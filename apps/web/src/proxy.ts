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
  '/planos',
  '/termos',
  '/privacidade',
];
const SO_SEM_SESSAO = ['/entrar', '/esqueci-senha', '/cadastro'];
/** Página inicial do site: quem já tem sessão vai direto para o app. */
const SITE = '/';

/**
 * Checagem otimista: só olha se existe o cookie de sessão. Quem decide se a sessão
 * vale é a API (o /api renova ou apaga o cookie).
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const temSessao = req.cookies.has('pf_sessao');
  if (pathname === SITE) {
    return temSessao ? NextResponse.redirect(new URL('/app', req.url)) : NextResponse.next();
  }
  const publica = PUBLICAS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!publica && !temSessao) {
    const url = new URL('/entrar', req.url);
    if (pathname !== '/app') url.searchParams.set('voltar', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  if (temSessao && SO_SEM_SESSAO.includes(pathname)) {
    return NextResponse.redirect(new URL('/app', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icones|robots.txt|sitemap.xml|opengraph-image|icon.svg|.*\\.png$).*)',
  ],
};
