// Ponte entre o navegador e a API (backend for frontend). O navegador chama /api/...,
// este handler acrescenta o token guardado em cookie httpOnly, renova a sessão quando
// o token de acesso venceu e devolve a resposta sem tokens no corpo.
import type { Sessao } from '@pente-fino/shared';
import { type NextRequest, NextResponse } from 'next/server';
import {
  apagarSessao,
  COOKIE_ACESSO,
  COOKIE_SESSAO,
  gravarSessao,
  gravarSessaoSuporte,
  renovar,
  SESSAO_SUPORTE,
  segundosAteVencer,
  urlDaApi,
} from '@/lib/servidor/sessao';
import {
  caminhoValido,
  hostsDeDesenvolvimento,
  LIMITE_CORPO_BYTES,
  origemPermitida,
} from '@/lib/seguranca';

/** Origens extras aceitas só em desenvolvimento (Codespaces). */
const HOSTS_EXTRAS = hostsDeDesenvolvimento(process.env);

/** Rotas internas: o navegador não chama direto. */
const BLOQUEADAS = new Set(['auth/renovar']);

/** Cabeçalhos repassados à API. O IP real vai no X-Forwarded-For (limite de tentativas). */
function cabecalhos(req: NextRequest, acesso?: string): Headers {
  const h = new Headers();
  const tipo = req.headers.get('content-type');
  if (tipo) h.set('content-type', tipo);
  const id = req.headers.get('x-request-id');
  if (id) h.set('x-request-id', id);
  const ip = req.headers.get('x-forwarded-for');
  if (ip) h.set('x-forwarded-for', ip);
  const agente = req.headers.get('user-agent');
  if (agente) h.set('user-agent', agente);
  // Admin F6: segredo da conversa do chat do site (o visitante não tem sessão).
  const chat = req.headers.get('x-chat-token');
  if (chat) h.set('x-chat-token', chat);
  if (acesso) h.set('authorization', `Bearer ${acesso}`);
  return h;
}

function temTokens(corpo: unknown): corpo is Sessao {
  return !!corpo && typeof corpo === 'object' && 'accessToken' in corpo && 'refreshToken' in corpo;
}

async function encaminhar(
  req: NextRequest,
  ctx: RouteContext<'/api/[...caminho]'>,
): Promise<Response> {
  const segmentos = (await ctx.params).caminho;
  const caminho = segmentos.join('/');
  // A administração tem a própria ponte (/admin-api) e o próprio login.
  if (!caminhoValido(segmentos) || BLOQUEADAS.has(caminho) || segmentos[0] === 'admin') {
    return NextResponse.json(
      { erro: { codigo: 'nao_encontrado', mensagem: 'Não encontrado.' } },
      { status: 404 },
    );
  }

  if (
    !origemPermitida(
      req.method,
      req.headers.get('host'),
      req.headers.get('origin'),
      req.headers.get('referer'),
      HOSTS_EXTRAS,
    )
  ) {
    return NextResponse.json(
      { erro: { codigo: 'origem_invalida', mensagem: 'Pedido recusado: origem desconhecida.' } },
      { status: 403 },
    );
  }
  if (Number(req.headers.get('content-length') ?? 0) > LIMITE_CORPO_BYTES) {
    return NextResponse.json(
      { erro: { codigo: 'muito_grande', mensagem: 'O envio é grande demais.' } },
      { status: 413 },
    );
  }

  // Admin F5: a página /suporte entrega aqui o token de suporte vindo da administração. Ele
  // vira cookie httpOnly; quem confere o token (e recusa gravação) é a API.
  if (caminho === 'suporte/entrar') {
    if (req.method !== 'POST') return NextResponse.json({}, { status: 405 });
    const { token } = ((await req.json().catch(() => ({}))) ?? {}) as { token?: unknown };
    const segundos = typeof token === 'string' ? segundosAteVencer(token) : 0;
    if (typeof token !== 'string' || segundos < 30)
      return NextResponse.json(
        { erro: { codigo: 'suporte_invalido', mensagem: 'O link de suporte venceu.' } },
        { status: 400 },
      );
    const res = new NextResponse(null, { status: 204 });
    gravarSessaoSuporte(req, res, token, segundos);
    return res;
  }

  const sessao = req.cookies.get(COOKIE_SESSAO)?.value;
  // Sessão de suporte não tem token de renovação: vale até o de acesso vencer.
  const refresh = sessao === SESSAO_SUPORTE ? undefined : sessao;
  const suporte = sessao === SESSAO_SUPORTE;

  // Sair: a API encerra a sessão do refreshToken; aqui os cookies são apagados.
  if (caminho === 'auth/sair') {
    if (refresh) {
      await fetch(`${urlDaApi()}/auth/sair`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      }).catch(() => undefined);
    }
    const res = new NextResponse(null, { status: 204 });
    apagarSessao(res, req);
    return res;
  }

  let acesso = req.cookies.get(COOKIE_ACESSO)?.value;
  let renovada: Sessao | null = null;
  if (!acesso && refresh) {
    renovada = await renovar(refresh);
    acesso = renovada?.accessToken;
  }

  const corpo = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer();
  if (corpo && corpo.byteLength > LIMITE_CORPO_BYTES) {
    return NextResponse.json(
      { erro: { codigo: 'muito_grande', mensagem: 'O envio é grande demais.' } },
      { status: 413 },
    );
  }
  const destino = `${urlDaApi()}/${caminho}${req.nextUrl.search}`;
  const chamar = (token?: string) =>
    fetch(destino, {
      method: req.method,
      headers: cabecalhos(req, token),
      body: corpo,
      cache: 'no-store',
    });

  let resposta: Response;
  try {
    resposta = await chamar(acesso);
    // Token recusado (expirou entre o cookie e a API): renova uma vez e tenta de novo.
    if (resposta.status === 401 && refresh && !renovada && acesso) {
      renovada = await renovar(refresh);
      if (renovada) resposta = await chamar(renovada.accessToken);
    }
  } catch {
    return NextResponse.json(
      {
        erro: {
          codigo: 'api_indisponivel',
          mensagem: 'O servidor não respondeu. Tente de novo em instantes.',
        },
      },
      { status: 502 },
    );
  }

  const tipo = resposta.headers.get('content-type') ?? '';
  let res: NextResponse;
  if (tipo.includes('application/json')) {
    const json: unknown = await resposta.json();
    if (resposta.ok && temTokens(json)) {
      // Login, aceite de convite, troca de senha: tokens viram cookies; o corpo leva só o usuário.
      res = NextResponse.json({ usuario: json.usuario }, { status: resposta.status });
      gravarSessao(req, res, json);
    } else {
      res = NextResponse.json(json, { status: resposta.status });
    }
  } else {
    res = new NextResponse(resposta.status === 204 ? null : await resposta.arrayBuffer(), {
      status: resposta.status,
      headers: {
        ...(tipo ? { 'content-type': tipo } : {}),
        // CSV e PDF (exportação, comandas impressas) baixam com o nome certo.
        ...(resposta.headers.get('content-disposition')
          ? { 'content-disposition': resposta.headers.get('content-disposition')! }
          : {}),
      },
    });
  }

  const idRequisicao = resposta.headers.get('x-request-id');
  if (idRequisicao) res.headers.set('x-request-id', idRequisicao);
  if (renovada && !res.cookies.get(COOKIE_SESSAO)) gravarSessao(req, res, renovada);
  // Sessão perdida (renovação recusada ou suporte vencido): limpa os cookies para o proxy mandar ao login.
  if (resposta.status === 401 && ((refresh && !renovada) || suporte)) apagarSessao(res, req);
  return res;
}

export const GET = encaminhar;
export const POST = encaminhar;
export const PUT = encaminhar;
export const PATCH = encaminhar;
export const DELETE = encaminhar;
