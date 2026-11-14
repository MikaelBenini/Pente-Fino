// Domínio próprio da barbearia (seção 7, lote 7e). Pedidos que chegam por um domínio que não é o
// do Pente Fino: a raiz é o site, /servicos, /equipe e /contato são as páginas dele, e /agendar
// é o agendamento. Regras puras, testadas em dominio-proprio.test.ts; quem usa é o proxy.
import type { DominioPublico } from '@pente-fino/shared';

/** Cabeçalho que o proxy põe no pedido reescrito: a página monta os links sem /s/<endereço>. */
export const CABECALHO_DOMINIO = 'x-pf-dominio';

/** O pedido veio pelo endereço do Pente Fino (ou pelo ambiente de desenvolvimento)? */
export function ehHostDoPenteFino(host: string, appUrl: string | undefined): boolean {
  const h = host.toLowerCase().replace(/:\d+$/, '');
  if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]') return true;
  if (h.endsWith('.app.github.dev') || h.endsWith('.github.dev')) return true;
  if (!appUrl) return true;
  try {
    const principal = new URL(appUrl).hostname;
    return h === principal || h.endsWith(`.${principal}`);
  } catch {
    return true;
  }
}

const PAGINAS = new Set(['/servicos', '/equipe', '/contato', '/galeria', '/clube']);
/** Caminhos que funcionam iguais em qualquer domínio (arquivos, fotos, ponte da API, horário). */
const PASSAM = ['/_next/', '/f/', '/api/', '/horario', '/b/', '/s/', '/icones/', '/video/'];
const ARQUIVOS = new Set(['/favicon.ico', '/manifest.webmanifest', '/sw.js', '/icon.svg']);

export type RotaNoDominio =
  { tipo: 'reescrever'; caminho: string } | { tipo: 'passar' } | { tipo: 'levar'; caminho: string };

/** O que fazer com o caminho pedido no domínio da barbearia. */
export function rotaNoDominio(pathname: string, mapa: DominioPublico): RotaNoDominio {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p === '/') return { tipo: 'reescrever', caminho: `/s/${mapa.siteSlug}` };
  if (PAGINAS.has(p)) return { tipo: 'reescrever', caminho: `/s/${mapa.siteSlug}${p}` };
  if (p === '/agendar' && mapa.slugAgendamento)
    return { tipo: 'reescrever', caminho: `/b/${mapa.slugAgendamento}` };
  if (p === '/robots.txt') return { tipo: 'passar' };
  if (ARQUIVOS.has(p) || PASSAM.some((x) => p.startsWith(x) || `${p}/` === x))
    return { tipo: 'passar' };
  // O resto (login, painel, página de vendas) é do Pente Fino: vai para o endereço principal.
  return { tipo: 'levar', caminho: p };
}
