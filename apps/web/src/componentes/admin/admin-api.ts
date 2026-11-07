'use client';

// Cliente da administração: fala só com /admin-api (a ponte própria, com o cookie da plataforma).
import { ErroApi, MENSAGEM_SEM_CONEXAO } from '@/lib/api';
import type { CampoInvalido } from '@/lib/tipos';

export async function adminApi<T>(
  caminho: string,
  opcoes: { metodo?: string; corpo?: unknown } = {},
): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`/admin-api/${caminho.replace(/^\//, '')}`, {
      method: opcoes.metodo ?? (opcoes.corpo === undefined ? 'GET' : 'POST'),
      headers: opcoes.corpo === undefined ? undefined : { 'content-type': 'application/json' },
      body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
      credentials: 'same-origin',
    });
  } catch {
    throw new ErroApi(0, 'sem_conexao', MENSAGEM_SEM_CONEXAO);
  }
  if (r.status === 204) return undefined as T;
  const corpo = (await r.json().catch(() => null)) as {
    erro?: { codigo: string; mensagem: string; campos?: CampoInvalido[] };
  } | null;
  if (!r.ok)
    throw new ErroApi(
      r.status,
      corpo?.erro?.codigo ?? 'erro',
      corpo?.erro?.mensagem ?? 'Não foi possível concluir. Tente de novo.',
      corpo?.erro?.campos,
    );
  return corpo as T;
}
