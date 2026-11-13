// Admin F5: acesso de suporte com consentimento. O dono libera por 24 h nas Configurações; a
// equipe do Pente Fino (admin ou suporte) abre o painel só para ler, por no máximo 1 h de cada vez.
import { z } from 'zod';

export const HORAS_LIBERACAO_SUPORTE = 24;
export const MINUTOS_SESSAO_SUPORTE = 60;

export const liberarSuporteSchema = z.object({ liberar: z.boolean() });
export type LiberarSuporteEntrada = z.infer<typeof liberarSuporteSchema>;

export interface AcessoSuporteDaConta {
  /** ISO; null = não liberado (ou já venceu). */
  liberadoAte: string | null;
}

/** Até quando vale uma sessão aberta agora: 1 h, nunca depois do fim da liberação; null = não pode. */
export function fimDaSessaoSuporte(liberadoAte: Date | null, agora: Date): Date | null {
  if (!liberadoAte || liberadoAte <= agora) return null;
  const umaHora = new Date(agora.getTime() + MINUTOS_SESSAO_SUPORTE * 60_000);
  return liberadoAte < umaHora ? liberadoAte : umaHora;
}

export interface SessaoSuporteAberta {
  token: string;
  /** ISO: quando a sessão acaba. */
  ate: string;
}
