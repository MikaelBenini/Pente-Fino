'use client';

// A faixa do aviso geral da administração, como a barbearia vê no topo do painel. Fica num lugar
// só para a prévia em /admin → Configurações ser idêntica ao que aparece (admin U8).
import type { AvisoGeral } from '@pente-fino/shared';
import { cn } from '@pente-fino/ui';
import { Megaphone } from 'lucide-react';

export function FaixaAvisoGeral({
  aviso,
  previa = false,
}: {
  aviso: AvisoGeral;
  previa?: boolean;
}) {
  return (
    <div
      role={previa ? undefined : 'status'}
      className="border-b border-borda bg-superficie-2 px-[max(1rem,env(safe-area-inset-left))] py-2 text-sm sm:px-8"
    >
      <p className="flex items-center gap-2">
        <Megaphone
          aria-hidden
          className={cn(
            'size-4 shrink-0',
            aviso.tom === 'manutencao' ? 'text-aviso-texto' : 'text-acao-texto',
          )}
        />
        <span>{aviso.texto}</span>
      </p>
    </div>
  );
}
