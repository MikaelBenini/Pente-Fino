// De onde veio o visitante (site T2): os parâmetros do anúncio e da campanha (gclid, gbraid,
// wbraid, utm_*) e o site de origem, guardados ao chegar e enviados no cadastro. Com o aceite
// de cookies, num cookie próprio de 90 dias (quem volta depois ainda conta para o anúncio); sem o
// aceite, só durante a visita (sessionStorage). Nunca dado pessoal.
import { origemCadastroSchema, origemDaVisita, type OrigemCadastro } from '@pente-fino/shared';

const COOKIE = 'pf_origem';
const SESSAO = 'pf-origem';
const NOVENTA_DIAS = 90 * 24 * 60 * 60;

const aceitouCookies = () => {
  try {
    return localStorage.getItem('pf-cookies') === 'aceito';
  } catch {
    return false;
  }
};

function lerCookie(): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`));
  return m ? decodeURIComponent(m[1]!) : null;
}

function gravar(o: OrigemCadastro) {
  const texto = JSON.stringify(o);
  if (aceitouCookies()) {
    const seguro = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${COOKIE}=${encodeURIComponent(texto)}; Max-Age=${NOVENTA_DIAS}; Path=/; SameSite=Lax${seguro}`;
  } else {
    try {
      sessionStorage.setItem(SESSAO, texto);
    } catch {
      // Sem armazenamento: a origem desta visita não é guardada.
    }
  }
}

/** A origem guardada (cookie ou visita), já conferida pelo mesmo esquema do servidor. */
export function lerOrigem(): OrigemCadastro | null {
  let bruto: string | null = null;
  try {
    bruto = lerCookie() ?? sessionStorage.getItem(SESSAO);
  } catch {
    bruto = null;
  }
  if (!bruto) return null;
  try {
    const r = origemCadastroSchema.safeParse(JSON.parse(bruto));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/** Ao chegar: guarda os parâmetros novos (visita direta não apaga o clique do anúncio). */
export function capturarOrigem() {
  const nova = origemDaVisita(window.location.href, document.referrer);
  if (nova) gravar(nova);
}

/** O visitante aceitou os cookies: o que estava só nesta visita passa a valer por 90 dias. */
export function promoverOrigem() {
  const o = lerOrigem();
  if (o) gravar(o);
}
