'use client';

import { useEffect, useState } from 'react';

export function EntrarSuporte() {
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    const token = window.location.hash.slice(1);
    // Tira o token da barra de endereço antes de qualquer coisa.
    window.history.replaceState(null, '', '/suporte');
    const entrar = token
      ? fetch('/api/suporte/entrar', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token }),
          credentials: 'same-origin',
        }).then((r) => r.ok)
      : Promise.resolve(false);
    void entrar.then((ok) => {
      if (ok) window.location.replace('/inicio');
      else setErro('O link de suporte venceu ou está incompleto. Abra de novo pela administração.');
    });
  }, []);
  return (
    <section aria-labelledby="titulo-suporte" className="flex flex-col gap-3">
      <h1 id="titulo-suporte" className="text-2xl font-semibold">
        Modo suporte
      </h1>
      <p role="status" className="text-tinta-suave">
        {erro ?? 'Abrindo o painel da barbearia, só para leitura…'}
      </p>
    </section>
  );
}
