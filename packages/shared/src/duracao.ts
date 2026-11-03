const UNIDADES_MS = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

/** Converte "15m", "12h", "30d", "45s" em milissegundos. */
export function duracaoEmMs(texto: string): number {
  const achado = /^(\d+)\s*([smhd])$/.exec(texto.trim());
  if (!achado) throw new RangeError(`duração inválida: "${texto}" (use 45s, 15m, 12h ou 30d)`);
  const [, quantidade, unidade] = achado;
  return Number(quantidade) * UNIDADES_MS[unidade as keyof typeof UNIDADES_MS];
}
