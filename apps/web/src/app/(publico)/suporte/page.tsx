import type { Metadata } from 'next';
import { EntrarSuporte } from './entrar-suporte';

// Admin F5: a administração abre esta página com o token de suporte no fragmento (#), que não
// vai para o servidor nem para o histórico de outros sites. Ela grava a sessão e abre o painel.
export const metadata: Metadata = {
  title: 'Modo suporte',
  robots: { index: false, follow: false },
};

export default function Pagina() {
  return <EntrarSuporte />;
}
