// Regras de valor e comissão de um item de comanda.
// Dinheiro sempre em centavos (inteiro). Percentuais em pontos-base: 10000 = 100%, 4000 = 40%.

/** Garante que o valor é um inteiro (centavos ou pontos-base) e não negativo. */
function exigirInteiro(nome: string, valor: number): void {
  if (!Number.isSafeInteger(valor) || valor < 0) {
    throw new RangeError(`${nome} deve ser um inteiro não negativo (recebido: ${valor})`);
  }
}

/** Arredonda para o centavo mais próximo; meio centavo sobe. */
function arredondar(valor: number): number {
  return Math.floor(valor + 0.5);
}

export interface ValorItemEntrada {
  quantidade: number;
  /** Preço unitário em centavos. */
  precoUnitario: number;
  /** Desconto total do item em centavos. */
  desconto?: number;
}

/** Valor líquido do item em centavos: quantidade × preço − desconto (nunca negativo). */
export function valorItem({ quantidade, precoUnitario, desconto = 0 }: ValorItemEntrada): number {
  exigirInteiro('quantidade', quantidade);
  exigirInteiro('precoUnitario', precoUnitario);
  exigirInteiro('desconto', desconto);
  const bruto = quantidade * precoUnitario;
  if (desconto > bruto) {
    throw new RangeError(`desconto (${desconto}) maior que o valor do item (${bruto})`);
  }
  return bruto - desconto;
}

/** Regra de comissão: percentual (pontos-base) ou valor fixo por unidade, nunca os dois. */
export type RegraComissao =
  { percentualBp: number; valorFixo?: null } | { percentualBp?: null; valorFixo: number };

/**
 * Comissão de um item em centavos.
 * Percentual: valor do item × percentual. Fixo: valor fixo × quantidade.
 */
export function comissaoItem(
  valorDoItem: number,
  quantidade: number,
  regra: RegraComissao,
): number {
  exigirInteiro('valorDoItem', valorDoItem);
  exigirInteiro('quantidade', quantidade);
  if (regra.percentualBp != null) {
    exigirInteiro('percentualBp', regra.percentualBp);
    if (regra.percentualBp > 10_000) throw new RangeError('percentual acima de 100%');
    return arredondar((valorDoItem * regra.percentualBp) / 10_000);
  }
  if (regra.valorFixo != null) {
    exigirInteiro('valorFixo', regra.valorFixo);
    return regra.valorFixo * quantidade;
  }
  throw new TypeError('regra de comissão sem percentual nem valor fixo');
}

/** Lucro do serviço em centavos: receita − (custo de produto + comissão). Pode ser negativo. */
export function lucroServico(receita: number, custoProduto: number, comissao: number): number {
  exigirInteiro('receita', receita);
  exigirInteiro('custoProduto', custoProduto);
  exigirInteiro('comissao', comissao);
  return receita - (custoProduto + comissao);
}
