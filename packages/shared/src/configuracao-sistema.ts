// Configurações do sistema (Etapa 15.1), editadas na administração. Cada chave tem um esquema;
// o que não valer vira o padrão (o sistema nunca para por uma configuração quebrada).
import { z } from 'zod';
import { lerModelosEmail, type ChaveModeloEmail, type TextoModeloEmail } from './modelos-email.js';
import { DIAS_TESTE, lerTabelasPreco, VERSAO_TERMOS, type TabelaPrecosPlanos } from './planos.js';
import { lerConfigClubeOnline, type ConfigClubeOnline } from './clube-online.js';
import {
  lerConfigNotaFiscal,
  type ConfigNotaFiscal,
  type NotasFiscaisNaSaude,
} from './nota-fiscal.js';
import type { ExecucaoLimpezaNaTela } from './limpeza.js';

/**
 * Admin F8: para quem é o aviso. Cada lista vazia ou ausente vale para todos; com mais de uma,
 * a conta precisa caber em todas (ex.: Pro e Premium em teste).
 */
export const publicoAvisoSchema = z.object({
  planos: z
    .array(z.enum(['basico', 'pro', 'premium']))
    .max(3)
    .optional(),
  /** "teste" = em teste; "pagante" = assinatura ativa. */
  situacoes: z
    .array(z.enum(['teste', 'pagante']))
    .max(2)
    .optional(),
  /** Só estas contas (ids). */
  contas: z.array(z.uuid()).max(200).optional(),
});
export type PublicoAviso = z.infer<typeof publicoAvisoSchema>;

export const avisoGeralSchema = z
  .object({
    texto: z.string().trim().min(5, { error: 'Escreva o aviso.' }).max(300),
    tom: z.enum(['info', 'manutencao']).default('info'),
    inicio: z.iso.datetime({ offset: true, error: 'Início inválido.' }),
    fim: z.iso.datetime({ offset: true, error: 'Fim inválido.' }),
    /** Admin F8: sem público, todas as barbearias veem. */
    publico: publicoAvisoSchema.optional(),
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
  /** Tabelas de preço em ordem de vigência (a primeira é a do lançamento). */
  tabelasPreco: TabelaPrecosPlanos[];
  /** Clube online: taxa da plataforma sobre as mensalidades pagas pelo link. */
  clubeOnline: ConfigClubeOnline;
  /** Nota fiscal das mensalidades do Pente Fino (emitida pelo Asaas). */
  notaFiscal: ConfigNotaFiscal;
}

export function lerConfiguracaoPublica(json: unknown): ConfiguracaoPublica {
  const o = (json ?? {}) as {
    aviso_geral?: unknown;
    teste?: unknown;
    modelos_email?: unknown;
    precos?: unknown;
    clube_online?: unknown;
    nota_fiscal?: unknown;
  };
  const aviso = avisoGeralSchema.safeParse(o.aviso_geral);
  const teste = configTesteSchema.safeParse(o.teste ?? {});
  return {
    avisoGeral: aviso.success ? aviso.data : null,
    teste: teste.success ? teste.data : { dias: DIAS_TESTE, versaoTermos: VERSAO_TERMOS },
    modelosEmail: lerModelosEmail(o.modelos_email),
    tabelasPreco: lerTabelasPreco(o.precos),
    clubeOnline: lerConfigClubeOnline(o.clube_online),
    notaFiscal: lerConfigNotaFiscal(o.nota_fiscal),
  };
}

/** Admin F8: a conta faz parte do público do aviso? */
export function contaNoPublico(
  publico: PublicoAviso | undefined,
  conta: { id: string; plano: 'basico' | 'pro' | 'premium'; status: string },
): boolean {
  if (!publico) return true;
  if (publico.contas?.length && !publico.contas.includes(conta.id)) return false;
  if (publico.planos?.length && !publico.planos.includes(conta.plano)) return false;
  if (publico.situacoes?.length) {
    const situacao =
      conta.status === 'teste' ? 'teste' : conta.status === 'ativa' ? 'pagante' : null;
    if (!situacao || !publico.situacoes.includes(situacao)) return false;
  }
  return true;
}

/** Admin F8: quem vê o aviso, em palavras ("Pro e Premium · em teste"). */
export function descreverPublico(publico: PublicoAviso | undefined): string {
  if (!publico) return 'Todas as barbearias';
  const partes: string[] = [];
  const nome = { basico: 'Básico', pro: 'Pro', premium: 'Premium' } as const;
  if (publico.contas?.length)
    partes.push(
      `${publico.contas.length} ${publico.contas.length === 1 ? 'conta escolhida' : 'contas escolhidas'}`,
    );
  if (publico.planos?.length)
    partes.push(`plano ${publico.planos.map((p) => nome[p]).join(' e ')}`);
  if (publico.situacoes?.length)
    partes.push(
      publico.situacoes.map((s) => (s === 'teste' ? 'em teste' : 'pagantes')).join(' e '),
    );
  return partes.length ? partes.join(' · ') : 'Todas as barbearias';
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
  /** Últimas execuções da limpeza de dados (a mais recente primeiro). */
  limpeza: ExecucaoLimpezaNaTela[];
  /** Notas fiscais das mensalidades (admin R2). */
  notasFiscais: NotasFiscaisNaSaude;
  /**
   * Admin R9: acessos à administração nos últimos 7 dias que chegaram com IP interno (rede do
   * Docker). Acima de zero, o IP real do visitante se perde antes do Caddy (em geral, IPv6).
   */
  ipsInternos: { acessos: number; ultimo: string | null };
  /** V3: o worker (bot, lembretes, rotinas) está batendo? */
  worker: { ultimoBatimento: string | null; parado: boolean };
  /** V3: última execução de cada rotina agendada. */
  rotinas: {
    rotina: string;
    nome: string;
    ultima: string | null;
    resultado: string | null;
    atrasada: boolean;
  }[];
  /** W3: chamadas aos webhooks recusadas (segredo errado) nos últimos 7 dias. */
  webhooksRecusados: {
    total7Dias: number;
    ultimos: { rota: string; ip: string | null; quando: string }[];
  };
  /** W4: segredos de webhook com menos de 32 caracteres (nome da variável). */
  segredosCurtos: string[];
  /** Admin U9: versão em produção e quando a API subiu (o último deploy). */
  versao: { versao: string; iniciadaEm: string };
  /** Admin U9: último backup, gravado pelo backup.sh (null = ainda não rodou). */
  backup: {
    quando: string;
    ok: boolean;
    tamanho?: string;
    externo?: boolean;
    erro?: string;
    /** Passou de 26 h sem backup novo. */
    atrasado: boolean;
  } | null;
  /** Admin U9: disco, memória e certificado, gravados pelo vigia.sh a cada 5 min. */
  servidor: {
    quando: string;
    discoPct: number;
    memoriaPct: number;
    tlsAte: string | null;
    /** Dias até o certificado vencer (null sem leitura). */
    tlsDias: number | null;
  } | null;
  /** Admin U9: último aviso do Asaas que chegou e foi aceito. */
  webhookAsaas: { quando: string; evento: string; resultado: string } | null;
}

// ─── E-mails que não saíram (admin R7) ────────────────────────────────────

/** Um e-mail que falhou na fila, sem o conteúdo e com o destinatário mascarado. */
export interface FalhaDeEmail {
  id: string;
  quando: string;
  /** "jo***@gmail.com". */
  para: string;
  /** Nome do modelo ("Confirmação do e-mail"), ou null em e-mail antigo sem a marca. */
  modelo: string | null;
  assunto: string;
  /** Resposta do servidor de e-mail (SMTP). */
  motivo: string;
  tentativas: number;
  /** Boas-vindas ou confirmação: sem ele, a barbearia não confirma o cadastro. */
  critico: boolean;
}

export const descartarEmailSchema = z.object({
  motivo: z.string().trim().min(5, { error: 'Explique o motivo (pelo menos 5 letras).' }).max(300),
});

/** "joao.silva@gmail.com" → "jo***@gmail.com": dá para reconhecer sem expor o endereço. */
export function mascararEmail(email: string): string {
  const [usuario = '', dominio = ''] = email.trim().split('@');
  if (!dominio) return '***';
  return `${usuario.slice(0, 2)}***@${dominio}`;
}

// ─── IP de quem acessa (admin R9) ─────────────────────────────────────────

/** "::ffff:203.0.113.5" → "203.0.113.5" (IPv4 dentro de IPv6, como o Node às vezes entrega). */
export function normalizarIp(ip: string | null | undefined): string | null {
  const v = ip?.trim();
  if (!v) return null;
  return v.toLowerCase().startsWith('::ffff:') && v.includes('.') ? v.slice(7) : v;
}

/** IP de rede interna (Docker, localhost, rede privada): não é o do visitante. */
export function ipInterno(ip: string | null | undefined): boolean {
  const v = normalizarIp(ip);
  if (!v) return false;
  if (v === '::1' || v.startsWith('127.')) return true;
  if (/^(10\.|192\.168\.)/.test(v)) return true;
  const m = /^172\.(\d{1,3})\./.exec(v);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  return /^f[cd][0-9a-f]{2}:/i.test(v) || /^fe80:/i.test(v);
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

/** Resposta dos botões "Testar conexão" e "Mandar e-mail de teste". */
export interface ResultadoTesteSmtp {
  ok: boolean;
  mensagem: string;
  /** O que o servidor respondeu ao aceitar o e-mail (ex.: "250 OK"). */
  resposta?: string;
  ms: number;
}

export function smtpParaTela(json: unknown): SmtpNaTela | null {
  const r = smtpGuardadoSchema.safeParse(json);
  if (!r.success) return null;
  const { senhaCifrada, ...resto } = r.data;
  return { ...resto, temSenha: !!senhaCifrada };
}
