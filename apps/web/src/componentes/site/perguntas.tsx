import { ChevronDown } from 'lucide-react';

export interface Pergunta {
  pergunta: string;
  resposta: string;
}

/** Perguntas frequentes com <details>: abre sem JavaScript e o leitor de tela entende. */
export function Perguntas({ itens }: { itens: readonly Pergunta[] }) {
  return (
    <div className="divide-y divide-borda border-y border-borda">
      {itens.map((p) => (
        <details key={p.pergunta} className="group">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-lg font-semibold focus-visible:outline-2 focus-visible:outline-foco [&::-webkit-details-marker]:hidden">
            {p.pergunta}
            <ChevronDown
              aria-hidden
              className="size-5 shrink-0 text-tinta-suave transition group-open:rotate-180"
            />
          </summary>
          <p className="max-w-3xl pb-5 text-tinta-suave">{p.resposta}</p>
        </details>
      ))}
    </div>
  );
}
