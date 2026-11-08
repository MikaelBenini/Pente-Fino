import { Quote } from 'lucide-react';

export interface Depoimento {
  texto: string;
  nome: string;
  /** Ex.: "Dono da Barbearia X · Curitiba (PR)". */
  quem: string;
}

/**
 * Depoimentos de clientes de verdade, com autorização por escrito de quem falou (nome, barbearia
 * e cidade). Lista vazia = a seção não aparece. Nunca inventar: depoimento falso fere o Código de
 * Defesa do Consumidor e as normas do CONAR, e derruba a confiança na página.
 */
export const DEPOIMENTOS: readonly Depoimento[] = [];

export function Depoimentos() {
  if (DEPOIMENTOS.length === 0) return null;
  return (
    <section
      aria-labelledby="depoimentos"
      className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24"
    >
      <h2 id="depoimentos" className="mb-10 font-denso text-4xl font-bold uppercase sm:text-5xl">
        Quem usa, conta
      </h2>
      <ul className="grid gap-4 md:grid-cols-3">
        {DEPOIMENTOS.map((d) => (
          <li
            key={d.nome}
            className="revelar flex flex-col gap-4 rounded-xl border border-borda bg-superficie p-6"
          >
            <Quote aria-hidden className="size-7 text-modulo-texto" />
            <blockquote className="text-lg leading-relaxed">“{d.texto}”</blockquote>
            <p className="mt-auto text-sm">
              <strong className="block">{d.nome}</strong>
              <span className="text-tinta-suave">{d.quem}</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
