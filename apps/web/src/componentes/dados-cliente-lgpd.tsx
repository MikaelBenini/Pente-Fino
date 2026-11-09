'use client';

// LGPD (Etapa 21), na ficha do cliente, só para o dono: baixar tudo o que o sistema guarda do
// cliente (para entregar a ele) e apagar os dados pessoais quando ele pedir.
import type { DadosDoCliente, ResultadoAnonimizar } from '@pente-fino/shared';
import { Botao, Campo, CampoTexto } from '@pente-fino/ui';
import { useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { chavesOperacao, useAcao } from '@/lib/consultas';
import { Aviso } from './aviso';

const mensagemDe = (e: unknown) =>
  e instanceof ErroApi ? (e.campos[0]?.mensagem ?? e.message) : 'Não foi possível concluir.';

export function DadosClienteLgpd({
  clienteId,
  nome,
  onApagado,
}: {
  clienteId: string;
  nome: string;
  onApagado: () => void;
}) {
  const [baixando, setBaixando] = useState(false);
  const [apagar, setApagar] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const anonimizar = useAcao(
    () =>
      api<ResultadoAnonimizar>(`clientes/${clienteId}/anonimizar`, {
        corpo: { motivo, confirmacao },
      }),
    [chavesOperacao.clientes],
  );

  async function baixar() {
    setErro(null);
    setBaixando(true);
    try {
      const d = await api<DadosDoCliente>(`clientes/${clienteId}/dados`);
      const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const arquivo = nome
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^\w]+/g, '-')
        .toLowerCase();
      a.href = url;
      a.download = `dados-${arquivo}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setBaixando(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border border-borda p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
        Dados do cliente (LGPD)
      </h3>
      <p className="text-sm text-tinta-suave">
        Se o cliente pedir, entregue o arquivo com tudo o que o sistema guarda dele ou apague os
        dados pessoais. Os atendimentos e o caixa continuam, sem o nome.
      </p>
      <div className="flex flex-wrap gap-2">
        <Botao variante="secundario" carregando={baixando} onClick={baixar}>
          Baixar os dados
        </Botao>
        {!apagar && (
          <Botao variante="fantasma" onClick={() => setApagar(true)}>
            Apagar os dados pessoais…
          </Botao>
        )}
      </div>
      {apagar && (
        <form
          method="post"
          noValidate
          className="flex flex-col gap-3 rounded-md border border-perigo/50 p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setErro(null);
            try {
              await anonimizar.mutateAsync();
              onApagado();
            } catch (er) {
              setErro(mensagemDe(er));
            }
          }}
        >
          <Aviso tom="erro">
            Não tem volta: saem o nome, o telefone, o e-mail, o aniversário, as anotações, as
            conversas do WhatsApp e os comentários das avaliações. Antes, cancele os horários
            futuros e o plano do clube, se houver.
          </Aviso>
          <CampoTexto
            id="lgpd-motivo"
            rotulo="Motivo"
            placeholder="Pedido do cliente pelo WhatsApp em 10/11"
            rows={2}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <Campo
            id="lgpd-confirmacao"
            rotulo={`Para confirmar, digite o nome: ${nome}`}
            autoComplete="off"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Botao type="submit" variante="perigo" carregando={anonimizar.isPending}>
              Apagar os dados pessoais
            </Botao>
            <Botao type="button" variante="fantasma" onClick={() => setApagar(false)}>
              Desistir
            </Botao>
          </div>
        </form>
      )}
      {erro && <Aviso tom="erro">{erro}</Aviso>}
    </section>
  );
}
