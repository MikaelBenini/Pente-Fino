// Administração do sistema (Etapa 15.1): leitura entre contas só pelas funções do banco
// (migração "plataforma"), com o usuário de banco da plataforma. Nunca dado de cliente.
import type { ContaNoFunil } from '@pente-fino/shared';
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
  /** Conta da própria equipe: fora das métricas e da cobrança (admin R5). */
  interna: boolean;
  cortesia_ate: Date | null;
  cobrar_a_partir_de: Date | null;
  /** De onde veio o cadastro (parâmetros de campanha), admin F2. */
  origem: unknown;
  /** Quantos dos 8 primeiros passos do tutorial a barbearia fez (admin U2). */
  ativacao: number;
}

/** Todas as contas, das mais novas para as mais antigas (plataforma_contas()). */
export function contasDaPlataforma(prisma: PrismaClient): Promise<LinhaContaPlataforma[]> {
  return prisma.$queryRaw<LinhaContaPlataforma[]>`SELECT * FROM plataforma_contas()`;
}

/** Admin F1: por conta, quais etapas do funil de ativação a barbearia já fez. */
export interface LinhaFunilPlataforma {
  id: string;
  criado_em: Date;
  interna: boolean;
  servicos: boolean;
  barbeiros: boolean;
  agendamento: boolean;
  comanda: boolean;
  whatsapp: boolean;
  pagamento: boolean;
}

export async function funilDasContas(prisma: PrismaClient): Promise<ContaNoFunil[]> {
  const linhas = await prisma.$queryRaw<LinhaFunilPlataforma[]>`SELECT * FROM plataforma_funil()`;
  return linhas.map(({ criado_em, ...l }) => ({ ...l, criadoEm: criado_em.toISOString() }));
}

/** A etapa do funil de uma conta (ficha da conta); undefined se a conta não existe. */
export async function funilDaConta(
  prisma: PrismaClient,
  contaId: string,
): Promise<ContaNoFunil | undefined> {
  const [l] = await prisma.$queryRaw<LinhaFunilPlataforma[]>`
    SELECT * FROM plataforma_funil() WHERE id = ${contaId}::uuid`;
  return l && { ...l, criadoEm: l.criado_em.toISOString() };
}

// ─── Alertas da equipe (admin F3) ─────────────────────────────────────────

/** WhatsApp caído (sem o dono pedir) e ainda desconectado, em todas as contas. */
export async function whatsappCaidoDaPlataforma(
  prisma: PrismaClient,
): Promise<{ contaId: string; conta: string; caiuEm: string }[]> {
  const linhas = await prisma.$queryRaw<{ conta_id: string; conta: string; caiu_em: Date }[]>`
    SELECT * FROM plataforma_whatsapp_caido()`;
  return linhas.map((l) => ({
    contaId: l.conta_id,
    conta: l.conta,
    caiuEm: l.caiu_em.toISOString(),
  }));
}

/** Quem da equipe recebe alertas: ativo e com pelo menos um tipo escolhido. */
export function equipeParaAlertas(prisma: PrismaClient) {
  return prisma.usuarioPlataforma.findMany({
    where: { ativo: true, NOT: { alertas: { isEmpty: true } } },
    select: { email: true, nome: true, alertas: true },
  });
}

/**
 * Grava os alertas como enviados e devolve só os que ainda não tinham saído (a chave primária
 * tipo + chave garante uma vez só, mesmo com duas rotinas ao mesmo tempo).
 */
export async function guardarAlertasNovos<A extends { tipo: string; chave: string }>(
  prisma: PrismaClient,
  alertas: readonly A[],
): Promise<A[]> {
  if (alertas.length === 0) return [];
  const novos = new Set<string>();
  for (const a of alertas) {
    const r = await prisma.$executeRaw`
      INSERT INTO alerta_equipe_enviado (tipo, chave) VALUES (${a.tipo}, ${a.chave})
      ON CONFLICT DO NOTHING`;
    if (r > 0) novos.add(`${a.tipo}\u0000${a.chave}`);
  }
  return alertas.filter((a) => novos.has(`${a.tipo}\u0000${a.chave}`));
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

export interface SituacaoDaContaNoBanco {
  status: 'teste' | 'ativa' | 'suspensa' | 'cancelada';
  statusAnterior: 'teste' | 'ativa' | 'suspensa' | 'cancelada' | null;
  testeAte: string | null;
  cortesiaAte: string | null;
  cobrarAPartirDe: string | null;
  canceladaEm: string | null;
  asaasAssinaturaId: string | null;
  interna: boolean;
  origem: unknown;
}

/** O que a regra da situação precisa saber da conta (admin R3). null = conta não existe. */
/** Ativação de uma conta (os mesmos passos da lista de contas). */
export async function ativacaoDaContaPlataforma(
  prisma: PrismaClient,
  contaId: string,
): Promise<number> {
  const [r] = await prisma.$queryRaw<{ ativacao: number }[]>`
    SELECT ativacao FROM plataforma_contas() WHERE id = ${contaId}::uuid`;
  return Number(r?.ativacao ?? 0);
}

export async function situacaoDaContaPlataforma(
  prisma: PrismaClient,
  contaId: string,
): Promise<SituacaoDaContaNoBanco | null> {
  const [r] = await prisma.$queryRaw<{ s: SituacaoDaContaNoBanco | null }[]>`
    SELECT plataforma_conta_situacao(${contaId}::uuid) AS s`;
  return r?.s ?? null;
}

/** Marca ou desmarca a conta como interna; devolve como era. */
export async function marcarContaInterna(
  prisma: PrismaClient,
  contaId: string,
  interna: boolean,
): Promise<boolean> {
  const [r] = await prisma.$queryRaw<{ antes: boolean }[]>`
    SELECT plataforma_marcar_interna(${contaId}::uuid, ${interna}) AS antes`;
  return r!.antes;
}

/** Grava a mudança que a regra (transicaoDaConta) decidiu; devolve como estava. */
export async function aplicarSituacaoDaConta(
  prisma: PrismaClient,
  contaId: string,
  mudanca: object,
  motivo: string,
): Promise<SituacaoDaContaNoBanco> {
  const [r] = await prisma.$queryRaw<{ antes: SituacaoDaContaNoBanco }[]>`
    SELECT plataforma_aplicar_situacao(${contaId}::uuid, ${JSON.stringify(mudanca)}::jsonb, ${motivo}) AS antes`;
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

/** Assinaturas do sistema no Asaas (uma por conta), sem as do clube online. */
export function assinaturasAsaasPlataforma(prisma: PrismaClient) {
  return prisma.$queryRaw<{ conta_id: string; conta: string; asaas_assinatura_id: string }[]>`
    SELECT * FROM plataforma_assinaturas_asaas()`;
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

/** Notas fiscais das mensalidades (Saúde do sistema): as dos últimos dias e as a caminho. */
export function notasFiscaisPlataforma(prisma: PrismaClient, desde: Date) {
  return prisma.$queryRaw<
    {
      conta: string;
      status: 'agendada' | 'enviada' | 'emitida' | 'erro' | 'cancelando' | 'cancelada';
      numero: string | null;
      mensagem: string | null;
      atualizado_em: Date;
    }[]
  >`SELECT * FROM plataforma_notas_fiscais(${desde}::timestamptz)`;
}

/** A última nota emitida de qualquer conta (ou nenhuma). */
export async function ultimaNotaEmitidaPlataforma(prisma: PrismaClient) {
  const [r] = await prisma.$queryRaw<
    { conta: string; numero: string | null; emitida_em: Date }[]
  >`SELECT * FROM plataforma_ultima_nota_emitida()`;
  return r ?? null;
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

/** Páginas de barbearia que ligaram "Aparecer no Google" (sitemap, painel P4). Só o público. */
export function paginasDeBarbeariaNoGoogle(prisma: PrismaClient) {
  return prisma.$queryRaw<{ slug: string; atualizado_em: Date }[]>`
    SELECT * FROM paginas_de_barbearia_no_google()`;
}
