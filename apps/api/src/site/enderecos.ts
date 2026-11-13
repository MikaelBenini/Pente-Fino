// Endereços da unidade (seção 7, lote 7d): o link de agendamento (/b/<slug>) e o site
// (/s/<site_slug>) são coisas diferentes, com endereços diferentes. Quando um muda, o antigo fica
// guardado e leva ao atual: nada impresso, no Instagram ou mandado pelo bot quebra.
import type { Transacao } from '@pente-fino/db';
import { gerarSlug, type TipoEndereco } from '@pente-fino/shared';

/** Guarda o endereço que saiu e libera o que entrou (deixou de ser antigo nesta conta). */
export async function registrarTrocaDeEndereco(
  tx: Transacao,
  unidadeId: string,
  tipo: TipoEndereco,
  antigo: string | null,
  novo: string | null,
): Promise<void> {
  if (antigo === novo) return;
  if (novo) await tx.enderecoAntigo.deleteMany({ where: { tipo, slug: novo } });
  if (antigo) {
    await tx.enderecoAntigo.deleteMany({ where: { tipo, slug: antigo } });
    await tx.enderecoAntigo.create({ data: { unidadeId, tipo, slug: antigo } });
  }
}

/** O endereço de site já é de outra unidade (de qualquer barbearia)? */
export async function siteSlugEmUso(
  tx: Transacao,
  slug: string,
  unidadeId: string,
): Promise<boolean> {
  const [r] = await tx.$queryRaw<{ em_uso: boolean }[]>`
    SELECT site_slug_em_uso(${slug}, ${unidadeId}::uuid) AS em_uso`;
  return !!r?.em_uso;
}

/** Sugestão de endereço do site: o do link de agendamento ou o nome da barbearia. */
export function sugestaoDeSiteSlug(slugAgendamento: string | null, barbearia: string): string {
  const base = slugAgendamento ?? gerarSlug(barbearia);
  return base.length >= 3 ? base : `barbearia-${base || 'nova'}`;
}

/** Primeira sugestão livre: "x", "x-2", "x-3"... */
export async function siteSlugLivre(
  tx: Transacao,
  sugestao: string,
  unidadeId: string,
): Promise<string> {
  for (let n = 1; n < 50; n++) {
    const candidato = n === 1 ? sugestao : `${sugestao.slice(0, 56)}-${n}`;
    if (!(await siteSlugEmUso(tx, candidato, unidadeId))) return candidato;
  }
  return `${sugestao.slice(0, 40)}-${Date.now().toString(36)}`;
}
