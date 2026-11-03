'use client';

import { useSyncExternalStore } from 'react';

const nada = () => () => undefined;

/**
 * Verdadeiro depois que o React assumiu a página. Antes disso, um clique em "Entrar"
 * faria o envio nativo do formulário, sem a validação e o tratamento da tela.
 */
export function useHidratado(): boolean {
  return useSyncExternalStore(
    nada,
    () => true,
    () => false,
  );
}
