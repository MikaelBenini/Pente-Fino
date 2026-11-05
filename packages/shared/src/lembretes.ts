// Lembretes do horário pelo WhatsApp (Etapa 11): quando mandar e o que dizer.
import { formatarHora } from './formatacao.js';

export const TIPOS_LEMBRETE = ['24h', '2h'] as const;
export type TipoLembrete = (typeof TIPOS_LEMBRETE)[number];

/** Minutos antes do horário em que cada lembrete sai. */
export const ANTECEDENCIA_LEMBRETE_MIN: Readonly<Record<TipoLembrete, number>> = {
  '24h': 24 * 60,
  '2h': 2 * 60,
};

/**
 * Quando cada lembrete deve sair. Só manda o que faz sentido: o de 24 h, se o horário foi
 * marcado com mais de um dia de antecedência; o de 2 h, se foi marcado com mais de 2 h
 * (quem marcou para daqui a pouco não precisa ser lembrado). Momentos já passados ficam de fora.
 */
export function momentosDosLembretes(
  inicio: Date,
  marcadoEm: Date,
  agora: Date,
): { tipo: TipoLembrete; quando: Date }[] {
  return TIPOS_LEMBRETE.flatMap((tipo) => {
    const antes = ANTECEDENCIA_LEMBRETE_MIN[tipo] * 60_000;
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
}

/** O lembrete com as opções; o de 2 h só confirma (mudar em cima da hora é com a recepção). */
export function textoLembrete(tipo: TipoLembrete, d: DadosDoLembrete): string {
  const ola = d.cliente ? `Oi, ${d.cliente.trim().split(/\s+/)[0]}!` : 'Oi!';
  const corpo = [
    `${ola} Lembrete do seu horário na ${d.barbearia}:`,
    '',
    `📅 ${d.diaRotulo}, às ${formatarHora(d.inicio)}`,
    `✂️ ${d.servicos.join(' + ')} com ${d.profissional}`,
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
  return momentosDosLembretes(inicio, marcadoEm, agora).map(({ tipo, quando }) => ({
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
