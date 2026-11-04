// Entradas e respostas da API do bot (Etapa 10). Mesma validação no painel e na API.
import { z } from 'zod';
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

const sessaoSchema: z.ZodType<SessaoBot> = z.object({
  caminho: z.array(id).max(5),
  ultimaEm: z.iso.datetime({ offset: true }),
  comAtendente: z.boolean(),
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
  conexao: { status: 'desconectado' | 'aguardando_qr' | 'conectado'; numero: string | null } | null;
}

export interface EstadoBot {
  publicado: { menu: MenuBot; publicadoEm: string | null; publicadoPor: string | null };
  rascunho: { menu: MenuBot; atualizadoEm: string; problemas: ProblemaMenu[] } | null;
  /** Existe versão anterior para voltar. */
  temAnterior: boolean;
  mensagens: MensagensBot;
  unidades: UnidadeDoBot[];
  /** Dono edita menu e mensagens; gestor vê, testa e ajusta o horário da unidade dele. */
  podeEditar: boolean;
}

export interface RespostaSimulacao {
  respostas: string[];
  sessao: SessaoBot;
  acao: string | null;
  consentimento: boolean | null;
}
