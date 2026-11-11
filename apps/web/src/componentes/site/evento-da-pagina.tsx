'use client';

import { useEffect } from 'react';
import { eventoGoogle } from './tag-google';

/** Site T3: evento quando a página abre (ex.: 'view_planos'). Não desenha nada. */
export function EventoDaPagina({ nome }: { nome: string }) {
  useEffect(() => eventoGoogle(nome), [nome]);
  return null;
}
