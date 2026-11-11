// Cobrança manual (venda presencial, Etapa 15.1): sem Asaas, a conta também vence. Sete dias
// antes do fim do período pago nasce a próxima cobrança em aberto e o dono é avisado; vencida,
// a conta segue o mesmo bloqueio suave da cobrança automática (situacaoAssinatura).
import { valorDaCobranca } from './assinatura.js';
import type { Ciclo, PlanoConta, TabelaPrecosPlanos } from './planos.js';
import { fimDoPeriodo } from './plataforma.js';

/** Quantos dias antes do vencimento a cobrança manual nasce (e o dono recebe o aviso). */
export const AVISO_COBRANCA_MANUAL_DIAS = 7;

const somarDias = (dia: string, n: number) => {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export interface CobrancaManualNova {
  vencimento: string;
  periodoInicio: string;
  periodoFim: string;
  valor: number;
}

/**
 * A próxima cobrança da conta manual, se já é hora de criá-la (admin R4). Vence no dia seguinte
 * ao fim do último período pago ou na data em que a administração mandou começar a cobrar
 * (reativação ou fim da cortesia), o que vier depois; nunca dentro da cortesia. Nasce
 * AVISO_COBRANCA_MANUAL_DIAS dias antes e só se não houver outra em aberto. null = nada a fazer:
 * nunca pagou e sem data de início (conta em teste ou "ativa sem cobrança", que a administração
 * vê em "Precisa de atenção").
 */
export function proximaCobrancaManual(d: {
  faturas: readonly { status: 'aberta' | 'paga' | 'recusada' | 'cancelada'; periodoFim: string }[];
  hoje: string;
  plano: PlanoConta;
  ciclo: Ciclo;
  unidades: number;
  /** Tabela que a conta contratou (o preço novo da administração não muda quem já assina). */
  tabela?: TabelaPrecosPlanos;
  descontoBp?: number;
  /** A administração mandou começar a cobrar nesta data. */
  cobrarAPartirDe?: string | null;
  /** Sem cobrança até esta data (inclusive). */
  cortesiaAte?: string | null;
}): CobrancaManualNova | null {
  if (d.faturas.some((f) => f.status === 'aberta' || f.status === 'recusada')) return null;
  const fimPago = d.faturas
    .filter((f) => f.status === 'paga')
    .map((f) => f.periodoFim)
    .sort()
    .at(-1);
  const candidatas = [
    fimPago ? somarDias(fimPago, 1) : null,
    d.cobrarAPartirDe ?? null,
    d.cortesiaAte ? somarDias(d.cortesiaAte, 1) : null,
  ].filter((x): x is string => x !== null);
  // Nunca pagou e sem data de início: quem cuida é o fim do teste (ou a administração).
  if (!fimPago && !d.cobrarAPartirDe) return null;
  const vencimento = candidatas.sort().at(-1)!;
  if (vencimento > somarDias(d.hoje, AVISO_COBRANCA_MANUAL_DIAS)) return null;
  return {
    vencimento,
    periodoInicio: vencimento,
    periodoFim: fimDoPeriodo(vencimento, d.ciclo),
    valor: valorDaCobranca(d.plano, d.ciclo, Math.max(1, d.unidades), d.tabela, d.descontoBp),
  };
}
