// Regras da comanda: estados, quem muda o quê, totais e rateio de desconto.
// docs/documentacao-do-produto.md, "Estados da comanda". Só comanda fechada conta.
import type { Papel } from './papeis.js';

export const ESTADOS_COMANDA = [
  'prevista',
  'em_atendimento',
  'confirmada',
  'pendente',
  'fechada',
  'cancelada',
  'reaberta',
] as const;
export type StatusComanda = (typeof ESTADOS_COMANDA)[number];

export type AcaoComanda =
  | 'iniciar'
  | 'confirmar'
  | 'fechar'
  | 'cancelar'
  | 'reabrir'
  | 'editar_itens'
  // Passou da tolerância e o cliente não veio: o barbeiro (ou a recepção) confirma o atraso.
  | 'nao_veio';

const GESTAO: readonly Papel[] = ['dono', 'gestor'];
const BALCAO: readonly Papel[] = ['dono', 'gestor', 'recepcao'];
const TODOS: readonly Papel[] = ['dono', 'gestor', 'recepcao', 'barbeiro'];

/** De quais estados cada ação parte, e quem pode fazê-la. */
const REGRAS: Record<AcaoComanda, { de: readonly StatusComanda[]; papeis: readonly Papel[] }> = {
  // Reaberta volta a ser uma comanda em aberto: começa, confirma, cancela ou marca falta de novo.
  iniciar: { de: ['prevista', 'pendente', 'reaberta'], papeis: TODOS },
  confirmar: { de: ['prevista', 'em_atendimento', 'pendente', 'reaberta'], papeis: TODOS },
  // Recepção fecha o que o barbeiro confirmou; sem confirmação (pendente), só dono ou gestor.
  fechar: {
    de: ['confirmada', 'reaberta', 'pendente', 'em_atendimento', 'prevista'],
    papeis: BALCAO,
  },
  cancelar: {
    de: ['prevista', 'em_atendimento', 'confirmada', 'pendente', 'reaberta'],
    papeis: BALCAO,
  },
  reabrir: { de: ['fechada'], papeis: GESTAO },
  // Pendente = o horário acabou e nada aconteceu: o barbeiro ainda pode confirmar que não veio.
  nao_veio: { de: ['prevista', 'pendente', 'reaberta'], papeis: TODOS },
  editar_itens: {
    de: ['prevista', 'em_atendimento', 'confirmada', 'pendente', 'reaberta'],
    papeis: TODOS,
  },
};

/** Fechar sem a confirmação do barbeiro exige dono ou gestor. */
const FECHAR_SEM_CONFIRMACAO: readonly StatusComanda[] = ['pendente', 'em_atendimento', 'prevista'];

export interface VerificacaoAcao {
  permitido: boolean;
  motivo?: string;
}

const NOME_ESTADO: Record<StatusComanda, string> = {
  prevista: 'prevista',
  em_atendimento: 'em atendimento',
  confirmada: 'confirmada',
  pendente: 'pendente',
  fechada: 'fechada',
  cancelada: 'cancelada',
  reaberta: 'reaberta',
};

/**
 * Pode fazer a ação nesta comanda? `propria` = o barbeiro é o profissional da comanda
 * (barbeiro só age nas próprias e não mexe em comanda já confirmada).
 */
export function podeAgirNaComanda(
  acao: AcaoComanda,
  status: StatusComanda,
  papeis: readonly Papel[],
  propria: boolean,
): VerificacaoAcao {
  const regra = REGRAS[acao];
  if (!regra.de.includes(status)) {
    return {
      permitido: false,
      motivo: `Não dá para ${TEXTO_ACAO[acao]} uma comanda ${NOME_ESTADO[status]}.`,
    };
  }
  const balcao = papeis.some((p) => BALCAO.includes(p));
  if (!papeis.some((p) => regra.papeis.includes(p))) {
    return { permitido: false, motivo: 'Seu papel não permite esta ação.' };
  }
  if (!balcao) {
    // Só barbeiro: apenas as próprias e antes de confirmar.
    if (!propria) return { permitido: false, motivo: 'Você só mexe nas suas comandas.' };
    if (acao === 'editar_itens' && status === 'confirmada') {
      return { permitido: false, motivo: 'Comanda já confirmada. Peça à recepção para ajustar.' };
    }
  }
  if (
    acao === 'fechar' &&
    FECHAR_SEM_CONFIRMACAO.includes(status) &&
    !papeis.some((p) => GESTAO.includes(p))
  ) {
    return {
      permitido: false,
      motivo: 'O barbeiro ainda não confirmou. Peça a confirmação ou chame o gestor para fechar.',
    };
  }
  return { permitido: true };
}

const TEXTO_ACAO: Record<AcaoComanda, string> = {
  iniciar: 'iniciar',
  confirmar: 'confirmar',
  fechar: 'fechar',
  cancelar: 'cancelar',
  reabrir: 'reabrir',
  editar_itens: 'mudar os itens de',
  nao_veio: 'marcar como não veio',
};

/** Tolerância depois do fim do horário antes de virar pendente. */
export const TOLERANCIA_PENDENTE_MIN = 15;

/**
 * Estado que a tela mostra: comanda prevista ou em atendimento cujo horário já
 * terminou (mais a tolerância) e não foi confirmada aparece como pendente.
 */
export function statusEfetivo(
  status: StatusComanda,
  fimHorario: Date | null,
  agora: Date,
): StatusComanda {
  if ((status === 'prevista' || status === 'em_atendimento') && fimHorario) {
    if (agora.getTime() > fimHorario.getTime() + TOLERANCIA_PENDENTE_MIN * 60_000)
      return 'pendente';
  }
  return status;
}

export interface ItemValor {
  quantidade: number;
  precoUnitario: number;
  desconto: number;
}

export interface TotaisComanda {
  totalBruto: number;
  desconto: number;
  totalLiquido: number;
}

export function totaisComanda(itens: readonly ItemValor[]): TotaisComanda {
  const totalBruto = itens.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0);
  const desconto = itens.reduce((s, i) => s + i.desconto, 0);
  return { totalBruto, desconto, totalLiquido: totalBruto - desconto };
}

/**
 * Distribui um desconto da comanda entre os itens, proporcional ao valor de cada
 * um (depois dos descontos que já tinham). A sobra de arredondamento vai para o
 * maior item. Assim a comissão sai sobre o valor que o cliente pagou.
 */
export function ratearDesconto<T extends ItemValor>(itens: readonly T[], desconto: number): T[] {
  if (!Number.isSafeInteger(desconto) || desconto < 0) throw new RangeError('desconto inválido');
  const liquidos = itens.map((i) => i.quantidade * i.precoUnitario - i.desconto);
  const base = liquidos.reduce((s, v) => s + v, 0);
  if (desconto > base) throw new RangeError('desconto maior que o total da comanda');
  if (desconto === 0 || base === 0) return itens.map((i) => ({ ...i }));
  const partes = liquidos.map((v) => Math.floor((v * desconto) / base));
  let sobra = desconto - partes.reduce((s, v) => s + v, 0);
  const ordem = liquidos.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; sobra > 0; k = (k + 1) % ordem.length) {
    const i = ordem[k]![1];
    if (partes[i]! < liquidos[i]!) {
      partes[i]! += 1;
      sobra -= 1;
    }
  }
  return itens.map((i, k) => ({ ...i, desconto: i.desconto + partes[k]! }));
}

/** Formas de pagamento somam exatamente o total? Devolve a diferença (positivo = falta). */
export function faltaReceber(
  totalLiquido: number,
  pagamentos: readonly { valor: number }[],
): number {
  return totalLiquido - pagamentos.reduce((s, p) => s + p.valor, 0);
}
