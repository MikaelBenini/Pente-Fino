// Lista de espera (Etapa 14): o cliente pede dia, faixa de horário e profissional; quando um
// horário vaga, o bot oferece na ordem da lista e o primeiro que responder "1" leva.
// Regras puras; o banco escolhe quem cabe e grava.
import { z } from 'zod';
import { formatarHora } from './formatacao.js';

/** Quantos da lista recebem a mesma vaga ao mesmo tempo (o primeiro "1" leva). */
export const OFERTAS_POR_VAGA = 3;
/** A oferta vale por este tempo (ou até o horário, o que vier antes). */
export const VALIDADE_OFERTA_MIN = 30;

export const ORIGENS_ESPERA = ['balcao', 'bot', 'site', 'antecipar'] as const;
export type OrigemEspera = (typeof ORIGENS_ESPERA)[number];
export type StatusEspera = 'aguardando' | 'oferecido' | 'atendido' | 'cancelado';

/** O horário da vaga começa dentro da faixa que o cliente pediu (minutos desde 00:00). */
export function cabeNaFaixa(minutoDaVaga: number, deMin: number, ateMin: number): boolean {
  return minutoDaVaga >= deMin && minutoDaVaga <= ateMin;
}

/** A oferta ainda vale: dentro da validade e antes do horário começar. */
export function ofertaValida(d: { enviadaEm: Date; inicio: Date; agora: Date }): boolean {
  return (
    d.agora.getTime() - d.enviadaEm.getTime() <= VALIDADE_OFERTA_MIN * 60_000 && d.agora < d.inicio
  );
}

export function textoOfertaVaga(o: {
  cliente: string | null;
  diaRotulo: string;
  inicio: string;
  profissional: string;
  antecipar: boolean;
}): string {
  const ola = o.cliente ? `Oi, ${o.cliente}!` : 'Oi!';
  return [
    o.antecipar
      ? `${ola} Vagou um horário antes do seu:`
      : `${ola} Vagou um horário que você pediu:`,
    '',
    `📅 ${o.diaRotulo}, às ${formatarHora(o.inicio)} com ${o.profissional}`,
    '',
    o.antecipar ? '1. Quero trocar para este' : '1. Quero',
    '2. Não, obrigado',
    '',
    `Vale por ${VALIDADE_OFERTA_MIN} minutos; quem responder primeiro leva.`,
  ].join('\n');
}

export const TEXTO_VAGA_PREENCHIDA =
  'Esse horário acabou de ser preenchido por outra pessoa. Continuo te avisando se vagar outro.';

// ─── Entradas e respostas da API ──────────────────────────────────────────

const minuto = z
  .number()
  .int()
  .min(0)
  .max(24 * 60);

export const esperaSchema = z
  .object({
    unidadeId: z.uuid(),
    clienteId: z.uuid().optional(),
    clienteNovo: z
      .object({ nome: z.string().trim().min(2).max(120), telefone: z.string().max(20).optional() })
      .optional(),
    profissionalId: z.uuid().nullable(),
    servicoIds: z.array(z.uuid()).min(1, { error: 'Escolha o serviço.' }).max(5),
    dia: z.iso.date(),
    deMin: minuto,
    ateMin: minuto,
  })
  .refine((d) => !!d.clienteId !== !!d.clienteNovo, { error: 'Escolha o cliente.' })
  .refine((d) => d.ateMin >= d.deMin, {
    error: 'O fim da faixa precisa ser depois do começo.',
    path: ['ateMin'],
  });
export type EsperaEntrada = z.infer<typeof esperaSchema>;

export interface EsperaDetalhe {
  id: string;
  cliente: { id: string; nome: string };
  profissional: string | null;
  servicos: string[];
  dia: string;
  deMin: number;
  ateMin: number;
  origem: OrigemEspera;
  status: StatusEspera;
  /** Oferta em aberto (quando oferecido). */
  oferta: { inicio: string; profissional: string } | null;
  criadoEm: string;
}

export const NOME_ORIGEM_ESPERA: Readonly<Record<OrigemEspera, string>> = {
  balcao: 'Balcão',
  bot: 'WhatsApp',
  site: 'Site',
  antecipar: 'Quer antecipar',
};

/** "09:00 às 12:00" a partir dos minutos. */
export function textoFaixa(deMin: number, ateMin: number): string {
  const h = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return `${h(deMin)} às ${h(ateMin)}`;
}

/**
 * "Avisar se vagar antes" (pedido em 2026-11-05): só pergunta quando o cliente foi empurrado
 * para depois — nenhum horário livre antes do escolhido (na grade que ele viu ao marcar) e o
 * escolhido não é o primeiro horário possível do dia (abertura, ou agora com a antecedência).
 */
export function deveOferecerAntecipar(d: {
  /** Inícios livres do dia (ISO) quando ele escolheu, para o profissional dele (ou todos). */
  livres: readonly string[];
  escolhido: string;
  /** Primeiro horário possível do dia (ISO), livre ou não. */
  primeiroPossivel: string;
  jaNaLista: boolean;
}): boolean {
  if (d.jaNaLista) return false;
  const escolhido = Date.parse(d.escolhido);
  if (escolhido <= Date.parse(d.primeiroPossivel)) return false;
  return d.livres.every((l) => Date.parse(l) >= escolhido);
}

export const TEXTO_PERGUNTA_ANTECIPAR =
  'Quer que eu avise se vagar um horário antes do seu nesse dia?\n\n1. Sim, me avise\n2. Não precisa';
