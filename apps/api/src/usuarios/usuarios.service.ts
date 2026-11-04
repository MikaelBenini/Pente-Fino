import { Inject, Injectable } from '@nestjs/common';
import type { Transacao } from '@pente-fino/db';
import {
  podeNaUnidade,
  unidadesPermitidas,
  type PapeisUsuarioEntrada,
  type PapelAtribuido,
  type UsuarioEquipe,
} from '@pente-fino/shared';
import { auditar } from '../auditoria/auditoria.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { Erros } from '../comum/erros.js';

const PAPEIS_DO_GESTOR = new Set(['recepcao', 'barbeiro']);

@Injectable()
export class UsuariosService {
  constructor(@Inject(BancoService) private readonly banco: BancoService) {}

  /** Dono vê todos; gestor vê quem tem papel na(s) unidade(s) dele. */
  listar(): Promise<UsuarioEquipe[]> {
    const alcance = unidadesPermitidas(Contexto.usuario().papeis, ['dono', 'gestor']);
    return this.banco.daConta(async (tx) => {
      const usuarios = await tx.usuario.findMany({
        where: alcance === 'todas' ? {} : { papeis: { some: { unidadeId: { in: alcance } } } },
        include: { papeis: true },
        orderBy: { nome: 'asc' },
      });
      return usuarios.map((u) => ({
        id: u.id,
        nome: u.nome,
        email: u.email,
        telefone: u.telefone,
        ativo: u.ativo,
        pendente: u.senhaHash === null,
        papeis: u.papeis.map((p) => ({ papel: p.papel, unidadeId: p.unidadeId })),
      }));
    });
  }

  /**
   * O gestor só mexe em recepção e barbeiro das unidades dele, e só se a pessoa não
   * tiver papel fora do alcance dele (não rebaixa um dono, não mexe em outra unidade).
   */
  private exigirAlcance(atuais: PapelAtribuido[], novos: PapelAtribuido[] = []) {
    const quem = Contexto.usuario();
    if (quem.papeis.some((p) => p.papel === 'dono' && p.unidadeId === null)) return;
    for (const p of [...atuais, ...novos]) {
      const ok =
        PAPEIS_DO_GESTOR.has(p.papel) &&
        p.unidadeId !== null &&
        podeNaUnidade(quem.papeis, p.unidadeId, ['gestor']);
      if (!ok) throw Erros.semPermissao('Seu papel só altera recepção e barbeiros da sua unidade.');
    }
  }

  private async exigirOutroDono(tx: Transacao, usuarioId: string) {
    const outros = await tx.papelUsuario.count({
      where: {
        papel: 'dono',
        unidadeId: null,
        usuarioId: { not: usuarioId },
        usuario: { ativo: true },
      },
    });
    if (outros === 0) throw Erros.conflito('A conta precisa de pelo menos um dono ativo.');
  }

  private async revogarSessoes(tx: Transacao, usuarioId: string) {
    await tx.tokenAcesso.updateMany({
      where: { usuarioId, tipo: 'renovacao', revogadoEm: null },
      data: { revogadoEm: new Date() },
    });
  }

  async definirPapeis(usuarioId: string, { papeis }: PapeisUsuarioEntrada): Promise<UsuarioEquipe> {
    if (usuarioId === Contexto.usuario().id)
      throw Erros.conflito('Você não pode alterar os seus próprios papéis.');
    const unicos = [...new Map(papeis.map((p) => [`${p.papel}|${p.unidadeId}`, p])).values()];
    for (const p of unicos) {
      if (p.papel !== 'dono' && p.unidadeId === null) {
        throw Erros.validacao([
          { campo: 'papeis', mensagem: 'Só o dono vale em todas as unidades. Escolha a unidade.' },
        ]);
      }
    }

    await this.banco.daConta(async (tx) => {
      const usuario = await tx.usuario.findUnique({
        where: { id: usuarioId },
        include: { papeis: true },
      });
      if (!usuario) throw Erros.naoEncontrado('Usuário não encontrado.');
      const atuais = usuario.papeis.map((p) => ({ papel: p.papel, unidadeId: p.unidadeId }));
      this.exigirAlcance(atuais, unicos);

      const unidades = unicos.map((p) => p.unidadeId).filter((id): id is string => id !== null);
      if (
        unidades.length &&
        (await tx.unidade.count({ where: { id: { in: unidades } } })) !== new Set(unidades).size
      ) {
        throw Erros.naoEncontrado('Unidade não encontrada.');
      }
      const eraDono = atuais.some((p) => p.papel === 'dono');
      const seraDono = unicos.some((p) => p.papel === 'dono');
      if (eraDono && !seraDono) await this.exigirOutroDono(tx, usuarioId);

      await tx.papelUsuario.deleteMany({ where: { usuarioId } });
      await tx.papelUsuario.createMany({
        data: unicos.map((p) => ({ usuarioId, papel: p.papel, unidadeId: p.unidadeId })),
      });
      await this.revogarSessoes(tx, usuarioId);
      await auditar(tx, {
        entidade: 'usuario',
        entidadeId: usuarioId,
        acao: 'alterar_papeis',
        antes: atuais,
        depois: unicos,
      });
    });
    return this.buscar(usuarioId);
  }

  async definirSituacao(usuarioId: string, ativo: boolean): Promise<UsuarioEquipe> {
    if (usuarioId === Contexto.usuario().id)
      throw Erros.conflito('Você não pode desativar o seu próprio acesso.');
    await this.banco.daConta(async (tx) => {
      const usuario = await tx.usuario.findUnique({
        where: { id: usuarioId },
        include: { papeis: true },
      });
      if (!usuario) throw Erros.naoEncontrado('Usuário não encontrado.');
      this.exigirAlcance(usuario.papeis.map((p) => ({ papel: p.papel, unidadeId: p.unidadeId })));
      if (!ativo && usuario.papeis.some((p) => p.papel === 'dono'))
        await this.exigirOutroDono(tx, usuarioId);
      await tx.usuario.update({ where: { id: usuarioId }, data: { ativo } });
      if (!ativo) {
        await this.revogarSessoes(tx, usuarioId);
        await tx.tokenAcesso.updateMany({
          where: {
            usuarioId,
            tipo: { in: ['convite', 'redefinir_senha'] },
            usadoEm: null,
            revogadoEm: null,
          },
          data: { revogadoEm: new Date() },
        });
      }
      await auditar(tx, {
        entidade: 'usuario',
        entidadeId: usuarioId,
        acao: ativo ? 'reativar' : 'desativar',
        antes: { ativo: usuario.ativo },
        depois: { ativo },
      });
    });
    return this.buscar(usuarioId);
  }

  private async buscar(id: string): Promise<UsuarioEquipe> {
    const lista = await this.listar();
    const u = lista.find((x) => x.id === id);
    if (!u) throw Erros.naoEncontrado('Usuário não encontrado.');
    return u;
  }
}
