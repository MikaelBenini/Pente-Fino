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
  /** Faltas na janela que fazem o cliente marcar só com a recepção (0 = desligado). */
  faltasParaBloquear: number;
  /** Janela das faltas, em dias. */
  faltasJanelaDias: number;
  /** Atraso tolerado (minutos), avisado na confirmação; depois, "Cliente não chegou?". */
  toleranciaAtrasoMin: number;
}

export const REGRAS_AGENDAMENTO_PADRAO: Readonly<RegrasAgendamento> = {
  antecedenciaMin: 30,
  janelaDias: 45,
  maxFuturos: 2,
  prazoMudarMin: 120,
  intervaloMin: 0,
  lembretesHoras: [24, 2],
  pelaConversa: true,
  faltasParaBloquear: 3,
  faltasJanelaDias: 90,
  toleranciaAtrasoMin: 10,
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
  // App antigo não manda estes: ficam no padrão.
  faltasParaBloquear: z.number().int().min(0).max(10).default(3),
  faltasJanelaDias: z.number().int().min(7).max(365).default(90),
  toleranciaAtrasoMin: z.number().int().min(0).max(60).default(10),
});

/** Muitas faltas na janela: marca só com a recepção (bot e site); o balcão segue livre. */
export function bloqueadoPorFaltas(faltas: number, regras: RegrasAgendamento): boolean {
  return regras.faltasParaBloquear > 0 && faltas >= regras.faltasParaBloquear;
}

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

// ─── Ligar o link público (painel A7) ─────────────────────────────────────

export interface ProntidaoDoLink {
  /** Serviços ativos com preço vigente na unidade. */
  servicosComPreco: number;
  /** Profissionais ativos da unidade com ao menos um turno na semana. */
  profissionaisComHorario: number;
}

export interface FaltaParaOLink {
  item: 'servico' | 'profissional';
  mensagem: string;
}

/**
 * O que falta para o link público servir para alguma coisa. Sem serviço com preço ou sem
 * profissional com horário, o cliente abre a página e não tem como marcar. Lista vazia = pode ligar.
 */
export function faltaParaLigarLink(p: ProntidaoDoLink): FaltaParaOLink[] {
  const falta: FaltaParaOLink[] = [];
  if (p.servicosComPreco === 0)
    falta.push({
      item: 'servico',
      mensagem: 'Cadastre o preço de pelo menos um serviço nesta unidade.',
    });
  if (p.profissionaisComHorario === 0)
    falta.push({
      item: 'profissional',
      mensagem: 'Cadastre pelo menos um profissional com horário de trabalho nesta unidade.',
    });
  return falta;
}
