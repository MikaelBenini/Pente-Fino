// Administração prática (Etapa 15.2): o que precisa de atenção hoje, cobranças em aberto de todas
// as contas, equipe da plataforma e auditoria. Regras puras, usadas pela API e testadas aqui.
import { LIMITE_TESTE_DIAS } from './situacao-conta.js';
import { z } from 'zod';
import type { ContaNaPlataforma, PapelPlataforma } from './plataforma.js';

const DIA_MS = 86_400_000;

// ─── Cobranças de todas as contas ──────────────────────────────────────────

export interface CobrancaNaPlataforma {
  contaId: string;
  conta: string;
  vendedorId: string | null;
  valor: number;
  status: 'aberta' | 'paga' | 'recusada' | 'cancelada';
  origem: 'asaas' | 'manual';
  forma: 'pix' | 'cartao' | 'boleto' | 'dinheiro' | 'transferencia' | null;
  vencimento: string;
  pagaEm: string | null;
  /** Dias depois do vencimento (0 = vence hoje ou ainda não venceu). */
  diasAtraso: number;
}

export interface ResumoCobrancas {
  /** Em aberto ou recusadas, das mais atrasadas para as mais novas. */
  pendentes: CobrancaNaPlataforma[];
  /** Pagas nos últimos 60 dias, das mais recentes. */
  recebidas: CobrancaNaPlataforma[];
  totais: {
    vencido: number;
    aVencer7Dias: number;
    recebidoNoMes: number;
    quantidadeVencidas: number;
  };
}

export function diasDeAtraso(vencimento: string, hoje: string): number {
  return Math.max(0, Math.round((Date.parse(hoje) - Date.parse(vencimento)) / DIA_MS));
}

/** Separa e soma as cobranças (datas AAAA-MM-DD, hoje no fuso de exibição). */
export function resumirCobrancas(
  cobrancas: readonly Omit<CobrancaNaPlataforma, 'diasAtraso'>[],
  hoje: string,
): ResumoCobrancas {
  const comAtraso = cobrancas.map((c) => ({ ...c, diasAtraso: diasDeAtraso(c.vencimento, hoje) }));
  const pendentes = comAtraso
    .filter((c) => c.status === 'aberta' || c.status === 'recusada')
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const limite60 = new Date(Date.parse(hoje) - 60 * DIA_MS).toISOString().slice(0, 10);
  const recebidas = comAtraso
    .filter((c) => c.status === 'paga' && (c.pagaEm ?? c.vencimento).slice(0, 10) >= limite60)
    .sort((a, b) => (b.pagaEm ?? b.vencimento).localeCompare(a.pagaEm ?? a.vencimento));
  const em7 = new Date(Date.parse(hoje) + 7 * DIA_MS).toISOString().slice(0, 10);
  const mes = hoje.slice(0, 7);
  const vencidas = pendentes.filter((c) => c.vencimento < hoje);
  return {
    pendentes,
    recebidas,
    totais: {
      vencido: vencidas.reduce((s, c) => s + c.valor, 0),
      aVencer7Dias: pendentes
        .filter((c) => c.vencimento >= hoje && c.vencimento <= em7)
        .reduce((s, c) => s + c.valor, 0),
      recebidoNoMes: recebidas
        .filter((c) => (c.pagaEm ?? c.vencimento).slice(0, 7) === mes)
        .reduce((s, c) => s + c.valor, 0),
      quantidadeVencidas: vencidas.length,
    },
  };
}

// ─── O que precisa de atenção ─────────────────────────────────────────────

export type TipoPendencia =
  | 'cobranca_vencida'
  | 'teste_acabando'
  | 'sem_uso'
  | 'dono_nao_ativou'
  | 'nao_configurada'
  | 'cobranca_a_vencer'
  | 'ativa_sem_cobranca'
  | 'teste_longo';

export interface Pendencia {
  tipo: TipoPendencia;
  contaId: string;
  conta: string;
  /** 1 = urgente, 2 = importante, 3 = acompanhar. */
  prioridade: 1 | 2 | 3;
  detalhe: string;
  /** O que fazer, em poucas palavras. */
  acao: string;
}

export const ROTULO_PENDENCIA: Readonly<Record<TipoPendencia, string>> = {
  cobranca_vencida: 'Cobrança vencida',
  teste_acabando: 'Teste acabando',
  sem_uso: 'Sem uso',
  dono_nao_ativou: 'Dono não ativou',
  nao_configurada: 'Não configurada',
  cobranca_a_vencer: 'Vence em breve',
  ativa_sem_cobranca: 'Ativa sem cobrança',
  teste_longo: 'Teste longo',
};

const reais = (centavos: number) =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * Lista do dia, das mais urgentes para as que só pedem acompanhamento. Uma conta pode aparecer
 * mais de uma vez (por motivos diferentes); contas canceladas ficam de fora.
 */
export function pendenciasDaPlataforma(
  contas: readonly ContaNaPlataforma[],
  cobrancas: readonly Pick<CobrancaNaPlataforma, 'contaId' | 'valor' | 'status' | 'vencimento'>[],
  agora: Date,
): Pendencia[] {
  const hoje = agora.toISOString().slice(0, 10);
  const r: Pendencia[] = [];
  const pagou = new Set(cobrancas.filter((c) => c.status === 'paga').map((c) => c.contaId));
  const abertas = new Map<string, typeof cobrancas>();
  for (const c of cobrancas)
    if (c.status === 'aberta' || c.status === 'recusada')
      abertas.set(c.contaId, [...(abertas.get(c.contaId) ?? []), c]);
  const dias = (iso: string) => Math.floor((agora.getTime() - Date.parse(iso)) / DIA_MS);

  for (const conta of contas) {
    // Conta interna (da própria equipe) não pede atenção comercial (admin R5).
    if (conta.status === 'cancelada' || conta.interna) continue;
    const base = { contaId: conta.id, conta: conta.nome };
    // Admin R5: ativa, nunca pagou, sem cortesia, sem data para começar a cobrar e sem cobrança
    // em aberto: está usando de graça sem ninguém ter decidido isso.
    const emCortesia = !!conta.cortesiaAte && conta.cortesiaAte >= hoje;
    if (
      conta.status === 'ativa' &&
      !pagou.has(conta.id) &&
      !emCortesia &&
      !conta.cobrarAPartirDe &&
      !abertas.has(conta.id)
    )
      r.push({
        ...base,
        tipo: 'ativa_sem_cobranca',
        prioridade: 1,
        detalhe: 'Ativa sem nenhuma cobrança paga, sem cortesia e sem data para cobrar',
        acao: 'Registrar o pagamento, dar cortesia, começar a cobrar ou marcar como interna',
      });
    // Admin R6: teste que vai além de 60 dias a partir de hoje (antes não havia limite).
    if (conta.status === 'teste' && conta.testeAte) {
      const faltam = Math.ceil((Date.parse(conta.testeAte) - agora.getTime()) / DIA_MS);
      if (faltam > LIMITE_TESTE_DIAS)
        r.push({
          ...base,
          tipo: 'teste_longo',
          prioridade: 2,
          detalhe: `Teste até ${conta.testeAte.slice(0, 10).split('-').reverse().join('/')} (mais de ${LIMITE_TESTE_DIAS} dias)`,
          acao: 'Dar cortesia com o motivo, encurtar o teste ou marcar como interna',
        });
    }
    for (const f of abertas.get(conta.id) ?? []) {
      const atraso = diasDeAtraso(f.vencimento, hoje);
      if (f.vencimento < hoje)
        r.push({
          ...base,
          tipo: 'cobranca_vencida',
          prioridade: atraso >= 5 ? 1 : 2,
          detalhe: `${reais(f.valor)} vencida há ${plural(atraso, 'dia', 'dias')}${f.status === 'recusada' ? ' (cartão recusado)' : ''}`,
          acao:
            atraso >= 5
              ? 'Cobrar hoje: a conta já está só leitura'
              : 'Cobrar ou registrar o pagamento',
        });
      else if (diasDeAtraso(hoje, f.vencimento) <= 7)
        r.push({
          ...base,
          tipo: 'cobranca_a_vencer',
          prioridade: 3,
          detalhe: `${reais(f.valor)} vence em ${f.vencimento.split('-').reverse().join('/')}`,
          acao: conta.cobrancaAutomatica ? 'Acompanhar' : 'Lembrar o pagamento',
        });
    }
    if (conta.status === 'teste' && conta.testeAte && !pagou.has(conta.id)) {
      const faltam = Math.ceil((Date.parse(conta.testeAte) - agora.getTime()) / DIA_MS);
      if (faltam >= 0 && faltam <= 3)
        r.push({
          ...base,
          tipo: 'teste_acabando',
          prioridade: faltam <= 1 ? 1 : 2,
          detalhe:
            faltam === 0
              ? 'O teste acaba hoje'
              : `O teste acaba em ${plural(faltam, 'dia', 'dias')}`,
          acao: conta.fechadas7Dias > 0 ? 'Ligar e fechar a assinatura' : 'Ligar e ajudar a usar',
        });
    }
    if (!conta.donoAtivou && conta.vendedorId && dias(conta.criadaEm) >= 2)
      r.push({
        ...base,
        tipo: 'dono_nao_ativou',
        prioridade: 2,
        detalhe: `Conta criada há ${plural(dias(conta.criadaEm), 'dia', 'dias')} e o dono não criou a senha`,
        acao: 'Mandar o convite de novo pelo WhatsApp',
      });
    else if (conta.donoAtivou && !conta.configuradaEm && dias(conta.criadaEm) >= 3)
      r.push({
        ...base,
        tipo: 'nao_configurada',
        prioridade: 2,
        detalhe: 'Entrou, mas não terminou a configuração guiada',
        acao: 'Oferecer ajuda para cadastrar serviços e equipe',
      });
    else if (conta.status !== 'suspensa' && conta.configuradaEm && dias(conta.criadaEm) >= 7) {
      const ultimo = conta.ultimoAcessoEm ? dias(conta.ultimoAcessoEm) : dias(conta.criadaEm);
      if (ultimo >= 7 && conta.fechadas7Dias === 0)
        r.push({
          ...base,
          tipo: 'sem_uso',
          prioridade: conta.status === 'ativa' ? 2 : 3,
          detalhe: `Nenhum acesso nem comanda fechada há ${plural(ultimo, 'dia', 'dias')}`,
          acao: 'Ligar: risco de cancelamento',
        });
    }
  }
  return r.sort((a, b) => a.prioridade - b.prioridade || a.conta.localeCompare(b.conta, 'pt-BR'));
}

// ─── Equipe da plataforma ──────────────────────────────────────────────────

export interface MembroDaPlataforma {
  id: string;
  nome: string;
  email: string;
  papel: PapelPlataforma;
  ativo: boolean;
  segundoFatorConfigurado: boolean;
  ultimoAcessoEm: string | null;
  criadoEm: string;
  contasVendidas: number;
}

export const novoMembroSchema = z.object({
  nome: z.string().trim().min(2, { error: 'Informe o nome.' }).max(80),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'E-mail inválido.' })),
  papel: z.enum(['admin', 'vendedor']),
});
export type NovoMembro = z.infer<typeof novoMembroSchema>;

export const mudarMembroSchema = z
  .object({
    papel: z.enum(['admin', 'vendedor']).optional(),
    ativo: z.boolean().optional(),
  })
  .refine((d) => d.papel !== undefined || d.ativo !== undefined, { error: 'Nada para mudar.' });
export type MudarMembro = z.infer<typeof mudarMembroSchema>;

/** Resposta de criar ou redefinir: a senha aparece uma vez só. */
export interface AcessoTemporario {
  id: string;
  email: string;
  senha: string;
}

// ─── Auditoria da plataforma ───────────────────────────────────────────────

export interface EventoDaAuditoria {
  id: string;
  quando: string;
  quem: string | null;
  acao: string;
  contaId: string | null;
  conta: string | null;
  motivo: string | null;
  ip: string | null;
  detalhe: string | null;
}

export const filtroAuditoriaSchema = z.object({
  usuario: z.uuid().optional(),
  acao: z.string().trim().max(60).optional(),
  conta: z.uuid().optional(),
  de: z.iso.date().optional(),
  ate: z.iso.date().optional(),
});
export type FiltroAuditoria = z.infer<typeof filtroAuditoriaSchema>;

/** Nome das ações na tela; o que não estiver aqui aparece como está gravado. */
export const ROTULO_ACAO_PLATAFORMA: Readonly<Record<string, string>> = {
  entrar: 'Entrou',
  sair: 'Saiu',
  entrar_recusado: 'Login recusado',
  configurar_segundo_fator: 'Configurou o autenticador',
  mudar_plano: 'Mudou o plano',
  mudar_teste: 'Mudou o teste',
  bloquear: 'Bloqueou a conta',
  desbloquear: 'Desbloqueou a conta',
  cancelar: 'Cancelou a conta',
  registrar_pagamento: 'Registrou pagamento',
  vender: 'Vendeu uma conta',
  criar_pela_venda: 'Conta criada pela venda',
  configurar_aviso_geral: 'Mudou o aviso geral',
  configurar_teste: 'Mudou o teste grátis',
  configurar_smtp: 'Mudou o e-mail (SMTP)',
  configurar_modelos_email: 'Mudou modelo de e-mail',
  configurar_precos: 'Mudou preços',
  configurar_cupons: 'Mudou cupons',
  criar_membro: 'Criou acesso da equipe',
  mudar_membro: 'Mudou acesso da equipe',
  redefinir_membro: 'Redefiniu acesso da equipe',
  criar_usuario_pelo_servidor: 'Criou acesso (servidor)',
  redefinir_acesso_pelo_servidor: 'Redefiniu acesso (servidor)',
};

/** Resumo legível de antes/depois (só os campos que mudaram, sem segredo). */
export function resumoDaMudanca(antes: unknown, depois: unknown): string | null {
  const a = (antes ?? {}) as Record<string, unknown>;
  const d = (depois ?? {}) as Record<string, unknown>;
  const chaves = [...new Set([...Object.keys(a), ...Object.keys(d)])].filter(
    (k) => !/senha|segredo|token|hash/i.test(k),
  );
  const fmt = (v: unknown) =>
    v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  const partes = chaves
    .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(d[k]))
    .map((k) => (k in a ? `${k}: ${fmt(a[k])} → ${fmt(d[k])}` : `${k}: ${fmt(d[k])}`));
  return partes.length ? partes.join(' · ').slice(0, 400) : null;
}
