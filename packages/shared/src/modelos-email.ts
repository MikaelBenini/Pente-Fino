// Modelos dos e-mails do sistema (Etapa 15.1): texto padrão aqui, personalização na
// administração. Variáveis entre chaves duplas ({{nome}}); parágrafos separados por linha em branco.
import { z } from 'zod';
import type { TrabalhoEmail } from './filas.js';

export const CHAVES_MODELO_EMAIL = [
  'boas_vindas',
  'confirmar_email',
  'ativacao_conta',
  'convite_equipe',
  'redefinir_senha',
  'senha_alterada',
  'fim_teste',
  'cobranca_aviso',
  'cobranca_vencida',
  'pagamento_recebido',
  'conta_sem_confirmar',
  'conta_sera_apagada',
  'whatsapp_caiu',
  'etapa_parada',
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

// Corpo: parágrafos separados por linha em branco; linhas começando com "- " viram lista.
export const MODELOS_EMAIL: Readonly<Record<ChaveModeloEmail, DefinicaoModeloEmail>> = {
  boas_vindas: {
    nome: 'Boas-vindas do cadastro',
    quando: 'Logo depois que a barbearia se cadastra pelo site.',
    variaveis: ['nome', 'conta', 'dias', 'data'],
    padrao: {
      assunto: 'Bem-vindo ao Pente Fino, {{nome}}! Seu teste grátis começou',
      corpo:
        'Olá, {{nome}}!\n\nA conta da {{conta}} está criada e o teste grátis já começou: são {{dias}} dias com tudo liberado, até {{data}}, sem cartão de crédito.\n\nPrimeiro, confirme o seu e-mail pelo botão abaixo: é o que libera a agenda, os convites da equipe e o WhatsApp.\n\nPara ver resultado já na primeira semana, comece por aqui:\n- Cadastre seus serviços e preços (a configuração guiada leva uns 5 minutos)\n- Convide os barbeiros: cada um lança os próprios atendimentos pelo celular\n- Ligue o link de agendamento para os clientes marcarem sozinhos\n\nNo fim do dia, o painel mostra quanto entrou e, principalmente, quanto sobrou: o lucro real por serviço, por barbeiro e por unidade.\n\nBons atendimentos!',
      botao: 'Confirmar e-mail e começar',
    },
  },
  confirmar_email: {
    nome: 'Confirmação do e-mail',
    quando: 'Quando o dono pede um novo link de confirmação (cadastro pelo site).',
    variaveis: ['nome', 'validade'],
    padrao: {
      assunto: 'Confirme seu e-mail no Pente Fino',
      corpo:
        'Olá, {{nome}}!\n\nFalta só confirmar o seu e-mail para liberar a agenda, os convites da equipe e o WhatsApp da barbearia.\n\nÉ só tocar no botão abaixo. O link vale até {{validade}}.\n\nNão criou uma conta no Pente Fino? Pode ignorar este e-mail.',
      botao: 'Confirmar meu e-mail',
    },
  },
  ativacao_conta: {
    nome: 'Boas-vindas e ativação da conta',
    quando: 'Na venda presencial: o dono cria a senha.',
    variaveis: ['nome', 'conta', 'vendedor', 'validade'],
    padrao: {
      assunto: 'A {{conta}} já está no Pente Fino: crie sua senha',
      corpo:
        'Olá, {{nome}}!\n\nQue bom ter a {{conta}} com a gente. {{vendedor}} já deixou sua conta pronta no Pente Fino, o sistema que mostra quanto sobra de verdade em cada atendimento.\n\nFalta só um passo: crie sua senha pelo botão abaixo. Em seguida, a configuração guiada ajuda a cadastrar serviços, preços e equipe em poucos minutos.\n\nEste link é pessoal e vale até {{validade}}.',
      botao: 'Criar minha senha',
    },
  },
  convite_equipe: {
    nome: 'Convite da equipe',
    quando: 'Quando o dono ou o gestor convida alguém para a equipe.',
    variaveis: ['nome', 'conta', 'convidadoPor', 'validade'],
    padrao: {
      assunto: '{{convidadoPor}} convidou você para a equipe da {{conta}}',
      corpo:
        'Olá, {{nome}}!\n\n{{convidadoPor}} convidou você para fazer parte da equipe da {{conta}} no Pente Fino.\n\nCom ele, você:\n- Vê a agenda do dia direto no celular\n- Lança os atendimentos em poucos toques\n- Acompanha suas comissões em tempo real, sem fazer conta no fim do mês\n\nCrie sua senha pelo botão abaixo para começar. O convite vale até {{validade}}.',
      botao: 'Aceitar convite',
    },
  },
  redefinir_senha: {
    nome: 'Recuperação de senha',
    quando: 'Quando alguém pede "esqueci minha senha".',
    variaveis: ['nome'],
    padrao: {
      assunto: 'Redefina sua senha do Pente Fino',
      corpo:
        'Olá, {{nome}}!\n\nRecebemos um pedido para redefinir a senha da sua conta. Para criar uma nova, use o botão abaixo.\n\nPor segurança, o link vale por 1 hora e só pode ser usado uma vez.\n\nNão foi você? Pode ignorar este e-mail: sua senha continua a mesma.',
      botao: 'Criar nova senha',
    },
  },
  senha_alterada: {
    nome: 'Senha alterada',
    quando: 'Depois que alguém troca a senha (aviso de segurança).',
    variaveis: ['nome', 'data'],
    padrao: {
      assunto: 'Sua senha do Pente Fino foi alterada',
      corpo:
        'Olá, {{nome}}!\n\nA senha da sua conta foi alterada em {{data}}. Por segurança, encerramos as outras sessões abertas.\n\nSe foi você, está tudo certo e não precisa fazer nada.\n\nNão reconhece essa alteração? Use "Esqueci minha senha" na tela de entrada para criar uma nova agora e avise o dono da barbearia.',
      botao: null,
    },
  },
  fim_teste: {
    nome: 'Aviso de fim do teste',
    quando: '3 dias antes de o teste grátis acabar.',
    variaveis: ['nome', 'conta', 'dias', 'data'],
    padrao: {
      assunto: 'Faltam {{dias}} dias do seu teste: continue com a {{conta}} sem parar',
      corpo:
        'Olá, {{nome}}!\n\nO teste grátis da {{conta}} termina em {{data}}. Para a agenda, as comandas, as comissões e o relatório de lucro seguirem funcionando normalmente, escolha um plano antes dessa data.\n\nAssinando agora, você mantém:\n- Tudo o que já foi lançado: clientes, atendimentos, caixa e histórico\n- A agenda e o link de agendamento funcionando para os seus clientes\n- O lucro real por serviço, barbeiro e unidade, todos os dias\n\nSe preferir esperar, nada se perde: depois do teste o sistema fica disponível para consulta até você escolher um plano.',
      botao: 'Escolher meu plano',
    },
  },
  cobranca_aviso: {
    nome: 'Aviso de vencimento',
    quando: 'Cobrança manual: 7 dias antes do vencimento.',
    variaveis: ['nome', 'conta', 'vencimento', 'valor'],
    padrao: {
      assunto: 'Lembrete: a mensalidade da {{conta}} vence em {{vencimento}}',
      corpo:
        'Olá, {{nome}}!\n\nPassando para lembrar que a próxima mensalidade da {{conta}} no Pente Fino vence em {{vencimento}}, no valor de {{valor}}.\n\nO pagamento pode ser feito com quem fez a sua venda, por Pix, dinheiro ou cartão. Assim que ele for registrado, você recebe a confirmação por e-mail.\n\nCom 5 dias de atraso, o sistema passa a funcionar só para consulta até a regularização.',
      botao: null,
    },
  },
  cobranca_vencida: {
    nome: 'Cobrança vencida',
    quando: 'No dia seguinte ao vencimento sem pagamento.',
    variaveis: ['nome', 'conta', 'vencimento', 'valor'],
    padrao: {
      assunto: 'Mensalidade da {{conta}} em aberto desde {{vencimento}}',
      corpo:
        'Olá, {{nome}}!\n\nNão identificamos o pagamento da mensalidade da {{conta}}, no valor de {{valor}}, que venceu em {{vencimento}}. Se você já pagou, pode desconsiderar este aviso.\n\nPara não interromper a agenda e os lançamentos da equipe, regularize em até 5 dias após o vencimento. Depois disso, o sistema fica disponível só para consulta até o pagamento.\n\nSeus dados continuam guardados com segurança.',
      botao: 'Ver minha assinatura',
    },
  },
  pagamento_recebido: {
    nome: 'Pagamento recebido',
    quando: 'Quando uma mensalidade é paga (Asaas ou registrada pela administração).',
    variaveis: ['nome', 'conta', 'valor', 'periodo'],
    padrao: {
      assunto: 'Pagamento confirmado: a {{conta}} está em dia',
      corpo:
        'Olá, {{nome}}!\n\nConfirmamos o recebimento de {{valor}} referente à mensalidade da {{conta}}, período de {{periodo}}.\n\nSua assinatura está em dia. Obrigado pela confiança, e bons atendimentos!',
      botao: null,
    },
  },
  conta_sem_confirmar: {
    nome: 'Conta sem confirmar o e-mail',
    quando: 'Cadastro pelo site sem confirmar o e-mail: 2 dias antes de a conta ser apagada.',
    variaveis: ['nome', 'conta', 'data'],
    padrao: {
      assunto: 'Confirme seu e-mail para não perder a {{conta}}',
      corpo:
        'Olá, {{nome}}!\n\nVocê criou a conta da {{conta}} no Pente Fino, mas o e-mail ainda não foi confirmado. Contas sem confirmação são apagadas em {{data}}, para proteger o sistema de cadastros falsos.\n\nPara manter a conta, entre no Pente Fino e toque em "Reenviar e-mail" no aviso do topo; depois é só abrir o link que chega na sua caixa de entrada.\n\nNão criou essa conta? Pode ignorar: ela sai sozinha.',
      botao: 'Entrar e confirmar',
    },
  },
  conta_sera_apagada: {
    nome: 'Conta será apagada',
    quando: 'Conta cancelada ou com o teste vencido sem pagamento: 15 e 3 dias antes de apagar.',
    variaveis: ['nome', 'conta', 'dias', 'data'],
    padrao: {
      assunto: 'Os dados da {{conta}} serão apagados em {{dias}} dias',
      corpo:
        'Olá, {{nome}}!\n\nA conta da {{conta}} no Pente Fino está parada, e pela nossa política de privacidade os dados de contas paradas são apagados 90 dias depois. A exclusão está marcada para {{data}}.\n\nO que sai: clientes, agenda, comandas, caixa, equipe e conversas do WhatsApp. Depois disso não dá para recuperar.\n\nQuer continuar usando? Entre e escolha um plano, ou responda este e-mail. Se quiser guardar alguma informação, baixe os relatórios antes da data.',
      botao: 'Entrar no Pente Fino',
    },
  },
  whatsapp_caiu: {
    nome: 'WhatsApp desconectado',
    quando: 'Quando o WhatsApp de uma unidade cai sozinho (o bot para de responder).',
    variaveis: ['nome', 'conta', 'unidade', 'data'],
    padrao: {
      assunto: 'O WhatsApp da {{unidade}} desconectou: o bot parou de responder',
      corpo:
        'Olá, {{nome}}!\n\nO WhatsApp da unidade {{unidade}} ({{conta}}) desconectou em {{data}}. Enquanto ele estiver fora, o bot não responde os clientes, os lembretes de horário não saem e a pesquisa de avaliação fica parada.\n\nPara voltar, abra a tela Bot no Pente Fino e leia o QR Code com o celular da barbearia (WhatsApp → Aparelhos conectados → Conectar um aparelho).\n\nIsso costuma acontecer quando o celular fica muito tempo sem internet, sem bateria ou quando o aparelho é desconectado no próprio WhatsApp.',
      botao: 'Reconectar o WhatsApp',
    },
  },
  etapa_parada: {
    nome: 'Ajuda com o próximo passo',
    quando:
      'Quando a barbearia fica 3 dias parada na mesma etapa da configuração (uma vez por etapa).',
    variaveis: ['nome', 'conta', 'passo', 'porque'],
    padrao: {
      assunto: '{{nome}}, falta pouco: {{passo}}',
      corpo:
        'Olá, {{nome}}!\n\nVimos que a {{conta}} ainda não fez este passo no Pente Fino: {{passo}}.\n\n{{porque}}\n\nLeva poucos minutos e o botão abaixo leva direto para a tela certa. Se travou em alguma coisa, é só responder este e-mail que a gente ajuda.',
      botao: 'Fazer agora',
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
  unidade: 'Centro',
  passo: 'Cadastrar os serviços com preço',
  porque: 'Sem preço não tem agenda nem lucro.',
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

const COR = {
  fundo: '#f4f4f5',
  tinta: '#18181b',
  suave: '#52525b',
  marca: '#f5d33b',
  escuro: '#0b0b0b',
};
const FONTE = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,Helvetica,sans-serif";

/** Um parágrafo em HTML: linhas que começam com "- " viram lista. */
function blocoHtml(p: string): string {
  const linhas = p.split('\n').map((l) => l.trim());
  const itens = linhas.filter((l) => l.startsWith('- '));
  if (itens.length === 0)
    return `<p style="font-size:16px;line-height:1.6;margin:0 0 16px">${linhas.map(escapar).join('<br>')}</p>`;
  const antes = linhas.filter((l) => l && !l.startsWith('- '));
  return `${antes.length ? `<p style="font-size:16px;line-height:1.6;margin:0 0 8px">${antes.map(escapar).join('<br>')}</p>` : ''}<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px">${itens
    .map(
      (i) =>
        `<tr><td style="vertical-align:top;padding:2px 10px 6px 0;color:${COR.escuro};font-size:16px;line-height:1.6">&#8226;</td><td style="font-size:16px;line-height:1.6;padding:0 0 6px">${escapar(i.slice(2))}</td></tr>`,
    )
    .join('')}</table>`;
}

export interface OpcoesEmail {
  /** Endereço do site (logo e rodapé). Sem ele, o e-mail sai sem a imagem da logo. */
  site?: string | undefined;
}

/** Texto puro e HTML com a marca (cliente de e-mail não lê CSS externo nem SVG). */
export function montarEmail(
  para: string,
  assunto: string,
  paragrafos: readonly string[],
  botao?: { texto: string; link: string } | null,
  opcoes: OpcoesEmail = {},
): TrabalhoEmail {
  const site = opcoes.site?.replace(/\/$/, '');
  const texto = [
    ...paragrafos,
    ...(botao ? [`${botao.texto}: ${botao.link}`] : []),
    '',
    `Equipe Pente Fino${site ? `\n${site}` : ''}`,
  ].join('\n\n');
  // Prévia que aparece ao lado do assunto na caixa de entrada.
  const previa = escapar((paragrafos[1] ?? paragrafos[0] ?? '').replace(/\n/g, ' ').slice(0, 140));
  const logo = site
    ? `<img src="${escapar(site)}/icones/icone-192.png" width="32" height="32" alt="" style="display:block;border:0;border-radius:6px">`
    : '';
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapar(assunto)}</title></head>
<body style="margin:0;padding:0;background:${COR.fundo};font-family:${FONTE};color:${COR.tinta}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${previa}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COR.fundo}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="background:${COR.escuro};border-radius:10px 10px 0 0;padding:18px 28px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>${logo ? `<td style="padding-right:10px">${logo}</td>` : ''}<td style="font-family:${FONTE};font-size:18px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:${COR.marca}">Pente Fino</td></tr></table>
</td></tr>
<tr><td style="background:#ffffff;padding:32px 28px 12px">
${paragrafos.map(blocoHtml).join('\n')}
${
  botao
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="background:${COR.marca};border-radius:8px"><a href="${escapar(botao.link)}" style="display:inline-block;padding:14px 26px;font-family:${FONTE};font-size:16px;font-weight:700;color:${COR.escuro};text-decoration:none">${escapar(botao.texto)}</a></td></tr></table>
<p style="font-size:13px;line-height:1.5;color:${COR.suave};margin:0 0 16px;word-break:break-all">Se o botão não abrir, copie e cole este endereço no navegador:<br>${escapar(botao.link)}</p>`
    : ''
}
<p style="font-size:16px;line-height:1.6;margin:8px 0 20px">Equipe Pente Fino</p>
</td></tr>
<tr><td style="background:#ffffff;border-top:1px solid #e4e4e7;border-radius:0 0 10px 10px;padding:16px 28px 22px">
<p style="font-size:12px;line-height:1.5;color:${COR.suave};margin:0">Pente Fino · Gestão de barbearia que mostra o lucro real${site ? `<br><a href="${escapar(site)}" style="color:${COR.suave}">${escapar(site.replace(/^https?:\/\//, ''))}</a>` : ''}</p>
<p style="font-size:12px;line-height:1.5;color:${COR.suave};margin:8px 0 0">Você recebeu este e-mail porque tem uma conta no Pente Fino.</p>
</td></tr>
</table></td></tr></table></body></html>`;
  return { para, assunto, texto, html };
}

/** O e-mail pronto para a fila: modelo + variáveis + link do botão. */
export function emailPronto(
  para: string,
  chave: ChaveModeloEmail,
  personalizados: Partial<Record<ChaveModeloEmail, TextoModeloEmail>>,
  vars: Readonly<Record<string, string>>,
  link?: string,
  opcoes: OpcoesEmail = {},
): TrabalhoEmail {
  const e = emailDoModelo(chave, personalizados[chave], vars);
  return {
    ...montarEmail(
      para,
      e.assunto,
      e.paragrafos,
      e.botao && link ? { texto: e.botao, link } : null,
      opcoes,
    ),
    modelo: chave,
  };
}

/**
 * Admin U8: o modelo (personalizado ou o padrão) preenchido com os exemplos, para quem
 * está na administração ver como chega. O assunto ganha "[Teste]" e o botão leva ao site.
 */
export function emailDeTeste(
  para: string,
  chave: ChaveModeloEmail,
  personalizados: Partial<Record<ChaveModeloEmail, TextoModeloEmail>>,
  site?: string,
): TrabalhoEmail {
  const e = emailPronto(
    para,
    chave,
    personalizados,
    EXEMPLO_VARIAVEIS,
    site ?? 'https://seupentefino.com.br',
    { site },
  );
  return { ...e, assunto: `[Teste] ${e.assunto}` };
}

/** E-mails que, se não saem, travam a conversão (a barbearia não confirma o cadastro). */
export const EMAILS_CRITICOS: readonly ChaveModeloEmail[] = ['boas_vindas', 'confirmar_email'];

/** Como a administração vê um modelo. */
export interface ModeloEmailNaTela extends DefinicaoModeloEmail {
  chave: ChaveModeloEmail;
  personalizado: TextoModeloEmail | null;
}
