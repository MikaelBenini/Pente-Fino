'use client';

import { formatarMoeda, lerMoeda } from '@pente-fino/shared';
import { useId, useRef, useState } from 'react';
import { BotaoTesteOferta } from './oferta-lancamento';
import { eventoGoogle } from './tag-google';

/** Valor digitado em reais ("45", "45,90", "1.234,56") para centavos; inválido vira 0. */
const centavos = (t: string) => Math.max(0, lerMoeda(t) ?? 0);
const inteiro = (t: string) => Math.max(0, Math.round(Number(t.replace(',', '.')) || 0));

function Campo({
  rotulo,
  valor,
  onChange,
  prefixo,
  sufixo,
  dica,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  prefixo?: string;
  sufixo?: string;
  dica?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {rotulo}
      </label>
      <div className="flex min-h-12 items-center rounded-lg border border-borda bg-fundo px-3 focus-within:border-modulo">
        {prefixo && <span className="mr-1 text-tinta-suave">{prefixo}</span>}
        <input
          id={id}
          inputMode="decimal"
          value={valor}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
          className="w-full bg-transparent font-denso text-xl font-semibold tabular-nums outline-none"
        />
        {sufixo && <span className="ml-1 text-tinta-suave">{sufixo}</span>}
      </div>
      {dica && <p className="text-xs text-tinta-suave">{dica}</p>}
    </div>
  );
}

/**
 * "Quanto sobra de cada corte?": o visitante põe preço, comissão, produto e quantos faz no mês e
 * vê para onde vai o dinheiro. É a conta que o Pente Fino faz sozinho em cada comanda.
 */
export function CalculadoraSobra() {
  const [preco, setPreco] = useState('45');
  const [comissao, setComissao] = useState('45');
  const [produto, setProduto] = useState('3,50');
  const [quantos, setQuantos] = useState('400');
  // Medição (briefing do site, T3): a primeira vez que o visitante mexe na conta.
  const mediu = useRef(false);
  const usar = (f: (v: string) => void) => (v: string) => {
    if (!mediu.current) {
      mediu.current = true;
      eventoGoogle('use_calculadora');
    }
    f(v);
  };

  const p = centavos(preco);
  const c = Math.round((p * Math.min(100, inteiro(comissao))) / 100);
  const pr = Math.min(centavos(produto), Math.max(0, p - c));
  const sobra = Math.max(0, p - c - pr);
  const n = inteiro(quantos);
  const pct = (v: number) => (p > 0 ? (v / p) * 100 : 0);

  return (
    <div className="grid gap-8 rounded-2xl border border-borda bg-superficie p-5 sm:p-8 lg:grid-cols-[1fr_1.1fr]">
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
        <Campo rotulo="Preço do corte" prefixo="R$" valor={preco} onChange={usar(setPreco)} />
        <Campo
          rotulo="Comissão do barbeiro"
          sufixo="%"
          valor={comissao}
          onChange={usar(setComissao)}
        />
        <Campo
          rotulo="Produto usado"
          prefixo="R$"
          valor={produto}
          onChange={usar(setProduto)}
          dica="Pomada, lâmina, toalha…"
        />
        <Campo rotulo="Cortes no mês" valor={quantos} onChange={usar(setQuantos)} />
      </form>

      <div className="flex flex-col gap-5" aria-live="polite">
        <div>
          <p className="text-sm text-tinta-suave">De cada corte, sobra para a casa</p>
          <p className="font-denso text-6xl font-bold text-modulo-texto tabular-nums">
            {formatarMoeda(sobra)}
          </p>
          <p className="text-sm text-tinta-suave">
            {pct(sobra).toFixed(0)}% do preço · no mês:{' '}
            <strong className="text-tinta">{formatarMoeda(sobra * n)}</strong> antes das despesas
            fixas
          </p>
        </div>
        <div
          className="flex h-4 w-full overflow-hidden rounded-full bg-superficie-3"
          role="img"
          aria-label={`Do preço: ${pct(c).toFixed(0)}% comissão, ${pct(pr).toFixed(0)}% produto, ${pct(sobra).toFixed(0)}% sobra`}
        >
          <span className="bg-[#bbaaf2] transition-[width]" style={{ width: `${pct(c)}%` }} />
          <span className="bg-[#f7ae72] transition-[width]" style={{ width: `${pct(pr)}%` }} />
          <span className="bg-modulo transition-[width]" style={{ width: `${pct(sobra)}%` }} />
        </div>
        <dl className="grid grid-cols-3 gap-3 text-sm">
          {[
            ['Comissão', c, 'bg-[#bbaaf2]'],
            ['Produto', pr, 'bg-[#f7ae72]'],
            ['Sobra', sobra, 'bg-modulo'],
          ].map(([rotulo, valor, cor]) => (
            <div key={rotulo as string} className="rounded-lg bg-fundo p-3">
              <dt className="flex items-center gap-1.5 text-tinta-suave">
                <span aria-hidden className={`size-2.5 rounded-full ${cor as string}`} />
                {rotulo as string}
              </dt>
              <dd className="font-denso text-xl font-semibold tabular-nums">
                {formatarMoeda(valor as number)}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-tinta-suave">
          O Pente Fino faz essa conta sozinho em cada comanda, para cada serviço, barbeiro e
          unidade, e ainda desconta as despesas do mês.
        </p>
        <BotaoTesteOferta extra="origem=calculadora" className="self-start" />
      </div>
    </div>
  );
}
