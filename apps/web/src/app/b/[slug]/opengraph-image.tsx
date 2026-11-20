import { formatarMoeda, precoInicial } from '@pente-fino/shared';
import { imagemDaPrevia, TAMANHO_PREVIA } from '@/lib/servidor/imagem-previa';
import { unidadePublica } from '@/lib/servidor/pagina-publica';

// Painel P1: a prévia do link no WhatsApp e no Instagram mostra a barbearia, não o Pente Fino.
// Desde 20/11/2026, com o logotipo, o título, o texto e a cor que a barbearia escolheu.
export const alt = 'Agende online';
export const size = TAMANHO_PREVIA;
export const contentType = 'image/png';

export default async function Imagem({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const u = await unidadePublica(slug);
  const preco = u ? precoInicial(u) : null;
  const unidade = u && u.nome.toLowerCase() !== u.barbearia.toLowerCase() ? u.nome : null;
  return imagemDaPrevia({
    previa: u?.previa ?? null,
    barbearia: u?.barbearia ?? 'Agende seu horário',
    unidade,
    linha:
      u?.previa.descricao ??
      ([u?.endereco, preco !== null ? `a partir de ${formatarMoeda(preco)}` : null]
        .filter(Boolean)
        .join(' · ') ||
        null),
    botao: 'Agende online',
  });
}
