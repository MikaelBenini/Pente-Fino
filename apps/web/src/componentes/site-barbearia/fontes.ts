// Fontes do site da barbearia (seção 7). Cada uma vira uma variável CSS; o navegador só baixa a
// fonte que a página usa de fato (a escolhida pelo dono para os títulos e a do texto).
import { Alfa_Slab_One, Big_Shoulders, DM_Serif_Display, Work_Sans } from 'next/font/google';
import type { FonteSite } from '@pente-fino/shared';

const serifa = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  variable: '--site-fonte-serifa',
  display: 'swap',
});
const condensada = Big_Shoulders({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--site-fonte-condensada',
  display: 'swap',
});
const letreiro = Alfa_Slab_One({
  subsets: ['latin'],
  weight: '400',
  variable: '--site-fonte-letreiro',
  display: 'swap',
});
const texto = Work_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--site-fonte-texto',
  display: 'swap',
});

export const CLASSES_FONTES = [serifa, condensada, letreiro, texto]
  .map((f) => f.variable)
  .join(' ');

/** Família dos títulos (a variável CSS da escolhida). */
export const FONTE_TITULO: Record<FonteSite, string> = {
  serifa: 'var(--site-fonte-serifa), Georgia, serif',
  condensada: 'var(--site-fonte-condensada), Impact, sans-serif',
  letreiro: 'var(--site-fonte-letreiro), Rockwell, serif',
};
