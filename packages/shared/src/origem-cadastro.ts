// De onde veio cada cadastro (site T2, admin F2): os parâmetros dos anúncios e campanhas que
// chegam no endereço (gclid, gbraid, wbraid, utm_*) e o site de origem. Guardados no navegador ao
// chegar e enviados no cadastro, para o Google Ads medir a conversão e a administração saber
// qual campanha traz barbearia. Nunca dado pessoal: só os parâmetros e o domínio de origem.
import { z } from 'zod';

export const CHAVES_ORIGEM = [
  'gclid',
  'gbraid',
  'wbraid',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
] as const;
export type ChaveOrigem = (typeof CHAVES_ORIGEM)[number];

const valor = z.string().trim().max(200);

export const origemCadastroSchema = z
  .object({
    gclid: valor.optional(),
    gbraid: valor.optional(),
    wbraid: valor.optional(),
    utm_source: valor.optional(),
    utm_medium: valor.optional(),
    utm_campaign: valor.optional(),
    utm_term: valor.optional(),
    utm_content: valor.optional(),
    /** Só o domínio do site de onde veio (ex.: "instagram.com"), nunca o endereço inteiro. */
    referrer: z.string().trim().max(120).optional(),
    /** Primeira chegada com estes parâmetros (ISO). */
    chegouEm: z.iso.datetime({ error: 'Data inválida.' }).optional(),
  })
  .strip();
export type OrigemCadastro = z.infer<typeof origemCadastroSchema>;

/**
 * O que guardar desta visita: os parâmetros do endereço e o domínio de quem mandou (quando não é
 * o próprio site). null = nada novo (visita direta ou navegação interna), então vale o que já
 * estava guardado (o clique do anúncio não se perde ao voltar pela página inicial).
 */
export function origemDaVisita(
  endereco: string,
  referrer: string,
  agora = new Date(),
): OrigemCadastro | null {
  let url: URL;
  try {
    url = new URL(endereco);
  } catch {
    return null;
  }
  const o: OrigemCadastro = {};
  for (const k of CHAVES_ORIGEM) {
    const v = url.searchParams.get(k)?.trim();
    if (v) o[k] = v.slice(0, 200);
  }
  let deFora: string | null = null;
  try {
    const r = referrer ? new URL(referrer) : null;
    if (r && r.hostname && r.hostname !== url.hostname) deFora = r.hostname.replace(/^www\./, '');
  } catch {
    deFora = null;
  }
  if (deFora) o.referrer = deFora.slice(0, 120);
  if (Object.keys(o).length === 0) return null;
  return { ...o, chegouEm: agora.toISOString() };
}

/** Resumo para a administração: "google / cpc · lancamento-30" ou "instagram.com". */
export function resumoDaOrigem(o: OrigemCadastro | null | undefined): string | null {
  if (!o) return null;
  if (o.gclid || o.gbraid || o.wbraid) {
    const campanha = o.utm_campaign ? ` · ${o.utm_campaign}` : '';
    return `Google Ads${campanha}`;
  }
  if (o.utm_source) {
    return [`${o.utm_source}${o.utm_medium ? ` / ${o.utm_medium}` : ''}`, o.utm_campaign]
      .filter(Boolean)
      .join(' · ');
  }
  return o.referrer ?? null;
}

/** Trilha de navegação (BreadcrumbList) para o Google nas páginas internas do site (S3). */
export function trilhaJsonLd(itens: readonly { nome: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: itens.map((i, n) => ({
      '@type': 'ListItem',
      position: n + 1,
      name: i.nome,
      item: i.url,
    })),
  };
}
