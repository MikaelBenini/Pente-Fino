'use client';

import {
  formatarData,
  formatarDataHora,
  formatarMoeda,
  formatarTelefone,
  NOME_MOTIVO_RECUPERAR,
  type AdesaoDetalhe,
  type ClienteParaRecuperar,
  type ClienteResumo,
} from '@pente-fino/shared';
import { Abas, Botao, Campo, Dialogo, EstadoVazio } from '@pente-fino/ui';
import { useQuery } from '@tanstack/react-query';
import { CalendarPlus, Contact, Crown, HeartHandshake, MessageCircle, Plus } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useDeferredValue, useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import {
  chavesOperacao,
  useAcao,
  useCliente,
  useClientes,
  useMensagensCliente,
} from '@/lib/consultas';
import { Aviso } from '../aviso';
import { ListaMensagens } from '../lista-mensagens';
import { MandarMensagem } from '../mandar-mensagem';
import { useApp } from '../contexto-app';
import { CabecalhoPagina, Estado, Ficha, Tabela, td, th } from '../pagina';

const mensagemDe = (e: unknown) =>
  e instanceof ErroApi ? (e.campos[0]?.mensagem ?? e.message) : 'Não foi possível concluir.';

export function TelaClientes() {
  const { papeis } = useApp();
  const balcao = papeis.some((p) => p !== 'barbeiro');
  const [aba, setAba] = useState('todos');
  // "Ver cliente" das Conversas abre a ficha direto (/clientes?id=).
  const idDoLink = useSearchParams().get('id');
  const [aberto, setAberto] = useState<string | null>(idDoLink);
  const [novo, setNovo] = useState(false);
  const lista = <ListaClientes onAbrir={setAberto} />;

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Clientes"
        pergunta={balcao ? 'Quem volta e quem sumiu?' : 'Clientes que você atendeu'}
        acao={
          balcao && (
            <Botao onClick={() => setNovo(true)}>
              <Plus aria-hidden className="size-5" /> Novo cliente
            </Botao>
          )
        }
      />
      {balcao ? (
        <Abas
          rotulo="Clientes"
          atual={aba}
          onTrocar={setAba}
          abas={[
            { id: 'todos', rotulo: 'Todos', conteudo: lista },
            {
              id: 'recuperar',
              rotulo: 'Para recuperar',
              conteudo: <ParaRecuperar onAbrir={setAberto} />,
            },
          ]}
        />
      ) : (
        lista
      )}
      <FichaCliente id={aberto} onFechar={() => setAberto(null)} />
      <NovoCliente aberto={novo} onFechar={() => setNovo(false)} />
    </div>
  );
}

function ListaClientes({ onAbrir }: { onAbrir: (id: string) => void }) {
  const [busca, setBusca] = useState('');
  const termo = useDeferredValue(busca.trim());
  const clientes = useClientes(termo);
  const setAberto = onAbrir;
  return (
    <div className="flex flex-col gap-6">
      <div className="max-w-md">
        <Campo
          id="clientes-busca"
          rotulo="Buscar"
          type="search"
          placeholder="Nome ou telefone"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>
      <Estado consulta={clientes}>
        {() =>
          clientes.data!.length === 0 ? (
            <EstadoVazio
              icone={Contact}
              titulo={termo ? 'Nenhum cliente encontrado' : 'Seus clientes aparecem aqui'}
              texto={
                termo
                  ? 'Confira a grafia ou busque pelo telefone.'
                  : 'Cada cliente atendido entra com telefone, histórico e anotações.'
              }
            />
          ) : (
            <Tabela rotulo="Clientes">
              <thead className="bg-superficie-2">
                <tr>
                  <th className={th}>Nome</th>
                  <th className={th}>Telefone</th>
                  <th className={`${th} text-right`}>Visitas</th>
                  <th className={th}>Última visita</th>
                </tr>
              </thead>
              <tbody>
                {clientes.data!.map((c: ClienteResumo) => (
                  <tr key={c.id} className="border-t border-borda">
                    <td className={td}>
                      <button
                        type="button"
                        onClick={() => setAberto(c.id)}
                        className="min-h-11 text-left font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-foco"
                      >
                        {c.nome}
                      </button>
                    </td>
                    <td className={`${td} font-denso tabular-nums text-tinta-suave`}>
                      {c.telefone ? formatarTelefone(c.telefone) : '—'}
                    </td>
                    <td className={`${td} text-right font-denso tabular-nums`}>{c.visitas}</td>
                    <td className={`${td} text-tinta-suave`}>
                      {c.ultimaVisita ? formatarData(c.ultimaVisita) : 'Nunca'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          )
        }
      </Estado>
    </div>
  );
}

/**
 * Para recuperar: nota baixa sem resolver, faltou e não voltou, passou do tempo de costume.
 * Cada linha diz o motivo e leva à ficha (mandar mensagem) ou ao novo agendamento.
 */
function ParaRecuperar({ onAbrir }: { onAbrir: (id: string) => void }) {
  const lista = useQuery({
    queryKey: ['clientes', 'recuperar'],
    queryFn: () => api<ClienteParaRecuperar[]>('clientes/recuperar'),
  });
  return (
    <div className="flex flex-col gap-4">
      <p className="text-tinta-suave">
        Quem deu nota baixa e ainda não foi resolvida, quem faltou e não voltou nos últimos 90 dias,
        e quem passou do tempo de costume entre uma visita e outra sem horário marcado.
      </p>
      <Estado consulta={lista}>
        {() =>
          lista.data!.length === 0 ? (
            <EstadoVazio
              icone={HeartHandshake}
              titulo="Ninguém para recuperar agora"
              texto="Quando alguém sumir, faltar ou der nota baixa, aparece aqui."
            />
          ) : (
            <ul className="flex flex-col gap-2" aria-label="Clientes para recuperar">
              {lista.data!.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-col gap-2 rounded-lg border border-borda bg-superficie p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onAbrir(c.id)}
                      className="min-h-11 text-left text-lg font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-foco"
                    >
                      {c.nome}
                    </button>
                    <span className="flex flex-wrap gap-1">
                      {c.motivos.map((m) => (
                        <Ficha key={m} tom={m === 'nota_baixa' ? 'perigo' : 'aviso'}>
                          {NOME_MOTIVO_RECUPERAR[m]}
                        </Ficha>
                      ))}
                    </span>
                  </div>
                  <p className="text-sm text-tinta-suave">
                    {[
                      c.ultimaVisita
                        ? `Última visita ${formatarData(c.ultimaVisita)} (${c.diasSemVir} dias)`
                        : 'Nunca foi atendido',
                      c.intervaloDias ? `costuma voltar a cada ${c.intervaloDias} dias` : null,
                      c.conviteRetornoEm
                        ? `convite de retorno em ${formatarData(c.conviteRetornoEm)}`
                        : null,
                      c.telefone ? formatarTelefone(c.telefone) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {c.notaBaixa && (
                    <p className="text-sm">
                      Nota {c.notaBaixa.nota}
                      {c.notaBaixa.comentario ? `: “${c.notaBaixa.comentario}”` : ''}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Botao variante="secundario" onClick={() => onAbrir(c.id)}>
                      <MessageCircle aria-hidden className="size-5" /> Abrir ficha
                    </Botao>
                    <Link
                      href={`/agenda?agendar=${c.id}`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 font-semibold text-modulo-texto underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-foco"
                    >
                      <CalendarPlus aria-hidden className="size-5" /> Agendar
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )
        }
      </Estado>
    </div>
  );
}

function FichaCliente({ id, onFechar }: { id: string | null; onFechar: () => void }) {
  const cliente = useCliente(id);
  const { papeis } = useApp();
  const veConversa = papeis.some((p) => p === 'dono' || p === 'gestor' || p === 'recepcao');
  const [nota, setNota] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const anotar = useAcao(
    (texto: string) => api(`clientes/${id}/notas`, { corpo: { texto } }),
    [chavesOperacao.clientes],
  );
  const c = cliente.data;
  return (
    <Dialogo
      aberto={id !== null}
      titulo={c?.nome ?? 'Cliente'}
      descricao={
        c
          ? `${c.visitas} ${c.visitas === 1 ? 'visita' : 'visitas'}${c.ultimaVisita ? ` · última em ${formatarData(c.ultimaVisita)}` : ''}`
          : undefined
      }
      onFechar={onFechar}
      largura="larga"
    >
      <Estado consulta={cliente}>
        {() => (
          <div className="flex flex-col gap-6">
            <ClubeDoCliente clienteId={c!.id} />
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
                  Telefone
                </dt>
                <dd className="font-denso text-lg tabular-nums">
                  {c!.telefoneOculto ? 'Oculto' : c!.telefone ? formatarTelefone(c!.telefone) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
                  Aniversário
                </dt>
                <dd>
                  {c!.aniversario ? formatarData(`${c!.aniversario}T12:00:00Z`).slice(0, 5) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
                  Origem
                </dt>
                <dd>{c!.origemLead === 'bot' ? 'WhatsApp (bot)' : (c!.origemLead ?? '—')}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
                  Avisos pelo WhatsApp
                </dt>
                <dd>
                  {c!.consentimentoMsg
                    ? 'Recebe'
                    : c!.consentimentoEm
                      ? 'Não recebe'
                      : 'Ainda não escolheu'}
                  {c!.consentimentoEm && (
                    <span className="block text-sm text-tinta-suave">
                      desde {formatarData(c!.consentimentoEm)}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
                Anotações
              </h3>
              <form
                method="post"
                noValidate
                className="flex flex-col gap-2 sm:flex-row sm:items-end"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setErro(null);
                  if (nota.trim().length < 2) return;
                  try {
                    await anotar.mutateAsync(nota.trim());
                    setNota('');
                  } catch (er) {
                    setErro(mensagemDe(er));
                  }
                }}
              >
                <div className="flex-1">
                  <Campo
                    id="cliente-nota"
                    rotulo="Nova anotação"
                    placeholder="Prefere degradê baixo, pele sensível…"
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                  />
                </div>
                <Botao type="submit" variante="secundario" carregando={anotar.isPending}>
                  Anotar
                </Botao>
              </form>
              {erro && <Aviso tom="erro">{erro}</Aviso>}
              <ul className="flex flex-col gap-2">
                {c!.notas.map((n) => (
                  <li key={n.id} className="rounded-md border border-borda px-3 py-2">
                    <p>{n.texto}</p>
                    <p className="text-sm text-tinta-suave">
                      {n.autor ?? 'Equipe'} · {formatarDataHora(n.criadoEm)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
            {veConversa && (
              <ConversaWhatsapp clienteId={id!} nome={c!.nome} telefone={c!.telefone ?? null} />
            )}
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
                Histórico
              </h3>
              {c!.historico.length === 0 ? (
                <p className="text-tinta-suave">Nenhum atendimento fechado ainda.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-borda rounded-md border border-borda">
                  {c!.historico.map((h) => (
                    <li key={h.comandaId}>
                      <Link
                        href={`/comandas?id=${h.comandaId}`}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 hover:bg-superficie-2"
                      >
                        <span>
                          <span className="block font-semibold">
                            {h.servicos.join(' + ') || 'Atendimento'}
                          </span>
                          <span className="block text-sm text-tinta-suave">
                            {formatarData(h.fechadaEm)} · {h.profissional} · {h.unidade}
                          </span>
                        </span>
                        <span className="font-denso text-lg tabular-nums">
                          {formatarMoeda(h.total)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </Estado>
    </Dialogo>
  );
}

/** Conversa do WhatsApp com o cliente, como no celular: cliente à esquerda, barbearia à direita. */
function ConversaWhatsapp({
  clienteId,
  nome,
  telefone,
}: {
  clienteId: string;
  nome: string;
  telefone: string | null;
}) {
  const mensagens = useMensagensCliente(clienteId, true);
  const [mandar, setMandar] = useState(false);
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
          WhatsApp
        </h3>
        <Botao variante="secundario" onClick={() => setMandar(true)}>
          <MessageCircle aria-hidden className="size-4" /> Mandar mensagem
        </Botao>
      </div>
      <MandarMensagem
        aberto={mandar}
        onFechar={() => setMandar(false)}
        clienteId={clienteId}
        nome={nome}
        telefone={telefone}
        textoInicial={`Olá, ${nome.split(' ')[0]}! `}
      />
      <Estado consulta={mensagens}>
        {() =>
          mensagens.data!.length === 0 ? (
            <p className="text-tinta-suave">Nenhuma conversa pelo WhatsApp ainda.</p>
          ) : (
            <ListaMensagens mensagens={mensagens.data!} className="max-h-80" />
          )
        }
      </Estado>
    </section>
  );
}

function NovoCliente({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const [f, setF] = useState({ nome: '', telefone: '', email: '', aniversario: '' });
  const [erro, setErro] = useState<string | null>(null);
  const criar = useAcao((corpo: object) => api('clientes', { corpo }), [chavesOperacao.clientes]);
  function fechar() {
    setF({ nome: '', telefone: '', email: '', aniversario: '' });
    setErro(null);
    onFechar();
  }
  return (
    <Dialogo aberto={aberto} titulo="Novo cliente" onFechar={fechar}>
      <form
        method="post"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setErro(null);
          try {
            await criar.mutateAsync({
              nome: f.nome,
              telefone: f.telefone || undefined,
              email: f.email,
              aniversario: f.aniversario || null,
              consentimentoMsg: true,
            });
            fechar();
          } catch (er) {
            setErro(mensagemDe(er));
          }
        }}
      >
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <Campo
          id="cliente-nome"
          rotulo="Nome"
          value={f.nome}
          onChange={(e) => setF({ ...f, nome: e.target.value })}
        />
        <Campo
          id="cliente-telefone"
          rotulo="WhatsApp"
          inputMode="tel"
          value={f.telefone}
          onChange={(e) => setF({ ...f, telefone: e.target.value })}
        />
        <Campo
          id="cliente-email"
          rotulo="E-mail (opcional)"
          type="email"
          value={f.email}
          onChange={(e) => setF({ ...f, email: e.target.value })}
        />
        <Campo
          id="cliente-aniversario"
          rotulo="Aniversário (opcional)"
          type="date"
          value={f.aniversario}
          onChange={(e) => setF({ ...f, aniversario: e.target.value })}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Botao variante="secundario" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={criar.isPending}>
            Cadastrar
          </Botao>
        </div>
      </form>
    </Dialogo>
  );
}

/** Na ficha: o plano do clube, o vencimento e o que resta no mês. */
function ClubeDoCliente({ clienteId }: { clienteId: string }) {
  const clube = useQuery({
    queryKey: ['clube', 'cliente', clienteId],
    queryFn: () => api<{ adesao: AdesaoDetalhe | null }>(`clube/cliente/${clienteId}`),
  });
  const a = clube.data?.adesao;
  if (!a) return null;
  return (
    <div
      className={`flex flex-col gap-1 rounded-md border p-3 ${a.situacao === 'ativa' ? 'border-acao-texto/50' : 'border-aviso-texto/50'}`}
    >
      <p className="flex items-center gap-2 font-semibold">
        <Crown aria-hidden className="size-4" /> Clube: {a.plano.nome}
      </p>
      <p className="text-sm text-tinta-suave">
        {a.situacao === 'ativa' ? 'Em dia até' : 'Vencido desde'} {formatarData(a.vencimento)}
        {a.situacao === 'ativa' &&
          ` · ${a.restantes.map((r) => (r.restam === null ? `${r.servico} à vontade` : `${r.servico}: restam ${r.restam}`)).join(' · ')}`}
      </p>
    </div>
  );
}
