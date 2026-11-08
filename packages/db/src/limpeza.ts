// Exclusão automática de dados (Etapa 15.4), chamada pela rotina diária do worker. Cada lote é
// uma transação curta dentro da conta (RLS de sempre); nada de DELETE gigante que trave a tabela.
import {
  DIAS_SEM_CONFIRMAR,
  DIAS_GUARDA,
  decidirLimpezaDaConta,
  emailPronto,
  formatarData,
  LOTE_LIMPEZA,
  type ChaveModeloEmail,
  type DecisaoLimpeza,
  type MotivoApagarConta,
  type TextoModeloEmail,
  type TipoLimpeza,
  type TrabalhoEmail,
} from '@pente-fino/shared';
import type { PrismaClient } from './generated/prisma/client.js';
import { naConta, type Transacao } from './index.js';

const DIA_MS = 86_400_000;

/** Todas as contas, de qualquer situação (a lista sai sem entrar em nenhuma conta). */
export async function contasParaLimpeza(
  prisma: PrismaClient,
): Promise<{ id: string; nome: string }[]> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.rotina', 'limpeza', true)`;
    return tx.conta.findMany({ select: { id: true, nome: true }, orderBy: { criadoEm: 'asc' } });
  });
}

/** Apaga em lotes até acabar; cada lote numa transação própria. */
async function emLotes(
  prisma: PrismaClient,
  contaId: string,
  lote: number,
  passo: (tx: Transacao, lote: number) => Promise<number>,
): Promise<number> {
  let total = 0;
  for (;;) {
    const n = await naConta(prisma, contaId, (tx) => passo(tx, lote));
    total += n;
    if (n < lote) return total;
  }
}

const ids = (linhas: { id: string }[]) => linhas.map((l) => l.id);

/**
 * O que sai de toda conta depois de 90 dias: conversas do bot, sessões do bot paradas, logins e
 * links vencidos, avisos lidos; avaliações perdem o comentário (a nota fica para a média).
 * Comandas, caixa e auditoria não saem (histórico financeiro).
 */
export async function limparDadosDaConta(
  prisma: PrismaClient,
  contaId: string,
  opcoes: { agora?: Date; lote?: number } = {},
): Promise<Partial<Record<TipoLimpeza, number>>> {
  const corte = new Date((opcoes.agora ?? new Date()).getTime() - DIAS_GUARDA * DIA_MS);
  const lote = opcoes.lote ?? LOTE_LIMPEZA;
  const apagar = (passo: (tx: Transacao, lote: number) => Promise<number>) =>
    emLotes(prisma, contaId, lote, passo);
  return {
    mensagens: await apagar(async (tx, take) => {
      const l = await tx.mensagem.findMany({
        where: { criadoEm: { lt: corte } },
        select: { id: true },
        take,
      });
      return (await tx.mensagem.deleteMany({ where: { id: { in: ids(l) } } })).count;
    }),
    sessoesBot: await apagar(async (tx, take) => {
      const l = await tx.botSessao.findMany({
        where: { atualizadoEm: { lt: corte } },
        select: { id: true },
        take,
      });
      return (await tx.botSessao.deleteMany({ where: { id: { in: ids(l) } } })).count;
    }),
    tokens: await apagar(async (tx, take) => {
      const l = await tx.tokenAcesso.findMany({
        where: { expiraEm: { lt: corte } },
        select: { id: true },
        take,
      });
      return (await tx.tokenAcesso.deleteMany({ where: { id: { in: ids(l) } } })).count;
    }),
    linksHorario: await apagar(async (tx, take) => {
      const l = await tx.linkHorario.findMany({
        where: { criadoEm: { lt: corte } },
        select: { id: true },
        take,
      });
      return (await tx.linkHorario.deleteMany({ where: { id: { in: ids(l) } } })).count;
    }),
    tokensAgendamento: await apagar(async (tx, take) => {
      const l = await tx.tokenAgendamento.findMany({
        where: { expiraEm: { lt: corte } },
        select: { id: true },
        take,
      });
      return (await tx.tokenAgendamento.deleteMany({ where: { id: { in: ids(l) } } })).count;
    }),
    avisosLidos: await apagar(async (tx, take) => {
      const l = await tx.aviso.findMany({
        where: { lidoEm: { lt: corte } },
        select: { id: true },
        take,
      });
      return (await tx.aviso.deleteMany({ where: { id: { in: ids(l) } } })).count;
    }),
    comentarios: await apagar(async (tx, take) => {
      const l = await tx.avaliacao.findMany({
        where: { criadoEm: { lt: corte }, comentario: { not: null } },
        select: { id: true },
        take,
      });
      return (
        await tx.avaliacao.updateMany({
          where: { id: { in: ids(l) } },
          data: { comentario: null },
        })
      ).count;
    }),
  };
}

export interface ContaNaLimpeza {
  decisao: DecisaoLimpeza;
  /** Por que a conta não pode sair agora, mesmo no prazo (cobrança ativa no Asaas). */
  retencao: string | null;
  donos: { nome: string; email: string }[];
}

/** Lê a conta e decide (avisar, apagar ou manter) com a regra de `decidirLimpezaDaConta`. */
export async function situacaoDaContaNaLimpeza(
  prisma: PrismaClient,
  contaId: string,
  agora = new Date(),
): Promise<ContaNaLimpeza | null> {
  return naConta(prisma, contaId, async (tx) => {
    const conta = await tx.conta.findUnique({ where: { id: contaId } });
    if (!conta) return null;
    const [pagas, semConfirmar, clubeOnline, donos] = await Promise.all([
      tx.faturaAssinatura.count({ where: { status: 'paga' } }),
      tx.usuario.count({
        where: { emailConfirmadoEm: null, papeis: { some: { papel: 'dono' } } },
      }),
      tx.assinaturaClubeOnline.count({ where: { status: { in: ['aguardando', 'ativa'] } } }),
      tx.usuario.findMany({
        where: { ativo: true, papeis: { some: { papel: 'dono' } } },
        select: { nome: true, email: true },
      }),
    ]);
    const decisao = decidirLimpezaDaConta(
      {
        status: conta.status,
        criadoEm: conta.criadoEm,
        testeAte: conta.testeAte,
        canceladaEm: conta.canceladaEm,
        temPagamento: pagas > 0,
        donoSemConfirmar: semConfirmar > 0,
      },
      agora,
    );
    // Apagar a conta com cobrança viva no Asaas deixaria alguém sendo cobrado sem sistema.
    const retencao = conta.asaasAssinaturaId
      ? 'Assinatura do sistema ainda ativa no Asaas: cancele lá antes.'
      : clubeOnline > 0
        ? `${clubeOnline} assinatura(s) do clube online ativa(s) no Asaas: cancele antes.`
        : null;
    return { decisao, retencao, donos };
  });
}

/** E-mails de aviso para os donos (conta sem confirmar ou conta parada). */
export function avisosDeExclusao(
  conta: string,
  c: ContaNaLimpeza,
  opcoes: { appUrl: string; modelos?: Partial<Record<ChaveModeloEmail, TextoModeloEmail>> },
): TrabalhoEmail[] {
  if (c.decisao.tipo !== 'avisar') return [];
  const { motivo, dias, apagaEm } = c.decisao;
  const data = formatarData(`${apagaEm}T12:00:00Z`);
  const chave: ChaveModeloEmail =
    motivo === 'sem_confirmar' ? 'conta_sem_confirmar' : 'conta_sera_apagada';
  const link =
    motivo === 'sem_confirmar'
      ? `${opcoes.appUrl}/entrar`
      : `${opcoes.appUrl}/configuracoes?aba=assinatura`;
  return c.donos.map((d) =>
    emailPronto(
      d.email,
      chave,
      opcoes.modelos ?? {},
      { nome: d.nome.split(' ')[0] ?? d.nome, conta, dias: String(dias), data },
      link,
      { site: opcoes.appUrl },
    ),
  );
}

/** Apaga a conta inteira (cascata) e registra na auditoria da plataforma que ela saiu. */
export async function apagarContaNaLimpeza(
  prisma: PrismaClient,
  contaId: string,
  nome: string,
  motivo: MotivoApagarConta,
): Promise<void> {
  await naConta(prisma, contaId, (tx) => tx.conta.deleteMany({ where: { id: contaId } }), {
    timeout: 60_000,
  });
  const texto =
    motivo === 'sem_confirmar'
      ? `E-mail não confirmado em ${DIAS_SEM_CONFIRMAR} dias`
      : 'Conta parada há 90 dias (cancelada ou teste vencido sem pagamento)';
  await prisma.$executeRaw`SELECT registrar_conta_apagada(${contaId}::uuid, ${nome}, ${texto})`;
}

/** Sessões da administração vencidas ou encerradas há mais de 90 dias. */
export async function limparSessoesDaAdministracao(
  prisma: PrismaClient,
  lote = LOTE_LIMPEZA,
): Promise<number> {
  let total = 0;
  for (;;) {
    const [r] = await prisma.$queryRaw<{ n: number }[]>`
      SELECT limpar_sessoes_plataforma(${DIAS_GUARDA}::int, ${lote}::int) AS n`;
    const n = Number(r?.n ?? 0);
    total += n;
    if (n < lote) return total;
  }
}
