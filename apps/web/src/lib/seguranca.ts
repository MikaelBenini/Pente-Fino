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
 */
export function origemPermitida(
  metodo: string,
  host: string | null,
  origin: string | null,
  referer: string | null,
): boolean {
  if (METODOS_SEGUROS.has(metodo.toUpperCase())) return true;
  const fonte = origin ?? referer;
  if (!fonte || !host) return false;
  try {
    return new URL(fonte).host === host;
  } catch {
    return false;
  }
}

export const LIMITE_CORPO_BYTES = 1024 * 1024;
