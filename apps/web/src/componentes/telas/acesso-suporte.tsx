'use client';

// Admin F5: o dono libera, por 24 horas, a equipe do Pente Fino a ver o painel só para ler (para
// ajudar num problema sem pedir senha). Pode cancelar antes; cada entrada fica na auditoria.
import {
  HORAS_LIBERACAO_SUPORTE,
  formatarDataHora,
  type AcessoSuporteDaConta,
} from '@pente-fino/shared';
import { Botao } from '@pente-fino/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Aviso } from '../aviso';
import { Estado } from '../pagina';

export function AcessoSuporte() {
  const cliente = useQueryClient();
  const chave = ['conta', 'suporte'];
  const q = useQuery({
    queryKey: chave,
    queryFn: () => api<AcessoSuporteDaConta>('conta/suporte'),
  });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function mudar(liberar: boolean) {
    setErro(null);
    setEnviando(true);
    try {
      const r = await api<AcessoSuporteDaConta>('conta/suporte', {
        metodo: 'PUT',
        corpo: { liberar },
      });
      cliente.setQueryData(chave, r);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para salvar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section aria-labelledby="titulo-acesso-suporte" className="flex max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="titulo-acesso-suporte" className="text-xl font-semibold">
          Acesso do suporte
        </h2>
        <p className="text-tinta-suave">
          Precisa de ajuda? Libere a equipe do Pente Fino para ver o seu painel por{' '}
          {HORAS_LIBERACAO_SUPORTE} horas, sem passar a senha. É só leitura: ninguém grava nada, e
          os telefones dos clientes e as conversas do bot ficam escondidos. Cada entrada aparece na
          auditoria.
        </p>
      </div>
      <Estado consulta={q}>
        {() =>
          q.data!.liberadoAte ? (
            <div className="flex flex-col gap-3 rounded-lg border border-modulo/40 bg-superficie p-4">
              <p role="status">
                Liberado até <strong>{formatarDataHora(q.data!.liberadoAte)}</strong>.
              </p>
              <Botao
                variante="secundario"
                className="self-start"
                carregando={enviando}
                onClick={() => void mudar(false)}
              >
                Cancelar o acesso agora
              </Botao>
            </div>
          ) : (
            <Botao className="self-start" carregando={enviando} onClick={() => void mudar(true)}>
              Liberar por {HORAS_LIBERACAO_SUPORTE} horas
            </Botao>
          )
        }
      </Estado>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
    </section>
  );
}
