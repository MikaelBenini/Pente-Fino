// Regras de segurança da ponte /api e dos redirecionamentos. Puras e testadas.

/**
 * Só aceita voltar para uma rota interna. Recusa "//site", "/\\site" (o navegador lê
 * como "//") e qualquer coisa que não comece com uma única barra.
 */
export function destinoSeguro(voltar: string | null | undefined): string {
  if (!voltar || !voltar.startsWith('/') || voltar.startsWith('//') || voltar.includes('\\'))
    return '/app';
  if (/[\u0000-\u001f]/.test(voltar)) return '/app';
  return voltar;
}

/** Segmentos do caminho repassado à API: sem "..", ".", vazios ou barras escondidas. */
export function caminhoValido(segmentos: readonly string[]): boolean {
  return (
    segmentos.length > 0 &&
    segmentos.every(
      (s) => s.length > 0 && s !== '.' && s !== '..' && !/[/\\?#\u0000-\u001f]/.test(s),
    )
  );
}

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Pedido que altera dados precisa vir do próprio site. Segunda barreira contra CSRF,
 * além do cookie SameSite=Lax. Sem Origin (navegadores antigos), olha o Referer.
 * `extras`: outros hosts aceitos (só em desenvolvimento, ver `hostsDeDesenvolvimento`).
 */
export function origemPermitida(
  metodo: string,
  host: string | null,
  origin: string | null,
  referer: string | null,
  extras: readonly string[] = [],
): boolean {
  if (METODOS_SEGUROS.has(metodo.toUpperCase())) return true;
  const fonte = origin ?? referer;
  if (!fonte || !host) return false;
  try {
    const de = new URL(fonte).host;
    return de === host || extras.includes(de);
  } catch {
    return false;
  }
}

/**
 * Endereço do app quando aberto pelo encaminhamento de portas do GitHub Codespaces
 * (o proxy entrega o pedido como "localhost:3000", mas o navegador manda a origem
 * "<codespace>-3000.app.github.dev"). Nunca vale em produção.
 */
export function hostsDeDesenvolvimento(
  env: {
    NODE_ENV?: string;
    CODESPACE_NAME?: string;
    GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN?: string;
  },
  porta = 3000,
): string[] {
  if (env.NODE_ENV === 'production') return [];
  const nome = env.CODESPACE_NAME;
  const dominio = env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
  return nome && dominio && /^[a-z0-9-]+$/i.test(nome) && /^[a-z0-9.-]+$/i.test(dominio)
    ? [`${nome}-${porta}.${dominio}`]
    : [];
}

export const LIMITE_CORPO_BYTES = 1024 * 1024;
