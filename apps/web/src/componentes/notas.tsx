'use client';

import { formatarDataHora, type ComentarioAvaliacao, type ResumoNotas } from '@pente-fino/shared';
import { Botao, Campo } from '@pente-fino/ui';
import { CircleCheck, Star } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { chavesResultados, useAcao } from '@/lib/consultas';
import { Aviso } from './aviso';

const nota = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1 });

/** Média de 1 a 5 com quantas respostas e as barras de cada nota (texto para leitor de tela). */
export function ResumoDeNotas({ titulo, resumo }: { titulo: string; resumo: ResumoNotas }) {
  const maior = Math.max(1, ...resumo.distribuicao);
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">{titulo}</p>
      {resumo.media === null ? (
        <p className="text-tinta-suave">Ninguém respondeu ainda.</p>
      ) : (
        <>
          <p className="flex items-baseline gap-2">
            <span className="font-denso text-3xl font-bold tabular-nums">{nota(resumo.media)}</span>
            <span className="text-tinta-suave">
              de 5 · {resumo.respostas} {resumo.respostas === 1 ? 'resposta' : 'respostas'}
            </span>
          </p>
          <ol className="flex flex-col gap-1" aria-label={`Notas de ${titulo.toLowerCase()}`}>
            {[5, 4, 3, 2, 1].map((n) => {
              const qtd = resumo.distribuicao[n - 1]!;
              return (
                <li key={n} className="flex items-center gap-2 text-sm">
                  <span className="flex w-7 shrink-0 items-center gap-0.5 tabular-nums">
                    {n}
                    <Star aria-hidden className="size-3" />
                  </span>
                  <span
                    aria-hidden
                    className="h-2 flex-1 overflow-hidden rounded-full bg-superficie-2"
                  >
                    <span
                      className={`block h-full rounded-full ${n <= 2 ? 'bg-perigo-texto' : 'bg-acao'}`}
                      style={{ width: `${(qtd / maior) * 100}%` }}
                    />
                  </span>
                  <span className="w-6 shrink-0 text-right tabular-nums text-tinta-suave">
                    <span className="sr-only">nota {n}: </span>
                    {qtd}
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}

/** Um comentário da pesquisa com as notas (o nome do cliente só para dono e gestor). */
export function ComentarioDaPesquisa({ c }: { c: ComentarioAvaliacao }) {
  return (
    <li className="flex flex-col gap-1 rounded-lg border border-borda bg-superficie p-3">
      <p className="text-sm">
        <span className="font-semibold">Atendimento {c.notaAtendimento}</span>
        {c.notaBarbearia !== null && (
          <span className="text-tinta-suave"> · barbearia {c.notaBarbearia}</span>
        )}
      </p>
      {c.comentario && <p className="whitespace-pre-line">“{c.comentario}”</p>}
      <p className="text-xs text-tinta-suave">
        {[c.cliente, c.profissional, formatarDataHora(c.respondidaEm)].filter(Boolean).join(' · ')}
      </p>
    </li>
  );
}

/**
 * Nota baixa em Métricas: atalho para o cliente e "Marcar como resolvido" com o que foi feito.
 * Resolvida, mostra quem resolveu, quando e a anotação.
 */
export function NotaBaixa({ c }: { c: ComentarioAvaliacao }) {
  const [aberto, setAberto] = useState(false);
  const [anotacao, setAnotacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const tratar = useAcao(
    (texto: string) => api(`avaliacoes/${c.id}/tratar`, { corpo: { anotacao: texto } }),
    [chavesResultados.indicadores],
  );
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-borda bg-superficie p-3">
      <p className="text-sm">
        <span className="font-semibold">Atendimento {c.notaAtendimento}</span>
        {c.notaBarbearia !== null && (
          <span className="text-tinta-suave"> · barbearia {c.notaBarbearia}</span>
        )}
      </p>
      {c.comentario && <p className="whitespace-pre-line">“{c.comentario}”</p>}
      <p className="text-xs text-tinta-suave">
        {[c.cliente, c.profissional, formatarDataHora(c.respondidaEm)].filter(Boolean).join(' · ')}
        {c.clienteId && (
          <>
            {' · '}
            <Link href={`/clientes?id=${c.clienteId}`} className="underline">
              Ver cliente
            </Link>
          </>
        )}
      </p>
      {c.tratamento ? (
        <p className="flex items-start gap-2 text-sm text-acao-texto">
          <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            Resolvida
            {c.tratamento.por ? ` por ${c.tratamento.por}` : ''} em{' '}
            {formatarDataHora(c.tratamento.em)}:{' '}
            <span className="text-tinta">{c.tratamento.anotacao}</span>
          </span>
        </p>
      ) : aberto ? (
        <form
          method="post"
          noValidate
          className="flex flex-col gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setErro(null);
            try {
              await tratar.mutateAsync(anotacao);
              setAberto(false);
            } catch (er) {
              setErro(er instanceof ErroApi ? er.message : 'Não foi possível salvar.');
            }
          }}
        >
          <Campo
            id={`tratamento-${c.id}`}
            rotulo="O que foi feito"
            dica="Ex.: liguei, pedi desculpas e ofereci o próximo corte com desconto"
            value={anotacao}
            onChange={(e) => setAnotacao(e.target.value)}
          />
          {erro && <Aviso tom="erro">{erro}</Aviso>}
          <div className="flex flex-wrap gap-2">
            <Botao
              type="submit"
              carregando={tratar.isPending}
              disabled={anotacao.trim().length < 3}
            >
              Salvar como resolvida
            </Botao>
            <Botao type="button" variante="fantasma" onClick={() => setAberto(false)}>
              Cancelar
            </Botao>
          </div>
        </form>
      ) : (
        <Botao variante="secundario" className="self-start" onClick={() => setAberto(true)}>
          Marcar como resolvida
        </Botao>
      )}
    </li>
  );
}
