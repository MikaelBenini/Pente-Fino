'use client';

import { Carregando } from '@pente-fino/ui';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useApp } from '@/componentes/contexto-app';
import { useEstadoConfiguracao } from '@/componentes/telas/configuracao-inicial';

/**
 * A entrada leva à primeira tela do menu do papel (Início, Agenda ou Hoje). O dono de uma conta
 * ainda não configurada (cadastro pelo site ou venda presencial) vai direto à configuração guiada.
 */
export default function Entrada() {
  const { menu, papeis } = useApp();
  const router = useRouter();
  const dono = papeis.includes('dono');
  const configuracao = useEstadoConfiguracao(dono);
  useEffect(() => {
    if (dono && configuracao.isPending) return;
    if (dono && configuracao.data && !configuracao.data.configurada) {
      router.replace('/configuracao-inicial');
      return;
    }
    router.replace(menu[0]?.rota ?? '/perfil');
  }, [menu, router, dono, configuracao.isPending, configuracao.data]);
  return <Carregando />;
}
