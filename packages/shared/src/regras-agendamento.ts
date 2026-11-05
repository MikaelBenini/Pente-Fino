// Regras de agendamento da unidade (Etapa 11): um lugar só, valendo para o bot e o site.
// O balcão marca livre (encaixe), mas respeita o intervalo entre atendimentos.
import { z } from 'zod';

export interface RegrasAgendamento {
  /** O cliente marca sozinho com pelo menos esta antecedência (minutos). */
  antecedenciaMin: number;
  /** Até quantos dias à frente o cliente marca sozinho. */
  janelaDias: number;
  /** Horários futuros por cliente na unidade; acima disso, só com a recepção. */
  maxFuturos: number;
  /** Até quanto tempo antes o cliente remarca ou cancela sozinho (minutos). */
  prazoMudarMin: number;
  /** Folga entre um atendimento e o próximo do mesmo profissional (minutos). */
  intervaloMin: number;
  /** Horas antes do horário em que saem os lembretes (0 a 2; vazio = sem lembrete). */
  lembretesHoras: number[];
  /** "Agendar" no bot marca pela conversa; desligado, manda o link do site. */
  pelaConversa: boolean;
}

export const REGRAS_AGENDAMENTO_PADRAO: Readonly<RegrasAgendamento> = {
  antecedenciaMin: 30,
  janelaDias: 45,
  maxFuturos: 2,
  prazoMudarMin: 120,
  intervaloMin: 0,
  lembretesHoras: [24, 2],
  pelaConversa: true,
};

export const regrasAgendamentoSchema = z.object({
  antecedenciaMin: z.number().int().min(0).max(2880),
  janelaDias: z.number().int().min(1, { error: 'Pelo menos 1 dia.' }).max(180),
  maxFuturos: z.number().int().min(1).max(10),
  prazoMudarMin: z.number().int().min(0).max(2880),
  intervaloMin: z.number().int().min(0).max(60),
  lembretesHoras: z
    .array(z.number().int().min(1, { error: 'Pelo menos 1 hora antes.' }).max(72))
    .max(2)
    .refine((h) => new Set(h).size === h.length, {
      error: 'Os dois lembretes têm o mesmo horário.',
    })
    // O maior primeiro: o primeiro lembrete oferece remarcar e cancelar; o segundo só confirma.
    .transform((h) => [...h].sort((a, b) => b - a)),
  pelaConversa: z.boolean(),
});

/** Regras gravadas na unidade (JSON) com o padrão no que faltar ou estiver inválido. */
export function lerRegrasAgendamento(valor: unknown): RegrasAgendamento {
  const base = {
    ...REGRAS_AGENDAMENTO_PADRAO,
    lembretesHoras: [...REGRAS_AGENDAMENTO_PADRAO.lembretesHoras],
  };
  if (!valor || typeof valor !== 'object') return base;
  const r = regrasAgendamentoSchema.partial().safeParse(valor);
  return r.success ? { ...base, ...r.data } : base;
}
