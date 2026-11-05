// Por onde os clientes marcam (Etapa 11): agendamentos, comparecimento e faturamento por canal.

export const CANAIS = ['bot', 'link', 'balcao', 'app', 'sem_horario'] as const;
export type Canal = (typeof CANAIS)[number];

export const NOME_CANAL: Readonly<Record<Canal, string>> = {
  bot: 'WhatsApp',
  link: 'Site',
  balcao: 'Balcão',
  app: 'App',
  sem_horario: 'Chegou sem horário',
};

export interface AgendamentoParaCanal {
  origem: 'balcao' | 'bot' | 'app' | 'link';
  status: 'agendado' | 'confirmado' | 'atendido' | 'cancelado' | 'falta';
  /** A comanda do agendamento (fechada conta como atendido e entra no faturamento). */
  comanda: { status: string; totalLiquido: number } | null;
}

export interface LinhaCanal {
  canal: Canal;
  /** Horários marcados no período por este canal (inclui cancelados e faltas). */
  agendados: number;
  /** Comandas fechadas. */
  atendidos: number;
  faltas: number;
  /** Cancelados (pelo cliente ou pela barbearia). */
  cancelados: number;
  faturamento: number;
  /** Faturamento ÷ faturamento total (fração); 0 sem faturamento. */
  fatia: number;
  /** Atendidos ÷ (agendados − cancelados): quem marcou e veio; null sem base. */
  comparecimento: number | null;
}

/**
 * Agendamentos do período por canal, mais as comandas fechadas sem agendamento (chegou sem
 * horário). Canais sem movimento ficam de fora; os com mais faturamento vêm primeiro.
 */
export function porCanal(
  agendamentos: readonly AgendamentoParaCanal[],
  semHorario: readonly { totalLiquido: number }[],
): LinhaCanal[] {
  const linhas = new Map<Canal, Omit<LinhaCanal, 'fatia' | 'comparecimento'>>();
  const linha = (canal: Canal) => {
    let l = linhas.get(canal);
    if (!l) {
      l = { canal, agendados: 0, atendidos: 0, faltas: 0, cancelados: 0, faturamento: 0 };
      linhas.set(canal, l);
    }
    return l;
  };
  for (const a of agendamentos) {
    const l = linha(a.origem);
    l.agendados += 1;
    if (a.status === 'falta') l.faltas += 1;
    if (a.status === 'cancelado') l.cancelados += 1;
    if (a.comanda?.status === 'fechada') {
      l.atendidos += 1;
      l.faturamento += a.comanda.totalLiquido;
    }
  }
  for (const c of semHorario) {
    const l = linha('sem_horario');
    l.atendidos += 1;
    l.faturamento += c.totalLiquido;
  }
  const total = [...linhas.values()].reduce((s, l) => s + l.faturamento, 0);
  return [...linhas.values()]
    .map((l) => {
      const base = l.agendados - l.cancelados;
      return {
        ...l,
        fatia: total > 0 ? l.faturamento / total : 0,
        comparecimento: l.canal === 'sem_horario' || base <= 0 ? null : l.atendidos / base,
      };
    })
    .sort((a, b) => b.faturamento - a.faturamento || b.agendados - a.agendados);
}
