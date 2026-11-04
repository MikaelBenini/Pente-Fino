'use client';

import { CircleAlert, Minus, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from './cn.js';

export interface CampoQuantidadeProps {
  id: string;
  rotulo: string;
  /** Valor atual; `null` enquanto o campo está vazio. */
  valor: number | null;
  onMudar: (valor: number | null) => void;
  min?: number;
  max?: number;
  /** Quanto cada toque em − e + muda (padrão 1). */
  passo?: number;
  dica?: string;
  erro?: string;
  /** Unidade mostrada no nome dos botões ("Diminuir cadeiras"). */
  nomeBotoes?: string;
}

/** Limita ao intervalo e arredonda para inteiro. */
export function limitarQuantidade(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * Número inteiro com botões − e +, no lugar das setas do `type="number"` (sem estilo e
 * pequenas demais no celular). Só aceita dígitos: não dá para digitar negativo nem decimal;
 * ao sair do campo, o valor volta para dentro do intervalo.
 */
export function CampoQuantidade({
  id,
  rotulo,
  valor,
  onMudar,
  min = 0,
  max = 9999,
  passo = 1,
  dica,
  erro,
  nomeBotoes,
}: CampoQuantidadeProps) {
  const [texto, setTexto] = useState(valor === null ? '' : String(valor));
  useEffect(() => {
    setTexto((t) =>
      (t === '' && valor === null) || Number(t) === valor ? t : String(valor ?? ''),
    );
  }, [valor]);

  const idDica = dica ? `${id}-dica` : undefined;
  const idErro = erro ? `${id}-erro` : undefined;
  const nome = nomeBotoes ?? rotulo.toLowerCase();
  const definir = (n: number) => {
    const v = limitarQuantidade(n, min, max);
    setTexto(String(v));
    onMudar(v);
  };
  const base = valor ?? min;
  const botao = cn(
    'toque inline-flex size-11 shrink-0 items-center justify-center text-tinta transition',
    'hover:bg-superficie-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foco',
    'disabled:cursor-not-allowed disabled:opacity-40',
  );

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-tinta">
        {rotulo}
      </label>
      <div
        className={cn(
          'flex w-full max-w-44 items-stretch overflow-hidden rounded-md border bg-superficie',
          erro ? 'border-perigo-texto' : 'border-borda',
        )}
      >
        <button
          type="button"
          className={cn(botao, 'border-r border-borda')}
          aria-label={`Diminuir ${nome}`}
          aria-controls={id}
          disabled={base <= min}
          onClick={() => definir(base - passo)}
        >
          <Minus aria-hidden className="size-4" />
        </button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          aria-invalid={erro ? true : undefined}
          aria-describedby={[idErro, idDica].filter(Boolean).join(' ') || undefined}
          className="min-h-11 w-full min-w-0 bg-transparent text-center text-base text-tinta tabular-nums focus-visible:outline-none"
          value={texto}
          onChange={(e) => {
            const so = e.target.value.replace(/\D/g, '').slice(0, String(max).length);
            setTexto(so);
            onMudar(so === '' ? null : Math.min(max, Number(so)));
          }}
          onBlur={() => {
            if (texto !== '') definir(Number(texto));
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              definir(base + passo);
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              definir(base - passo);
            }
          }}
        />
        <button
          type="button"
          className={cn(botao, 'border-l border-borda')}
          aria-label={`Aumentar ${nome}`}
          aria-controls={id}
          disabled={base >= max}
          onClick={() => definir(base + passo)}
        >
          <Plus aria-hidden className="size-4" />
        </button>
      </div>
      {erro && (
        <p id={idErro} className="flex items-start gap-1.5 text-sm text-perigo-texto">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}
      {dica && !erro && (
        <p id={idDica} className="text-sm text-tinta-suave">
          {dica}
        </p>
      )}
    </div>
  );
}
