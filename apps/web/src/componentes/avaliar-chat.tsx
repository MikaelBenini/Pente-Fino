'use client';

// Sugestão aprovada em 13/11: ao encerrar, quem conversou diz se o chat foi útil. A média aparece
// no resumo da aba Chat da administração.
import { useState } from 'react';

export function AvaliarChat({
  avaliacao,
  onAvaliar,
}: {
  avaliacao: boolean | null;
  onAvaliar: (util: boolean) => Promise<unknown>;
}) {
  const [enviando, setEnviando] = useState(false);
  if (avaliacao !== null)
    return <p className="text-sm text-tinta-suave">Obrigado pela avaliação!</p>;
  const avaliar = (util: boolean) => {
    setEnviando(true);
    void onAvaliar(util).finally(() => setEnviando(false));
  };
  return (
    <div role="group" aria-label="Avaliar a conversa" className="flex items-center gap-2 text-sm">
      <span>Foi útil?</span>
      <button
        type="button"
        disabled={enviando}
        onClick={() => avaliar(true)}
        className="min-h-9 rounded-md border border-borda px-3 hover:bg-superficie-2 focus-visible:outline-2 focus-visible:outline-foco"
      >
        👍 Sim
      </button>
      <button
        type="button"
        disabled={enviando}
        onClick={() => avaliar(false)}
        className="min-h-9 rounded-md border border-borda px-3 hover:bg-superficie-2 focus-visible:outline-2 focus-visible:outline-foco"
      >
        👎 Não
      </button>
    </div>
  );
}
