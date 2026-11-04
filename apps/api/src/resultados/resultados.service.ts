import { Inject, Injectable } from '@nestjs/common';
import type { Transacao } from '@pente-fino/db';
import {
  calcularIndicadores,
  dataLocal,
  diasDeTrabalho,
  lucratividadePorServico,
  projetar,
  unidadesPermitidas,
  type ComandaFechada,
  type DespesaValor,
  type MetaDetalhe,
  type Papel,
  type Projecao,
  type RespostaIndicadores,
} from '@pente-fino/shared';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { Erros } from '../comum/erros.js';
import { data, dataTexto, exigirUnidade } from '../comum/escopo.js';

export function somarDias(d: string, n: number): string {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}
const inicioDoDia = (d: string) => new Date(`${d}T00:00:00-03:00`);
const diasEntre = (de: string, ate: string) =>
  Math.round(
    (new Date(`${ate}T12:00:00Z`).getTime() - new Date(`${de}T12:00:00Z`).getTime()) / 86_400_000,
  ) + 1;
export const ultimoDiaDoMes = (mes: string) =>
  somarDias(`${somarDias(`${mes}-01`, 32).slice(0, 7)}-01`, -1);

/** Unidades do escopo: a pedida (conferida) ou todas as que o papel alcança. */
export function escopoUnidades(
  unidadeId: string | undefined,
  aceitos: Papel[],
): { filtro: Record<string, unknown>; incluiConta: boolean } {
  if (unidadeId) {
    exigirUnidade(unidadeId, aceitos);
    return { filtro: { unidadeId }, incluiConta: false };
  }
  const alcance = unidadesPermitidas(Contexto.usuario().papeis, aceitos);
  return alcance === 'todas'
    ? { filtro: {}, incluiConta: true }
    : { filtro: { unidadeId: { in: alcance } }, incluiConta: false };
}

type ComandaComItens = ComandaFechada & {
  id: string;
  unidadeId: string;
  profissionalId: string;
  fechadaEm: Date | null;
};

@Injectable()
export class ResultadosService {
  constructor(@Inject(BancoService) private readonly banco: BancoService) {}

  /** Comandas fechadas no período (data do fechamento, em São Paulo). */
  async fechadas(
    tx: Transacao,
    de: string,
    ate: string,
    filtro: Record<string, unknown>,
  ): Promise<ComandaComItens[]> {
    const comandas = await tx.comanda.findMany({
      where: {
        ...filtro,
        status: 'fechada',
        fechadaEm: { gte: inicioDoDia(de), lt: inicioDoDia(somarDias(ate, 1)) },
      },
      include: { itens: true },
    });
    return comandas.map((c) => ({
      id: c.id,
      unidadeId: c.unidadeId,
      profissionalId: c.profissionalId,
      fechadaEm: c.fechadaEm,
      itens: c.itens,
    }));
  }

  /** Despesas cuja competência cai nos meses do período. Despesa da conta (sem unidade) só no escopo da rede. */
  async despesas(
    tx: Transacao,
    de: string,
    ate: string,
    filtro: Record<string, unknown>,
    incluiConta: boolean,
  ): Promise<DespesaValor[]> {
    const lista = await tx.despesa.findMany({
      where: {
        competencia: { gte: data(`${de.slice(0, 7)}-01`), lte: data(`${ate.slice(0, 7)}-01`) },
        ...(incluiConta ? {} : filtro),
      },
      include: { categoria: true },
    });
    return lista.map((d) => ({ grupo: d.categoria.grupo, valor: d.valor }));
  }

  async indicadores(
    unidadeId: string | undefined,
    de: string,
    ate: string,
  ): Promise<RespostaIndicadores> {
    if (diasEntre(de, ate) > 366)
      throw Erros.validacao([{ campo: 'ate', mensagem: 'Período de até um ano.' }]);
    const { filtro, incluiConta } = escopoUnidades(unidadeId, ['dono', 'gestor']);
    const n = diasEntre(de, ate);
    const antDe = somarDias(de, -n);
    const antAte = somarDias(de, -1);
    return this.banco.daConta(async (tx) => {
      if (unidadeId && !(await tx.unidade.findUnique({ where: { id: unidadeId } })))
        throw Erros.naoEncontrado('Unidade não encontrada.');
      const [atuais, anteriores, despAtual, despAnterior] = await Promise.all([
        this.fechadas(tx, de, ate, filtro),
        this.fechadas(tx, antDe, antAte, filtro),
        this.despesas(tx, de, ate, filtro, incluiConta),
        this.despesas(tx, antDe, antAte, filtro, incluiConta),
      ]);
      const atual = calcularIndicadores(atuais, despAtual);
      const hoje = dataLocal(new Date());
      const mesCorrente = de === `${hoje.slice(0, 7)}-01` && ate >= hoje;
      return {
        de,
        ate,
        atual,
        anterior: calcularIndicadores(anteriores, despAnterior),
        projecao: mesCorrente
          ? await this.projecao(tx, hoje.slice(0, 7), hoje, filtro, atuais)
          : null,
      };
    });
  }

  /** Projeção somando unidade por unidade, cada uma com o próprio calendário. */
  async projecao(
    tx: Transacao,
    mes: string,
    hoje: string,
    filtro: Record<string, unknown>,
    fechadas: ComandaComItens[],
  ): Promise<Projecao> {
    const unidades = await tx.unidade.findMany({
      where: {
        ativa: true,
        ...(filtro.unidadeId ? { id: filtro.unidadeId as string | { in: string[] } } : {}),
      },
    });
    let projecao = 0;
    let diasDoMes = 0;
    let diasTrabalhados = 0;
    for (const u of unidades) {
      const excecoes = await tx.calendarioUnidade.findMany({
        where: {
          unidadeId: u.id,
          data: { gte: data(`${mes}-01`), lte: data(ultimoDiaDoMes(mes)) },
        },
      });
      const dias = diasDeTrabalho(
        mes,
        u.diasTrabalho,
        excecoes.map((e) => ({ data: dataTexto(e.data), trabalha: e.trabalha })),
      );
      const faturamento = calcularIndicadores(
        fechadas.filter((c) => c.unidadeId === u.id),
      ).faturamento;
      const p = projetar(faturamento, dias, hoje);
      projecao += p.projecao;
      diasDoMes += p.diasDoMes;
      diasTrabalhados += p.diasTrabalhados;
    }
    return {
      projecao,
      diasDoMes,
      diasTrabalhados,
      fracaoDoMes: diasDoMes > 0 ? diasTrabalhados / diasDoMes : 0,
    };
  }

  async lucratividade(unidadeId: string | undefined, de: string, ate: string) {
    const { filtro } = escopoUnidades(unidadeId, ['dono', 'gestor']);
    return this.banco.daConta(async (tx) => {
      const lista = lucratividadePorServico(await this.fechadas(tx, de, ate, filtro));
      const nomes = new Map(
        (await tx.servico.findMany({ where: { id: { in: lista.map((l) => l.servicoId) } } })).map(
          (s) => [s.id, s.nome],
        ),
      );
      return { servicos: lista.map((l) => ({ ...l, nome: nomes.get(l.servicoId) ?? 'Serviço' })) };
    });
  }

  /** Metas do mês com o atual calculado das comandas fechadas. */
  async metas(tx: Transacao, mes: string, filtro: Record<string, unknown>): Promise<MetaDetalhe[]> {
    const metas = await tx.meta.findMany({
      where: { ...filtro, mes: data(`${mes}-01`) },
      include: { servico: true },
    });
    if (metas.length === 0) return [];
    const fim = ultimoDiaDoMes(mes);
    const fechadas = await this.fechadas(tx, `${mes}-01`, fim, filtro);
    const hoje = dataLocal(new Date());
    const r: MetaDetalhe[] = [];
    for (const m of metas) {
      const daUnidade = fechadas.filter((c) => c.unidadeId === m.unidadeId);
      const atual =
        m.tipo === 'faturamento'
          ? calcularIndicadores(daUnidade).faturamento
          : daUnidade
              .flatMap((c) => c.itens)
              .filter((i) => i.servicoId === m.servicoId)
              .reduce((s, i) => s + i.quantidade, 0);
      const unidade = await tx.unidade.findUniqueOrThrow({ where: { id: m.unidadeId } });
      const excecoes = await tx.calendarioUnidade.findMany({
        where: { unidadeId: m.unidadeId, data: { gte: data(`${mes}-01`), lte: data(fim) } },
      });
      const dias = diasDeTrabalho(
        mes,
        unidade.diasTrabalho,
        excecoes.map((e) => ({ data: dataTexto(e.data), trabalha: e.trabalha })),
      );
      r.push({
        id: m.id,
        unidadeId: m.unidadeId,
        mes,
        tipo: m.tipo,
        servicoId: m.servicoId,
        servico: m.servico?.nome ?? null,
        objetivo: m.objetivo,
        atual,
        fracaoDoMes: projetar(0, dias, hoje < `${mes}-01` ? `${mes}-00` : hoje).fracaoDoMes,
      });
    }
    return r;
  }
}
