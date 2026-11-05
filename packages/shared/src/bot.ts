// Bot do WhatsApp sem IA (linha de desenvolvimento, Etapa 10): um menu numerado, palavras-chave
// e mensagens prontas que o dono escreve. Tudo aqui é puro: o simulador do painel e o WhatsApp
// de verdade passam pelo mesmo `responder`.
import { lerNota } from './avaliacao.js';
import { formatarMoeda } from './formatacao.js';

// ─── Menu ─────────────────────────────────────────────────────────────────

export const ACOES_BOT = [
  'agendar',
  'ver_precos',
  'endereco',
  'falar_com_atendente',
  'voltar_menu',
] as const;
export type AcaoBot = (typeof ACOES_BOT)[number];

export const NOME_ACAO_BOT: Readonly<Record<AcaoBot, string>> = {
  agendar: 'Agendar horário',
  ver_precos: 'Mostrar a tabela de preços',
  endereco: 'Endereço e horário de funcionamento',
  falar_com_atendente: 'Passar para um atendente',
  voltar_menu: 'Voltar ao menu',
};

export interface OpcaoMenu {
  id: string;
  /** O que aparece na lista numerada ("Agendar horário"). */
  rotulo: string;
  /** O que o bot responde ao escolher. Ações completam a resposta (preços, link, endereço). */
  resposta: string;
  acao: AcaoBot | null;
  /** Escolher a opção abre outro menu. */
  submenu: MenuNo | null;
}

export interface MenuNo {
  /** Texto acima da lista ("Como posso ajudar?"). */
  texto: string;
  opcoes: OpcaoMenu[];
}

export interface GrupoPalavrasChave {
  id: string;
  /** Qualquer uma delas, em qualquer ponto da conversa. Sem diferença de acento e maiúscula. */
  palavras: string[];
  resposta: string;
  acao: AcaoBot | null;
}

export interface MenuBot {
  menu: MenuNo;
  palavrasChave: GrupoPalavrasChave[];
}

/** Variáveis que o dono pode usar nos textos. */
export const VARIAVEIS_BOT = {
  cliente: 'Primeiro nome do cliente, quando ele já está cadastrado',
  barbearia: 'Nome da barbearia',
  unidade: 'Nome da unidade (útil para quem tem mais de uma)',
  endereco: 'Endereço da unidade',
  mapa: 'Link do endereço no mapa',
  horario: 'Horário de funcionamento, por extenso',
  link: 'Link de agendamento pelo site',
  profissional: 'Primeiro nome de quem atendeu (só na pesquisa depois do atendimento)',
} as const;
export type VariavelBot = keyof typeof VARIAVEIS_BOT;

/** Palavras que o próprio sistema usa e não podem virar palavra-chave. */
export const PALAVRAS_RESERVADAS = ['sair', 'receber', '0'] as const;
export const MAXIMO_OPCOES = 9;
const PROFUNDIDADE_MAXIMA = 3;

// ─── Mensagens prontas ────────────────────────────────────────────────────

export const TIPOS_MENSAGEM_BOT = [
  'boas_vindas',
  'fora_horario',
  'nao_entendi',
  'nao_entendi_de_novo',
  'transferencia',
  'encerramento',
  'saida_avisos',
  'volta_avisos',
  'convite_avisos',
  'pesquisa_atendimento',
  'pesquisa_barbearia',
  'pesquisa_comentario',
  'pesquisa_obrigado',
] as const;
export type TipoMensagemBot = (typeof TIPOS_MENSAGEM_BOT)[number];
export type MensagensBot = Record<TipoMensagemBot, string>;

export const SOBRE_MENSAGEM_BOT: Readonly<
  Record<TipoMensagemBot, { nome: string; quando: string }>
> = {
  boas_vindas: { nome: 'Boas-vindas', quando: 'Primeira mensagem da conversa, antes do menu.' },
  fora_horario: {
    nome: 'Fora do horário',
    quando: 'Quando a conversa começa com a barbearia fechada. O menu continua funcionando.',
  },
  nao_entendi: {
    nome: 'Não entendi',
    quando:
      'Quando a resposta não é uma opção do menu nem uma palavra-chave. As opções seguem numa linha só.',
  },
  nao_entendi_de_novo: {
    nome: 'Não entendi de novo',
    quando:
      'No segundo erro seguido. Depois dele o bot fica quieto até o cliente mandar uma opção, uma palavra-chave ou 0, para não encher a conversa.',
  },
  transferencia: {
    nome: 'Passar para atendente',
    quando: 'Quando o cliente pede um atendente. O bot fica quieto até a recepção devolver.',
  },
  encerramento: {
    nome: 'Encerramento',
    quando: 'Quando a recepção termina o atendimento e devolve a conversa ao bot.',
  },
  saida_avisos: {
    nome: 'Parar avisos (SAIR)',
    quando: 'Quando o cliente responde SAIR: confirma que ele não recebe mais lembretes.',
  },
  volta_avisos: {
    nome: 'Voltar a receber (RECEBER)',
    quando: 'Quando o cliente responde RECEBER depois de ter saído.',
  },
  convite_avisos: {
    nome: 'Convite para receber avisos',
    quando:
      'No fim da primeira conversa de um número que ainda não escolheu. Só quem responde RECEBER recebe lembretes.',
  },
  pesquisa_atendimento: {
    nome: 'Pesquisa: nota do atendimento',
    quando:
      'Uma hora depois de fechar a comanda, para quem aceitou avisos. Use {profissional} para o nome de quem atendeu.',
  },
  pesquisa_barbearia: {
    nome: 'Pesquisa: nota da barbearia',
    quando: 'Depois que o cliente dá a nota do atendimento.',
  },
  pesquisa_comentario: {
    nome: 'Pesquisa: comentário',
    quando: 'Depois da nota da barbearia. O cliente escreve ou responde 0 para terminar.',
  },
  pesquisa_obrigado: { nome: 'Pesquisa: agradecimento', quando: 'No fim da pesquisa.' },
};

export const MENSAGENS_BOT_PADRAO: Readonly<MensagensBot> = {
  boas_vindas: 'Olá, {cliente}! Aqui é a {barbearia}.',
  fora_horario:
    'Agora estamos fechados. Funcionamos {horario}. Você pode agendar pelo menu a qualquer hora.',
  nao_entendi: 'Não entendi. Responda com o número de uma das opções:',
  nao_entendi_de_novo:
    'Ainda não entendi. Digite 0 para ver as opções ou ATENDENTE para falar com a nossa equipe.',
  transferencia: 'Certo! Um atendente vai responder por aqui assim que possível.',
  encerramento: 'Obrigado pelo contato! Quando precisar, é só mandar uma mensagem.',
  saida_avisos:
    'Pronto, você não vai mais receber lembretes nem avisos. Para voltar a receber, responda RECEBER.',
  volta_avisos: 'Combinado! Você volta a receber os lembretes da {barbearia}.',
  convite_avisos:
    'Quer receber lembretes dos seus horários por aqui? Responda RECEBER. Para parar a qualquer momento, responda SAIR.',
  pesquisa_atendimento:
    'Oi, {cliente}! Obrigado pela visita na {barbearia}. De 1 a 5, que nota você dá para o atendimento de {profissional}? Responda só com o número.',
  pesquisa_barbearia:
    'Valeu! E de 1 a 5, que nota você dá para a barbearia (ambiente, recepção, pontualidade)?',
  pesquisa_comentario: 'Quer deixar um comentário? Escreva aqui, ou responda 0 para terminar.',
  pesquisa_obrigado: 'Obrigado pela avaliação! Ela ajuda a gente a melhorar.',
};

/** Resposta fora de 1 a 5 durante a pesquisa (uma vez só; na segunda, a pesquisa termina). */
export const NOTA_NAO_ENTENDIDA = 'Responda só com um número de 1 a 5, por favor.';

/** Menu que toda barbearia recebe pronto, para editar à vontade. */
export const MENU_BOT_PADRAO: Readonly<MenuBot> = {
  menu: {
    texto: 'Como posso ajudar?',
    opcoes: [
      {
        id: 'agendar',
        rotulo: 'Agendar horário',
        resposta: 'Para agendar, escolha o serviço, o barbeiro e o horário por aqui:',
        acao: 'agendar',
        submenu: null,
      },
      {
        id: 'precos',
        rotulo: 'Ver preços',
        resposta: 'Nossos preços:',
        acao: 'ver_precos',
        submenu: null,
      },
      {
        id: 'endereco',
        rotulo: 'Endereço e horário',
        resposta: 'Estamos em {endereco}.\n{mapa}\nFuncionamos {horario}.',
        acao: 'endereco',
        submenu: null,
      },
      {
        id: 'atendente',
        rotulo: 'Falar com um atendente',
        resposta: 'Certo! Um atendente vai responder por aqui assim que possível.',
        acao: 'falar_com_atendente',
        submenu: null,
      },
    ],
  },
  palavrasChave: [
    {
      id: 'kw-precos',
      palavras: ['preço', 'preços', 'valor', 'quanto custa', 'tabela'],
      resposta: 'Nossos preços:',
      acao: 'ver_precos',
    },
    {
      id: 'kw-agendar',
      palavras: ['agendar', 'marcar', 'horário', 'agenda'],
      resposta: 'Para agendar, escolha o serviço, o barbeiro e o horário por aqui:',
      acao: 'agendar',
    },
    {
      id: 'kw-endereco',
      palavras: ['endereço', 'onde fica', 'localização', 'como chegar'],
      resposta: 'Estamos em {endereco}.\n{mapa}\nFuncionamos {horario}.',
      acao: 'endereco',
    },
    {
      id: 'kw-atendente',
      palavras: ['atendente', 'humano', 'pessoa', 'falar com alguém'],
      resposta: 'Certo! Um atendente vai responder por aqui assim que possível.',
      acao: 'falar_com_atendente',
    },
    {
      id: 'kw-menu',
      palavras: ['menu', 'início', 'voltar'],
      resposta: '',
      acao: 'voltar_menu',
    },
  ],
};

// ─── Texto ────────────────────────────────────────────────────────────────

/** "Preço!" → "preco": sem acento, minúsculo, só letras, números e espaços simples. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export type ValoresBot = Partial<Record<VariavelBot, string | null>>;

/**
 * Troca {variavel} pelo valor. Sem valor, a variável some e a pontuação em volta é arrumada;
 * uma linha que só tinha variáveis vazias sai inteira.
 */
export function preencher(texto: string, valores: ValoresBot): string {
  const trocar = (linha: string) =>
    linha.replace(/\{(\w+)\}/g, (inteiro, nome: string) =>
      nome in VARIAVEIS_BOT ? (valores[nome as VariavelBot] ?? '') : inteiro,
    );
  return texto
    .split('\n')
    .filter((linha) => !/\{\w+\}/.test(linha) || trocar(linha).trim() !== '')
    .map((linha) =>
      trocar(linha)
        .replace(/[ \t]+([,!?.])/g, '$1')
        .replace(/,([!?.])/g, '$1')
        .replace(/[ \t]{2,}/g, ' ')
        .trimEnd(),
    )
    .join('\n')
    .trim();
}

/** A mensagem do menu como o cliente vê: texto, opções numeradas e o "0" nos submenus. */
export function textoDoMenu(menu: MenuNo, valores: ValoresBot, submenu: boolean): string {
  const linhas = menu.opcoes.map((o, i) => `${i + 1}. ${preencher(o.rotulo, valores)}`);
  if (submenu) linhas.push('0. Voltar');
  return `${preencher(menu.texto, valores)}\n\n${linhas.join('\n')}`;
}

// ─── Validação do menu ────────────────────────────────────────────────────

export interface ProblemaMenu {
  /** Onde está o problema, em palavras ("Opção 2 do menu principal"). */
  onde: string;
  mensagem: string;
}

function variaveisDesconhecidas(texto: string): string[] {
  return [...texto.matchAll(/\{(\w+)\}/g)]
    .map((m) => m[1]!)
    .filter((nome) => !(nome in VARIAVEIS_BOT));
}

/** Tudo que impede publicar o menu, com o lugar exato. Lista vazia = pode publicar. */
export function validarMenu(m: MenuBot): ProblemaMenu[] {
  const problemas: ProblemaMenu[] = [];
  const checarTexto = (onde: string, texto: string) => {
    for (const v of variaveisDesconhecidas(texto))
      problemas.push({ onde, mensagem: `A variável {${v}} não existe.` });
  };
  const visitar = (menu: MenuNo, nome: string, profundidade: number) => {
    if (!menu.texto.trim()) problemas.push({ onde: nome, mensagem: 'Escreva o texto do menu.' });
    checarTexto(nome, menu.texto);
    if (menu.opcoes.length === 0)
      problemas.push({ onde: nome, mensagem: 'O menu precisa de pelo menos uma opção.' });
    if (menu.opcoes.length > MAXIMO_OPCOES)
      problemas.push({ onde: nome, mensagem: `No máximo ${MAXIMO_OPCOES} opções por menu.` });
    menu.opcoes.forEach((o, i) => {
      const onde = `Opção ${i + 1} ${nome === 'Menu principal' ? 'do menu principal' : `de ${nome}`}`;
      if (!o.rotulo.trim()) problemas.push({ onde, mensagem: 'Dê um nome para a opção.' });
      if (!o.resposta.trim() && !o.acao && !o.submenu)
        problemas.push({ onde, mensagem: 'Escreva a resposta ou escolha o que a opção faz.' });
      checarTexto(onde, o.rotulo);
      checarTexto(onde, o.resposta);
      if (o.submenu) {
        if (profundidade >= PROFUNDIDADE_MAXIMA)
          problemas.push({ onde, mensagem: `No máximo ${PROFUNDIDADE_MAXIMA} níveis de menu.` });
        else visitar(o.submenu, `"${o.rotulo || `opção ${i + 1}`}"`, profundidade + 1);
      }
    });
  };
  visitar(m.menu, 'Menu principal', 1);

  const vistas = new Map<string, number>();
  m.palavrasChave.forEach((g, i) => {
    const onde = `Palavras-chave, grupo ${i + 1}`;
    const palavras = g.palavras.map(normalizar).filter(Boolean);
    if (palavras.length === 0)
      problemas.push({ onde, mensagem: 'Informe pelo menos uma palavra.' });
    if (!g.resposta.trim() && !g.acao)
      problemas.push({ onde, mensagem: 'Escreva a resposta ou escolha o que o grupo faz.' });
    checarTexto(onde, g.resposta);
    for (const p of palavras) {
      if ((PALAVRAS_RESERVADAS as readonly string[]).includes(p))
        problemas.push({ onde, mensagem: `"${p}" é uma palavra do sistema e não pode ser usada.` });
      const outro = vistas.get(p);
      if (outro !== undefined && outro !== i)
        problemas.push({ onde, mensagem: `"${p}" já está no grupo ${outro + 1}.` });
      vistas.set(p, i);
    }
  });
  return problemas;
}

// ─── Horário ──────────────────────────────────────────────────────────────

export interface TurnoBot {
  /** 0 = domingo … 6 = sábado. */
  diaSemana: number;
  inicioMin: number;
  fimMin: number;
}

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const DIAS_PLURAL = ['domingos', 'segundas', 'terças', 'quartas', 'quintas', 'sextas', 'sábados'];
const hora = (min: number) =>
  min % 60 === 0
    ? `${Math.floor(min / 60)}h`
    : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;

/** "de segunda a sábado, das 9h às 19h" — junta dias seguidos com o mesmo horário. */
export function descreverHorario(turnos: readonly TurnoBot[]): string {
  const porDia = new Map<number, string>();
  for (const t of [...turnos].sort((a, b) => a.inicioMin - b.inicioMin)) {
    const atual = porDia.get(t.diaSemana);
    const faixa = `das ${hora(t.inicioMin)} às ${hora(t.fimMin)}`;
    porDia.set(t.diaSemana, atual ? `${atual} e ${faixa}` : faixa);
  }
  if (porDia.size === 0) return 'com horário a combinar';
  // Semana começando na segunda, como o balcão fala.
  const ordem = [1, 2, 3, 4, 5, 6, 0].filter((d) => porDia.has(d));
  const grupos: { dias: number[]; faixa: string }[] = [];
  for (const d of ordem) {
    const ultimo = grupos[grupos.length - 1];
    const anterior = ultimo?.dias[ultimo.dias.length - 1];
    const seguido = anterior !== undefined && (anterior + 1) % 7 === d;
    if (ultimo && ultimo.faixa === porDia.get(d) && seguido) ultimo.dias.push(d);
    else grupos.push({ dias: [d], faixa: porDia.get(d)! });
  }
  return grupos
    .map(({ dias, faixa }) => {
      const d = dias[0]!;
      const nome =
        dias.length === 1
          ? `${d === 0 || d === 6 ? 'aos' : 'às'} ${DIAS_PLURAL[d]}`
          : `de ${DIAS[d]} a ${DIAS[dias[dias.length - 1]!]}`;
      return `${nome}, ${faixa}`;
    })
    .join('; ');
}

/** Agora está dentro de algum turno? Hora de São Paulo (-03:00). */
export function dentroDoHorario(turnos: readonly TurnoBot[], agora: Date): boolean {
  const local = new Date(agora.getTime() - 3 * 3_600_000);
  const dia = local.getUTCDay();
  const min = local.getUTCHours() * 60 + local.getUTCMinutes();
  return turnos.some((t) => t.diaSemana === dia && min >= t.inicioMin && min < t.fimMin);
}

// ─── Conversa ─────────────────────────────────────────────────────────────

/** Sem resposta por este tempo, a conversa recomeça do menu principal. */
export const EXPIRACAO_SESSAO_MIN = 30;
/** Com atendente, o bot espera mais antes de voltar sozinho: a recepção pode demorar. */
export const EXPIRACAO_ATENDENTE_MIN = 120;

export interface SessaoBot {
  /** Ids das opções que abriram submenus, da raiz até o menu atual. */
  caminho: string[];
  /** ISO da última mensagem do cliente. */
  ultimaEm: string;
  /** Pediu atendente: o bot fica quieto até a recepção devolver. */
  comAtendente: boolean;
  /** Respostas seguidas que o bot não entendeu (sessões antigas não têm: conta 0). */
  erros?: number;
  /** Pesquisa depois do atendimento em andamento: vale mesmo depois dos 30 min da sessão. */
  pesquisa?: { avaliacaoId: string; passo: PassoPesquisa; erros?: number };
}

export type PassoPesquisa = 'atendimento' | 'barbearia' | 'comentario';

/** O que gravar da pesquisa a cada resposta. */
export interface RespostaPesquisa {
  avaliacaoId: string;
  notaAtendimento?: number;
  notaBarbearia?: number;
  comentario?: string | null;
  concluida: boolean;
}

/** A partir deste erro seguido, o bot para de responder até o cliente acertar. */
export const ERROS_ATE_SILENCIO = 3;

export interface ContextoConversa {
  agora: Date;
  /** Primeiro nome, se o telefone já é de um cliente. */
  cliente: string | null;
  /** Nome da conta, o que o cliente conhece. */
  barbearia: string;
  unidade: string;
  endereco: string | null;
  horario: string;
  dentroDoHorario: boolean;
  link: string | null;
  precos: readonly { nome: string; valor: number }[];
  /** Número que ainda não escolheu se recebe avisos: a primeira conversa termina com o convite. */
  pedirConsentimento?: boolean;
}

export interface ResultadoConversa {
  respostas: string[];
  sessao: SessaoBot;
  /** O que aconteceu, para quem chamou registrar (transferência, consentimento). */
  acao: AcaoBot | null;
  /** true = voltou a aceitar avisos; false = pediu para sair. */
  consentimento: boolean | null;
  /** Resposta da pesquisa depois do atendimento, para gravar na avaliação. */
  avaliacao: RespostaPesquisa | null;
}

function menuNoCaminho(
  menu: MenuNo,
  caminho: readonly string[],
): { menu: MenuNo; caminho: string[] } {
  let atual = menu;
  const valido: string[] = [];
  for (const id of caminho) {
    const opcao = atual.opcoes.find((o) => o.id === id);
    if (!opcao?.submenu) break;
    atual = opcao.submenu;
    valido.push(id);
  }
  return { menu: atual, caminho: valido };
}

function contem(texto: string, palavra: string): boolean {
  const p = normalizar(palavra);
  return !!p && ` ${texto} `.includes(` ${p} `);
}

const NUMEROS_POR_EXTENSO: Readonly<Record<string, number>> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
};

/**
 * Qual opção o cliente quis, aceitando o jeito que as pessoas escrevem: "2", "2.", "opção 2",
 * "a dois", "2 por favor" ou o nome da opção ("precos", "quero ver preços"). Pelo nome, só
 * quando uma opção só combina, para nunca escolher no chute. `texto` já vem normalizado.
 */
export function opcaoEscolhida(
  texto: string,
  menu: MenuNo,
  valores: ValoresBot = {},
): OpcaoMenu | null {
  const t = texto.replace(/^(?:a |o )?(?:opcao|opc|op|numero|num|n)\s+/, '').replace(/^a |^o /, '');
  const digitos = /^(\d{1,2})(?:\s|$)/.exec(t);
  const numero = digitos ? Number(digitos[1]) : NUMEROS_POR_EXTENSO[t];
  if (numero !== undefined) return menu.opcoes[numero - 1] ?? null;
  if (t.length < 4) return null;
  const combinam = menu.opcoes.filter((o) => {
    const rotulo = normalizar(preencher(o.rotulo, valores));
    return !!rotulo && (contem(rotulo, t) || contem(t, rotulo));
  });
  return combinam.length === 1 ? combinam[0]! : null;
}

/**
 * Só as opções, uma por linha (sem o texto do menu), para o "não entendi": no celular, uma
 * linha corrida com "·" quebra no meio e fica ilegível.
 */
export function opcoesEmLista(menu: MenuNo, valores: ValoresBot, submenu: boolean): string {
  const itens = menu.opcoes.map((o, i) => `${i + 1}. ${preencher(o.rotulo, valores)}`);
  if (submenu) itens.push('0. Voltar');
  return itens.join('\n');
}

/**
 * "Oi", "oiii", "olá", "bom dia", "e aí", "opa", com ou sem um "tudo bem" depois. O cliente
 * cumprimentando no meio da conversa quer o menu de novo, não um "não entendi".
 * `texto` já vem normalizado.
 */
export function ehSaudacao(texto: string): boolean {
  const t = texto.replace(/(.)\1{2,}/g, '$1$1'); // "oiiiii" → "oii"
  return /^(?:o+i+e?|oie|ola+|eai|e ai|opa+|salve|hey|eae|bom dia|boa tarde|boa noite|boa)(?: (?:tudo bem|tudo bom|tudo certo|blz|beleza|td bem|bom dia|boa tarde|boa noite))?$/.test(
    t,
  );
}

/** Uma mensagem do cliente → o que o bot responde e como a conversa fica. */
export function responder(
  m: MenuBot,
  mensagens: MensagensBot,
  sessaoAnterior: SessaoBot | null,
  entrada: string,
  ctx: ContextoConversa,
): ResultadoConversa {
  const valores: ValoresBot = {
    cliente: ctx.cliente?.trim().split(/\s+/)[0] ?? null,
    barbearia: ctx.barbearia,
    unidade: ctx.unidade,
    endereco: ctx.endereco,
    mapa: ctx.endereco
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ctx.endereco)}`
      : null,
    horario: ctx.horario,
    link: ctx.link,
  };
  const msg = (t: TipoMensagemBot) => preencher(mensagens[t], valores);
  const texto = normalizar(entrada);
  const agoraIso = ctx.agora.toISOString();
  const limiteMin = sessaoAnterior?.comAtendente ? EXPIRACAO_ATENDENTE_MIN : EXPIRACAO_SESSAO_MIN;
  const expirou =
    !sessaoAnterior ||
    ctx.agora.getTime() - Date.parse(sessaoAnterior.ultimaEm) > limiteMin * 60_000;
  const sessao: SessaoBot = expirou
    ? { caminho: [], ultimaEm: agoraIso, comAtendente: false }
    : { ...sessaoAnterior!, ultimaEm: agoraIso };
  // Qualquer resposta entendida zera a conta; só o "não entendi" lá embaixo soma.
  const errosAntes = expirou ? 0 : (sessao.erros ?? 0);
  sessao.erros = 0;
  const resultado = (
    respostas: string[],
    extra: Partial<Omit<ResultadoConversa, 'respostas'>> = {},
  ): ResultadoConversa => ({
    respostas: respostas.filter((r) => r.trim()),
    sessao,
    acao: null,
    consentimento: null,
    avaliacao: null,
    ...extra,
  });
  // Conversa nova de quem ainda não escolheu: o convite fecha a primeira resposta.
  const comConvite = (r: ResultadoConversa): ResultadoConversa =>
    expirou && ctx.pedirConsentimento && !sessao.comAtendente
      ? { ...r, respostas: [...r.respostas, msg('convite_avisos')].filter((t) => t.trim()) }
      : r;

  // A pesquisa sobrevive à expiração da sessão (a resposta pode vir horas depois).
  if (sessaoAnterior?.pesquisa) sessao.pesquisa = sessaoAnterior.pesquisa;

  // Avisos: valem sempre, até com atendente. SAIR também encerra a pesquisa.
  if (texto === 'sair') {
    delete sessao.pesquisa;
    return resultado([msg('saida_avisos')], { consentimento: false });
  }
  if (texto === 'receber') return resultado([msg('volta_avisos')], { consentimento: true });

  // Pesquisa depois do atendimento: nota do atendimento → da barbearia → comentário.
  const pesquisa = sessao.pesquisa;
  if (pesquisa) {
    const { avaliacaoId } = pesquisa;
    if (pesquisa.passo === 'comentario') {
      delete sessao.pesquisa;
      const pular = ['0', 'nao', 'n', 'pular', 'nada', 'nenhum', 'sem comentario'].includes(texto);
      return resultado([msg('pesquisa_obrigado')], {
        avaliacao: {
          avaliacaoId,
          comentario: pular || !entrada.trim() ? null : entrada.trim().slice(0, 500),
          concluida: true,
        },
      });
    }
    const nota = lerNota(entrada);
    if (nota !== null) {
      sessao.pesquisa =
        pesquisa.passo === 'atendimento'
          ? { avaliacaoId, passo: 'barbearia' }
          : { avaliacaoId, passo: 'comentario' };
      return resultado(
        [msg(pesquisa.passo === 'atendimento' ? 'pesquisa_barbearia' : 'pesquisa_comentario')],
        {
          avaliacao: {
            avaliacaoId,
            ...(pesquisa.passo === 'atendimento'
              ? { notaAtendimento: nota }
              : { notaBarbearia: nota }),
            concluida: false,
          },
        },
      );
    }
    // Não é nota: pede de novo uma vez; na segunda, larga a pesquisa e segue o menu.
    if (!pesquisa.erros) {
      sessao.pesquisa = { ...pesquisa, erros: 1 };
      return resultado([NOTA_NAO_ENTENDIDA]);
    }
    delete sessao.pesquisa;
  }

  // Com atendente, quem responde é a recepção.
  if (sessao.comAtendente) return resultado([]);

  const abertura = expirou
    ? [ctx.dentroDoHorario ? '' : msg('fora_horario'), msg('boas_vindas')]
    : [];
  const posicao = menuNoCaminho(m.menu, sessao.caminho);
  sessao.caminho = posicao.caminho;
  const menuAtual = () =>
    textoDoMenu(menuNoCaminho(m.menu, sessao.caminho).menu, valores, sessao.caminho.length > 0);

  const executar = (resposta: string, acao: AcaoBot | null): ResultadoConversa => {
    const corpo = preencher(resposta, valores);
    switch (acao) {
      case 'voltar_menu':
        sessao.caminho = [];
        return resultado([...abertura, corpo, menuAtual()], { acao });
      case 'ver_precos': {
        const tabela = ctx.precos.length
          ? ctx.precos.map((p) => `• ${p.nome}: ${formatarMoeda(p.valor)}`).join('\n')
          : 'A tabela de preços ainda não foi cadastrada.';
        return resultado([...abertura, `${corpo}\n${tabela}`.trim(), 'Digite 0 para ver o menu.'], {
          acao,
        });
      }
      case 'agendar':
        return resultado(
          [
            ...abertura,
            ctx.link ? `${corpo}\n${ctx.link}`.trim() : msg('transferencia'),
            'Digite 0 para ver o menu.',
          ],
          { acao: ctx.link ? acao : 'falar_com_atendente' },
        );
      case 'falar_com_atendente':
        sessao.comAtendente = true;
        return resultado([...abertura, corpo || msg('transferencia')], { acao });
      default:
        return resultado([...abertura, corpo, 'Digite 0 para ver o menu.'], { acao });
    }
  };

  // Palavra-chave em qualquer ponto da conversa.
  const grupo = m.palavrasChave.find((g) => g.palavras.some((p) => contem(texto, p)));
  if (grupo) return comConvite(executar(grupo.resposta, grupo.acao));

  // Conversa nova sem palavra-chave: abertura, menu e (se for o caso) o convite.
  if (expirou) return comConvite(resultado([...abertura, menuAtual()]));

  // Cumprimentou no meio da conversa: recomeça do menu principal, com as boas-vindas.
  if (ehSaudacao(texto)) {
    sessao.caminho = [];
    return resultado([msg('boas_vindas'), menuAtual()]);
  }

  if (texto === '0') {
    sessao.caminho = sessao.caminho.slice(0, -1);
    return resultado([menuAtual()]);
  }

  const opcao = opcaoEscolhida(texto, posicao.menu, valores);
  if (!opcao) {
    // Não repete o menu a cada erro: 1º, aviso curto com as opções numa linha; 2º, oferece
    // ver o menu ou falar com alguém; do 3º em diante, silêncio até o cliente acertar.
    sessao.erros = errosAntes + 1;
    if (sessao.erros >= ERROS_ATE_SILENCIO) return resultado([]);
    if (sessao.erros === 2) return resultado([msg('nao_entendi_de_novo')]);
    return resultado([
      `${msg('nao_entendi')}\n\n${opcoesEmLista(posicao.menu, valores, sessao.caminho.length > 0)}`,
    ]);
  }
  if (opcao.submenu) {
    sessao.caminho = [...sessao.caminho, opcao.id];
    const intro = opcao.resposta.trim() ? [preencher(opcao.resposta, valores)] : [];
    return resultado([...intro, menuAtual()]);
  }
  return executar(opcao.resposta, opcao.acao);
}
