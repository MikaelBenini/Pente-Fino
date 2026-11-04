import { type NextRequest, NextResponse } from 'next/server';

/** Telas sem login. Convite e redefinição abrem mesmo com sessão (o link vem por e-mail). */
const PUBLICAS = [
  '/entrar',
  '/esqueci-senha',
  '/redefinir-senha',
  '/convite',
  '/offline',
  '/cadastro',
  '/agendar',
];
const SO_SEM_SESSAO = ['/entrar', '/esqueci-senha', '/cadastro'];

/**
 * Checagem otimista: só olha se existe o cookie de sessão. Quem decide se a sessão
 * vale é a API (o /api renova ou apaga o cookie).
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const temSessao = req.cookies.has('pf_sessao');
  const publica = PUBLICAS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!publica && !temSessao) {
    const url = new URL('/entrar', req.url);
    if (pathname !== '/') url.searchParams.set('voltar', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  if (temSessao && SO_SEM_SESSAO.includes(pathname)) {
    return NextResponse.redirect(new URL('/', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icones|.*\\.png$).*)',
  ],
};
