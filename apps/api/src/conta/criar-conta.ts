// Criação de uma conta nova com o dono (cadastro pelo site e "Abrir outro negócio"): conta,
// unidade principal, usuário dono, papel, modelos iniciais (categorias de despesa, mensagens e
// menu do bot no vocabulário do segmento) e a auditoria. Roda dentro de naConta(contaId).
import { aplicarModelosIniciais, type Prisma, type Transacao } from '@pente-fino/db';
import {
  dataLocal,
  gerarSlug,
  type Ciclo,
  type Licenca,
  type PlanoConta,
  type Segmento,
} from '@pente-fino/shared';
import { randomBytes } from 'node:crypto';
import { auditar } from '../auditoria/auditoria.js';

export interface ContaNova {
  contaId: string;
  nome: string;
  plano: PlanoConta;
  ciclo: Ciclo;
  licenca: Licenca;
  segmento: Segmento;
  automacoesContratadas: boolean;
  testeAte: Date;
  cupom: string | null;
  descontoBp: number;
  indicadoPor?: string | null;
  origem?: Prisma.InputJsonValue;
  aceiteTermos: string;
  dono: {
    nome: string;
    email: string;
    senhaHash: string | null;
    emailConfirmadoEm: Date | null;
    telefone: string | null;
  };
  /** O que mais vai para a auditoria (de onde veio). */
  auditoria?: Record<string, unknown>;
}

export async function criarContaComDono(
  tx: Transacao,
  d: ContaNova,
): Promise<{ donoId: string; unidadeId: string }> {
  await tx.conta.create({
    data: {
      id: d.contaId,
      nome: d.nome,
      plano: d.plano,
      licenca: d.licenca,
      segmento: d.segmento,
      ciclo: d.ciclo,
      automacoesContratadas: d.automacoesContratadas,
      indicadoPor: d.indicadoPor ?? null,
      status: 'teste',
      testeAte: d.testeAte,
      precosDesde: new Date(`${dataLocal(new Date())}T00:00:00Z`),
      cupom: d.cupom,
      descontoBp: d.descontoBp,
      ...(d.origem ? { origem: d.origem } : {}),
    },
  });
  const unidade = await tx.unidade.create({
    data: {
      nome: 'Unidade principal',
      capacidade: 2,
      slug: `${gerarSlug(d.nome).slice(0, 50) || 'agenda'}-${randomBytes(2).toString('hex')}`,
    },
  });
  const dono = await tx.usuario.create({ data: d.dono });
  await tx.papelUsuario.create({ data: { usuarioId: dono.id, papel: 'dono', unidadeId: null } });
  // Categorias de despesa, mensagens e menu do bot; os serviços vêm da configuração guiada.
  await aplicarModelosIniciais(tx, {
    unidadeIds: [unidade.id],
    vigenciaInicio: dataLocal(new Date()),
    incluirServicos: false,
  });
  await auditar(
    tx,
    {
      entidade: 'conta',
      entidadeId: d.contaId,
      acao: 'criar',
      depois: {
        nome: d.nome,
        plano: d.plano,
        ciclo: d.ciclo,
        licenca: d.licenca,
        aceiteTermos: d.aceiteTermos,
        ...d.auditoria,
      },
    },
    dono.id,
  );
  return { donoId: dono.id, unidadeId: unidade.id };
}
