// Admin F1d: e-mail para a barbearia parada há 3 dias na mesma etapa do funil de ativação, com o
// link do passo que falta. Uma vez por etapa; a rotina guarda a etapa e desde quando está nela.
import { DEFINICAO_PASSOS, type PassoInicial } from './ajuda.js';
import type { EtapaFunil } from './funil.js';
import { temRecurso, type PlanoConta } from './planos.js';

/** Etapas do funil que viram e-mail, com o passo do tutorial (título, porquê e tela). */
export const PASSO_DA_ETAPA: Partial<Record<EtapaFunil, PassoInicial>> = {
  servicos: 'servicos',
  barbeiros: 'equipe',
  agendamento: 'agendamento',
  comanda: 'comanda',
  whatsapp: 'whatsapp',
};

export const DIAS_PARADA = 3;

export interface EtapaGuardada {
  etapa: string;
  /** ISO: desde quando a conta está nesta etapa. */
  desde: string;
  avisadoEm: string | null;
}

export type DecisaoEtapa =
  | { acao: 'nada' }
  /** A etapa mudou (ou é a primeira vez): guarda a nova, sem aviso ainda. */
  | { acao: 'guardar'; etapa: EtapaFunil }
  /** Parada há 3 dias ou mais e sem aviso nesta etapa: manda o e-mail e marca. */
  | { acao: 'avisar'; passo: PassoInicial };

/**
 * O que fazer com uma conta agora. Só conta em teste ou ativa e não interna. A etapa de
 * pagamento não gera este e-mail (a cobrança tem os próprios avisos), e o WhatsApp só para
 * plano que tem o bot.
 */
export function decidirEtapaParada(d: {
  etapa: EtapaFunil | null;
  guardada: EtapaGuardada | null;
  status: 'teste' | 'ativa' | 'suspensa' | 'cancelada';
  interna: boolean;
  plano: PlanoConta;
  agora: Date;
}): DecisaoEtapa {
  if (!d.etapa || d.interna || (d.status !== 'teste' && d.status !== 'ativa'))
    return { acao: 'nada' };
  if (!d.guardada || d.guardada.etapa !== d.etapa) return { acao: 'guardar', etapa: d.etapa };
  const passo = PASSO_DA_ETAPA[d.etapa];
  if (!passo || d.guardada.avisadoEm) return { acao: 'nada' };
  if (passo === 'whatsapp' && !temRecurso(d.plano, 'bot')) return { acao: 'nada' };
  const parada = d.agora.getTime() - Date.parse(d.guardada.desde);
  return parada >= DIAS_PARADA * 86_400_000 ? { acao: 'avisar', passo } : { acao: 'nada' };
}

/** Variáveis e link do e-mail do passo. */
export function emailDoPasso(passo: PassoInicial, appUrl: string) {
  const p = DEFINICAO_PASSOS[passo];
  return { passo: p.titulo, porque: p.porque, link: `${appUrl}${p.rota}` };
}
