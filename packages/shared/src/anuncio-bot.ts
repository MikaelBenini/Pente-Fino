// Mensagens automáticas para quem vem de anúncio (pedido do dono em 16/11/2026): quem chega por
// um anúncio do Facebook/Instagram (clique para o WhatsApp), ou escreve a frase pronta do anúncio,
// recebe uma conversa própria, sem o menu do bot: as perguntas em sequência, a mensagem final e a
// passagem para a equipe, que vê as respostas e a marca "Veio de anúncio" na tela Conversas.
import { z } from 'zod';
import {
  EXPIRACAO_ATENDENTE_MIN,
  EXPIRACAO_SESSAO_MIN,
  normalizar,
  preencher,
  type SessaoBot,
} from './bot.js';

/** Origem do cliente que chegou por anúncio (`cliente.origem_lead`). */
export const ORIGEM_ANUNCIO = 'anuncio';

export interface FluxoAnuncio {
  ativo: boolean;
  /** Frases prontas do anúncio ("Olá! Quero saber mais"): quem escreve uma delas entra no fluxo. */
  frases: string[];
  /** Mensagens em sequência; depois de cada uma, o bot espera a resposta do cliente. */
  etapas: string[];
  /** Fecha a conversa automática e passa para a equipe. */
  final: string;
}

export const FLUXO_ANUNCIO_PADRAO: Readonly<FluxoAnuncio> = {
  ativo: false,
  // Vazio por padrão (18/11/2026): "Olá! Quero saber mais." é também a frase do botão do
  // WhatsApp no Instagram e no Facebook, e mandava o fluxo do anúncio para quem não veio dele.
  frases: [],
  etapas: [
    'Oi, {cliente}! Que bom que você veio pelo nosso anúncio. 😊 Qual serviço te interessou?',
    'Perfeito! Qual dia e horário ficam melhores para você?',
  ],
  final: 'Anotado! Já passei para a nossa equipe, que te responde por aqui em instantes.',
};

/** A frase pronta do anúncio: inteira (12 letras ou mais, 3 palavras ou mais). */
const fraseValida = (f: string) =>
  f.trim().length >= 12 && f.trim().split(/\s+/).filter(Boolean).length >= 3;

const textoEtapa = z
  .string()
  .trim()
  .min(1, { error: 'Escreva a mensagem.' })
  .max(1000, { error: 'No máximo 1.000 caracteres.' });

export const fluxoAnuncioSchema = z.object({
  ativo: z.boolean(),
  frases: z
    .array(
      z
        .string()
        .trim()
        .max(120)
        // Frase curta ("Olá", "Oi, tudo bem") pega conversa comum: só a frase inteira do anúncio.
        .refine(fraseValida, {
          error: 'Use a frase inteira que o anúncio deixa pronta (pelo menos 3 palavras).',
        }),
    )
    .max(10, { error: 'No máximo 10 frases.' }),
  etapas: z
    .array(textoEtapa)
    .min(1, { error: 'Escreva pelo menos uma mensagem.' })
    .max(5, { error: 'No máximo 5 mensagens antes de passar para a equipe.' }),
  final: textoEtapa,
});
export type FluxoAnuncioEntrada = z.infer<typeof fluxoAnuncioSchema>;
/** O fluxo de um escopo: `proprio` = a unidade tem o dela (no padrão da conta, sempre true). */
export type FluxoAnuncioDoEscopo = FluxoAnuncio & { proprio: boolean };

/** O que está gravado passa de novo pelo esquema; estragado ou vazio = o padrão (desligado). */
export function lerFluxoAnuncio(valor: unknown): FluxoAnuncio {
  // Configuração antiga com frase curta ("Olá"): a frase sai, o resto do fluxo continua valendo.
  if (valor && typeof valor === 'object' && Array.isArray((valor as { frases?: unknown }).frases))
    valor = {
      ...(valor as object),
      frases: ((valor as { frases: unknown[] }).frases ?? []).filter(
        (f) => typeof f === 'string' && fraseValida(f),
      ),
    };
  const r = fluxoAnuncioSchema.safeParse(valor);
  return r.success ? r.data : (structuredClone(FLUXO_ANUNCIO_PADRAO) as FluxoAnuncio);
}

/** A mensagem é a frase pronta de um anúncio (sem diferença de acento, maiúscula e pontuação)? */
export function ehFraseDeAnuncio(fluxo: FluxoAnuncio, entrada: string): boolean {
  const t = normalizar(entrada);
  return (
    !!t &&
    fluxo.frases.some((f) => {
      const n = normalizar(f);
      // A mensagem COMEÇA com a frase (a do anúncio vem pronta no início); no meio de um texto
      // qualquer não conta (16/11/2026: "quero saber mais" de cliente comum caía no anúncio).
      return !!n && (t === n || t.startsWith(`${n} `));
    })
  );
}

/** Respostas do cliente no fluxo, em uma linha para a equipe. */
export const resumoDoAnuncio = (respostas: readonly string[]) =>
  respostas.length ? `Do anúncio: ${respostas.join(' · ')}` : 'Do anúncio';

export interface ResultadoAnuncio {
  respostas: string[];
  sessao: SessaoBot;
  /** Terminou: passa para a equipe (tela Conversas). */
  paraEquipe: boolean;
  /** Começou agora (para marcar a conversa como vinda de anúncio). */
  comecou: boolean;
}

/**
 * Uma mensagem no fluxo do anúncio, ou null quando não é com ele (segue o bot normal).
 * Começa com o anúncio detectado pelo WhatsApp ou com a frase pronta; segue enquanto há
 * etapas; no fim manda a mensagem final e passa para a equipe.
 */
/** Quem pode entrar no fluxo do anúncio (18/11/2026: o fluxo ia para quem não veio de anúncio). */
export interface ChegadaDoAnuncio {
  /** O WhatsApp marcou a mensagem como vinda de anúncio (a prova forte). */
  doAnuncio: boolean;
  /** O número nunca tinha escrito para a barbearia: só então a frase pronta vale. */
  primeiroContato: boolean;
  /** Já passou pelo fluxo do anúncio há pouco (30 dias): não recebe de novo. */
  anuncioRecente: boolean;
}

/** Quem passou pelo fluxo do anúncio não recebe de novo neste prazo. */
export const DIAS_SEM_REPETIR_ANUNCIO = 30;

export function responderAnuncio(
  fluxo: FluxoAnuncio,
  sessaoAnterior: SessaoBot | null,
  entrada: string,
  agora: Date,
  chegada: ChegadaDoAnuncio | boolean,
  cliente: string | null,
): ResultadoAnuncio | null {
  // `true`/`false` (simulador e testes antigos): a marca do WhatsApp, numa conversa nova.
  const c: ChegadaDoAnuncio =
    typeof chegada === 'boolean'
      ? { doAnuncio: chegada, primeiroContato: true, anuncioRecente: false }
      : chegada;
  const doAnuncio = c.doAnuncio;
  if (!fluxo.ativo || fluxo.etapas.length === 0) return null;
  const texto = (t: string) => preencher(t, { cliente: cliente?.trim().split(/\s+/)[0] ?? null });
  const agoraIso = agora.toISOString();
  const emAndamento =
    sessaoAnterior?.anuncio &&
    !sessaoAnterior.comAtendente &&
    agora.getTime() - Date.parse(sessaoAnterior.ultimaEm) <= EXPIRACAO_ATENDENTE_MIN * 60_000;

  if (emAndamento) {
    const a = sessaoAnterior!.anuncio!;
    const respostas = [...a.respostas, entrada.trim().slice(0, 300)].filter(Boolean);
    const proxima = a.etapa + 1;
    if (proxima < fluxo.etapas.length)
      return {
        respostas: [texto(fluxo.etapas[proxima]!)],
        sessao: {
          ...sessaoAnterior!,
          ultimaEm: agoraIso,
          erros: 0,
          anuncio: { ...a, etapa: proxima, respostas },
        },
        paraEquipe: false,
        comecou: false,
      };
    const resto: SessaoBot = { ...sessaoAnterior! };
    delete resto.anuncio;
    return {
      respostas: [texto(fluxo.final)],
      sessao: {
        ...resto,
        ultimaEm: agoraIso,
        erros: 0,
        caminho: [],
        comAtendente: true,
        respostasAnuncio: respostas,
      },
      paraEquipe: true,
      comecou: false,
    };
  }

  // Já com a equipe: quem responde é a recepção.
  if (sessaoAnterior?.comAtendente) return null;
  // O que separa o cliente de anúncio do comum: a marca que o próprio WhatsApp manda quando a
  // pessoa toca no anúncio; ou, sem ela, a frase pronta do anúncio como PRIMEIRA mensagem de
  // uma conversa nova (no meio de uma conversa, a frase não muda nada).
  const conversaNova =
    !sessaoAnterior ||
    agora.getTime() - Date.parse(sessaoAnterior.ultimaEm) > EXPIRACAO_SESSAO_MIN * 60_000;
  // Já passou pelo fluxo há pouco: segue o bot normal (nada de repetir o anúncio).
  if (c.anuncioRecente) return null;
  // A frase só vale para quem nunca escreveu: cliente da casa não vira "cliente de anúncio".
  if (!doAnuncio && !(conversaNova && c.primeiroContato && ehFraseDeAnuncio(fluxo, entrada)))
    return null;
  return {
    respostas: [texto(fluxo.etapas[0]!)],
    sessao: {
      caminho: [],
      comAtendente: false,
      ultimaEm: agoraIso,
      erros: 0,
      anuncio: { etapa: 0, respostas: [] },
    },
    paraEquipe: false,
    comecou: true,
  };
}

// ─── Relatório: clientes de anúncio (sugestão aprovada em 16/11/2026) ─────

export interface ResumoAnuncios {
  /** Conversas que chegaram por anúncio no período. */
  conversas: number;
  /** Clientes novos cuja origem é o anúncio, cadastrados no período. */
  novosClientes: number;
  /** Clientes de anúncio (de qualquer época) com comanda fechada no período. */
  clientesQueCompraram: number;
  /** O que esses clientes gastaram no período (comandas fechadas), em centavos. */
  faturamento: number;
  /** Faturamento ÷ clientes que compraram (0 sem clientes). */
  ticket: number;
  /** Conversas por anúncio (título que o WhatsApp manda; sem título = "Sem título"). */
  porAnuncio: { titulo: string; conversas: number }[];
}

/** Junta conversas, cadastros e comandas dos clientes de anúncio no período. */
export function resumirAnuncios(d: {
  conversas: readonly { titulo: string | null }[];
  novosClientes: number;
  comandas: readonly { clienteId: string; total: number }[];
}): ResumoAnuncios {
  const clientes = new Set(d.comandas.map((c) => c.clienteId));
  const faturamento = d.comandas.reduce((t, c) => t + c.total, 0);
  const porTitulo = new Map<string, number>();
  for (const c of d.conversas) {
    const t = c.titulo?.trim() || 'Sem título';
    porTitulo.set(t, (porTitulo.get(t) ?? 0) + 1);
  }
  return {
    conversas: d.conversas.length,
    novosClientes: d.novosClientes,
    clientesQueCompraram: clientes.size,
    faturamento,
    ticket: clientes.size ? Math.round(faturamento / clientes.size) : 0,
    porAnuncio: [...porTitulo]
      .map(([titulo, conversas]) => ({ titulo, conversas }))
      .sort((a, b) => b.conversas - a.conversas || a.titulo.localeCompare(b.titulo)),
  };
}
