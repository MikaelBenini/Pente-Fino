// Esquemas de entrada da autenticação, usados pela API (validação) e pelo front (formulários).
import { z } from 'zod';
import { papelSchema } from './papeis.js';

export const emailSchema = z
  .string({ error: 'Informe o e-mail.' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'E-mail inválido.' }));

/** Senha: de 8 a 128 caracteres. Sem regra de símbolo: comprimento protege mais. */
export const senhaSchema = z
  .string({ error: 'Informe a senha.' })
  .min(8, { error: 'A senha precisa ter pelo menos 8 caracteres.' })
  .max(128, { error: 'A senha pode ter no máximo 128 caracteres.' });

const tokenSchema = z
  .string({ error: 'Token ausente.' })
  .min(20, { error: 'Token inválido.' })
  .max(200);

export const loginSchema = z.object({
  email: emailSchema,
  senha: z.string({ error: 'Informe a senha.' }).min(1, { error: 'Informe a senha.' }).max(128),
});
export type LoginEntrada = z.infer<typeof loginSchema>;

export const renovarSessaoSchema = z.object({ refreshToken: tokenSchema });
export type RenovarSessaoEntrada = z.infer<typeof renovarSessaoSchema>;

export const esqueciSenhaSchema = z.object({ email: emailSchema });
export type EsqueciSenhaEntrada = z.infer<typeof esqueciSenhaSchema>;

export const redefinirSenhaSchema = z.object({ token: tokenSchema, senha: senhaSchema });
export type RedefinirSenhaEntrada = z.infer<typeof redefinirSenhaSchema>;

export const trocarSenhaSchema = z
  .object({
    senhaAtual: z.string().min(1, { error: 'Informe a senha atual.' }).max(128),
    novaSenha: senhaSchema,
  })
  .refine((d) => d.senhaAtual !== d.novaSenha, {
    error: 'A nova senha precisa ser diferente da atual.',
    path: ['novaSenha'],
  });
export type TrocarSenhaEntrada = z.infer<typeof trocarSenhaSchema>;

/**
 * Telefone em dígitos com DDI (5511999998888). Aceita digitado com máscara e sem o 55:
 * com só DDD + número (10 ou 11 dígitos), o DDI do Brasil é completado.
 */
export const telefoneSchema = z
  .string()
  .transform((t) => {
    const digitos = t.replace(/\D/g, '');
    return digitos.length === 10 || digitos.length === 11 ? `55${digitos}` : digitos;
  })
  .pipe(z.string().regex(/^\d{12,13}$/, { error: 'Telefone inválido: informe DDD e número.' }));

export const convidarUsuarioSchema = z
  .object({
    nome: z
      .string({ error: 'Informe o nome.' })
      .trim()
      .min(2, { error: 'Informe o nome.' })
      .max(120),
    email: emailSchema,
    telefone: telefoneSchema.optional(),
    papel: papelSchema,
    /** Vazio = todas as unidades (só faz sentido para dono e gestor). */
    unidadeId: z.uuid({ error: 'Unidade inválida.' }).nullable().default(null),
  })
  .refine((d) => d.papel === 'dono' || d.unidadeId !== null, {
    error: 'Escolha a unidade deste usuário.',
    path: ['unidadeId'],
  });
export type ConvidarUsuarioEntrada = z.infer<typeof convidarUsuarioSchema>;

export const aceitarConviteSchema = z.object({ token: tokenSchema, senha: senhaSchema });
export type AceitarConviteEntrada = z.infer<typeof aceitarConviteSchema>;

/** Link do e-mail de confirmação (cadastro pelo site, Etapa 15.4). */
export const confirmarEmailSchema = z.object({ token: tokenSchema });
export type ConfirmarEmailEntrada = z.infer<typeof confirmarEmailSchema>;

/** Resposta de login, aceite de convite e renovação. */
export interface Sessao {
  accessToken: string;
  /** Segundos até o accessToken expirar. */
  expiraEm: number;
  refreshToken: string;
  usuario: UsuarioSessao;
}

export interface UsuarioSessao {
  id: string;
  nome: string;
  email: string;
  contaId: string;
  papeis: { papel: z.infer<typeof papelSchema>; unidadeId: string | null }[];
  /** E-mail confirmado (só o cadastro pelo site começa sem): até lá, não agenda nem convida. */
  emailConfirmado: boolean;
}

/** Unidade como a lista de escolha mostra. */
export interface UnidadeResumo {
  id: string;
  nome: string;
  ativa: boolean;
}
