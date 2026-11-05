import 'server-only';
import type { Sessao } from '@pente-fino/shared';
import type { NextRequest, NextResponse } from 'next/server';

/** JWT de acesso (curto). Só as rotas /api precisam dele. */
export const COOKIE_ACESSO = 'pf_acesso';
/** Token de renovação (longo). O proxy.ts usa a presença dele para saber se há sessão. */
export const COOKIE_SESSAO = 'pf_sessao';

const SESSAO_DIAS = 30;

export function urlDaApi(): string {
  const url = process.env.API_URL;
  if (!url) throw new Error('API_URL não definida (veja o .env da raiz)');
  return url.replace(/\/$/, '');
}

function seguro(req: NextRequest): boolean {
  return req.nextUrl.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
}

/** Guarda os tokens em cookies httpOnly: o JavaScript da página nunca vê token. */
export function gravarSessao(
  req: NextRequest,
  res: NextResponse,
  s: Pick<Sessao, 'accessToken' | 'refreshToken' | 'expiraEm'>,
) {
  const base = { httpOnly: true, sameSite: 'lax' as const, secure: seguro(req) };
  // Acesso expira um pouco antes do JWT, para não ir à API com token vencido.
  res.cookies.set(COOKIE_ACESSO, s.accessToken, {
    ...base,
    path: '/api',
    maxAge: Math.max(30, s.expiraEm - 30),
  });
  res.cookies.set(COOKIE_SESSAO, s.refreshToken, {
    ...base,
    path: '/',
    maxAge: SESSAO_DIAS * 86_400,
  });
}

/** Apaga com os mesmos atributos da gravação (alguns navegadores exigem para trocar cookie Secure). */
export function apagarSessao(res: NextResponse, req?: NextRequest) {
  const base = { httpOnly: true, sameSite: 'lax' as const, secure: req ? seguro(req) : false };
  res.cookies.set(COOKIE_ACESSO, '', { ...base, path: '/api', maxAge: 0 });
  res.cookies.set(COOKIE_SESSAO, '', { ...base, path: '/', maxAge: 0 });
}

/**
 * Renovações em andamento ou recém-feitas, por refreshToken. Várias requisições que
 * chegam juntas com o mesmo token (abas, consultas paralelas) compartilham uma única
 * renovação: a API trata o segundo uso do mesmo token como roubo e encerra a sessão.
 * O resultado fica 20 s para atender quem chegou com o cookie antigo logo depois.
 */
const renovacoes = new Map<string, { promessa: Promise<Sessao | null>; expira: number }>();

export function renovar(refreshToken: string): Promise<Sessao | null> {
  const agora = Date.now();
  for (const [chave, r] of renovacoes) if (r.expira < agora) renovacoes.delete(chave);

  const existente = renovacoes.get(refreshToken);
  if (existente) return existente.promessa;

  const promessa = fetch(`${urlDaApi()}/auth/renovar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  })
    .then(async (r) => (r.ok ? ((await r.json()) as Sessao) : null))
    .catch(() => null);
  renovacoes.set(refreshToken, { promessa, expira: agora + 20_000 });
  return promessa;
}
