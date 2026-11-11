import { trilhaJsonLd } from '@pente-fino/shared';
import { URL_SITE } from '@/lib/site';

/** Site S3: trilha de navegação (BreadcrumbList) das páginas internas, para o Google. */
export function TrilhaGoogle({ pagina, caminho }: { pagina: string; caminho: string }) {
  const dados = trilhaJsonLd([
    { nome: 'Pente Fino', url: `${URL_SITE}/` },
    { nome: pagina, url: `${URL_SITE}${caminho}` },
  ]);
  return (
    <script
      type="application/ld+json"
      // Sem dado de usuário; "<" escapado para não fechar o <script>.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(dados).replace(/</g, '\\u003c') }}
    />
  );
}
