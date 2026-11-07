// Cobrança manual (Etapa 15.1): a rotina diária cria a próxima cobrança em aberto das contas sem
// Asaas e devolve os e-mails de aviso para o worker mandar. A regra está em packages/shared.
import {
  dataLocal,
  emailCobrancaManual,
  proximaCobrancaManual,
  type TrabalhoEmail,
} from '@pente-fino/shared';
import type { PrismaClient } from './generated/prisma/client.js';
import { naConta } from './index.js';

/** Contas de cobrança manual em uso (a lista sai sem entrar em nenhuma conta). */
export async function contasComCobrancaManual(prisma: PrismaClient): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.rotina', 'cobranca_manual', true)`;
    const contas = await tx.conta.findMany({ select: { id: true } });
    return contas.map((c) => c.id);
  });
}

const dia = (d: Date) => d.toISOString().slice(0, 10);

/** Cria a próxima cobrança manual, se for a hora, e devolve os avisos para os donos. */
export async function rotinaCobrancaManual(
  prisma: PrismaClient,
  contaId: string,
  agora = new Date(),
): Promise<TrabalhoEmail[]> {
  return naConta(prisma, contaId, async (tx) => {
    const conta = await tx.conta.findUnique({ where: { id: contaId } });
    if (!conta || conta.asaasAssinaturaId || conta.status !== 'ativa') return [];
    const faturas = await tx.faturaAssinatura.findMany({
      select: { status: true, periodoFim: true },
    });
    const nova = proximaCobrancaManual({
      faturas: faturas.map((f) => ({ status: f.status, periodoFim: dia(f.periodoFim) })),
      hoje: dataLocal(agora),
      plano: conta.plano,
      ciclo: conta.ciclo,
      unidades: await tx.unidade.count({ where: { ativa: true } }),
    });
    if (!nova) return [];
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
    const donos = await tx.usuario.findMany({
      where: { ativo: true, papeis: { some: { papel: 'dono' } } },
      select: { nome: true, email: true },
    });
    return donos.map((d) => {
      const e = emailCobrancaManual({ nome: d.nome, conta: conta.nome, cobranca: nova });
      return { para: d.email, assunto: e.assunto, texto: e.texto };
    });
  });
}
