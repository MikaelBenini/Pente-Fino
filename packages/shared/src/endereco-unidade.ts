// Endereço da unidade no mapa (testes de 19/11/2026): o bot mandava o Google Maps procurando só
// "Rua jabora 123", sem cidade nem UF, e uma rua com o mesmo nome em outra cidade podia aparecer.

export const UFS = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const;

export interface EnderecoDaUnidade {
  endereco: string | null;
  cidade?: string | null;
  uf?: string | null;
  linkMapa?: string | null;
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** "Rua Jaborá, 123, Cascavel - PR": junta cidade e UF quando o endereço ainda não traz. */
export function enderecoCompleto(u: EnderecoDaUnidade): string | null {
  const rua = u.endereco?.trim();
  if (!rua) return null;
  const cidade = u.cidade?.trim();
  const uf = u.uf?.trim().toUpperCase();
  const base = semAcento(rua);
  const partes = [rua];
  if (cidade && !base.includes(semAcento(cidade))) partes.push(cidade);
  const temUf = uf && new RegExp(`(^|[^a-z])${uf.toLowerCase()}([^a-z]|$)`).test(base);
  if (uf && !temUf) {
    if (partes.length > 1) partes[partes.length - 1] = `${partes.at(-1)} - ${uf}`;
    else partes.push(uf);
  }
  return partes.join(', ');
}

/** Link do Google Maps que a barbearia colou (curto ou completo). */
export function linkDeMapaValido(url: string): boolean {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== 'https:') return false;
    const h = u.hostname.toLowerCase();
    return (
      h === 'maps.app.goo.gl' ||
      h === 'goo.gl' ||
      h === 'maps.google.com' ||
      ((h === 'www.google.com' || h === 'google.com' || h.startsWith('www.google.com.')) &&
        u.pathname.startsWith('/maps'))
    );
  } catch {
    return false;
  }
}

/**
 * O link do mapa da unidade: o que a barbearia escolheu ou, sem ele, a busca pelo endereço
 * completo (com cidade e UF quando cadastradas).
 */
export function linkMapaDaUnidade(u: EnderecoDaUnidade): string | null {
  if (u.linkMapa && linkDeMapaValido(u.linkMapa)) return u.linkMapa.trim();
  const completo = enderecoCompleto(u);
  return completo
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(completo)}`
    : null;
}

/** Faltam dados para o mapa achar o lugar certo: o cadastro avisa. */
export function mapaPodeErrar(u: EnderecoDaUnidade): boolean {
  if (u.linkMapa && linkDeMapaValido(u.linkMapa)) return false;
  if (!u.endereco?.trim()) return false;
  return !u.cidade?.trim() || !u.uf?.trim();
}
