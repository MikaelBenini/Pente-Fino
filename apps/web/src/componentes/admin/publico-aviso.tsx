'use client';

// Admin F8: para quem vai o aviso geral. Planos, situação (em teste ou pagante) e contas
// escolhidas; nada marcado = todas. Mostra quantas contas vão ver hoje.
import {
  contaNoPublico,
  descreverPublico,
  NOME_PLANO,
  PLANOS,
  type ContaNaPlataforma,
  type PublicoAviso,
} from '@pente-fino/shared';
import { Selecao } from '@pente-fino/ui';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { adminApi } from './admin-api';

/** Tira as listas vazias: sem nenhuma, o aviso vale para todas (undefined). */
export function publicoLimpo(p: PublicoAviso): PublicoAviso | undefined {
  const limpo: PublicoAviso = {};
  if (p.planos?.length) limpo.planos = p.planos;
  if (p.situacoes?.length) limpo.situacoes = p.situacoes;
  if (p.contas?.length) limpo.contas = p.contas;
  return Object.keys(limpo).length ? limpo : undefined;
}

function alternar<T>(lista: readonly T[] | undefined, item: T): T[] {
  const l = lista ?? [];
  return l.includes(item) ? l.filter((x) => x !== item) : [...l, item];
}

export function PublicoDoAviso({
  publico,
  onMudar,
}: {
  publico: PublicoAviso;
  onMudar: (p: PublicoAviso) => void;
}) {
  const contas = useQuery({
    queryKey: ['admin', 'contas'],
    queryFn: () => adminApi<ContaNaPlataforma[]>('contas'),
  });
  const lista = (contas.data ?? []).filter((c) => !c.interna && c.status !== 'cancelada');
  const nomes = new Map(lista.map((c) => [c.id, c.nome]));
  const limpo = publicoLimpo(publico);
  const veem = lista.filter((c) => contaNoPublico(limpo, c)).length;
  const caixa = 'flex min-h-9 items-center gap-2 text-sm';

  return (
    <fieldset className="flex flex-col gap-3 rounded-md border border-borda p-3">
      <legend className="px-1 text-sm font-semibold">Quem vê</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        {PLANOS.map((p) => (
          <label key={p} className={caixa}>
            <input
              type="checkbox"
              checked={!!publico.planos?.includes(p)}
              onChange={() => onMudar({ ...publico, planos: alternar(publico.planos, p) })}
              className="size-4 accent-modulo"
            />
            {NOME_PLANO[p]}
          </label>
        ))}
        <label className={caixa}>
          <input
            type="checkbox"
            checked={!!publico.situacoes?.includes('teste')}
            onChange={() =>
              onMudar({ ...publico, situacoes: alternar(publico.situacoes, 'teste') })
            }
            className="size-4 accent-modulo"
          />
          Em teste
        </label>
        <label className={caixa}>
          <input
            type="checkbox"
            checked={!!publico.situacoes?.includes('pagante')}
            onChange={() =>
              onMudar({ ...publico, situacoes: alternar(publico.situacoes, 'pagante') })
            }
            className="size-4 accent-modulo"
          />
          Pagantes
        </label>
      </div>
      <Selecao
        id="aviso-conta"
        rotulo="Só estas contas (opcional)"
        value=""
        onChange={(e) =>
          e.target.value &&
          onMudar({ ...publico, contas: [...new Set([...(publico.contas ?? []), e.target.value])] })
        }
        opcoes={[
          { valor: '', rotulo: 'Escolher uma conta…' },
          ...lista
            .filter((c) => !publico.contas?.includes(c.id))
            .map((c) => ({ valor: c.id, rotulo: c.nome })),
        ]}
      />
      {publico.contas?.length ? (
        <ul aria-label="Contas escolhidas" className="flex flex-wrap gap-2">
          {publico.contas.map((id) => (
            <li
              key={id}
              className="flex items-center gap-1 rounded-full border border-borda px-3 py-1 text-sm"
            >
              {nomes.get(id) ?? 'Conta'}
              <button
                type="button"
                aria-label={`Tirar ${nomes.get(id) ?? 'a conta'}`}
                onClick={() =>
                  onMudar({ ...publico, contas: publico.contas!.filter((x) => x !== id) })
                }
                className="grid size-6 place-items-center rounded-full hover:bg-superficie-2 focus-visible:outline-2 focus-visible:outline-foco"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p aria-live="polite" className="text-sm text-tinta-suave">
        {descreverPublico(limpo)}
        {contas.data && ` · ${veem} ${veem === 1 ? 'conta vê' : 'contas veem'} hoje`}
      </p>
    </fieldset>
  );
}
