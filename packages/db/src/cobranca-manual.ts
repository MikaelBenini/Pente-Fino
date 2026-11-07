// Avisos da assinatura por e-mail (Etapa 15.1), na rotina diária do worker: fim do teste (3 dias
// antes), próxima cobrança da conta manual (7 dias antes, criando a cobrança em aberto) e cobrança
// vencida (no dia seguinte ao vencimento). Os textos vêm dos modelos de e-mail.
import {
  dataLocal,
  diasRestantesTeste,
  emailPronto,
  formatarData,
  formatarMoeda,
  proximaCobrancaManual,
  type ChaveModeloEmail,
  type TextoModeloEmail,
  type TrabalhoEmail,
} from '@pente-fino/shared';
import type { PrismaClient } from './generated/prisma/client.js';
import { naConta } from './index.js';

/** Aviso de fim do teste sai quando faltam estes dias. */
export const AVISO_FIM_TESTE_DIAS = 3;

/** Contas em teste ou ativas (a lista sai sem entrar em nenhuma conta). */
export async function contasParaAvisosDaAssinatura(prisma: PrismaClient): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.rotina', 'assinatura', true)`;
    const contas = await tx.conta.findMany({ select: { id: true } });
    return contas.map((c) => c.id);
  });
}

const dia = (d: Date) => d.toISOString().slice(0, 10);
const somarDias = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const ddmmaaaa = (iso: string) => formatarData(`${iso}T12:00:00Z`);

/**
 * Os avisos de hoje para os donos da conta (e a cobrança manual em aberto, se for a hora).
 * Cada aviso cai num dia só (3 dias antes, 7 dias antes, 1 dia depois), então não repete.
 */
export async function rotinaAvisosDaAssinatura(
  prisma: PrismaClient,
  contaId: string,
  opcoes: {
    agora?: Date;
    appUrl?: string;
    modelos?: Partial<Record<ChaveModeloEmail, TextoModeloEmail>>;
  } = {},
): Promise<TrabalhoEmail[]> {
  const agora = opcoes.agora ?? new Date();
  const modelos = opcoes.modelos ?? {};
  const linkAssinatura = `${opcoes.appUrl ?? ''}/configuracoes?aba=assinatura`;
  return naConta(prisma, contaId, async (tx) => {
    const conta = await tx.conta.findUnique({ where: { id: contaId } });
    if (!conta || (conta.status !== 'teste' && conta.status !== 'ativa')) return [];
    const hoje = dataLocal(agora);
    const faturas = await tx.faturaAssinatura.findMany({
      select: { status: true, periodoFim: true, vencimento: true, valor: true },
    });
    const donos = await tx.usuario.findMany({
      where: { ativo: true, papeis: { some: { papel: 'dono' } } },
      select: { nome: true, email: true },
    });
    const avisar = (chave: ChaveModeloEmail, vars: Record<string, string>, link?: string) =>
      donos.map((d) =>
        emailPronto(
          d.email,
          chave,
          modelos,
          { nome: d.nome.split(' ')[0] ?? d.nome, conta: conta.nome, ...vars },
          link,
        ),
      );
    const saida: TrabalhoEmail[] = [];

    // Fim do teste (quem nunca pagou).
    const pagou = faturas.some((f) => f.status === 'paga');
    if (conta.status === 'teste' && conta.testeAte && !pagou) {
      const faltam = diasRestantesTeste(conta.testeAte, agora);
      if (faltam === AVISO_FIM_TESTE_DIAS)
        saida.push(
          ...avisar(
            'fim_teste',
            { dias: String(faltam), data: formatarData(conta.testeAte) },
            linkAssinatura,
          ),
        );
    }

    // Cobrança vencida ontem e ainda não paga (automática ou manual).
    const ontem = somarDias(hoje, -1);
    for (const f of faturas)
      if ((f.status === 'aberta' || f.status === 'recusada') && dia(f.vencimento) === ontem)
        saida.push(
          ...avisar(
            'cobranca_vencida',
            { vencimento: ddmmaaaa(ontem), valor: formatarMoeda(f.valor) },
            linkAssinatura,
          ),
        );

    // Conta manual: próxima cobrança em aberto 7 dias antes, com o aviso.
    if (conta.status === 'ativa' && !conta.asaasAssinaturaId) {
      const nova = proximaCobrancaManual({
        faturas: faturas.map((f) => ({ status: f.status, periodoFim: dia(f.periodoFim) })),
        hoje,
        plano: conta.plano,
        ciclo: conta.ciclo,
        unidades: await tx.unidade.count({ where: { ativa: true } }),
      });
      if (nova) {
        await tx.faturaAssinatura.create({
          data: {
            plano: conta.plano,
            ciclo: conta.ciclo,
            valor: nova.valor,
            vencimento: new Date(`${nova.vencimento}T00:00:00Z`),
            periodoInicio: new Date(`${nova.periodoInicio}T00:00:00Z`),
            periodoFim: new Date(`${nova.periodoFim}T00:00:00Z`),
            status: 'aberta',
            origem: 'manual',
          },
        });
        saida.push(
          ...avisar('cobranca_aviso', {
            vencimento: ddmmaaaa(nova.vencimento),
            valor: formatarMoeda(nova.valor),
          }),
        );
      }
    }
    return saida;
  });
}
