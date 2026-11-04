import { cn } from './cn.js';

export interface EntradaBarraMeta {
  atual: number;
  objetivo: number;
  /** Parte do mês já trabalhada (dias trabalhados ÷ dias de trabalho), de 0 a 1. */
  fracaoDoMes: number;
}

export interface CalculoBarraMeta {
  /** atual ÷ objetivo, podendo passar de 1. */
  fracao: number;
  /** Onde a barra deveria estar hoje pelo ritmo, de 0 a 1. */
  esperado: number;
  situacao: 'batida' | 'adiantada' | 'no_ritmo' | 'atrasada';
  falta: number;
}

/** Tolerância de 3 pontos para "no ritmo": um dia fraco não pinta o mês de vermelho. */
const TOLERANCIA = 0.03;

export function calcularBarraMeta({
  atual,
  objetivo,
  fracaoDoMes,
}: EntradaBarraMeta): CalculoBarraMeta {
  const fracao = objetivo > 0 ? atual / objetivo : 0;
  const esperado = Math.min(1, Math.max(0, fracaoDoMes));
  let situacao: CalculoBarraMeta['situacao'] = 'no_ritmo';
  if (fracao >= 1) situacao = 'batida';
  else if (fracao > esperado + TOLERANCIA) situacao = 'adiantada';
  else if (fracao < esperado - TOLERANCIA) situacao = 'atrasada';
  return { fracao, esperado, situacao, falta: Math.max(0, objetivo - atual) };
}

const TEXTO_SITUACAO: Record<CalculoBarraMeta['situacao'], string> = {
  batida: 'Meta batida',
  adiantada: 'Acima do ritmo',
  no_ritmo: 'No ritmo',
  atrasada: 'Abaixo do ritmo',
};

const pct = (f: number) => `${Math.round(f * 100)}%`;

export interface BarraMetaProps extends EntradaBarraMeta {
  rotulo: string;
  /** Formata atual, objetivo e falta (moeda ou quantidade). */
  formatar: (valor: number) => string;
  className?: string;
}

/** Atual sobre objetivo, com a marca de onde deveria estar hoje pelo ritmo. */
export function BarraMeta({ rotulo, formatar, className, ...entrada }: BarraMetaProps) {
  const c = calcularBarraMeta(entrada);
  const atrasada = c.situacao === 'atrasada';
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-tinta-suave">{rotulo}</span>
        <span className="font-denso text-lg font-semibold tabular-nums text-tinta">
          {formatar(entrada.atual)}{' '}
          <span className="text-tinta-fraca">de {formatar(entrada.objetivo)}</span>
        </span>
      </div>
      <div
        role="meter"
        aria-label={rotulo}
        aria-valuemin={0}
        aria-valuemax={entrada.objetivo}
        aria-valuenow={entrada.atual}
        aria-valuetext={`${pct(c.fracao)} da meta; pelo ritmo, hoje deveria estar em ${pct(c.esperado)}`}
        className="relative h-3 rounded-full bg-superficie-3"
      >
        <div
          className={cn('animar-barra-x h-full rounded-full', atrasada ? 'bg-aviso' : 'bg-acao')}
          style={{ width: `${Math.min(100, c.fracao * 100)}%` }}
        />
        <div
          aria-hidden
          className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-tinta"
          style={{ left: `calc(${c.esperado * 100}% - 1px)` }}
        />
      </div>
      <div className="flex flex-wrap justify-between gap-x-3 text-sm tabular-nums">
        <span className={atrasada ? 'font-semibold text-aviso-texto' : 'text-tinta-suave'}>
          {pct(c.fracao)} · {TEXTO_SITUACAO[c.situacao]}
        </span>
        <span className="text-tinta-suave">
          {c.falta > 0
            ? `Faltam ${formatar(c.falta)} · ritmo pede ${pct(c.esperado)}`
            : 'Objetivo alcançado'}
        </span>
      </div>
    </div>
  );
}
