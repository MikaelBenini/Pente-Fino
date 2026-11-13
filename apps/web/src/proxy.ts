import { type NextRequest, NextResponse } from 'next/server';
import { ehRotaDoApp } from './lib/rotas';

/** Telas sem login. Convite e redefinição abrem mesmo com sessão (o link vem por e-mail). */
const PUBLICAS = [
  '/entrar',
  '/esqueci-senha',
  '/redefinir-senha',
  '/convite',
  '/confirmar-email',
  '/offline',
  '/cadastro',
  '/agendar',
  '/b',
  '/s',
  '/f',
  '/horario',
  '/assinar',
  '/planos',
  '/termos',
  '/privacidade',
  // Administração do sistema: login próprio (não usa a sessão da barbearia).
  '/admin',
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

  // Só as telas do sistema pedem login; endereço que não existe vira 404 (não o login com 200).
  if (!publica && !temSessao && ehRotaDoApp(pathname)) {
    const url = new URL('/entrar', req.url);
    if (pathname !== '/app') url.searchParams.set('voltar', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  if (temSessao && SO_SEM_SESSAO.includes(pathname)) {
    // A tela mandou ao login porque a API recusou a sessão: o cookie que sobrou não vale.
    // Sem isto, /entrar devolveria para /app, que mandaria de novo para /entrar.
    if (pathname === '/entrar' && req.nextUrl.searchParams.get('motivo') === 'sessao') {
      const res = NextResponse.next();
      res.cookies.set('pf_sessao', '', { path: '/', maxAge: 0 });
      res.cookies.set('pf_acesso', '', { path: '/api', maxAge: 0 });
      return res;
    }
    return NextResponse.redirect(new URL('/app', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|admin-api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icones|video|site/|robots.txt|sitemap.xml|opengraph-image|icon.svg|.*\\.png$).*)',
  ],
};
