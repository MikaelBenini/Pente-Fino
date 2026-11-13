// Admin F6: chat do site com a equipe do Pente Fino. O visitante deixa nome e contato, escreve a
// dúvida e entra na fila; alguém da equipe assume, conversa e encerra. Fora do horário, a
// mensagem fica guardada e a equipe responde pelo contato. As mensagens chegam por consulta
// periódica (alguns segundos), sem conexão aberta.
import { z } from 'zod';

/** Horário de atendimento (Brasília): segunda a sexta das 9 h às 18 h, sábado das 9 h às 13 h. */
export const HORARIO_CHAT: Readonly<Record<number, readonly [number, number] | null>> = {
  0: null,
  1: [9, 18],
  2: [9, 18],
  3: [9, 18],
  4: [9, 18],
  5: [9, 18],
  6: [9, 13],
};
export const TEXTO_HORARIO_CHAT = 'Segunda a sexta, das 9h às 18h, e sábado, das 9h às 13h';

/** Dentro do horário de atendimento agora (fuso de São Paulo)? */
export function chatEmHorario(agora: Date): boolean {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'short',
      hour: 'numeric',
      hourCycle: 'h23',
    })
      .formatToParts(agora)
      .map((p) => [p.type, p.value]),
  );
  const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(partes.weekday ?? '');
  const faixa = HORARIO_CHAT[dia];
  const hora = Number(partes.hour);
  return !!faixa && hora >= faixa[0] && hora < faixa[1];
}

const texto = z
  .string()
  .trim()
  .min(1, { error: 'Escreva a mensagem.' })
  .max(2000, { error: 'Mensagem muito longa (até 2000 caracteres).' });

/** O contato: WhatsApp (só dígitos, com DDD) ou e-mail. */
const contato = z
  .string()
  .trim()
  .min(5, { error: 'Deixe seu WhatsApp ou e-mail para a gente responder.' })
  .max(120)
  .refine((v) => /\S+@\S+\.\S+/.test(v) || v.replace(/\D/g, '').length >= 10, {
    error: 'Informe um WhatsApp com DDD ou um e-mail válido.',
  });

export const iniciarChatSchema = z.object({
  nome: z.string().trim().min(2, { error: 'Diga seu nome.' }).max(80),
  contato,
  texto,
  /** Página onde a conversa começou (ex.: /planos). */
  pagina: z.string().trim().max(200).optional(),
});
export type IniciarChatEntrada = z.infer<typeof iniciarChatSchema>;

export const mensagemChatSchema = z.object({ texto });
export type MensagemChatEntrada = z.infer<typeof mensagemChatSchema>;

export type StatusChat = 'fila' | 'atendendo' | 'encerrada';

export interface MensagemChat {
  id: string;
  de: 'visitante' | 'equipe';
  /** Nome de quem da equipe escreveu (para o visitante, só o primeiro nome). */
  autor: string | null;
  texto: string;
  criadoEm: string;
}

/** O que o visitante recebe ao consultar a conversa. */
export interface ChatDoVisitante {
  status: StatusChat;
  /** Posição na fila (1 = é o próximo); null fora da fila. */
  posicao: number | null;
  /** Primeiro nome de quem está atendendo. */
  atendente: string | null;
  emHorario: boolean;
  mensagens: MensagemChat[];
}

export interface ChatIniciado {
  id: string;
  /** Segredo do visitante para ler e escrever nesta conversa (guardado só no navegador dele). */
  token: string;
}

/** Linha da lista da administração. */
export interface ConversaNaFila {
  id: string;
  status: StatusChat;
  nome: string;
  contato: string;
  pagina: string | null;
  atendente: string | null;
  criadoEm: string;
  ultimaMensagemEm: string;
  /** Texto da última mensagem (até 120 caracteres). */
  ultimaMensagem: string;
  /** A última mensagem é do visitante (esperando resposta). */
  esperandoEquipe: boolean;
  /** O visitante se cadastrou depois de conversar (conta criada pelo site). */
  virouConta: { id: string; nome: string } | null;
  /** "site" (visitante) ou "painel" (cliente logado, pela Ajuda). */
  origem: 'site' | 'painel';
}

/** Conversa aberta na administração. */
export interface ConversaDaEquipe extends ConversaNaFila {
  mensagens: MensagemChat[];
}

/** Aviso que o visitante vê junto da conversa. */
export function avisoDoChat(
  c: Pick<ChatDoVisitante, 'status' | 'posicao' | 'atendente' | 'emHorario'>,
): string {
  if (c.status === 'encerrada') return 'Conversa encerrada. Se precisar, comece outra.';
  if (c.status === 'atendendo' && c.atendente) return `${c.atendente} está te atendendo.`;
  if (!c.emHorario)
    return `Estamos fora do horário (${TEXTO_HORARIO_CHAT.toLowerCase()}). Sua mensagem ficou guardada e respondemos pelo seu contato assim que voltarmos.`;
  if (c.posicao && c.posicao > 1)
    return `Você está na fila: ${c.posicao - 1} ${c.posicao === 2 ? 'pessoa' : 'pessoas'} na sua frente. Já já alguém responde.`;
  return 'Você é o próximo da fila. Já já alguém responde.';
}

// ─── Respostas prontas e resumo (sugestões aprovadas em 13/11) ────────────

export interface RespostaPronta {
  titulo: string;
  texto: string;
}

/**
 * Respostas prontas da equipe: um clique põe o texto na caixa, e a pessoa ajusta antes de mandar.
 * Preços e dias de teste vêm de quem chama (a mesma tabela do site), para nunca ficarem velhos.
 */
export function respostasProntasDoChat(d: {
  diasTeste: number;
  basico: string;
  pro: string;
  premium: string;
}): RespostaPronta[] {
  return [
    {
      titulo: 'Preço dos planos',
      texto: `Os planos são por barbearia, não por cadeira: Básico ${d.basico}/mês (até 3 profissionais), Pro ${d.pro}/mês (até 10) e Premium ${d.premium}/mês (profissionais ilimitados e várias unidades). No anual sai mais barato. Quer que eu te ajude a escolher?`,
    },
    {
      titulo: 'Como funciona o teste',
      texto: `São ${d.diasTeste} dias grátis com tudo do plano escolhido, sem cartão e sem fidelidade. No fim do teste você decide se assina; nada é cobrado sozinho. É só criar a conta em seupentefino.com.br/cadastro.`,
    },
    {
      titulo: 'Importar a planilha',
      texto:
        'Dá para trazer o que você já tem: a configuração guiada importa clientes, serviços e preços da sua planilha antes do primeiro atendimento. Se quiser, me manda a planilha que eu te ajudo.',
    },
    {
      titulo: 'Comissão do barbeiro',
      texto:
        'A comissão sai sozinha em cada serviço e produto da comanda, com a regra de cada barbeiro, e o barbeiro vê o próprio extrato no celular. Vem em todos os planos.',
    },
    {
      titulo: 'Bot do WhatsApp',
      texto:
        'O bot usa o WhatsApp da própria barbearia, conectado por QR Code, e agenda sozinho com menus que você programa. Não usa inteligência artificial e não cobra por mensagem. Vem nos planos Pro e Premium.',
    },
    {
      titulo: 'Encerrar',
      texto:
        'Fico por aqui, mas qualquer dúvida é só chamar de novo neste chat. Boas vendas e bons atendimentos!',
    },
  ];
}

export interface ResumoDoChat {
  /** Conversas começadas no período. */
  conversas: number;
  /** Delas, quantas viraram cadastro. */
  viraramCadastro: number;
  /** 0 a 1. */
  taxaCadastro: number;
  /** Tempo médio até a primeira resposta da equipe, em minutos, só das começadas em horário; null = sem dado. */
  primeiraRespostaMin: number | null;
  /** Começadas em horário e ainda sem resposta. */
  semResposta: number;
}

/** Resumo dos últimos dias: conversas, conversão em cadastro e velocidade da primeira resposta. */
export function resumirChat(
  conversas: readonly {
    criadoEm: string;
    primeiraRespostaEm: string | null;
    virouConta: boolean;
  }[],
): ResumoDoChat {
  const emHorario = conversas.filter((c) => chatEmHorario(new Date(c.criadoEm)));
  const respondidas = emHorario.filter((c) => c.primeiraRespostaEm);
  const viraram = conversas.filter((c) => c.virouConta).length;
  const minutos = respondidas.map(
    (c) => (Date.parse(c.primeiraRespostaEm!) - Date.parse(c.criadoEm)) / 60_000,
  );
  return {
    conversas: conversas.length,
    viraramCadastro: viraram,
    taxaCadastro: conversas.length ? viraram / conversas.length : 0,
    primeiraRespostaMin: minutos.length
      ? Math.round(minutos.reduce((s, m) => s + m, 0) / minutos.length)
      : null,
    semResposta: emHorario.length - respondidas.length,
  };
}
