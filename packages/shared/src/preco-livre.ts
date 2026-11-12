// Serviço com preço livre (química, por exemplo): o valor é digitado na comanda. Pedido do dono
// em 11/11/2026: a opção existe, mas sem virar desconto escondido. O serviço liga "preço livre"
// (desligado por padrão), pode ter faixa (mínimo e máximo) e o preço da tabela continua sendo o
// valor sugerido. Dono, gestor e recepção digitam; o barbeiro só se o dono liberar.
import type { Papel } from './papeis.js';

export interface RegraPrecoLivre {
  precoLivre: boolean;
  precoMinimo: number | null;
  precoMaximo: number | null;
}

export type ResultadoPrecoLivre =
  | { ok: true; valor: number }
  | {
      ok: false;
      codigo: 'preco_fixo' | 'abaixo_do_minimo' | 'acima_do_maximo';
      mensagem: string;
    };

const reais = (centavos: number) =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * O preço que o item recebe: sem valor digitado, o da tabela; com valor, só se o serviço tem
 * preço livre e o valor está dentro da faixa.
 */
export function conferirPrecoLivre(
  regra: RegraPrecoLivre,
  tabela: number,
  valor?: number | null,
): ResultadoPrecoLivre {
  if (valor === undefined || valor === null) return { ok: true, valor: tabela };
  if (!regra.precoLivre) {
    if (valor === tabela) return { ok: true, valor };
    return {
      ok: false,
      codigo: 'preco_fixo',
      mensagem: 'Este serviço tem preço de tabela. Para cobrar menos, dê desconto.',
    };
  }
  if (regra.precoMinimo !== null && valor < regra.precoMinimo)
    return {
      ok: false,
      codigo: 'abaixo_do_minimo',
      mensagem: `O valor mínimo deste serviço é ${reais(regra.precoMinimo)}.`,
    };
  if (regra.precoMaximo !== null && valor > regra.precoMaximo)
    return {
      ok: false,
      codigo: 'acima_do_maximo',
      mensagem: `O valor máximo deste serviço é ${reais(regra.precoMaximo)}.`,
    };
  return { ok: true, valor };
}

/** Faixa do cadastro: mínimo até o máximo. Devolve a mensagem do erro, ou null se está certa. */
export function erroNaFaixaPrecoLivre(regra: RegraPrecoLivre): string | null {
  if (!regra.precoLivre) return null;
  if (
    regra.precoMinimo !== null &&
    regra.precoMaximo !== null &&
    regra.precoMinimo > regra.precoMaximo
  )
    return 'O mínimo não pode ser maior que o máximo.';
  return null;
}

/** Quem pode digitar o valor: dono, gestor e recepção; o barbeiro só com a liberação do dono. */
export function podeDigitarPrecoLivre(papeis: readonly Papel[], barbeiroDigita: boolean): boolean {
  if (papeis.some((p) => p !== 'barbeiro')) return true;
  return papeis.includes('barbeiro') && barbeiroDigita;
}

/** Liberação do barbeiro (Serviços → Catálogo, só o dono). */
export interface ConfigPrecoLivre {
  barbeiroDigita: boolean;
}
