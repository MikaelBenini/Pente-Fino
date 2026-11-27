'use client';

// Os negócios do mesmo login lado a lado no Início (sugestão aprovada em 27/11/2026): para quem é
// dono em mais de um, o faturamento do mês e os horários de hoje de cada um, sem trocar de negócio.
import { formatarMoeda, NOME_LICENCA, type NegocioNoResumo } from '@pente-fino/shared';
import { Botao } from '@pente-fino/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { trocarDeNegocio } from '@/lib/sessao';
import { useApp } from './contexto-app';

export function SeusNegocios() {
  const app = useApp();
  const temOutros = !!app.usuario.outrasContas?.length && app.papeis.includes('dono');
  const negocios = useQuery({
    queryKey: ['resumo', 'negocios'],
    queryFn: () => api<NegocioNoResumo[]>('resumo/negocios'),
    enabled: temOutros,
    staleTime: 60_000,
  });
  const [trocando, setTrocando] = useState<string | null>(null);
  if (!temOutros || !negocios.data?.length) return null;
  return (
    <section aria-labelledby="titulo-seus-negocios" className="flex flex-col gap-3">
      <h2 id="titulo-seus-negocios" className="text-lg font-semibold">
        Seus negócios
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {negocios.data.map((n) => (
          <li
            key={n.contaId}
            className={
              n.atual
                ? 'flex flex-col gap-2 rounded-lg border-2 border-modulo bg-superficie p-4'
                : 'flex flex-col gap-2 rounded-lg border border-borda bg-superficie p-4'
            }
          >
            <p className="flex items-baseline justify-between gap-2">
              <span className="truncate font-semibold">{n.nome}</span>
              <span className="shrink-0 text-xs text-tinta-suave">
                {n.atual ? 'Você está aqui' : `Licença ${NOME_LICENCA[n.licenca]}`}
              </span>
            </p>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-tinta-suave">Faturamento do mês</dt>
                <dd className="font-denso text-lg tabular-nums">
                  {n.faturamentoMes === null ? '—' : formatarMoeda(n.faturamentoMes)}
                </dd>
              </div>
              <div>
                <dt className="text-tinta-suave">Horários hoje</dt>
                <dd className="font-denso text-lg tabular-nums">{n.agendamentosHoje}</dd>
              </div>
            </dl>
            {!n.atual && (
              <Botao
                variante="secundario"
                className="self-start"
                carregando={trocando === n.contaId}
                onClick={async () => {
                  setTrocando(n.contaId);
                  await trocarDeNegocio(n.contaId).catch(() => setTrocando(null));
                }}
              >
                Ir para {n.nome}
              </Botao>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
