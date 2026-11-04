import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from './cn.js';

export interface Comparacao {
  /** "vs. outubro" ou "meta R$ 35.000,00". */
  rotulo: string;
  /** Variação já formatada: "+12%". */
  variacao: string;
  sentido: 'bom' | 'ruim' | 'neutro';
}

export interface CartaoIndicadorProps {
  rotulo: string;
  /** Valor já formatado. */
  valor: string;
  comparacao?: Comparacao;
  /** De onde vem o número; aparece ao tocar. Ex.: "Comandas fechadas de 01/11 a 03/11, Centro". */
  origem?: string;
  className?: string;
}

const SENTIDO = {
  bom: { icone: ArrowUpRight, classe: 'text-acao-texto' },
  ruim: { icone: ArrowDownRight, classe: 'text-perigo-texto' },
  neutro: { icone: Minus, classe: 'text-tinta-suave' },
} as const;

/** Número sempre com contexto: valor, comparação e a origem do cálculo. */
export function CartaoIndicador({
  rotulo,
  valor,
  comparacao,
  origem,
  className,
}: CartaoIndicadorProps) {
  const s = comparacao ? SENTIDO[comparacao.sentido] : null;
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col gap-1 rounded-lg border border-borda bg-superficie p-4',
        className,
      )}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">{rotulo}</h3>
      <p className="font-denso text-3xl font-semibold leading-tight tabular-nums text-tinta">
        {valor}
      </p>
      {comparacao && s && (
        <p className={cn('flex items-center gap-1 text-sm tabular-nums', s.classe)}>
          <s.icone aria-hidden className="size-4" />
          <span className="font-semibold">{comparacao.variacao}</span>
          <span className="text-tinta-suave">{comparacao.rotulo}</span>
        </p>
      )}
      {origem && (
        <details className="group mt-1 text-sm">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-tinta-suave underline decoration-dotted underline-offset-4 hover:text-tinta">
            De onde vem
          </summary>
          <p className="text-tinta-suave">{origem}</p>
        </details>
      )}
    </section>
  );
}
