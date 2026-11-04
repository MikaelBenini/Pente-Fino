// Cliente HTTP do navegador: sempre fala com /api (a ponte do Next), nunca com a API direto.
import type { CampoInvalido } from './tipos';

export class ErroApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
    readonly campos: CampoInvalido[] = [],
  ) {
    super(mensagem);
  }
}

export const MENSAGEM_SEM_CONEXAO = 'Sem conexão com a internet. Confira o sinal e tente de novo.';

export async function api<T>(
  caminho: string,
  opcoes: { metodo?: string; corpo?: unknown } = {},
): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(`/api/${caminho.replace(/^\//, '')}`, {
      method: opcoes.metodo ?? (opcoes.corpo === undefined ? 'GET' : 'POST'),
      headers: opcoes.corpo === undefined ? undefined : { 'content-type': 'application/json' },
      body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
      credentials: 'same-origin',
    });
  } catch {
    throw new ErroApi(0, 'sem_conexao', MENSAGEM_SEM_CONEXAO);
  }

  if (resposta.status === 204) return undefined as T;
  const corpo = (await resposta.json().catch(() => null)) as {
    erro?: { codigo: string; mensagem: string; campos?: CampoInvalido[] };
  } | null;

  if (!resposta.ok) {
    const erro = corpo?.erro;
    // Sessão acabou no meio do uso: volta ao login guardando onde estava.
    if (
      resposta.status === 401 &&
      erro?.codigo !== 'credenciais_invalidas' &&
      typeof window !== 'undefined'
    ) {
      const voltar = encodeURIComponent(window.location.pathname + window.location.search);
      // Recarga completa de propósito: descarta o cache da sessão que acabou.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/entrar?voltar=${voltar}&motivo=sessao`);
    }
    throw new ErroApi(
      resposta.status,
      erro?.codigo ?? 'erro',
      erro?.mensagem ?? 'Não foi possível concluir. Tente de novo.',
      erro?.campos,
    );
  }
  return corpo as T;
}
