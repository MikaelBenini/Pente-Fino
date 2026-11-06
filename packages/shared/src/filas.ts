// Filas do BullMQ compartilhadas entre a API (produz) e o worker (consome).

export const FILA_EMAILS = 'emails';
export const FILA_EVENTOS = 'eventos';
/** Webhook do provedor de WhatsApp, já lido e conferido pela API. */
export const FILA_WHATSAPP_ENTRADA = 'whatsapp-entrada';
/** Mensagens para enviar, uma por trabalho, espaçadas por número da barbearia. */
export const FILA_WHATSAPP_SAIDA = 'whatsapp-saida';
/** Notificações no celular (push do PWA). */
export const FILA_NOTIFICACOES = 'notificacoes';

/** Uma notificação para todos os aparelhos que a pessoa ligou. */
export interface TrabalhoNotificacao {
  contaId: string;
  usuarioId: string;
  titulo: string;
  corpo: string;
  /** Tela que abre ao tocar (caminho do app). */
  url: string;
  /** Mesma etiqueta substitui a notificação anterior no aparelho. */
  etiqueta?: string;
}

export type StatusConexaoWhatsapp = 'desconectado' | 'aguardando_qr' | 'conectado';

/** O que chega do provedor, num formato que não depende dele. */
export type EventoWhatsapp =
  | {
      tipo: 'mensagem';
      instancia: string;
      /** Id da mensagem no WhatsApp: a mesma mensagem entregue duas vezes é descartada. */
      idExterno: string;
      telefone: string;
      /** Nome do perfil do WhatsApp, quando vem. */
      nome: string | null;
      /** Texto da mensagem; vazio para áudio, foto e figurinha. */
      texto: string;
      recebidaEm: string;
    }
  | {
      tipo: 'conexao';
      instancia: string;
      status: StatusConexaoWhatsapp;
      /** Número conectado (só dígitos), quando o provedor informa. */
      numero: string | null;
    };

/**
 * Mensagens escritas no painel (resposta da recepção, "devolver ao bot"): passam pela fila de
 * entrada para o worker espaçá-las junto com as do bot, no mesmo relógio por número.
 */
export interface EnvioDoPainel {
  tipo: 'enviar';
  contaId: string;
  instancia: string;
  mensagemIds: string[];
}

/** Hora de mandar a pesquisa depois do atendimento (trabalho atrasado, criado no fechamento). */
export interface InicioDePesquisa {
  tipo: 'pesquisa';
  contaId: string;
  avaliacaoId: string;
}

/** Hora de lembrar o cliente do horário (trabalho atrasado, criado ao marcar ou remarcar). */
export interface LembreteDeHorario {
  tipo: 'lembrete';
  contaId: string;
  agendamentoId: string;
  lembrete: '24h' | '2h';
  /** Horário quando o lembrete foi agendado: se remarcaram, este fica para trás e não sai. */
  inicio: string;
}

/** O que vai na fila `whatsapp-entrada`: eventos do provedor, envios do painel, pesquisas e lembretes. */
/** Assistente da equipe: "próximo cliente em 15 minutos" (trabalho atrasado por agendamento). */
export interface ProximoClienteDaEquipe {
  tipo: 'proximo_cliente';
  contaId: string;
  agendamentoId: string;
  inicio: string;
}

/** Assistente da equipe: agenda do dia ou resumo; ao rodar, agenda o próximo. */
export interface RotinaDaEquipe {
  tipo: 'rotina_equipe';
  contaId: string;
  assistenteId: string;
  rotina: 'agenda' | 'resumo' | 'gestao';
  dia: string;
}

/** Nota 1 ou 2: aviso para dono e gestor (no fim da pesquisa ou depois da espera). */
export interface NotaBaixaParaGestao {
  tipo: 'nota_baixa';
  contaId: string;
  avaliacaoId: string;
}

/** 2 h depois do pedido de atendente: se ninguém respondeu, o bot volta e avisa o cliente. */
export interface FimDaEsperaDoAtendente {
  tipo: 'atendente_expira';
  contaId: string;
  unidadeId: string;
  telefone: string;
  /** Início da espera (ISO): outra espera depois desta não é encerrada por este trabalho. */
  desde: string;
}

/** Rotina diária das automações (retorno e aniversário) em todas as contas que ligaram. */
export interface RotinaDasAutomacoes {
  tipo: 'automacoes';
}

/** Vagou um horário (cancelamento, falta, remarcação): oferecer para a lista de espera. */
export interface VagaLiberada {
  tipo: 'vaga';
  contaId: string;
  unidadeId: string;
  profissionalId: string;
  inicio: string;
  fim: string;
}

/** "Não veio" por atraso: 5 min depois (tempo de desfazer), manda a remarcação rápida. */
export interface RemarcacaoPorAtraso {
  tipo: 'atraso';
  contaId: string;
  agendamentoId: string;
}

/** A barbearia moveu o horário: avisa o cliente depois do tempo de desfazer, se nada mudou de novo. */
export interface HorarioMudou {
  tipo: 'horario_mudou';
  contaId: string;
  agendamentoId: string;
  /** Horário e barbeiro depois do movimento: se mudaram de novo (desfazer), o aviso não sai. */
  inicio: string;
  profissionalId: string;
  mudouHorario: boolean;
}

/** Rotina dos avisos da equipe (a cada 15 min): comandas pendentes para a recepção. */
export interface RotinaDosAvisos {
  tipo: 'avisos';
}

export type TrabalhoWhatsappEntrada =
  | EventoWhatsapp
  | EnvioDoPainel
  | InicioDePesquisa
  | LembreteDeHorario
  | ProximoClienteDaEquipe
  | RotinaDaEquipe
  | NotaBaixaParaGestao
  | FimDaEsperaDoAtendente
  | RotinaDasAutomacoes
  | VagaLiberada
  | RemarcacaoPorAtraso
  | HorarioMudou
  | RotinaDosAvisos;

/** Uma mensagem já gravada (tabela mensagem) esperando a vez de sair. */
export interface TrabalhoWhatsappSaida {
  contaId: string;
  mensagemId: string;
}

/** E-mail pronto para envio; o worker só entrega. */
export interface TrabalhoEmail {
  para: string;
  assunto: string;
  texto: string;
  html?: string;
}

/** Eventos de domínio (docs/documentacao-do-produto.md, seção 5). */
export const EVENTOS = [
  'agendamento.criado',
  'comanda.confirmada',
  'comanda.fechada',
  'comanda.reaberta',
  'mensagem.recebida',
  'adesao.vencida',
  'usuario.convidado',
  'usuario.senha_alterada',
] as const;
export type NomeEvento = (typeof EVENTOS)[number];

/** Envelope de todo evento: a conta vai junto para o worker abrir naConta(). */
export interface EventoDominio<D = Record<string, unknown>> {
  nome: NomeEvento;
  contaId: string;
  ocorridoEm: string;
  dados: D;
}
