import { imagemDaPrevia, TAMANHO_PREVIA } from '@/lib/servidor/imagem-previa';
import { sitePublico } from '@/lib/servidor/pagina-publica';

// Prévia do site da barbearia nas redes (pedido do dono em 20/11/2026): logotipo, nome e cor.
export const alt = 'Prévia do site';
export const size = TAMANHO_PREVIA;
export const contentType = 'image/png';

export default async function Imagem({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await sitePublico(slug);
  const unidade = s && s.unidade.toLowerCase() !== s.barbearia.toLowerCase() ? s.unidade : null;
  return imagemDaPrevia({
    previa: s?.previa ?? null,
    barbearia: s?.barbearia ?? 'Barbearia',
    unidade,
    linha: s?.previa.descricao ?? (s?.site.slogan || s?.endereco || null),
    botao: s?.slugAgendamento ? 'Agende online' : 'Conheça',
  });
}
