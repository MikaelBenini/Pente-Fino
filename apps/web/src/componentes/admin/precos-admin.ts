'use client';

import { tabelaVigente, type TabelaPrecosPlanos } from '@pente-fino/shared';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from './admin-api';

/** Tabelas de preço na administração e a que vale numa data (padrão: hoje). */
export function useTabelasAdmin() {
  const q = useQuery({
    queryKey: ['admin', 'precos'],
    queryFn: () =>
      adminApi<{ tabelas: TabelaPrecosPlanos[]; hoje: string }>('configuracoes/precos'),
  });
  return {
    consulta: q,
    vigente: (data?: string | null) =>
      q.data ? tabelaVigente(q.data.tabelas, data === undefined ? q.data.hoje : data) : undefined,
  };
}
