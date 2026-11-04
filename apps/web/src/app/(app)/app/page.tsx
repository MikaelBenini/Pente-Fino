'use client';

import { Carregando } from '@pente-fino/ui';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useApp } from '@/componentes/contexto-app';

/** A entrada leva à primeira tela do menu do papel (Início, Agenda ou Hoje). */
export default function Entrada() {
  const { menu } = useApp();
  const router = useRouter();
  useEffect(() => {
    router.replace(menu[0]?.rota ?? '/perfil');
  }, [menu, router]);
  return <Carregando />;
}
