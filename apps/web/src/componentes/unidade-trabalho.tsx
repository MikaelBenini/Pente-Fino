'use client';

import { Selecao } from '@pente-fino/ui';
import { useState } from 'react';
import { useApp } from './contexto-app';

/**
 * Telas do dia a dia (agenda, comandas, caixa) trabalham numa unidade. Com
 * "Todas as unidades" ativa, mostra um seletor; senão usa a unidade ativa.
 */
export function useUnidadeTrabalho(): { unidadeId: string | null; seletor: React.ReactNode } {
  const { unidades, unidadeAtiva } = useApp();
  const ativas = unidades.filter((u) => u.ativa);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  if (unidadeAtiva !== 'todas') return { unidadeId: unidadeAtiva, seletor: null };
  const unidadeId = escolhida ?? ativas[0]?.id ?? null;
  return {
    unidadeId,
    seletor:
      ativas.length > 1 ? (
        <div className="w-full max-w-56">
          <Selecao
            id="unidade-trabalho"
            rotulo="Unidade"
            value={unidadeId ?? ''}
            onChange={(e) => setEscolhida(e.target.value)}
            opcoes={ativas.map((u) => ({ valor: u.id, rotulo: u.nome }))}
          />
        </div>
      ) : null,
  };
}
