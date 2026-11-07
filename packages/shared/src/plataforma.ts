// Administração do sistema (Etapa 15.1): quem opera o Pente Fino, fora das contas.
import { z } from 'zod';
import type { Ciclo, PlanoConta } from './planos.js';

export const PAPEIS_PLATAFORMA = ['admin', 'vendedor'] as const;
export type PapelPlataforma = (typeof PAPEIS_PLATAFORMA)[number];
export const NOME_PAPEL_PLATAFORMA: Readonly<Record<PapelPlataforma, string>> = {
  admin: 'Administrador',
  vendedor: 'Vendedor',
};

export const entrarAdminSchema = z.object({
  email: z.email({ error: 'E-mail inválido.' }).transform((e) => e.trim().toLowerCase()),
  senha: z.string().min(1, { error: 'Informe a senha.' }).max(200),
  /** Código de 6 dígitos do aplicativo autenticador (obrigatório depois de configurar). */
  codigo: z
    .string()
    .transform((c) => c.replace(/\s/g, ''))
    .pipe(z.string().regex(/^\d{6}$/, { error: 'O código tem 6 dígitos.' }))
    .optional(),
});
export type EntrarAdminEntrada = z.infer<typeof entrarAdminSchema>;

export interface UsuarioPlataformaSessao {
  id: string;
  nome: string;
  email: string;
  papel: PapelPlataforma;
}

/** Login em etapas: senha certa sem autenticador → configurar; com autenticador → código. */
export type RespostaEntrarAdmin =
  | { etapa: 'codigo' }
  | { etapa: 'configurar'; otpauth: string; segredo: string }
  | { etapa: 'pronto'; token: string; expiraEm: string; usuario: UsuarioPlataformaSessao };

/** Conta vista pela administração: assinatura e uso; nunca dado de cliente. */
export interface ContaNaPlataforma {
  id: string;
  nome: string;
  plano: PlanoConta;
  ciclo: Ciclo;
  status: 'teste' | 'ativa' | 'suspensa' | 'cancelada';
  criadaEm: string;
  testeAte: string | null;
  configuradaEm: string | null;
  cobrancaAutomatica: boolean;
  unidades: number;
  profissionais: number;
  whatsappConectado: boolean;
  fechadas7Dias: number;
  ultimaFechadaEm: string | null;
}
