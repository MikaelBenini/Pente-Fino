'use client';

import { NOME_TIPO_AVISO, type PreferenciasAvisos, type TipoAviso } from '@pente-fino/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { Aviso } from './aviso';

type Resposta = PreferenciasAvisos & { tipos: TipoAviso[]; profissional: boolean };
const chave = ['avisos', 'preferencias'] as const;

/**
 * Perfil → Avisos: cada tipo de aviso da central pode ir ou não para o celular; dono e gestor
 * escolhem também receber o resumo do dia por e-mail. Salva a cada mudança.
 */
export function PreferenciasDeAvisos() {
  const prefs = useQuery({ queryKey: chave, queryFn: () => api<Resposta>('avisos/preferencias') });
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  // Escolha local: o checkbox muda na hora; o servidor só confirma.
  const [local, setLocal] = useState<PreferenciasAvisos | null>(null);
  if (!prefs.data || (prefs.data.tipos.length === 0 && !prefs.data.profissional)) return null;
  const p = { ...prefs.data, ...(local ?? {}) };

  async function salvar(novo: PreferenciasAvisos) {
    setErro(null);
    setSalvo(false);
    setLocal(novo);
    try {
      await api('avisos/preferencias', { metodo: 'PUT', corpo: novo });
      setSalvo(true);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível salvar.');
      setLocal(null);
      void prefs.refetch();
    }
  }
  const atual: PreferenciasAvisos = {
    celular: p.celular,
    resumoPorEmail: p.resumoPorEmail,
    agendaNoCelular: p.agendaNoCelular,
  };

  return (
    <section className="flex flex-col gap-3" aria-labelledby="titulo-pref-avisos">
      <h2
        id="titulo-pref-avisos"
        className="text-xs font-semibold uppercase tracking-wider text-tinta-suave"
      >
        Avisos
      </h2>
      <div className="flex flex-col gap-4 rounded-lg border border-borda bg-superficie p-4">
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <p className="text-tinta-suave">
          Todos aparecem no sino do app. Escolha quais também chegam como notificação no celular
          (nos aparelhos em que você ligou as notificações).
        </p>
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-medium">No celular</legend>
          {p.profissional && (
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                checked={p.agendaNoCelular}
                onChange={(e) => salvar({ ...atual, agendaNoCelular: e.target.checked })}
                className="size-5 accent-[var(--modulo)]"
              />
              Horário novo, remarcado ou cancelado na minha agenda
            </label>
          )}
          {p.tipos.map((t) => (
            <label key={t} className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                checked={p.celular[t] !== false}
                onChange={(e) =>
                  salvar({ ...atual, celular: { ...atual.celular, [t]: e.target.checked } })
                }
                className="size-5 accent-[var(--modulo)]"
              />
              {NOME_TIPO_AVISO[t]}
            </label>
          ))}
        </fieldset>
        {p.tipos.includes('resumo_dia') && (
          <label className="flex min-h-11 items-center gap-3 border-t border-borda pt-3">
            <input
              type="checkbox"
              checked={p.resumoPorEmail}
              onChange={(e) => salvar({ ...atual, resumoPorEmail: e.target.checked })}
              className="size-5 accent-[var(--modulo)]"
            />
            Receber o resumo do dia também por e-mail
          </label>
        )}
        {salvo && (
          <p role="status" className="text-sm text-acao-texto">
            Preferências salvas.
          </p>
        )}
      </div>
    </section>
  );
}
