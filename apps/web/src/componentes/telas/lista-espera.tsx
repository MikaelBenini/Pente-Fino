'use client';

import {
  formatarHora,
  NOME_ORIGEM_ESPERA,
  textoFaixa,
  type EsperaDetalhe,
} from '@pente-fino/shared';
import { Botao, Campo, Dialogo, Marcador, Selecao } from '@pente-fino/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { useAcao, useProfissionais, useServicos } from '@/lib/consultas';
import { Aviso } from '../aviso';
import { Estado, Ficha } from '../pagina';
import { BuscaCliente, clienteParaApi, type ClienteEscolhido } from './busca-cliente';
import { ConviteSeFaltar } from '../convite-plano';

const mensagemDe = (e: unknown) =>
  e instanceof ErroApi ? (e.campos[0]?.mensagem ?? e.message) : 'Não foi possível concluir.';
const paraMinutos = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/**
 * Lista de espera do dia (balcão): quem quer um horário, em ordem de chegada. Quando um horário
 * vaga, o WhatsApp oferece sozinho para quem cabe nele; o primeiro "1" leva.
 */
export function ListaEspera({
  unidadeId,
  dia,
  aberto,
  onFechar,
}: {
  unidadeId: string;
  dia: string;
  aberto: boolean;
  onFechar: () => void;
}) {
  const chave = ['espera', unidadeId, dia] as const;
  const lista = useQuery({
    queryKey: chave,
    queryFn: () => api<EsperaDetalhe[]>(`espera?unidadeId=${unidadeId}&dia=${dia}`),
    enabled: aberto,
  });
  const [incluindo, setIncluindo] = useState(false);
  const tirar = useAcao((id: string) => api(`espera/${id}/cancelar`, { corpo: {} }), [chave]);
  return (
    <Dialogo
      aberto={aberto}
      titulo="Lista de espera"
      descricao="Quando um horário vagar, o WhatsApp oferece na ordem; quem responder primeiro leva."
      onFechar={() => {
        setIncluindo(false);
        onFechar();
      }}
      largura="larga"
    >
      <ConviteSeFaltar recurso="listaEspera" />
      {incluindo ? (
        <Incluir
          unidadeId={unidadeId}
          dia={dia}
          onFeito={() => setIncluindo(false)}
          invalidar={[...chave]}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <Estado consulta={lista}>
            {() =>
              lista.data!.length === 0 ? (
                <p className="text-tinta-suave">Ninguém na lista deste dia.</p>
              ) : (
                <ol className="flex flex-col gap-2" aria-label="Lista de espera do dia">
                  {lista.data!.map((e, i) => (
                    <li
                      key={e.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-borda p-3"
                    >
                      <span className="min-w-0">
                        <span className="font-semibold">
                          {i + 1}. {e.cliente.nome}
                        </span>
                        <span className="block text-sm text-tinta-suave">
                          {e.servicos.join(' + ')} · {textoFaixa(e.deMin, e.ateMin)} ·{' '}
                          {e.profissional ?? 'qualquer barbeiro'} · {NOME_ORIGEM_ESPERA[e.origem]}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        {e.oferta && (
                          <Ficha tom="aviso">
                            Oferecido {formatarHora(e.oferta.inicio)} com {e.oferta.profissional}
                          </Ficha>
                        )}
                        <Botao
                          variante="fantasma"
                          carregando={tirar.isPending && tirar.variables === e.id}
                          onClick={() => tirar.mutate(e.id)}
                        >
                          Tirar
                        </Botao>
                      </span>
                    </li>
                  ))}
                </ol>
              )
            }
          </Estado>
          <Botao className="self-start" onClick={() => setIncluindo(true)}>
            Pôr na lista
          </Botao>
        </div>
      )}
    </Dialogo>
  );
}

function Incluir({
  unidadeId,
  dia,
  onFeito,
  invalidar,
}: {
  unidadeId: string;
  dia: string;
  onFeito: () => void;
  invalidar: readonly unknown[];
}) {
  const servicos = useServicos();
  const profissionais = useProfissionais();
  const [cliente, setCliente] = useState<ClienteEscolhido | null>(null);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [profissionalId, setProfissionalId] = useState('');
  const [diaPedido, setDiaPedido] = useState(dia);
  const [de, setDe] = useState('09:00');
  const [ate, setAte] = useState('18:00');
  const [erro, setErro] = useState<string | null>(null);
  const incluir = useAcao((corpo: object) => api('espera', { corpo }), [invalidar]);
  return (
    <form
      method="post"
      noValidate
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setErro(null);
        if (!cliente) return setErro('Escolha o cliente.');
        try {
          await incluir.mutateAsync({
            unidadeId,
            ...clienteParaApi(cliente),
            profissionalId: profissionalId || null,
            servicoIds: escolhidos,
            dia: diaPedido,
            deMin: paraMinutos(de),
            ateMin: paraMinutos(ate),
          });
          onFeito();
        } catch (er) {
          setErro(mensagemDe(er));
        }
      }}
    >
      <BuscaCliente id="espera-cliente" valor={cliente} onEscolher={setCliente} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">Serviços</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(servicos.data ?? [])
            .filter((s) => s.ativo)
            .map((s) => (
              <Marcador
                key={s.id}
                id={`espera-servico-${s.id}`}
                rotulo={`${s.nome} · ${s.duracaoMin} min`}
                checked={escolhidos.includes(s.id)}
                onChange={(ev) =>
                  setEscolhidos((x) =>
                    ev.target.checked ? [...x, s.id] : x.filter((id) => id !== s.id),
                  )
                }
              />
            ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Selecao
          id="espera-profissional"
          rotulo="Barbeiro"
          value={profissionalId}
          onChange={(e) => setProfissionalId(e.target.value)}
          opcoes={[
            { valor: '', rotulo: 'Qualquer um' },
            ...(profissionais.data ?? [])
              .filter((p) => p.unidadeId === unidadeId && !p.dataSaida)
              .map((p) => ({ valor: p.id, rotulo: p.nome })),
          ]}
        />
        <Campo
          id="espera-dia"
          rotulo="Dia"
          type="date"
          value={diaPedido}
          onChange={(e) => setDiaPedido(e.target.value)}
        />
        <Campo
          id="espera-de"
          rotulo="A partir de"
          type="time"
          value={de}
          onChange={(e) => setDe(e.target.value)}
        />
        <Campo
          id="espera-ate"
          rotulo="Até"
          type="time"
          value={ate}
          onChange={(e) => setAte(e.target.value)}
        />
      </div>
      <p className="text-sm text-tinta-suave">
        A oferta sai pelo WhatsApp da unidade, para quem aceita mensagens e já conversou com ela.
      </p>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <div className="flex flex-wrap gap-2">
        <Botao type="submit" carregando={incluir.isPending} disabled={escolhidos.length === 0}>
          Pôr na lista
        </Botao>
        <Botao type="button" variante="fantasma" onClick={onFeito}>
          Voltar
        </Botao>
      </div>
    </form>
  );
}
