// Assinatura do Pente Fino pela barbearia (Etapa 10.1, lado do dono): em que situação a conta
// está e se o sistema fica só para consulta. Bloqueio suave: nunca apaga dado.
import { dataLocal } from './datas.js';
import { diasRestantesTeste } from './planos.js';
import type { DataISO } from './vigencia.js';

/** Dias depois do vencimento em que a conta segue normal, só com aviso. */
export const TOLERANCIA_ATRASO_DIAS = 5;

export const STATUS_FATURA = ['aberta', 'paga', 'recusada', 'cancelada'] as const;
export type StatusFatura = (typeof STATUS_FATURA)[number];

export type SituacaoAssinatura =
  'teste' | 'teste_vencido' | 'ativa' | 'em_atraso' | 'bloqueada' | 'suspensa' | 'cancelada';

export interface FaturaParaSituacao {
  status: StatusFatura;
  vencimento: DataISO;
}

export interface EstadoAssinatura {
  situacao: SituacaoAssinatura;
  /** Bloqueio suave: lê tudo, não grava nada (só pagar e sair). */
  somenteLeitura: boolean;
  /** Dias que faltam no teste (0 = termina hoje); null fora do teste. */
  diasRestantesTeste: number | null;
  /** Dias desde o vencimento da fatura mais antiga em aberto; null sem atraso. */
  diasEmAtraso: number | null;
  /** Frase para o aviso no topo do painel. */
  mensagem: string;
}

const dias = (de: DataISO, ate: DataISO) =>
  Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);

/**
 * Situação da assinatura:
 * - teste: dentro dos 14 dias; teste_vencido: acabou sem pagamento → só consulta;
 * - ativa; em_atraso: fatura vencida (ou recusada) há até 5 dias → aviso;
 * - bloqueada: vencida há mais de 5 dias → só consulta;
 * - suspensa e cancelada: decididas pela administração → só consulta.
 */
export function situacaoAssinatura(
  conta: { status: 'teste' | 'ativa' | 'suspensa' | 'cancelada'; testeAte: Date | null },
  faturas: readonly FaturaParaSituacao[],
  agora: Date,
): EstadoAssinatura {
  const hoje = dataLocal(agora);
  const base = { diasRestantesTeste: null, diasEmAtraso: null };
  if (conta.status === 'suspensa')
    return {
      ...base,
      situacao: 'suspensa',
      somenteLeitura: true,
      mensagem:
        'A conta está suspensa: dá para consultar tudo, mas não lançar. Fale com o suporte.',
    };
  if (conta.status === 'cancelada')
    return {
      ...base,
      situacao: 'cancelada',
      somenteLeitura: true,
      mensagem: 'A assinatura foi cancelada. Seus dados continuam aqui para consulta.',
    };

  const pagou = faturas.some((f) => f.status === 'paga');
  if (conta.status === 'teste' && !pagou) {
    const restantes = conta.testeAte ? diasRestantesTeste(conta.testeAte, agora) : null;
    if (restantes !== null && conta.testeAte! > agora)
      return {
        ...base,
        situacao: 'teste',
        somenteLeitura: false,
        diasRestantesTeste: restantes,
        mensagem:
          restantes === 0
            ? 'Seu teste grátis termina hoje.'
            : `Faltam ${restantes} ${restantes === 1 ? 'dia' : 'dias'} de teste grátis.`,
      };
    return {
      ...base,
      situacao: 'teste_vencido',
      somenteLeitura: true,
      diasRestantesTeste: restantes,
      mensagem:
        'Seu teste grátis terminou. O sistema está só para consulta: assine para voltar a lançar. Seus dados continuam aqui.',
    };
  }

  const atrasadas = faturas
    .filter((f) => (f.status === 'aberta' || f.status === 'recusada') && f.vencimento < hoje)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  if (atrasadas.length === 0)
    return { ...base, situacao: 'ativa', somenteLeitura: false, mensagem: 'Assinatura em dia.' };
  const atraso = dias(atrasadas[0]!.vencimento, hoje);
  if (atraso > TOLERANCIA_ATRASO_DIAS)
    return {
      ...base,
      situacao: 'bloqueada',
      somenteLeitura: true,
      diasEmAtraso: atraso,
      mensagem: `A fatura está vencida há ${atraso} dias. O sistema está só para consulta até o pagamento. Seus dados continuam aqui.`,
    };
  const faltam = TOLERANCIA_ATRASO_DIAS - atraso;
  return {
    ...base,
    situacao: 'em_atraso',
    somenteLeitura: false,
    diasEmAtraso: atraso,
    mensagem: `Há uma fatura vencida. Pague em até ${faltam} ${faltam === 1 ? 'dia' : 'dias'} para não ficar só para consulta.`,
  };
}

export interface FaturaDetalhe {
  id: string;
  plano: 'basico' | 'pro' | 'premium';
  ciclo: 'mensal' | 'anual';
  valor: number;
  vencimento: DataISO;
  periodoInicio: DataISO;
  periodoFim: DataISO;
  status: StatusFatura;
  forma: 'pix' | 'cartao' | 'boleto' | 'dinheiro' | 'transferencia' | null;
  pagaEm: string | null;
  motivoRecusa: string | null;
  linkPagamento: string | null;
}

/** Aba Assinatura (só o dono). */
export interface AssinaturaDetalhe {
  estado: EstadoAssinatura;
  plano: 'basico' | 'pro' | 'premium';
  ciclo: 'mensal' | 'anual';
  /** Fim do teste grátis (ISO); null fora do teste. */
  testeAte: string | null;
  /** Preço por mês do plano no ciclo, com as unidades ativas (centavos). */
  precoPorMes: number;
  unidades: number;
  /** A fatura em aberto (ou recusada) mais antiga: a que precisa de atenção. */
  pendente: FaturaDetalhe | null;
  faturas: FaturaDetalhe[];
}

export const NOME_SITUACAO_ASSINATURA: Readonly<Record<SituacaoAssinatura, string>> = {
  teste: 'Teste grátis',
  teste_vencido: 'Teste terminado',
  ativa: 'Em dia',
  em_atraso: 'Pagamento atrasado',
  bloqueada: 'Só para consulta',
  suspensa: 'Suspensa',
  cancelada: 'Cancelada',
};

export const NOME_STATUS_FATURA: Readonly<Record<StatusFatura, string>> = {
  aberta: 'Em aberto',
  paga: 'Paga',
  recusada: 'Recusada',
  cancelada: 'Cancelada',
};
