// Admin F4: nota de saúde da conta (0 a 100) e o que puxa a nota para baixo. Quanto menor a
// nota, maior o risco de cancelamento: a lista de Contas ordena por ela.

export interface DadosSaudeConta {
  status: 'teste' | 'ativa' | 'suspensa' | 'cancelada';
  /** ISO; null = nunca entrou. */
  ultimoAcessoEm: string | null;
  fechadas7Dias: number;
  whatsappConectado: boolean;
  /** Passos do tutorial feitos e o total. */
  ativacao: number;
  totalPassos: number;
  /** Alguma fatura da assinatura vencida sem pagamento. */
  cobrancaVencida: boolean;
}

export interface SaudeConta {
  nota: number;
  /** O que tirou pontos, do que mais tirou para o que menos tirou. */
  motivos: string[];
}

/** Pesos (somam 100). */
export const PESOS_SAUDE = {
  acesso: 30,
  comandas: 30,
  tutorial: 15,
  cobranca: 15,
  whatsapp: 10,
} as const;

const DIA = 86_400_000;

/**
 * Nota de 0 a 100. Acesso: até 2 dias vale tudo, até 7 dias a metade. Comandas fechadas na
 * semana: 20 ou mais vale tudo, 5 a 19 dois terços, 1 a 4 um terço. Tutorial: proporcional.
 * Cobrança: perde tudo com fatura vencida. WhatsApp: conectado ou não.
 * Conta cancelada não tem nota (null).
 */
export function saudeDaConta(d: DadosSaudeConta, agora: Date): SaudeConta | null {
  if (d.status === 'cancelada') return null;
  const perdas: { pontos: number; motivo: string }[] = [];

  const dias = d.ultimoAcessoEm ? (agora.getTime() - Date.parse(d.ultimoAcessoEm)) / DIA : null;
  const acesso = dias !== null && dias <= 2 ? 1 : dias !== null && dias <= 7 ? 0.5 : 0;
  if (acesso < 1)
    perdas.push({
      pontos: PESOS_SAUDE.acesso * (1 - acesso),
      motivo:
        dias === null
          ? 'Ninguém entrou ainda'
          : `Sem acesso há ${Math.floor(dias)} ${Math.floor(dias) === 1 ? 'dia' : 'dias'}`,
    });

  const n = d.fechadas7Dias;
  const comandas = n >= 20 ? 1 : n >= 5 ? 2 / 3 : n >= 1 ? 1 / 3 : 0;
  if (comandas < 1)
    perdas.push({
      pontos: PESOS_SAUDE.comandas * (1 - comandas),
      motivo:
        n === 0
          ? 'Nenhuma comanda fechada na semana'
          : `Só ${n} ${n === 1 ? 'comanda fechada' : 'comandas fechadas'} na semana`,
    });

  const tutorial = d.totalPassos ? Math.min(1, d.ativacao / d.totalPassos) : 1;
  if (tutorial < 1)
    perdas.push({
      pontos: PESOS_SAUDE.tutorial * (1 - tutorial),
      motivo: `Configurou ${d.ativacao} de ${d.totalPassos} primeiros passos`,
    });

  if (d.cobrancaVencida) perdas.push({ pontos: PESOS_SAUDE.cobranca, motivo: 'Cobrança vencida' });

  if (!d.whatsappConectado)
    perdas.push({ pontos: PESOS_SAUDE.whatsapp, motivo: 'WhatsApp desconectado' });

  const total = perdas.reduce((s, p) => s + p.pontos, 0);
  return {
    nota: Math.max(0, Math.round(100 - total)),
    motivos: perdas.sort((a, b) => b.pontos - a.pontos).map((p) => p.motivo),
  };
}

/** Faixa para a tela: boa (70+), atenção (40 a 69) ou risco (abaixo de 40). */
export function faixaDaSaude(nota: number): 'boa' | 'atencao' | 'risco' {
  return nota >= 70 ? 'boa' : nota >= 40 ? 'atencao' : 'risco';
}
