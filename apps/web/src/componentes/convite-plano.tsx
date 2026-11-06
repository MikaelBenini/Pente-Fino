'use client';

import { NOME_PLANO, RECURSOS, textoRecursoBloqueado, type Recurso } from '@pente-fino/shared';
import { Lock } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { usePlano, useTemRecurso } from '@/lib/plano';
import { useApp } from './contexto-app';

/**
 * Recurso de um plano maior: diz em que plano está e convida a mudar (o dono vai direto para a
 * assinatura; os outros são orientados a falar com ele). Nada já lançado é escondido por isto.
 */
export function ConvitePlano({
  recurso,
  compacto = false,
}: {
  recurso: Recurso;
  compacto?: boolean;
}) {
  const plano = usePlano();
  const { papeis } = useApp();
  if (!plano) return null;
  const dono = papeis.includes('dono');
  return (
    <div
      role="note"
      aria-label={`Disponível no plano ${NOME_PLANO[RECURSOS[recurso].desde]}`}
      className="flex flex-col gap-2 rounded-lg border border-dashed border-borda-forte bg-superficie p-4"
    >
      <p className="flex items-center gap-2 font-semibold">
        <Lock aria-hidden className="size-4 text-modulo-texto" />
        Disponível no plano {NOME_PLANO[RECURSOS[recurso].desde]}
      </p>
      {!compacto && <p className="text-tinta-suave">{textoRecursoBloqueado(recurso, plano)}</p>}
      {dono ? (
        <Link
          href="/configuracoes?aba=assinatura"
          className="self-start font-semibold text-tinta underline underline-offset-4 hover:decoration-modulo"
        >
          Ver planos e mudar
        </Link>
      ) : (
        <p className="text-sm text-tinta-suave">Fale com o dono da barbearia para mudar o plano.</p>
      )}
    </div>
  );
}

/** Mostra o conteúdo se o plano tem o recurso; senão, o convite. Nada enquanto carrega. */
export function SoNoPlano({
  recurso,
  children,
  compacto,
}: {
  recurso: Recurso;
  children: ReactNode;
  compacto?: boolean;
}) {
  const tem = useTemRecurso(recurso);
  if (tem === undefined) return null;
  return tem ? <>{children}</> : <ConvitePlano recurso={recurso} compacto={compacto} />;
}

/** Só o convite, quando o plano não tem o recurso (a tela continua, com o que já foi lançado). */
export function ConviteSeFaltar({ recurso }: { recurso: Recurso }) {
  return useTemRecurso(recurso) === false ? <ConvitePlano recurso={recurso} /> : null;
}
