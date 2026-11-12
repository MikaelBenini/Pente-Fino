// Receber adiantado, o sinal (painel A2, aprovado pelo dono em 11/11/2026): o pagamento fica
// registrado na comanda aberta, entra no caixa do dia em que foi recebido e abate do total ao
// fechar. Cancelar a comanda pede o que fazer com ele: devolver (sai do caixa no dia da
// devolução) ou reter (fica no caixa, como receita não operacional, fora do faturamento).
import type { FormaPagamento } from './esquemas-operacao.js';

export interface PagamentoNoCaixa {
  forma: FormaPagamento;
  valor: number;
}

/** O que falta receber no fechamento, depois do sinal. Negativo = o sinal passou do total. */
export function restanteAposSinal(
  totalLiquido: number,
  sinais: readonly { valor: number }[],
): number {
  return totalLiquido - sinais.reduce((s, p) => s + p.valor, 0);
}

/**
 * Entradas do caixa do dia, por forma: os pagamentos das comandas fechadas no dia (sem os
 * sinais, que já entraram no dia em que foram recebidos), mais os sinais recebidos no dia,
 * menos os sinais devolvidos no dia.
 */
export function entradasDoCaixa(e: {
  fechadas: readonly PagamentoNoCaixa[];
  sinaisRecebidos: readonly PagamentoNoCaixa[];
  sinaisDevolvidos: readonly PagamentoNoCaixa[];
}): {
  porForma: { forma: FormaPagamento; total: number; quantidade: number }[];
  total: number;
  sinais: { recebidos: number; devolvidos: number };
} {
  const mapa = new Map<FormaPagamento, { total: number; quantidade: number }>();
  const somar = (p: PagamentoNoCaixa, sinal: 1 | -1) => {
    const atual = mapa.get(p.forma) ?? { total: 0, quantidade: 0 };
    mapa.set(p.forma, {
      total: atual.total + sinal * p.valor,
      quantidade: atual.quantidade + (sinal === 1 ? 1 : 0),
    });
  };
  for (const p of e.fechadas) somar(p, 1);
  for (const p of e.sinaisRecebidos) somar(p, 1);
  for (const p of e.sinaisDevolvidos) somar(p, -1);
  const ordem: FormaPagamento[] = ['dinheiro', 'pix', 'debito', 'credito', 'clube'];
  const porForma = ordem
    .filter((f) => mapa.has(f))
    .map((forma) => ({ forma, ...mapa.get(forma)! }));
  const soma = (l: readonly PagamentoNoCaixa[]) => l.reduce((s, p) => s + p.valor, 0);
  return {
    porForma,
    total: porForma.reduce((s, f) => s + f.total, 0),
    sinais: { recebidos: soma(e.sinaisRecebidos), devolvidos: soma(e.sinaisDevolvidos) },
  };
}
