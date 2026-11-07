// Modelos dos e-mails do sistema (Etapa 15.1): texto padrão aqui, personalização na
// administração. Variáveis entre chaves duplas ({{nome}}); parágrafos separados por linha em branco.
import { z } from 'zod';
import type { TrabalhoEmail } from './filas.js';

export const CHAVES_MODELO_EMAIL = [
  'ativacao_conta',
  'convite_equipe',
  'redefinir_senha',
  'fim_teste',
  'cobranca_aviso',
  'cobranca_vencida',
  'pagamento_recebido',
] as const;
export type ChaveModeloEmail = (typeof CHAVES_MODELO_EMAIL)[number];

export interface TextoModeloEmail {
  assunto: string;
  corpo: string;
  /** Texto do botão (o link vem do sistema); null = sem botão. */
  botao: string | null;
}

export interface DefinicaoModeloEmail {
  nome: string;
  quando: string;
  variaveis: readonly string[];
  padrao: TextoModeloEmail;
}

export const MODELOS_EMAIL: Readonly<Record<ChaveModeloEmail, DefinicaoModeloEmail>> = {
  ativacao_conta: {
    nome: 'Boas-vindas e ativação da conta',
    quando: 'Na venda presencial: o dono cria a senha.',
    variaveis: ['nome', 'conta', 'vendedor', 'validade'],
    padrao: {
      assunto: 'Sua conta da {{conta}} no Pente Fino está pronta',
      corpo:
        'Olá, {{nome}}!\n\n{{vendedor}} deixou a conta da {{conta}} pronta no Pente Fino.\n\nCrie sua senha pelo botão abaixo; em seguida, a configuração guiada leva poucos minutos. O link vale até {{validade}}.',
      botao: 'Criar minha senha',
    },
  },
  convite_equipe: {
    nome: 'Convite da equipe',
    quando: 'Quando o dono ou o gestor convida alguém para a equipe.',
    variaveis: ['nome', 'conta', 'convidadoPor', 'validade'],
    padrao: {
      assunto: 'Convite para a equipe da {{conta}}',
      corpo:
        'Olá, {{nome}}!\n\n{{convidadoPor}} convidou você para usar o Pente Fino na {{conta}}.\n\nCrie sua senha pelo botão abaixo. O convite vale até {{validade}}.',
      botao: 'Aceitar convite',
    },
  },
  redefinir_senha: {
    nome: 'Recuperação de senha',
    quando: 'Quando alguém pede "esqueci minha senha".',
    variaveis: ['nome'],
    padrao: {
      assunto: 'Redefinir sua senha',
      corpo:
        'Olá, {{nome}}!\n\nRecebemos um pedido para redefinir sua senha. O link vale por 1 hora e só pode ser usado uma vez.\n\nSe não foi você, ignore este e-mail: sua senha continua a mesma.',
      botao: 'Criar nova senha',
    },
  },
  fim_teste: {
    nome: 'Aviso de fim do teste',
    quando: '3 dias antes de o teste grátis acabar.',
    variaveis: ['nome', 'conta', 'dias', 'data'],
    padrao: {
      assunto: 'Seu teste do Pente Fino acaba em {{dias}} dias',
      corpo:
        'Olá, {{nome}}!\n\nO teste grátis da {{conta}} acaba em {{data}}. Depois disso, o sistema fica só para consulta até você escolher um plano. Nada do que você lançou se perde.',
      botao: 'Escolher um plano',
    },
  },
  cobranca_aviso: {
    nome: 'Aviso de vencimento',
    quando: 'Cobrança manual: 7 dias antes do vencimento.',
    variaveis: ['nome', 'conta', 'vencimento', 'valor'],
    padrao: {
      assunto: 'Mensalidade do Pente Fino vence em {{vencimento}}',
      corpo:
        'Olá, {{nome}}!\n\nA próxima mensalidade da {{conta}} no Pente Fino vence em {{vencimento}}: {{valor}}.\n\nPague com quem fez a sua venda (Pix, dinheiro ou maquininha) ou responda este e-mail. Depois de 5 dias de atraso, o sistema fica só para consulta até o pagamento.',
      botao: null,
    },
  },
  cobranca_vencida: {
    nome: 'Cobrança vencida',
    quando: 'No dia seguinte ao vencimento sem pagamento.',
    variaveis: ['nome', 'conta', 'vencimento', 'valor'],
    padrao: {
      assunto: 'A mensalidade do Pente Fino venceu em {{vencimento}}',
      corpo:
        'Olá, {{nome}}!\n\nA mensalidade da {{conta}} ({{valor}}) venceu em {{vencimento}} e ainda não aparece paga. Se já pagou, desconsidere.\n\nDepois de 5 dias de atraso, o sistema fica só para consulta até o pagamento. Seus dados continuam guardados.',
      botao: 'Ver assinatura',
    },
  },
  pagamento_recebido: {
    nome: 'Pagamento recebido',
    quando: 'Quando uma mensalidade é paga (Asaas ou registrada pela administração).',
    variaveis: ['nome', 'conta', 'valor', 'periodo'],
    padrao: {
      assunto: 'Recebemos o pagamento da {{conta}}',
      corpo:
        'Olá, {{nome}}!\n\nRecebemos {{valor}} da mensalidade da {{conta}}, referente a {{periodo}}. Obrigado!',
      botao: null,
    },
  },
};

/** Valores de exemplo para a pré-visualização na administração. */
export const EXEMPLO_VARIAVEIS: Readonly<Record<string, string>> = {
  nome: 'Carlos',
  conta: 'Barbearia do Carlos',
  vendedor: 'Vera Vendas',
  convidadoPor: 'Carlos Mendes',
  validade: '14/11/2026 18:00',
  dias: '3',
  data: '10/11/2026',
  vencimento: '05/12/2026',
  valor: 'R$ 149,90',
  periodo: '05/12/2026 a 04/01/2027',
};

const textoModeloSchema = z.object({
  assunto: z.string().trim().min(3, { error: 'Escreva o assunto.' }).max(150),
  corpo: z.string().trim().min(10, { error: 'Escreva o texto.' }).max(4000),
  botao: z.string().trim().max(40).nullable(),
});

/** Variáveis usadas no texto que o modelo não conhece. */
export function variaveisDesconhecidas(chave: ChaveModeloEmail, t: TextoModeloEmail): string[] {
  const usadas = [...`${t.assunto} ${t.corpo}`.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]!);
  return [...new Set(usadas.filter((v) => !MODELOS_EMAIL[chave].variaveis.includes(v)))];
}

/** Personalização de um modelo: recusa variável que o sistema não preenche. */
export function modeloPersonalizadoSchema(chave: ChaveModeloEmail) {
  return textoModeloSchema.superRefine((t, ctx) => {
    const fora = variaveisDesconhecidas(chave, t);
    if (fora.length)
      ctx.addIssue({
        code: 'custom',
        path: ['corpo'],
        message: `Variável que este e-mail não tem: ${fora.map((v) => `{{${v}}}`).join(', ')}.`,
      });
  });
}

/** Personalizações guardadas (o que não valer é ignorado: vale o padrão). */
export function lerModelosEmail(
  json: unknown,
): Partial<Record<ChaveModeloEmail, TextoModeloEmail>> {
  const o = (json ?? {}) as Record<string, unknown>;
  const r: Partial<Record<ChaveModeloEmail, TextoModeloEmail>> = {};
  for (const chave of CHAVES_MODELO_EMAIL) {
    const v = modeloPersonalizadoSchema(chave).safeParse(o[chave]);
    if (v.success) r[chave] = v.data;
  }
  return r;
}

const preencher = (t: string, vars: Readonly<Record<string, string>>) =>
  t.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, v: string) => vars[v] ?? '');

/** Assunto, parágrafos e botão do e-mail, com o texto personalizado ou o padrão. */
export function emailDoModelo(
  chave: ChaveModeloEmail,
  personalizado: TextoModeloEmail | undefined,
  vars: Readonly<Record<string, string>>,
): { assunto: string; paragrafos: string[]; botao: string | null } {
  const t = personalizado ?? MODELOS_EMAIL[chave].padrao;
  return {
    assunto: preencher(t.assunto, vars),
    paragrafos: preencher(t.corpo, vars)
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean),
    botao: t.botao,
  };
}

function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Texto puro e HTML simples (cliente de e-mail não lê CSS externo). */
export function montarEmail(
  para: string,
  assunto: string,
  paragrafos: readonly string[],
  botao?: { texto: string; link: string } | null,
): TrabalhoEmail {
  const texto = [
    ...paragrafos,
    ...(botao ? [`${botao.texto}: ${botao.link}`] : []),
    '',
    '— Pente Fino',
  ].join('\n\n');
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px">
${paragrafos.map((p) => `<p style="font-size:16px;line-height:1.5;margin:0 0 16px">${escapar(p)}</p>`).join('\n')}
${botao ? `<p style="margin:24px 0"><a href="${escapar(botao.link)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:bold">${escapar(botao.texto)}</a></p><p style="font-size:13px;color:#52525b;word-break:break-all">Se o botão não abrir, copie este endereço: ${escapar(botao.link)}</p>` : ''}
<p style="font-size:13px;color:#71717a;margin-top:32px">Pente Fino</p></div></body></html>`;
  return { para, assunto, texto, html };
}

/** O e-mail pronto para a fila: modelo + variáveis + link do botão. */
export function emailPronto(
  para: string,
  chave: ChaveModeloEmail,
  personalizados: Partial<Record<ChaveModeloEmail, TextoModeloEmail>>,
  vars: Readonly<Record<string, string>>,
  link?: string,
): TrabalhoEmail {
  const e = emailDoModelo(chave, personalizados[chave], vars);
  return montarEmail(
    para,
    e.assunto,
    e.paragrafos,
    e.botao && link ? { texto: e.botao, link } : null,
  );
}

/** Como a administração vê um modelo. */
export interface ModeloEmailNaTela extends DefinicaoModeloEmail {
  chave: ChaveModeloEmail;
  personalizado: TextoModeloEmail | null;
}
