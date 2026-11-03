'use client';

import { Botao } from '@pente-fino/ui';

export function BotaoRecarregar() {
  return (
    <Botao className="self-start" onClick={() => window.location.reload()}>
      Tentar de novo
    </Botao>
  );
}
