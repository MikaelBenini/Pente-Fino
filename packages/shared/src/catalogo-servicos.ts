// Catálogo de serviços com preço, comissão e sobra (painel M3): responde à pergunta da tela
// ("Quanto custa cada serviço e quanto sobra dele?"), que antes mostrava só o custo do produto.
// Usa a mesma regra de comissão da comanda (comissaoItem), então o número bate com o que o
// barbeiro recebe.
import { comissaoItem, type RegraComissao } from './dinheiro.js';

export interface PrecoNaUnidade {
  unidadeId: string;
  valor: number;
}

export interface RegraDoBarbeiro {
  unidadeId: string;
  /** A regra de comissão de serviço vigente hoje para este barbeiro (null = sem regra). */
  regra: RegraComissao | null;
}

export interface LinhaDoCatalogo {
  /** Menor e maior preço entre as unidades (iguais quando é o mesmo); null = sem preço. */
  preco: { min: number; max: number } | null;
  /** Comissão média por atendimento, entre os barbeiros das unidades com preço. */
  comissaoMedia: number | null;
  /** Preço − comissão − custo de produto, na média; pode ser negativo. */
  sobraMedia: number | null;
}

/**
 * Para cada preço (unidade) e cada barbeiro ativo daquela unidade, a comissão e a sobra de um
 * atendimento; a linha mostra as médias. Unidade sem barbeiro com regra conta comissão zero.
 */
export function linhaDoCatalogo(d: {
  precos: readonly PrecoNaUnidade[];
  custoProduto: number;
  barbeiros: readonly RegraDoBarbeiro[];
}): LinhaDoCatalogo {
  if (d.precos.length === 0) return { preco: null, comissaoMedia: null, sobraMedia: null };
  const valores = d.precos.map((p) => p.valor);
  const comissoes: number[] = [];
  const sobras: number[] = [];
  for (const p of d.precos) {
    const daUnidade = d.barbeiros.filter((b) => b.unidadeId === p.unidadeId && b.regra);
    const lista = daUnidade.length ? daUnidade.map((b) => comissaoItem(p.valor, 1, b.regra!)) : [0];
    for (const c of lista) {
      comissoes.push(c);
      sobras.push(p.valor - c - d.custoProduto);
    }
  }
  const media = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) / xs.length);
  return {
    preco: { min: Math.min(...valores), max: Math.max(...valores) },
    comissaoMedia: media(comissoes),
    sobraMedia: media(sobras),
  };
}

/** A regra de serviço vigente numa data (a mais recente que já começou). */
export function regraVigente(
  regras: readonly {
    tipoItem: 'servico' | 'produto';
    percentualBp: number | null;
    valorFixo: number | null;
    vigenciaInicio: string;
  }[],
  hoje: string,
): RegraComissao | null {
  const r = regras
    .filter((x) => x.tipoItem === 'servico' && x.vigenciaInicio <= hoje)
    .sort((a, b) => b.vigenciaInicio.localeCompare(a.vigenciaInicio))[0];
  if (!r) return null;
  if (r.percentualBp != null) return { percentualBp: r.percentualBp };
  if (r.valorFixo != null) return { valorFixo: r.valorFixo };
  return null;
}
