import { z } from 'zod';

/** Papéis de acesso. A matriz de permissões está em docs/documentacao-do-produto.md (TRD). */
export const PAPEIS = ['dono', 'gestor', 'recepcao', 'barbeiro'] as const;

export const papelSchema = z.enum(PAPEIS);

export type Papel = z.infer<typeof papelSchema>;
