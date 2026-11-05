// Entradas e respostas da API do bot (Etapa 10). Mesma validação no painel e na API.
import { z } from 'zod';
import type { StatusConexaoWhatsapp } from './filas.js';
import {
  ACOES_BOT,
  MAXIMO_OPCOES,
  TIPOS_MENSAGEM_BOT,
  VARIAVEIS_BOT,
  type GrupoPalavrasChave,
  type MensagensBot,
  type MenuBot,
  type MenuNo,
  type OpcaoMenu,
  type ProblemaMenu,
  type SessaoBot,
  type TurnoBot,
} from './bot.js';

const acao = z.enum(ACOES_BOT).nullable();
const id = z.string().trim().min(1).max(40);
const textoLivre = z.string().max(1000, { error: 'Texto muito longo (até 1.000 caracteres).' });

const opcaoSchema: z.ZodType<OpcaoMenu> = z.object({
  id,
  rotulo: z.string().trim().max(60, { error: 'Nome da opção com até 60 caracteres.' }),
  resposta: textoLivre,
  acao,
  get submenu() {
    return menuNoSchema.nullable();
  },
});

const menuNoSchema: z.ZodType<MenuNo> = z.object({
  texto: textoLivre,
  opcoes: z.array(opcaoSchema).max(MAXIMO_OPCOES, { error: `No máximo ${MAXIMO_OPCOES} opções.` }),
});

const grupoSchema: z.ZodType<GrupoPalavrasChave> = z.object({
  id,
  palavras: z.array(z.string().trim().min(1).max(40)).max(20),
  resposta: textoLivre,
  acao,
});

/** Rascunho: pode estar incompleto. Para publicar, `validarMenu` tem que voltar vazio. */
export const menuBotSchema: z.ZodType<MenuBot> = z.object({
  menu: menuNoSchema,
  palavrasChave: z.array(grupoSchema).max(30, { error: 'No máximo 30 grupos de palavras-chave.' }),
});

const variaveisValidas = (t: string) =>
  [...t.matchAll(/\{(\w+)\}/g)].every((m) => (m[1] as string) in VARIAVEIS_BOT);

export const mensagensBotSchema = z.object({
  mensagens: z.partialRecord(
    z.enum(TIPOS_MENSAGEM_BOT),
    z
      .string()
      .trim()
      .min(1, { error: 'A mensagem não pode ficar vazia.' })
      .max(1000)
      .refine(variaveisValidas, { error: 'Use só as variáveis da lista.' }),
  ),
});
export type MensagensBotEntrada = z.infer<typeof mensagensBotSchema>;

const turnoSchema: z.ZodType<TurnoBot> = z
  .object({
    diaSemana: z.number().int().min(0).max(6),
    inicioMin: z.number().int().min(0).max(1439),
    fimMin: z.number().int().min(1).max(1440),
  })
  .refine((t) => t.fimMin > t.inicioMin, { error: 'O fim vem depois do início.' });

/** null = o bot segue o expediente da equipe. */
export const horarioBotSchema = z.object({
  turnos: z.array(turnoSchema).max(21).nullable(),
});
export type HorarioBotEntrada = z.infer<typeof horarioBotSchema>;

/** Agendamento em andamento no simulador (o painel devolve a sessão a cada mensagem). */
const agendaSchema = z.object({
  passo: z.enum(['servico', 'profissional', 'dia', 'horario', 'confirmar']),
  servicoIds: z.array(z.uuid()).max(10),
  profissionalId: z.uuid().nullable(),
  dia: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  opcoes: z.array(z.string().max(120)).max(60),
  pagina: z.number().int().min(0).max(50),
  escolha: z
    .object({ inicio: z.iso.datetime({ offset: true }), profissionalId: z.uuid() })
    .nullable(),
  erros: z.number().int().min(0).max(5),
});

const sessaoSchema: z.ZodType<SessaoBot> = z.object({
  caminho: z.array(id).max(5),
  ultimaEm: z.iso.datetime({ offset: true }),
  comAtendente: z.boolean(),
  erros: z.number().int().min(0).max(10).optional(),
  agenda: agendaSchema.optional(),
});

export const simularBotSchema = z.object({
  unidadeId: z.uuid({ error: 'Unidade inválida.' }),
  entrada: z.string().trim().min(1, { error: 'Escreva uma mensagem.' }).max(500),
  sessao: sessaoSchema.nullable(),
  versao: z.enum(['rascunho', 'publicado']).default('rascunho'),
  /** Simular como cliente cadastrado (mostra o {cliente} preenchido). */
  cliente: z.string().trim().max(60).nullable().default(null),
  /** Testar a mensagem de fora do horário sem esperar a barbearia fechar. */
  foraDoHorario: z.boolean().default(false),
});
export type SimularBotEntrada = z.input<typeof simularBotSchema>;
export type SimularBotDados = z.output<typeof simularBotSchema>;

// ─── Respostas ────────────────────────────────────────────────────────────

export interface UnidadeDoBot {
  id: string;
  nome: string;
  /** Horário próprio do bot; null = segue o expediente. */
  horario: TurnoBot[] | null;
  /** Expediente da equipe (turnos dos profissionais, nos dias da unidade). */
  expediente: TurnoBot[];
  /** Como o cliente lê o horário que vale. */
  descricao: string;
  aberto: boolean;
  link: string | null;
  conexao: {
    status: StatusConexaoWhatsapp;
    numero: string | null;
    /** Caiu sem ninguém pedir: o painel avisa até reconectar. */
    caiuEm: string | null;
  } | null;
}

/** Conexão do WhatsApp de uma unidade, como a tela Bot mostra. */
export interface ConexaoBot {
  unidadeId: string;
  status: StatusConexaoWhatsapp;
  numero: string | null;
  /** QR Code (data URL de imagem) enquanto aguarda a leitura pelo celular. */
  qr: string | null;
  caiuEm: string | null;
  /** O provedor não respondeu: o estado mostrado é o último conhecido. */
  erro: string | null;
  /** WhatsApp de teste (sem celular): o QR é de mentira. */
  teste: boolean;
}

/** Uma mensagem do WhatsApp no histórico do cliente. */
export interface MensagemDoCliente {
  id: string;
  direcao: 'entrada' | 'saida';
  texto: string;
  status: 'recebida' | 'pendente' | 'enviada' | 'falhou' | 'descartada';
  unidade: string;
  criadoEm: string;
}

// ─── Conversas (recepção) ─────────────────────────────────────────────────

export interface ConversaResumo {
  /** Id da sessão do número na unidade. */
  id: string;
  unidadeId: string;
  telefone: string;
  clienteId: string | null;
  cliente: string | null;
  /**
   * bot: o menu está respondendo; aguardando: pediu atendente (ou escreveu de novo) e ninguém
   * respondeu; atendimento: a equipe respondeu e o bot está quieto.
   */
  situacao: 'bot' | 'aguardando' | 'atendimento';
  /** Desde quando espera resposta da equipe (ISO). */
  aguardandoDesde: string | null;
  ultimaMensagem: { texto: string; direcao: 'entrada' | 'saida'; criadoEm: string } | null;
  atualizadoEm: string;
}

export interface ListaConversas {
  conversas: ConversaResumo[];
  /** Quantas esperam atendente nas unidades que a pessoa vê (aviso no menu). */
  aguardando: number;
  /** A unidade tem WhatsApp conectado (sem isso, a resposta não sai). */
  conectado: boolean;
}

export const responderConversaSchema = z.object({
  texto: z
    .string()
    .trim()
    .min(1, { error: 'Escreva a mensagem.' })
    .max(1000, { error: 'No máximo 1.000 caracteres.' }),
});
export type ResponderConversaEntrada = z.infer<typeof responderConversaSchema>;

export interface EstadoBot {
  publicado: { menu: MenuBot; publicadoEm: string | null; publicadoPor: string | null };
  rascunho: { menu: MenuBot; atualizadoEm: string; problemas: ProblemaMenu[] } | null;
  /** Existe versão anterior para voltar. */
  temAnterior: boolean;
  mensagens: MensagensBot;
  unidades: UnidadeDoBot[];
  /** Dono edita menu e mensagens; gestor vê, testa e ajusta o horário da unidade dele. */
  podeEditar: boolean;
  /** Pesquisa de 1 a 5 depois do atendimento ligada para a conta. */
  pesquisaAtiva: boolean;
}

export interface RespostaSimulacao {
  respostas: string[];
  sessao: SessaoBot;
  acao: string | null;
  consentimento: boolean | null;
}

export const listarConversasSchema = z.object({
  unidadeId: z.uuid({ error: 'Unidade inválida.' }).optional(),
});

// ─── Mensagem para um cliente, pelo bot ou pelo link ──────────────────────

/** Se dá para mandar pelo número da barbearia e, se não, por quê (a tela oferece o link). */
export interface EnvioParaCliente {
  podeBot: boolean;
  motivo: string | null;
  /** Unidade por onde sai: a que o cliente escreveu por último. */
  unidadeId: string | null;
  unidade: string | null;
}

export const enviarParaClienteSchema = z.object({
  texto: z
    .string()
    .trim()
    .min(1, { error: 'Escreva a mensagem.' })
    .max(1000, { error: 'No máximo 1.000 caracteres.' }),
  unidadeId: z.uuid({ error: 'Unidade inválida.' }).optional(),
});
export type EnviarParaClienteEntrada = z.infer<typeof enviarParaClienteSchema>;

export const pesquisaBotSchema = z.object({ ativa: z.boolean() });
export type PesquisaBotEntrada = z.infer<typeof pesquisaBotSchema>;
