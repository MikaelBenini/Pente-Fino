// Lembretes do horário pelo WhatsApp (Etapa 11): quando mandar e o que dizer.
import { formatarHora } from './formatacao.js';
import { textoTolerancia } from './atraso.js';

/**
 * Primeiro lembrete ("24h", o mais longe do horário: confirma, remarca ou cancela) e segundo
 * ("2h", em cima da hora: só confirma). As horas de cada um vêm das regras da unidade.
 */
export const TIPOS_LEMBRETE = ['24h', '2h'] as const;
export type TipoLembrete = (typeof TIPOS_LEMBRETE)[number];

/**
 * Quando cada lembrete deve sair. Só manda o que faz sentido: o de 24 h, se o horário foi
 * marcado com mais de um dia de antecedência; o de 2 h, se foi marcado com mais de 2 h
 * (quem marcou para daqui a pouco não precisa ser lembrado). Momentos já passados ficam de fora.
 */
export function momentosDosLembretes(
  inicio: Date,
  marcadoEm: Date,
  agora: Date,
  horas: readonly number[] = [24, 2],
): { tipo: TipoLembrete; quando: Date }[] {
  const ordenadas = [...horas].sort((a, b) => b - a).slice(0, 2);
  return ordenadas.flatMap((h, i) => {
    const tipo = TIPOS_LEMBRETE[i]!;
    const antes = h * 3_600_000;
    const quando = new Date(inicio.getTime() - antes);
    const marcadoComFolga = inicio.getTime() - marcadoEm.getTime() > antes;
    return marcadoComFolga && quando > agora ? [{ tipo, quando }] : [];
  });
}

export interface DadosDoLembrete {
  cliente: string | null;
  barbearia: string;
  /** "Amanhã (sex, 07/11)" ou "Hoje (qui, 06/11)". */
  diaRotulo: string;
  inicio: string;
  servicos: readonly string[];
  profissional: string;
  /** Atraso tolerado (minutos), avisado no lembrete. */
  toleranciaMin?: number;
}

/** O lembrete com as opções; o de 2 h só confirma (mudar em cima da hora é com a recepção). */
/**
 * Lembrete: a abertura vem do texto editável do bot (já preenchido); dia, hora, serviços e
 * opções são fixos, porque a resposta 1/2/3 depende deles.
 */
export function textoLembrete(tipo: TipoLembrete, d: DadosDoLembrete, abertura?: string): string {
  const ola = d.cliente ? `Oi, ${d.cliente.trim().split(/\s+/)[0]}!` : 'Oi!';
  const corpo = [
    abertura?.trim() || `${ola} Lembrete do seu horário na ${d.barbearia}:`,
    '',
    `📅 ${d.diaRotulo}, às ${formatarHora(d.inicio)}`,
    `✂️ ${d.servicos.join(' + ')} com ${d.profissional}`,
    ...(d.toleranciaMin ? [textoTolerancia(d.toleranciaMin)!] : []),
    '',
  ];
  if (tipo === '2h')
    return [...corpo, '1. Confirmo', '', 'Precisa mudar? Responda ATENDENTE.'].join('\n');
  return [...corpo, '1. Confirmo', '2. Remarcar', '3. Cancelar'].join('\n');
}

/**
 * Os trabalhos atrasados da fila para lembrar um horário. O id inclui o horário: remarcar
 * cria trabalhos novos, e os antigos não saem (o worker confere o horário na hora).
 */
export function trabalhosDeLembrete(
  contaId: string,
  agendamentoId: string,
  inicio: Date,
  marcadoEm: Date,
  agora: Date,
  horas: readonly number[] = [24, 2],
): {
  dados: {
    tipo: 'lembrete';
    contaId: string;
    agendamentoId: string;
    lembrete: TipoLembrete;
    inicio: string;
  };
  atrasoMs: number;
  jobId: string;
}[] {
  return momentosDosLembretes(inicio, marcadoEm, agora, horas).map(({ tipo, quando }) => ({
    dados: {
      tipo: 'lembrete',
      contaId,
      agendamentoId,
      lembrete: tipo,
      inicio: inicio.toISOString(),
    },
    atrasoMs: quando.getTime() - agora.getTime(),
    jobId: `lembrete_${agendamentoId}_${tipo}_${inicio.getTime()}`,
  }));
}
