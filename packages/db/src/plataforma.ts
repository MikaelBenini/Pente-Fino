// Administração do sistema (Etapa 15.1): leitura entre contas só pelas funções do banco
// (migração "plataforma"), com o usuário de banco da plataforma. Nunca dado de cliente.
import type { PrismaClient } from './generated/prisma/client.js';

export interface LinhaContaPlataforma {
  id: string;
  nome: string;
  plano: 'basico' | 'pro' | 'premium';
  ciclo: 'mensal' | 'anual';
  status: 'teste' | 'ativa' | 'suspensa' | 'cancelada';
  criado_em: Date;
  teste_ate: Date | null;
  configurada_em: Date | null;
  cobranca_automatica: boolean;
  cancelada_em: Date | null;
  motivo_cancelamento: string | null;
  vendedor_id: string | null;
  precos_desde: Date | null;
  cupom: string | null;
  desconto_bp: number;
  dono_ativou: boolean;
  unidades: number;
  profissionais: number;
  whatsapp_conectado: boolean;
  fechadas_7_dias: number;
  ultima_fechada_em: Date | null;
  /** Última renovação de sessão de alguém da conta (uso do app). */
  ultimo_acesso_em: Date | null;
}

/** Todas as contas, das mais novas para as mais antigas (plataforma_contas()). */
export function contasDaPlataforma(prisma: PrismaClient): Promise<LinhaContaPlataforma[]> {
  return prisma.$queryRaw<LinhaContaPlataforma[]>`SELECT * FROM plataforma_contas()`;
}

export interface LinhaFaturaPlataforma {
  conta_id: string;
  plano: 'basico' | 'pro' | 'premium';
  ciclo: 'mensal' | 'anual';
  valor: number;
  status: 'aberta' | 'paga' | 'recusada' | 'cancelada';
  origem: 'asaas' | 'manual';
  forma: 'pix' | 'cartao' | 'boleto' | 'dinheiro' | 'transferencia' | null;
  vencimento: Date;
  paga_em: Date | null;
}

/** Faturas das assinaturas de todas as contas (plataforma_faturas()). */
export function faturasDaPlataforma(prisma: PrismaClient): Promise<LinhaFaturaPlataforma[]> {
  return prisma.$queryRaw<LinhaFaturaPlataforma[]>`SELECT * FROM plataforma_faturas()`;
}

// ─── Ações da administração numa conta (funções SECURITY DEFINER) ─────────

/** Ficha da conta (jsonb de plataforma_conta); null se não existe. */
export async function fichaDaContaPlataforma(
  prisma: PrismaClient,
  contaId: string,
): Promise<Record<string, unknown> | null> {
  const [r] = await prisma.$queryRaw<{ ficha: Record<string, unknown> | null }[]>`
    SELECT plataforma_conta(${contaId}::uuid) AS ficha`;
  return r?.ficha ?? null;
}

export async function mudarPlanoDaConta(
  prisma: PrismaClient,
  contaId: string,
  plano: string,
  ciclo: string,
): Promise<{ plano: string; ciclo: string; asaasAssinaturaId: string | null; unidades: number }> {
  const [r] = await prisma.$queryRaw<{ antes: never }[]>`
    SELECT plataforma_mudar_plano(${contaId}::uuid, ${plano}::plano, ${ciclo}::ciclo_cobranca) AS antes`;
  return r!.antes;
}

export async function mudarTesteDaConta(
  prisma: PrismaClient,
  contaId: string,
  ate: Date,
): Promise<{ status: string; testeAte: string | null }> {
  const [r] = await prisma.$queryRaw<{ antes: never }[]>`
    SELECT plataforma_mudar_teste(${contaId}::uuid, ${ate}::timestamptz) AS antes`;
  return r!.antes;
}

export async function mudarSituacaoDaConta(
  prisma: PrismaClient,
  contaId: string,
  status: 'ativa' | 'suspensa' | 'cancelada',
  motivo: string,
): Promise<{ status: string; testeAte: string | null; canceladaEm: string | null }> {
  const [r] = await prisma.$queryRaw<{ antes: never }[]>`
    SELECT plataforma_mudar_situacao(${contaId}::uuid, ${status}::status_conta, ${motivo}) AS antes`;
  return r!.antes;
}

export async function registrarPagamentoManual(
  prisma: PrismaClient,
  d: {
    contaId: string;
    valor: number;
    forma: string;
    pagaEm: Date;
    inicio: string;
    fim: string;
    recebidoPorId: string;
    comprovante: string | null;
  },
): Promise<{ faturaId: string; statusAntes: string; plano: string; ciclo: string }> {
  const [r] = await prisma.$queryRaw<{ r: never }[]>`
    SELECT plataforma_registrar_pagamento(
      ${d.contaId}::uuid, ${d.valor}::int, ${d.forma}::forma_pagamento_fatura, ${d.pagaEm}::timestamptz,
      ${d.inicio}::date, ${d.fim}::date, ${d.recebidoPorId}::uuid, ${d.comprovante}
    ) AS r`;
  return r!.r;
}

// ─── Configurações do sistema ─────────────────────────────────────────────

/** Chaves públicas (aviso geral, teste) como JSON cru; a aplicação valida com o esquema. */
export async function configuracaoDoSistema(prisma: PrismaClient): Promise<unknown> {
  const [r] = await prisma.$queryRaw<{ c: unknown }[]>`SELECT configuracao_do_sistema() AS c`;
  return r?.c ?? {};
}

export function conexoesCaidasPlataforma(prisma: PrismaClient) {
  return prisma.$queryRaw<
    { conta_id: string; conta: string; unidade: string; numero: string | null; caiu_em: Date }[]
  >`SELECT * FROM plataforma_conexoes_caidas()`;
}

/** Configuração do SMTP guardada pela administração (senha cifrada); null = usar o .env. */
export async function configuracaoSmtp(prisma: PrismaClient): Promise<unknown> {
  const [r] = await prisma.$queryRaw<{ c: unknown }[]>`SELECT configuracao_smtp() AS c`;
  return r?.c ?? null;
}

/** O cupom com esse código (cru, a aplicação valida) e quantas contas já usaram. */
export async function cupomParaCadastro(
  prisma: PrismaClient,
  codigo: string,
): Promise<{ cupom: unknown; usados: number }> {
  const [r] = await prisma.$queryRaw<{ r: { cupom: unknown; usados: number } }[]>`
    SELECT cupom_para_cadastro(${codigo}) AS r`;
  return { cupom: r?.r.cupom ?? null, usados: Number(r?.r.usados ?? 0) };
}
