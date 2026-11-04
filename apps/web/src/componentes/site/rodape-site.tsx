import { cacheLife } from 'next/cache';
import Link from 'next/link';
import { EMAIL_CONTATO } from '@/lib/site';
import { Marca } from '../marca';

const LINKS = [
  { href: '/planos', rotulo: 'Planos e preços' },
  { href: '/cadastro', rotulo: 'Criar conta' },
  { href: '/entrar', rotulo: 'Entrar' },
  { href: '/termos', rotulo: 'Termos de uso' },
  { href: '/privacidade', rotulo: 'Política de privacidade' },
] as const;

export function RodapeSite() {
  return (
    <footer className="border-t border-borda bg-superficie">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-3">
          <Marca compacta />
          <p className="max-w-sm text-sm text-tinta-suave">
            Gestão de barbearia para quem quer saber quanto sobra, não só quanto entrou.
          </p>
          <a
            href={`mailto:${EMAIL_CONTATO}`}
            className="text-sm text-tinta underline underline-offset-4"
          >
            {EMAIL_CONTATO}
          </a>
        </div>
        <nav aria-label="Rodapé">
          <ul className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="inline-flex min-h-9 items-center text-tinta-suave hover:text-tinta"
                >
                  {l.rotulo}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-8 text-xs text-tinta-fraca sm:px-6">
        © <Ano /> Pente Fino. Preços em reais, por conta.
      </p>
    </footer>
  );
}

/** Ano do copyright: calculado uma vez por dia, não a cada visita. */
async function Ano() {
  'use cache';
  cacheLife('days');
  return new Date().getFullYear();
}
