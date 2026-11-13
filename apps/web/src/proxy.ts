import type { DominioPublico } from '@pente-fino/shared';
import { type NextRequest, NextResponse } from 'next/server';
import { CABECALHO_DOMINIO, ehHostDoPenteFino, rotaNoDominio } from './lib/dominio-proprio';
import { ehRotaDoApp } from './lib/rotas';

/** Domínios próprios já consultados (um minuto): o proxy não pergunta à API a cada pedido. */
const DOMINIOS = new Map<string, { mapa: DominioPublico | null; ate: number }>();

async function mapaDoDominio(host: string): Promise<DominioPublico | null> {
  const chave = host.toLowerCase().replace(/:\d+$/, '');
  const guardado = DOMINIOS.get(chave);
  if (guardado && guardado.ate > Date.now()) return guardado.mapa;
  let mapa: DominioPublico | null = null;
  try {
    const api = (process.env.API_URL ?? '').replace(/\/$/, '');
    const r = await fetch(`${api}/publico/dominio/${encodeURIComponent(chave)}`);
    mapa = r.ok ? ((await r.json()) as DominioPublico) : null;
  } catch {
    mapa = null;
  }
  if (DOMINIOS.size > 5000) DOMINIOS.clear();
  DOMINIOS.set(chave, { mapa, ate: Date.now() + 60_000 });
  return mapa;
}

/** Pedido pelo domínio da barbearia (lote 7e): site, páginas e /agendar; o resto, ao Pente Fino. */
async function noDominio(req: NextRequest, host: string): Promise<NextResponse> {
  const mapa = await mapaDoDominio(host);
  if (!mapa)
    return new NextResponse('Este domínio ainda não está ligado a um site.', { status: 404 });
  const { pathname, search } = req.nextUrl;
  const rota = rotaNoDominio(pathname, mapa);
  if (rota.tipo === 'passar') return NextResponse.next();
  if (rota.tipo === 'levar') {
    const principal = process.env.APP_URL ?? 'https://seupentefino.com.br';
    return NextResponse.redirect(new URL(`${rota.caminho}${search}`, principal));
  }
  const cabecalhos = new Headers(req.headers);
  cabecalhos.set(CABECALHO_DOMINIO, host.toLowerCase().replace(/:\d+$/, ''));
  return NextResponse.rewrite(new URL(`${rota.caminho}${search}`, req.url), {
    request: { headers: cabecalhos },
  });
}

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
export async function proxy(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  if (host && !ehHostDoPenteFino(host, process.env.APP_URL)) return noDominio(req, host);
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
