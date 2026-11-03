'use client';

import type { ClipboardEvent } from 'react';
import { cn } from './cn.js';

export interface ColunaEditavel {
  chave: string;
  rotulo: string;
  /** "numero" e "moeda" alinham à direita com números tabulares. */
  tipo?: 'texto' | 'numero' | 'moeda';
  somenteLeitura?: boolean;
}

export type LinhaEditavel = Record<string, string>;

/** Texto copiado de planilha (Excel, Google Planilhas): linhas por quebra, colunas por tab. */
export function interpretarColagem(texto: string): string[][] {
  const linhas = texto.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n');
  return linhas.map((l) => l.split('\t').map((c) => c.trim()));
}

/**
 * Aplica a colagem a partir da célula (linha, coluna), criando linhas no fim se
 * precisar. Colunas somente leitura são puladas; o que passa da última coluna é ignorado.
 */
export function aplicarColagem(
  linhas: readonly LinhaEditavel[],
  colunas: readonly ColunaEditavel[],
  inicio: { linha: number; coluna: number },
  dados: string[][],
): LinhaEditavel[] {
  const editaveis = colunas
    .map((c, i) => ({ c, i }))
    .filter(({ c, i }) => i >= inicio.coluna && !c.somenteLeitura);
  const resultado = linhas.map((l) => ({ ...l }));
  dados.forEach((valores, deslocamento) => {
    const indice = inicio.linha + deslocamento;
    while (resultado.length <= indice)
      resultado.push(Object.fromEntries(colunas.map((c) => [c.chave, ''])));
    valores.forEach((valor, j) => {
      const alvo = editaveis[j];
      if (alvo) resultado[indice]![alvo.c.chave] = valor;
    });
  });
  return resultado;
}

export interface TabelaEditavelProps {
  id: string;
  legenda: string;
  colunas: readonly ColunaEditavel[];
  linhas: readonly LinhaEditavel[];
  onChange: (linhas: LinhaEditavel[]) => void;
}

/** Tabela de células editáveis que aceita colar várias linhas da planilha de uma vez. */
export function TabelaEditavel({ id, legenda, colunas, linhas, onChange }: TabelaEditavelProps) {
  function aoColar(e: ClipboardEvent<HTMLInputElement>, linha: number, coluna: number) {
    const texto = e.clipboardData.getData('text/plain');
    if (!texto.includes('\t') && !texto.includes('\n')) return; // colagem de um valor só: deixa o input cuidar
    e.preventDefault();
    onChange(aplicarColagem(linhas, colunas, { linha, coluna }, interpretarColagem(texto)));
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-borda">
      <table className="w-full border-collapse font-denso text-base">
        <caption className="sr-only">{legenda}</caption>
        <thead className="bg-superficie-2">
          <tr>
            {colunas.map((c) => (
              <th
                key={c.chave}
                scope="col"
                className={cn(
                  'px-3 py-2 text-sm font-semibold uppercase tracking-wide text-tinta-suave',
                  c.tipo && c.tipo !== 'texto' ? 'text-right' : 'text-left',
                )}
              >
                {c.rotulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, i) => (
            <tr key={i} className="border-t border-borda">
              {colunas.map((c, j) => {
                const numerico = c.tipo === 'numero' || c.tipo === 'moeda';
                return (
                  <td key={c.chave} className="p-0">
                    <input
                      id={`${id}-${i}-${c.chave}`}
                      aria-label={`${c.rotulo}, linha ${i + 1}`}
                      value={linha[c.chave] ?? ''}
                      readOnly={c.somenteLeitura}
                      inputMode={numerico ? 'decimal' : undefined}
                      onPaste={(e) => aoColar(e, i, j)}
                      onChange={(e) => {
                        const novas = linhas.map((l) => ({ ...l }));
                        novas[i]![c.chave] = e.target.value;
                        onChange(novas);
                      }}
                      className={cn(
                        'min-h-11 w-full bg-transparent px-3 text-tinta tabular-nums',
                        'focus-visible:bg-superficie-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foco',
                        numerico && 'text-right',
                        c.somenteLeitura && 'text-tinta-suave',
                      )}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
