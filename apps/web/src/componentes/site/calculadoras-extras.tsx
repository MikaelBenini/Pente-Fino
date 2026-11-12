'use client';

// Site N3: calculadoras de comissão e de preço do corte. As contas ficam em @pente-fino/shared
// (calculadoras.ts, com teste); aqui só os campos e o resultado.
import { comissaoDoBarbeiro, formatarMoeda, precoMinimoDoCorte } from '@pente-fino/shared';
import { useId, useRef, useState } from 'react';
import { Campo, centavos, inteiro } from './calculadora-sobra';
import { BotaoTesteOferta } from './oferta-lancamento';
import { eventoGoogle } from './tag-google';

/** Medição (briefing do site, T3): a primeira vez que o visitante mexe na conta. */
function useMedir(nome: string) {
  const mediu = useRef(false);
  return (f: (v: string) => void) => (v: string) => {
    if (!mediu.current) {
      mediu.current = true;
      eventoGoogle('use_calculadora', { calculadora: nome });
    }
    f(v);
  };
}

const Caixa = ({ children }: { children: React.ReactNode }) => (
  <div className="grid gap-8 rounded-2xl border border-borda bg-superficie p-5 sm:p-8 lg:grid-cols-[1fr_1.1fr]">
    {children}
  </div>
);

function Linha({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="rounded-lg bg-fundo p-3">
      <dt className="text-sm text-tinta-suave">{rotulo}</dt>
      <dd className="font-denso text-xl font-semibold tabular-nums">{formatarMoeda(valor)}</dd>
    </div>
  );
}

export function CalculadoraComissao() {
  const [preco, setPreco] = useState('50');
  const [comissao, setComissao] = useState('40');
  const [produto, setProduto] = useState('5');
  const [descontar, setDescontar] = useState(false);
  const usar = useMedir('comissao');
  const idDescontar = useId();
  const r = comissaoDoBarbeiro({
    preco: centavos(preco),
    comissaoPct: inteiro(comissao),
    produto: centavos(produto),
    descontarProduto: descontar,
  });
  return (
    <Caixa>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
        <Campo rotulo="Preço do serviço" prefixo="R$" valor={preco} onChange={usar(setPreco)} />
        <Campo rotulo="Comissão" sufixo="%" valor={comissao} onChange={usar(setComissao)} />
        <Campo rotulo="Produto usado" prefixo="R$" valor={produto} onChange={usar(setProduto)} />
        <label htmlFor={idDescontar} className="flex min-h-12 items-center gap-3 self-end text-sm">
          <input
            id={idDescontar}
            type="checkbox"
            checked={descontar}
            onChange={(e) => usar(() => setDescontar(e.target.checked))('')}
            className="size-5 accent-modulo"
          />
          Descontar o produto antes da comissão
        </label>
      </form>
      <div className="flex flex-col gap-5" aria-live="polite">
        <div>
          <p className="text-sm text-tinta-suave">O barbeiro recebe</p>
          <p className="font-denso text-6xl font-bold text-modulo-texto tabular-nums">
            {formatarMoeda(r.barbeiro)}
          </p>
          <p className="text-sm text-tinta-suave">
            {inteiro(comissao)}% sobre {formatarMoeda(r.base)}
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-3">
          <Linha rotulo="Barbeiro" valor={r.barbeiro} />
          <Linha rotulo="Produto" valor={r.produto} />
          <Linha rotulo="Casa" valor={r.casa} />
        </dl>
        <p className="text-sm text-tinta-suave">
          O Pente Fino calcula a comissão de cada item da comanda sozinho, com a regra de cada
          barbeiro, e mostra o extrato no celular dele.
        </p>
        <BotaoTesteOferta extra="origem=calculadora-comissao" className="self-start" />
      </div>
    </Caixa>
  );
}

export function CalculadoraPreco() {
  const [fixos, setFixos] = useState('6000');
  const [cortes, setCortes] = useState('400');
  const [comissao, setComissao] = useState('45');
  const [produto, setProduto] = useState('3,50');
  const [margem, setMargem] = useState('20');
  const usar = useMedir('preco');
  const r = precoMinimoDoCorte({
    custosFixosMes: centavos(fixos),
    cortesMes: inteiro(cortes),
    comissaoPct: inteiro(comissao),
    produto: centavos(produto),
    margemPct: inteiro(margem),
  });
  return (
    <Caixa>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
        <Campo
          rotulo="Custos fixos do mês"
          prefixo="R$"
          valor={fixos}
          onChange={usar(setFixos)}
          dica="Aluguel, luz, internet, sistema…"
        />
        <Campo rotulo="Cortes no mês" valor={cortes} onChange={usar(setCortes)} />
        <Campo rotulo="Comissão" sufixo="%" valor={comissao} onChange={usar(setComissao)} />
        <Campo
          rotulo="Produto por corte"
          prefixo="R$"
          valor={produto}
          onChange={usar(setProduto)}
        />
        <Campo rotulo="Margem desejada" sufixo="%" valor={margem} onChange={usar(setMargem)} />
      </form>
      <div className="flex flex-col gap-5" aria-live="polite">
        {r ? (
          <>
            <div>
              <p className="text-sm text-tinta-suave">Preço mínimo do corte</p>
              <p className="font-denso text-6xl font-bold text-modulo-texto tabular-nums">
                {formatarMoeda(r.preco)}
              </p>
              <p className="text-sm text-tinta-suave">
                Abaixo disso, o corte não paga os custos com a margem que você quer.
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Linha rotulo="Comissão" valor={r.comissao} />
              <Linha rotulo="Produto" valor={centavos(produto)} />
              <Linha rotulo="Custo fixo" valor={r.fixoPorCorte} />
              <Linha rotulo="Margem" valor={r.margem} />
            </dl>
          </>
        ) : (
          <p role="status" className="text-lg">
            Com esses números não existe preço possível: a comissão e a margem somam 100% ou mais,
            ou faltam os cortes do mês.
          </p>
        )}
        <p className="text-sm text-tinta-suave">
          No Pente Fino, o lucro e a margem de cada serviço aparecem sozinhos, com os números reais
          do mês (plano Premium).
        </p>
        <BotaoTesteOferta extra="origem=calculadora-preco" className="self-start" />
      </div>
    </Caixa>
  );
}
