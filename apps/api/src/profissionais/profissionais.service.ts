import { Inject, Injectable } from '@nestjs/common';
import type { Transacao } from '@pente-fino/db';
import {
  dataLocal,
  temAlgumPapel,
  verificarLimite,
  type BloqueioEntrada,
  type HorariosEntrada,
  type NovaRegraComissaoEntrada,
  type NovoProfissionalEntrada,
  type ProfissionalDetalhe,
} from '@pente-fino/shared';
import type { z } from 'zod';
import type { profissionalParcialSchema } from '@pente-fino/shared';
import { auditar } from '../auditoria/auditoria.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { Erros } from '../comum/erros.js';
import { data, dataTexto, exigirUnidade, filtroUnidade, GESTAO, TODOS } from '../comum/escopo.js';
import { ConvitesService } from '../usuarios/convites.service.js';

const INCLUIR = {
  usuario: true,
  horarios: true,
  regrasComissao: { orderBy: { vigenciaInicio: 'desc' as const } },
};

type ComInclusoes = Awaited<ReturnType<Transacao['profissional']['findFirstOrThrow']>> & {
  usuario: { nome: string; email: string; senhaHash: string | null };
  horarios: { diaSemana: number; inicioMin: number; fimMin: number }[];
  regrasComissao: {
    id: string;
    tipoItem: 'servico' | 'produto';
    percentualBp: number | null;
    valorFixo: number | null;
    vigenciaInicio: Date;
  }[];
};

function detalhe(p: ComInclusoes, verRegras: boolean): ProfissionalDetalhe {
  return {
    id: p.id,
    usuarioId: p.usuarioId,
    nome: p.usuario.nome,
    email: p.usuario.email,
    pendente: p.usuario.senhaHash === null,
    unidadeId: p.unidadeId,
    dataEntrada: dataTexto(p.dataEntrada),
    dataSaida: p.dataSaida ? dataTexto(p.dataSaida) : null,
    ativo: p.ativo,
    horarios: p.horarios
      .map((h) => ({ diaSemana: h.diaSemana, inicioMin: h.inicioMin, fimMin: h.fimMin }))
      .sort((a, b) => a.diaSemana - b.diaSemana || a.inicioMin - b.inicioMin),
    regras: verRegras
      ? p.regrasComissao.map((r) => ({
          id: r.id,
          tipoItem: r.tipoItem,
          percentualBp: r.percentualBp,
          valorFixo: r.valorFixo,
          vigenciaInicio: dataTexto(r.vigenciaInicio),
        }))
      : [],
  };
}

@Injectable()
export class ProfissionaisService {
  constructor(
    @Inject(BancoService) private readonly banco: BancoService,
    @Inject(ConvitesService) private readonly convites: ConvitesService,
  ) {}

  private verRegras() {
    return temAlgumPapel(Contexto.usuario().papeis, GESTAO);
  }

  /** Dono/gestor/recepção: os da unidade. Barbeiro: só ele mesmo. */
  async listar(unidadeId?: string): Promise<ProfissionalDetalhe[]> {
    const quem = Contexto.usuario();
    const soEle = !temAlgumPapel(quem.papeis, ['dono', 'gestor', 'recepcao']);
    const lista = await this.banco.daConta((tx) =>
      tx.profissional.findMany({
        where: {
          ...(soEle ? { usuarioId: quem.id } : filtroUnidade(['dono', 'gestor', 'recepcao'])),
          ...(unidadeId ? { unidadeId } : {}),
        },
        include: INCLUIR,
        orderBy: [{ ativo: 'desc' }, { usuario: { nome: 'asc' } }],
      }),
    );
    return lista.map((p) => detalhe(p as ComInclusoes, this.verRegras()));
  }

  private async carregar(tx: Transacao, id: string, aceitos = GESTAO) {
    const p = await tx.profissional.findUnique({ where: { id }, include: INCLUIR });
    if (!p) throw Erros.naoEncontrado('Profissional não encontrado.');
    exigirUnidade(p.unidadeId, aceitos);
    return p as ComInclusoes;
  }

  private async exigirLimite(tx: Transacao) {
    const conta = await tx.conta.findUniqueOrThrow({ where: { id: Contexto.usuario().contaId } });
    const limite = verificarLimite(
      conta.plano,
      'profissionais',
      await tx.profissional.count({ where: { ativo: true } }),
    );
    if (limite) throw Erros.requisicaoInvalida('limite_plano', limite);
  }

  async criar(
    d: NovoProfissionalEntrada,
  ): Promise<ProfissionalDetalhe & { linkConvite?: string; linkWhatsapp?: string | null }> {
    exigirUnidade(d.unidadeId, GESTAO);
    await this.banco.daConta((tx) => this.exigirLimite(tx));

    let usuarioId = d.usuarioId;
    let convite: { linkConvite: string; linkWhatsapp: string | null } | undefined;
    if (!usuarioId) {
      const c = await this.convites.convidar({
        nome: d.nome!,
        email: d.email!,
        telefone: d.telefone
          ? d.telefone.replace(/\D/g, '').replace(/^(\d{10,11})$/, '55$1')
          : undefined,
        papel: 'barbeiro',
        unidadeId: d.unidadeId,
      });
      usuarioId = c.usuarioId;
      convite = { linkConvite: c.linkConvite, linkWhatsapp: c.linkWhatsapp };
    }

    const criado = await this.banco.daConta(async (tx) => {
      await this.exigirLimite(tx);
      const unidade = await tx.unidade.findUnique({ where: { id: d.unidadeId } });
      if (!unidade) throw Erros.naoEncontrado('Unidade não encontrada.');
      const usuario = await tx.usuario.findUnique({
        where: { id: usuarioId },
        include: { papeis: true },
      });
      if (!usuario) throw Erros.naoEncontrado('Usuário não encontrado.');
      if (await tx.profissional.findFirst({ where: { usuarioId, unidadeId: d.unidadeId } })) {
        throw Erros.conflito('Esta pessoa já é profissional nesta unidade.');
      }
      if (!usuario.papeis.some((p) => p.papel === 'barbeiro' && p.unidadeId === d.unidadeId)) {
        await tx.papelUsuario.create({
          data: { usuarioId: usuario.id, papel: 'barbeiro', unidadeId: d.unidadeId },
        });
      }
      const p = await tx.profissional.create({
        data: { usuarioId: usuario.id, unidadeId: d.unidadeId, dataEntrada: data(d.dataEntrada) },
      });
      // Expediente padrão: dias da unidade, das 9h às 19h. Ajustável depois.
      await tx.horarioProfissional.createMany({
        data: unidade.diasTrabalho.map((diaSemana) => ({
          profissionalId: p.id,
          diaSemana,
          inicioMin: 540,
          fimMin: 1140,
        })),
      });
      await tx.regraComissao.createMany({
        data: [
          {
            profissionalId: p.id,
            tipoItem: 'servico' as const,
            ...d.comissaoServico,
            vigenciaInicio: data(d.dataEntrada),
          },
          {
            profissionalId: p.id,
            tipoItem: 'produto' as const,
            ...d.comissaoProduto,
            vigenciaInicio: data(d.dataEntrada),
          },
        ],
      });
      await auditar(tx, {
        entidade: 'profissional',
        entidadeId: p.id,
        acao: 'criar',
        depois: {
          usuarioId: usuario.id,
          unidadeId: d.unidadeId,
          dataEntrada: d.dataEntrada,
          comissaoServico: d.comissaoServico,
          comissaoProduto: d.comissaoProduto,
        },
      });
      return this.carregar(tx, p.id);
    });
    return { ...detalhe(criado, true), ...convite };
  }

  async alterar(
    id: string,
    d: z.infer<typeof profissionalParcialSchema>,
  ): Promise<ProfissionalDetalhe> {
    return this.banco.daConta(async (tx) => {
      const antes = await this.carregar(tx, id);
      if (d.ativo === true && !antes.ativo) await this.exigirLimite(tx);
      const dataSaida =
        d.dataSaida === undefined ? undefined : d.dataSaida === null ? null : data(d.dataSaida);
      const ativo = d.ativo ?? (dataSaida ? false : undefined);
      await tx.profissional.update({
        where: { id },
        data: { dataEntrada: d.dataEntrada ? data(d.dataEntrada) : undefined, dataSaida, ativo },
      });
      await auditar(tx, {
        entidade: 'profissional',
        entidadeId: id,
        acao: 'alterar',
        antes: {
          dataEntrada: dataTexto(antes.dataEntrada),
          dataSaida: antes.dataSaida ? dataTexto(antes.dataSaida) : null,
          ativo: antes.ativo,
        },
        depois: d,
      });
      return detalhe(await this.carregar(tx, id), true);
    });
  }

  async definirHorarios(id: string, { horarios }: HorariosEntrada): Promise<ProfissionalDetalhe> {
    for (const [i, a] of horarios.entries()) {
      for (const b of horarios.slice(i + 1)) {
        if (a.diaSemana === b.diaSemana && a.inicioMin < b.fimMin && b.inicioMin < a.fimMin) {
          throw Erros.validacao([
            { campo: 'horarios', mensagem: 'Há dois horários se sobrepondo no mesmo dia.' },
          ]);
        }
      }
    }
    return this.banco.daConta(async (tx) => {
      await this.carregar(tx, id);
      await tx.horarioProfissional.deleteMany({ where: { profissionalId: id } });
      await tx.horarioProfissional.createMany({
        data: horarios.map((h) => ({ ...h, profissionalId: id })),
      });
      return detalhe(await this.carregar(tx, id), true);
    });
  }

  async novaRegra(id: string, d: NovaRegraComissaoEntrada): Promise<ProfissionalDetalhe> {
    if (d.vigenciaInicio < dataLocal(new Date())) {
      throw Erros.validacao([
        {
          campo: 'vigenciaInicio',
          mensagem: 'A nova regra vale de hoje em diante; o que já foi fechado não muda.',
        },
      ]);
    }
    return this.banco.daConta(async (tx) => {
      await this.carregar(tx, id);
      const regra = await tx.regraComissao.upsert({
        where: {
          profissionalId_tipoItem_vigenciaInicio: {
            profissionalId: id,
            tipoItem: d.tipoItem,
            vigenciaInicio: data(d.vigenciaInicio),
          },
        },
        create: {
          profissionalId: id,
          tipoItem: d.tipoItem,
          ...d.regra,
          vigenciaInicio: data(d.vigenciaInicio),
        },
        update: { ...d.regra },
      });
      await auditar(tx, {
        entidade: 'regra_comissao',
        entidadeId: regra.id,
        acao: 'definir',
        depois: d,
      });
      return detalhe(await this.carregar(tx, id), true);
    });
  }

  async bloqueios(id: string, de: string, ate: string) {
    return this.banco.daConta(async (tx) => {
      const p = await this.carregar(tx, id, TODOS);
      if (
        !temAlgumPapel(Contexto.usuario().papeis, ['dono', 'gestor', 'recepcao']) &&
        p.usuarioId !== Contexto.usuario().id
      ) {
        throw Erros.semPermissao();
      }
      const lista = await tx.bloqueioAgenda.findMany({
        where: {
          profissionalId: id,
          fim: { gt: new Date(`${de}T00:00:00-03:00`) },
          inicio: { lt: new Date(`${ate}T23:59:59-03:00`) },
        },
        orderBy: { inicio: 'asc' },
      });
      return lista.map((b) => ({
        id: b.id,
        inicio: b.inicio.toISOString(),
        fim: b.fim.toISOString(),
        motivo: b.motivo,
      }));
    });
  }

  async novoBloqueio(id: string, d: BloqueioEntrada) {
    return this.banco.daConta(async (tx) => {
      await this.carregar(tx, id, ['dono', 'gestor', 'recepcao']);
      const b = await tx.bloqueioAgenda.create({
        data: {
          profissionalId: id,
          inicio: new Date(d.inicio),
          fim: new Date(d.fim),
          motivo: d.motivo ?? null,
        },
      });
      return {
        id: b.id,
        inicio: b.inicio.toISOString(),
        fim: b.fim.toISOString(),
        motivo: b.motivo,
      };
    });
  }

  async removerBloqueio(id: string, bloqueioId: string) {
    await this.banco.daConta(async (tx) => {
      await this.carregar(tx, id, ['dono', 'gestor', 'recepcao']);
      const r = await tx.bloqueioAgenda.deleteMany({
        where: { id: bloqueioId, profissionalId: id },
      });
      if (r.count === 0) throw Erros.naoEncontrado('Bloqueio não encontrado.');
    });
  }
}
