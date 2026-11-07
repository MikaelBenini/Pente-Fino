// Ponte da administração do sistema (/admin): separada da ponte das barbearias. O token da
// sessão da plataforma fica num cookie httpOnly só deste caminho (SameSite=Strict) e nunca vai
// para o JavaScript da página; só rotas admin/... da API passam por aqui.
import type { RespostaEntrarAdmin } from '@pente-fino/shared';
import { type NextRequest, NextResponse } from 'next/server';
import { urlDaApi } from '@/lib/servidor/sessao';
import {
  caminhoValido,
  hostsDeDesenvolvimento,
  LIMITE_CORPO_BYTES,
  origemPermitida,
} from '@/lib/seguranca';

const COOKIE_ADMIN = 'pf_admin';
const HOSTS_EXTRAS = hostsDeDesenvolvimento(process.env);
const erro = (status: number, codigo: string, mensagem: string) =>
  NextResponse.json({ erro: { codigo, mensagem } }, { status });

function seguro(req: NextRequest): boolean {
  return req.nextUrl.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
}
const cookieBase = (req: NextRequest) => ({
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: seguro(req),
  path: '/admin-api',
});

async function encaminhar(
  req: NextRequest,
  ctx: { params: Promise<{ caminho: string[] }> },
): Promise<Response> {
  const segmentos = (await ctx.params).caminho;
  if (!caminhoValido(segmentos)) return erro(404, 'nao_encontrado', 'Não encontrado.');
  const caminho = `admin/${segmentos.join('/')}`;
  if (
    !origemPermitida(
      req.method,
      req.headers.get('host'),
      req.headers.get('origin'),
      req.headers.get('referer'),
      HOSTS_EXTRAS,
    )
  )
    return erro(403, 'origem_invalida', 'Pedido recusado: origem desconhecida.');
  const corpo = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer();
  if (corpo && corpo.byteLength > LIMITE_CORPO_BYTES)
    return erro(413, 'muito_grande', 'O envio é grande demais.');

  const h = new Headers();
  for (const nome of ['content-type', 'x-forwarded-for', 'user-agent', 'x-request-id']) {
    const v = req.headers.get(nome);
    if (v) h.set(nome, v);
  }
  const token = req.cookies.get(COOKIE_ADMIN)?.value;
  if (token) h.set('authorization', `Bearer ${token}`);

  let resposta: Response;
  try {
    resposta = await fetch(`${urlDaApi()}/${caminho}${req.nextUrl.search}`, {
      method: req.method,
      headers: h,
      body: corpo,
      cache: 'no-store',
    });
  } catch {
    return erro(502, 'api_indisponivel', 'O servidor não respondeu. Tente de novo em instantes.');
  }

  if (resposta.status === 204) {
    const res = new NextResponse(null, { status: 204 });
    if (caminho === 'admin/auth/sair')
      res.cookies.set(COOKIE_ADMIN, '', { ...cookieBase(req), maxAge: 0 });
    return res;
  }
  const json: unknown = await resposta.json().catch(() => null);
  // Entrou: o token vira cookie e o corpo leva só quem entrou.
  if (caminho === 'admin/auth/entrar' && resposta.ok) {
    const r = json as RespostaEntrarAdmin;
    if (r.etapa === 'pronto') {
      const res = NextResponse.json({ etapa: 'pronto', usuario: r.usuario, expiraEm: r.expiraEm });
      const segundos = Math.max(60, Math.floor((Date.parse(r.expiraEm) - Date.now()) / 1000));
      res.cookies.set(COOKIE_ADMIN, r.token, { ...cookieBase(req), maxAge: segundos });
      return res;
    }
  }
  const res = NextResponse.json(json, { status: resposta.status });
  // Sessão acabou: apaga o cookie para a tela voltar ao login.
  if (resposta.status === 401 && token)
    res.cookies.set(COOKIE_ADMIN, '', { ...cookieBase(req), maxAge: 0 });
  return res;
}

export const GET = encaminhar;
export const POST = encaminhar;
export const PUT = encaminhar;
export const PATCH = encaminhar;
export const DELETE = encaminhar;
