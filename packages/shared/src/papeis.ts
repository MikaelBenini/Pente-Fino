import { z } from 'zod';

/**
 * Papéis de acesso. A matriz de permissões está em docs/papeis-e-permissoes.md. Desde 27/11/2026
 * o papel de quem atende é `profissional` (antes `barbeiro`), neutro para todos os segmentos; o
 * nome que a tela mostra vem do vocabulário do segmento.
 */
export const PAPEIS = ['dono', 'gestor', 'recepcao', 'profissional'] as const;

export type Papel = (typeof PAPEIS)[number];

/**
 * Nome antigo do papel, aceito na transição: tokens já emitidos, telas abertas antes do deploy e
 * integrações. Some depois de um ciclo de deploys (o token de acesso dura minutos).
 */
export function papelAtual(valor: unknown): unknown {
  return valor === 'barbeiro' ? 'profissional' : valor;
}

export const papelSchema = z.preprocess(papelAtual, z.enum(PAPEIS));
