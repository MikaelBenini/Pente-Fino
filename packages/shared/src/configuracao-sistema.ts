// Configurações do sistema (Etapa 15.1), editadas na administração. Cada chave tem um esquema;
// o que não valer vira o padrão (o sistema nunca para por uma configuração quebrada).
import { z } from 'zod';
import { lerModelosEmail, type ChaveModeloEmail, type TextoModeloEmail } from './modelos-email.js';
import { DIAS_TESTE, VERSAO_TERMOS } from './planos.js';

export const avisoGeralSchema = z
  .object({
    texto: z.string().trim().min(5, { error: 'Escreva o aviso.' }).max(300),
    tom: z.enum(['info', 'manutencao']).default('info'),
    inicio: z.iso.datetime({ offset: true, error: 'Início inválido.' }),
    fim: z.iso.datetime({ offset: true, error: 'Fim inválido.' }),
  })
  .refine((a) => Date.parse(a.fim) > Date.parse(a.inicio), {
    error: 'O fim vem depois do início.',
    path: ['fim'],
  });
export type AvisoGeral = z.infer<typeof avisoGeralSchema>;

export const configTesteSchema = z.object({
  /** Dias de teste grátis no cadastro pelo site. */
  dias: z.number().int().min(1).max(60).default(DIAS_TESTE),
  /** Versão (data) dos termos e da política em vigor: o cadastro grava o aceite desta. */
  versaoTermos: z.iso.date().default(VERSAO_TERMOS),
});
export type ConfigTeste = z.infer<typeof configTesteSchema>;

/** O que a aplicação lê (configuracao_do_sistema()). */
export interface ConfiguracaoPublica {
  avisoGeral: AvisoGeral | null;
  teste: ConfigTeste;
  /** Modelos de e-mail personalizados (os demais usam o texto padrão). */
  modelosEmail: Partial<Record<ChaveModeloEmail, TextoModeloEmail>>;
}

export function lerConfiguracaoPublica(json: unknown): ConfiguracaoPublica {
  const o = (json ?? {}) as { aviso_geral?: unknown; teste?: unknown; modelos_email?: unknown };
  const aviso = avisoGeralSchema.safeParse(o.aviso_geral);
  const teste = configTesteSchema.safeParse(o.teste ?? {});
  return {
    avisoGeral: aviso.success ? aviso.data : null,
    teste: teste.success ? teste.data : { dias: DIAS_TESTE, versaoTermos: VERSAO_TERMOS },
    modelosEmail: lerModelosEmail(o.modelos_email),
  };
}

/** O aviso geral aparece só entre o início e o fim. */
export const avisoVigente = (a: AvisoGeral | null, agora: Date): AvisoGeral | null =>
  a && Date.parse(a.inicio) <= agora.getTime() && agora.getTime() < Date.parse(a.fim) ? a : null;

// ─── Saúde do sistema ─────────────────────────────────────────────────────

export interface FilaNaSaude {
  fila: string;
  esperando: number;
  agendados: number;
  ativos: number;
  falhas: number;
}

export interface SaudeDoSistema {
  banco: 'ok' | 'falha';
  filas: FilaNaSaude[];
  conexoesCaidas: {
    contaId: string;
    conta: string;
    unidade: string;
    numero: string | null;
    caiuEm: string;
  }[];
  /** Trabalhos que falharam nas últimas 24 h (sem o conteúdo, só o motivo). */
  errosRecentes: { fila: string; tipo: string; motivo: string; quando: string }[];
}

// ─── E-mail (SMTP) ────────────────────────────────────────────────────────

const smtpBase = {
  host: z.string().trim().min(3, { error: 'Informe o servidor.' }).max(200),
  porta: z.number().int().min(1).max(65535),
  /** TLS desde o início (porta 465); false = STARTTLS quando o servidor oferece (587). */
  seguro: z.boolean(),
  usuario: z.string().trim().max(200).default(''),
  remetente: z.string().trim().min(3, { error: 'Informe o remetente.' }).max(200),
};

/** O que a tela manda: senha null = manter a que está guardada; '' = sem senha. */
export const smtpEntradaSchema = z.object({
  ...smtpBase,
  senha: z.string().max(500).nullable().default(null),
});
export type SmtpEntrada = z.infer<typeof smtpEntradaSchema>;

/** Como fica guardado (a senha só cifrada). */
export const smtpGuardadoSchema = z.object({
  ...smtpBase,
  senhaCifrada: z.string().nullable(),
});
export type SmtpGuardado = z.infer<typeof smtpGuardadoSchema>;

/** O que a tela vê: nunca a senha, só se há uma guardada. */
export interface SmtpNaTela extends Omit<SmtpGuardado, 'senhaCifrada'> {
  temSenha: boolean;
}

export function smtpParaTela(json: unknown): SmtpNaTela | null {
  const r = smtpGuardadoSchema.safeParse(json);
  if (!r.success) return null;
  const { senhaCifrada, ...resto } = r.data;
  return { ...resto, temSenha: !!senhaCifrada };
}
