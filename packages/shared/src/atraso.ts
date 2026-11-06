// Tolerância de atraso e remarcação rápida (Etapa 14, pedido de 2026-11-05): o sistema
// identifica o atraso, mas só o "Não veio" confirmado pelo barbeiro (ou pela recepção) cancela.
// Regras puras; a API grava e o worker manda a remarcação.
import { formatarHora } from './formatacao.js';

/** Depois do "Não veio", este tempo para desfazer antes de qualquer mensagem sair. */
export const DESFAZER_NAO_VEIO_MIN = 5;
/** Quantos horários a remarcação rápida oferece. */
export const HORARIOS_REMARCAR_ATRASO = 3;

/**
 * Passou da tolerância e a comanda nem começou: mostra "Cliente não chegou?". Nunca cancela
 * sozinho; iniciar, fechar ou cancelar a comanda tira o aviso.
 */
export function estaAtrasado(d: {
  statusComanda: string;
  statusAgendamento: string | null;
  inicio: Date;
  agora: Date;
  toleranciaMin: number;
}): boolean {
  if (d.statusComanda !== 'prevista') return false;
  if (d.statusAgendamento && !['agendado', 'confirmado'].includes(d.statusAgendamento))
    return false;
  return d.agora.getTime() > d.inicio.getTime() + d.toleranciaMin * 60_000;
}

/** Os próximos horários livres depois de agora (já na antecedência), em ordem, até `n`. */
export function proximosHorariosParaRemarcar(
  livres: readonly string[],
  depoisDe: Date,
  n = HORARIOS_REMARCAR_ATRASO,
): string[] {
  return [...new Set(livres)]
    .filter((i) => Date.parse(i) > depoisDe.getTime())
    .sort()
    .slice(0, n);
}

/** Linha que vai na confirmação do horário e no lembrete. */
export function textoTolerancia(minutos: number): string | null {
  if (minutos <= 0) return null;
  return `⏱️ Tolerância de ${minutos} minutos; depois disso o horário pode ser cancelado.`;
}

export function textoRemarcarAtraso(d: {
  cliente: string | null;
  horaCancelada: string;
  opcoes: readonly { inicio: string; rotulo: string }[];
  link: string | null;
}): string {
  const ola = d.cliente ? `Oi, ${d.cliente}.` : 'Oi.';
  const outro = d.opcoes.length + 1;
  return [
    `${ola} Seu horário das ${formatarHora(d.horaCancelada)} foi cancelado pelo atraso. Quer remarcar?`,
    '',
    ...d.opcoes.map((o, i) => `${i + 1}. ${o.rotulo}, às ${formatarHora(o.inicio)}`),
    ...(d.link ? [`${outro}. Outro dia (pelo site): ${d.link}`] : []),
    '0. Agora não',
    '',
    'Responda o número que eu já marco.',
  ].join('\n');
}
