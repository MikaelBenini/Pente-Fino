// Horários livres para agendar: expediente − agendamentos − bloqueios − o que já passou.

export interface Intervalo {
  inicio: Date;
  fim: Date;
}

export interface EntradaHorariosLivres {
  /** Turnos do profissional no dia (já convertidos para instantes). */
  expediente: readonly Intervalo[];
  /** Agendamentos ativos e bloqueios do profissional no dia. */
  ocupados: readonly Intervalo[];
  duracaoMin: number;
  /** De quanto em quanto tempo oferecer horários. */
  passoMin?: number;
  /** Não oferece horários que já começaram. */
  agora?: Date;
}

const MIN = 60_000;

function cruza(a: Intervalo, b: Intervalo): boolean {
  return a.inicio < b.fim && b.inicio < a.fim;
}

/** Inícios possíveis, em ordem. Um horário serve se cabe inteiro no turno e não cruza nada ocupado. */
export function horariosLivres({
  expediente,
  ocupados,
  duracaoMin,
  passoMin = 15,
  agora,
}: EntradaHorariosLivres): Date[] {
  if (duracaoMin <= 0) return [];
  const livres: Date[] = [];
  for (const turno of expediente) {
    for (
      let t = turno.inicio.getTime();
      t + duracaoMin * MIN <= turno.fim.getTime();
      t += passoMin * MIN
    ) {
      const candidato = { inicio: new Date(t), fim: new Date(t + duracaoMin * MIN) };
      if (agora && candidato.inicio < agora) continue;
      if (ocupados.some((o) => cruza(candidato, o))) continue;
      livres.push(candidato.inicio);
    }
  }
  return livres.sort((a, b) => a.getTime() - b.getTime());
}

/** Instante de um horário local (minutos desde a meia-noite) num dia, no fuso fixo -03:00 de São Paulo. */
export function instanteLocal(data: string, minutos: number): Date {
  const hh = String(Math.floor(minutos / 60)).padStart(2, '0');
  const mm = String(minutos % 60).padStart(2, '0');
  return new Date(`${data}T${hh}:${mm}:00-03:00`);
}

/** Dia da semana (0 = domingo) de uma data AAAA-MM-DD. */
export function diaDaSemana(data: string): number {
  return new Date(`${data}T12:00:00Z`).getUTCDay();
}
