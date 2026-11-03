'use client';

import { criarFilaOffline, type Lancamento, type ResultadoEnvio } from '@pente-fino/shared';
import { createStore, get, set } from 'idb-keyval';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

// Lançamentos feitos sem internet ficam no IndexedDB do aparelho e sobem na ordem
// quando a conexão volta. Os módulos de comanda (Etapa 6) usam enfileirarLancamento().

const loja = typeof indexedDB === 'undefined' ? undefined : createStore('pente-fino', 'fila');
const CHAVE = 'lancamentos';

const armazenamento = {
  ler: async () => (loja ? ((await get<Lancamento[]>(CHAVE, loja)) ?? []) : []),
  gravar: async (l: Lancamento[]) => {
    if (loja) await set(CHAVE, l, loja);
  },
};

async function enviar(l: Lancamento): Promise<ResultadoEnvio> {
  try {
    const r = await fetch(`/api/${l.caminho}`, {
      method: l.metodo,
      headers: { 'content-type': 'application/json', 'x-request-id': l.id },
      body: l.corpo === undefined ? undefined : JSON.stringify(l.corpo),
    });
    if (r.ok) return { tipo: 'ok' };
    // Sessão vencida ou servidor fora: tenta de novo depois, sem perder o lançamento.
    if (r.status === 401 || r.status >= 500 || r.status === 429) return { tipo: 'sem_conexao' };
    const corpo = (await r.json().catch(() => null)) as { erro?: { mensagem?: string } } | null;
    return { tipo: 'recusado', mensagem: corpo?.erro?.mensagem ?? `Recusado (${r.status}).` };
  } catch {
    return { tipo: 'sem_conexao' };
  }
}

const fila = criarFilaOffline(armazenamento, enviar);
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((o) => o());

export async function enfileirarLancamento(
  dados: Pick<Lancamento, 'caminho' | 'metodo' | 'corpo' | 'descricao'>,
) {
  await fila.enfileirar(dados, crypto.randomUUID());
  avisar();
  if (navigator.onLine) void fila.sincronizar().then(avisar);
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    useCallback((o: () => void) => {
      window.addEventListener('online', o);
      window.addEventListener('offline', o);
      return () => {
        window.removeEventListener('online', o);
        window.removeEventListener('offline', o);
      };
    }, []),
    () => navigator.onLine,
    () => true,
  );
}

/** Lançamentos esperando conexão e recusados; sincroniza ao voltar a internet. */
export function useFilaOffline() {
  const online = useOnline();
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);

  useEffect(() => {
    const atualizar = () => void fila.listar().then(setLancamentos);
    ouvintes.add(atualizar);
    atualizar();
    return () => void ouvintes.delete(atualizar);
  }, []);

  useEffect(() => {
    if (online) void fila.sincronizar().then(avisar);
  }, [online]);

  return {
    online,
    pendentes: lancamentos.filter((l) => !l.erro),
    recusados: lancamentos.filter((l) => l.erro),
    descartar: async (id: string) => {
      await fila.descartar(id);
      avisar();
    },
  };
}
