'use client';

// Plano fundador em /planos: quantas vagas restam (a vaga só conta quando a barbearia paga).
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export function VagasFundador({ total }: { total: number }) {
  const [restantes, setRestantes] = useState<number | null | 'esgotado'>(null);
  useEffect(() => {
    let vivo = true;
    api<{ restantes: number | null }>('publico/cupom/FUNDADOR')
      .then((r) => vivo && setRestantes(r.restantes))
      .catch(() => vivo && setRestantes('esgotado'));
    return () => {
      vivo = false;
    };
  }, []);
  if (restantes === null) return null;
  if (restantes === 'esgotado')
    return <p className="font-semibold text-tinta-suave">As vagas do plano fundador acabaram.</p>;
  return (
    <p className="font-semibold">
      Restam <span className="font-denso text-2xl text-modulo-texto">{restantes}</span> de {total}{' '}
      vagas.
    </p>
  );
}
