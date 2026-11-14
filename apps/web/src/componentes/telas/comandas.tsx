'use client';

import {
  dataLocal,
  FORMAS_PAGAMENTO,
  formatarDiaPorExtenso,
  formatarHora,
  formatarMoeda,
  lerMoeda,
  NOME_FORMA,
  papeisNaUnidade,
  podeAgirNaComanda,
  valorParaCampo,
  type AcaoComanda,
  type ComandaDetalhe,
  type ComandaResumo,
  type ItemComandaDetalhe,
  disponivelNaUnidade,
} from '@pente-fino/shared';
import {
  Abas,
  Botao,
  Campo,
  Dialogo,
  EstadoVazio,
  EtiquetaEstado,
  Marcador,
  ModalConfirmacao,
  Selecao,
} from '@pente-fino/ui';
import {
  ArrowLeft,
  Minus,
  MonitorPlay,
  Pencil,
  Plus,
  Printer,
  ReceiptText,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import {
  chavesOperacao,
  INVALIDAR_OPERACAO,
  useAcao,
  useComanda,
  useComandas,
  useProdutos,
  useProfissionais,
  useServicos,
} from '@/lib/consultas';
import { enfileirarLancamento, useOnline } from '@/lib/fila';
import { Aviso } from '../aviso';
import { MoverComanda, useMoverHorario } from '../mover-horario';
import { useApp } from '../contexto-app';
import { CabecalhoPagina, Estado } from '../pagina';
import { useUnidadeTrabalho } from '../unidade-trabalho';
import { ModoRecepcao } from './recepcao';
import { BuscaCliente, clienteParaApi, type ClienteEscolhido } from './busca-cliente';

const mensagemDe = (e: unknown) =>
  e instanceof ErroApi
    ? (e.campos[0]?.mensagem ?? e.message)
    : 'Não foi possível concluir. Tente de novo.';

export function TelaComandas() {
  return (
    <Suspense>
      <Roteador />
    </Suspense>
  );
}

function Roteador() {
  const busca = useSearchParams();
  const { papeis } = useApp();
  const id = busca.get('id');
  if (id) return <DetalheComanda id={id} />;
  // Seção 7: o modo recepção é esta mesma tela, em letra grande, para o monitor do balcão.
  if (busca.get('modo') === 'recepcao' && papeis.some((p) => p !== 'barbeiro'))
    return <ModoRecepcao />;
  return <ListaComandas />;
}

// ─── Lista ────────────────────────────────────────────────────────────────

const GRUPOS: { id: string; rotulo: string; status: ComandaResumo['status'][] }[] = [
  { id: 'abertas', rotulo: 'Em atendimento', status: ['prevista', 'em_atendimento'] },
  { id: 'receber', rotulo: 'Para receber', status: ['confirmada', 'pendente', 'reaberta'] },
  { id: 'fechadas', rotulo: 'Fechadas', status: ['fechada'] },
  { id: 'canceladas', rotulo: 'Canceladas', status: ['cancelada'] },
];

function ListaComandas() {
  const { papeis } = useApp();
  const { unidadeId, seletor } = useUnidadeTrabalho();
  const [dia, setDia] = useState(dataLocal(new Date()));
  const comandas = useComandas(unidadeId, dia);
  const [aba, setAba] = useState('abertas');
  const [nova, setNova] = useState(false);
  const balcao = papeis.some((p) => p !== 'barbeiro');
  // A impressão leva as comandas do dia que não foram canceladas (igual ao PDF).
  const paraImprimir = (comandas.data ?? []).filter((c) => c.status !== 'cancelada').length;

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Comandas"
        pergunta={balcao ? 'O que falta receber?' : 'Suas comandas do dia'}
        acao={
          balcao && (
            <div className="flex flex-wrap gap-2">
              <Link
                href="/comandas?modo=recepcao"
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-borda bg-superficie-2 px-4 font-semibold hover:bg-superficie-3 focus-visible:outline-2 focus-visible:outline-foco"
              >
                <MonitorPlay aria-hidden className="size-5" /> Modo recepção
              </Link>
              <Botao onClick={() => setNova(true)}>
                <Plus aria-hidden className="size-5" /> Abrir comanda
              </Botao>
            </div>
          )
        }
      />
      <div className="flex flex-wrap items-end gap-3">
        {seletor}
        <div className="w-44">
          <Campo
            id="comandas-dia"
            rotulo="Dia"
            type="date"
            value={dia}
            onChange={(e) => e.target.value && setDia(e.target.value)}
          />
        </div>
        {balcao && unidadeId && (
          <div className="flex flex-wrap items-center gap-2">
            {[4, 6].map((n) =>
              paraImprimir > 0 ? (
                <a
                  key={n}
                  href={`/api/comandas/impressao?unidadeId=${unidadeId}&data=${dia}&porFolha=${n}`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex min-h-11 items-center gap-2 rounded-md border border-borda bg-superficie-2 px-4 font-semibold hover:bg-superficie-3 focus-visible:outline-2 focus-visible:outline-foco"
                >
                  <Printer aria-hidden className="size-4" /> Imprimir {n} por folha
                </a>
              ) : (
                // Painel M8: com 0 comandas, o PDF sairia em branco.
                <Botao key={n} variante="secundario" disabled aria-describedby="sem-impressao">
                  <Printer aria-hidden className="size-4" /> Imprimir {n} por folha
                </Botao>
              ),
            )}
            {paraImprimir === 0 && comandas.data && (
              <span id="sem-impressao" className="text-sm text-tinta-suave">
                Nenhuma comanda neste dia para imprimir.
              </span>
            )}
          </div>
        )}
      </div>
      <Estado consulta={comandas}>
        {() => (
          <Abas
            rotulo="Situação das comandas"
            atual={aba}
            onTrocar={setAba}
            abas={GRUPOS.map((g) => {
              const lista = comandas.data!.filter((c) => g.status.includes(c.status));
              const total = lista.reduce((s, c) => s + c.totalLiquido, 0);
              return {
                id: g.id,
                rotulo: `${g.rotulo} (${lista.length})`,
                conteudo:
                  lista.length === 0 ? (
                    <EstadoVazio
                      icone={ReceiptText}
                      titulo="Nenhuma comanda aqui"
                      texto={`Nenhuma comanda ${g.rotulo.toLowerCase()} em ${formatarDiaPorExtenso(`${dia}T12:00:00Z`)}.`}
                    />
                  ) : (
                    <div className="flex flex-col gap-3">
                      <p className="font-denso text-lg tabular-nums text-tinta-suave">
                        {lista.length} {lista.length === 1 ? 'comanda' : 'comandas'} ·{' '}
                        <span className="text-tinta">{formatarMoeda(total)}</span>
                      </p>
                      <ul className="flex flex-col gap-2">
                        {lista.map((c) => (
                          <li key={c.id}>
                            <Link
                              href={`/comandas?id=${c.id}`}
                              className="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-borda bg-superficie px-4 py-3 hover:border-borda-forte focus-visible:outline-2 focus-visible:outline-foco"
                            >
                              <span className="font-denso text-lg font-semibold tabular-nums text-tinta-suave">
                                {c.inicio ? formatarHora(c.inicio) : '—'}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate font-semibold">
                                  {c.cliente ?? 'Sem cliente'}
                                </span>
                                <span className="block truncate text-sm text-tinta-suave">
                                  {c.profissional} · {c.servicos.join(', ') || 'sem serviço'}
                                </span>
                              </span>
                              <span className="flex flex-col items-end gap-1">
                                <EtiquetaEstado estado={c.status} />
                                <span className="font-denso text-lg font-semibold tabular-nums">
                                  {formatarMoeda(c.totalLiquido)}
                                </span>
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ),
              };
            })}
          />
        )}
      </Estado>
      {unidadeId && (
        <NovaComanda unidadeId={unidadeId} aberto={nova} onFechar={() => setNova(false)} />
      )}
    </div>
  );
}

function NovaComanda({
  unidadeId,
  aberto,
  onFechar,
}: {
  unidadeId: string;
  aberto: boolean;
  onFechar: () => void;
}) {
  const router = useRouter();
  const profissionais = useProfissionais();
  const servicos = useServicos();
  const [cliente, setCliente] = useState<ClienteEscolhido | null>(null);
  const [profissionalId, setProfissionalId] = useState('');
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const abrir = useAcao(
    (corpo: object) => api<ComandaDetalhe>('comandas', { corpo }),
    INVALIDAR_OPERACAO,
  );
  const doLocal = (profissionais.data ?? []).filter((p) => p.unidadeId === unidadeId && p.ativo);
  const prof = profissionalId || doLocal[0]?.id || '';

  return (
    <Dialogo
      aberto={aberto}
      titulo="Abrir comanda"
      descricao="Cliente chegou sem horário: a comanda já começa em atendimento."
      onFechar={onFechar}
    >
      <form
        method="post"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setErro(null);
          if (!cliente) return setErro('Escolha o cliente ou cadastre um novo.');
          try {
            const c = await abrir.mutateAsync({
              unidadeId,
              profissionalId: prof,
              ...clienteParaApi(cliente),
              servicoIds: escolhidos,
            });
            onFechar();
            router.push(`/comandas?id=${c.id}`);
          } catch (er) {
            setErro(mensagemDe(er));
          }
        }}
      >
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <BuscaCliente id="nova-comanda" valor={cliente} onEscolher={setCliente} />
        <Selecao
          id="nova-comanda-prof"
          rotulo="Barbeiro"
          value={prof}
          onChange={(e) => setProfissionalId(e.target.value)}
          opcoes={doLocal.map((p) => ({ valor: p.id, rotulo: p.nome }))}
        />
        <fieldset className="min-w-0">
          <legend className="mb-1 text-sm font-medium">Serviços</legend>
          <div className="flex flex-col gap-1">
            {(servicos.data ?? [])
              .filter((s) => s.ativo && !s.ehExtra && disponivelNaUnidade(s, unidadeId))
              .map((s) => (
                <Marcador
                  key={s.id}
                  id={`nova-comanda-servico-${s.id}`}
                  rotulo={`${s.nome} · ${s.duracaoMin} min`}
                  checked={escolhidos.includes(s.id)}
                  onChange={(e) =>
                    setEscolhidos(
                      e.target.checked
                        ? [...escolhidos, s.id]
                        : escolhidos.filter((x) => x !== s.id),
                    )
                  }
                />
              ))}
          </div>
        </fieldset>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Botao variante="secundario" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={abrir.isPending} disabled={!prof}>
            Abrir comanda
          </Botao>
        </div>
      </form>
    </Dialogo>
  );
}

// ─── Detalhe ──────────────────────────────────────────────────────────────

function DetalheComanda({ id }: { id: string }) {
  const comanda = useComanda(id);
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/comandas"
        className="inline-flex min-h-11 items-center gap-2 self-start font-medium text-tinta-suave hover:text-tinta"
      >
        <ArrowLeft aria-hidden className="size-5" /> Comandas
      </Link>
      <Estado consulta={comanda}>{() => <Comanda c={comanda.data!} />}</Estado>
    </div>
  );
}

function Comanda({ c }: { c: ComandaDetalhe }) {
  const { usuario } = useApp();
  const papeis = papeisNaUnidade(usuario.papeis, c.unidadeId);
  const profissionais = useProfissionais();
  const propria =
    profissionais.data?.some((p) => p.id === c.profissionalId && p.usuarioId === usuario.id) ??
    false;
  const pode = (acao: AcaoComanda) => podeAgirNaComanda(acao, c.status, papeis, propria).permitido;
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [fechar, setFechar] = useState(false);
  const [cancelar, setCancelar] = useState(false);
  const [reabrir, setReabrir] = useState(false);
  const [mover, setMover] = useState(false);
  const [sinal, setSinal] = useState(false);
  const [devolver, setDevolver] = useState<string | null>(null);
  // Sinal (receber adiantado): só o balcão recebe e devolve; vale até fechar.
  const balcao = papeis.some((p) => p !== 'barbeiro');
  const sinalRetido = c.sinais.filter((s) => !s.devolvidoEm).reduce((t, s) => t + s.valor, 0);
  const movimento = useMoverHorario();
  // Reaberta (fechada por engano) também remarca: o horário pode ter sido o erro.
  const podeMover =
    (c.status === 'prevista' || c.status === 'reaberta') &&
    !!c.agendamentoId &&
    !!c.inicio &&
    papeis.some((p) => p === 'dono' || p === 'gestor' || p === 'recepcao');
  const online = useOnline();
  const chave = [[...chavesOperacao.comandas, 'detalhe', c.id], ...INVALIDAR_OPERACAO];
  const acao = useAcao(
    (d: { caminho: string; metodo?: string; corpo?: unknown }) =>
      api<ComandaDetalhe>(`comandas/${c.id}/${d.caminho}`, {
        metodo: d.metodo,
        corpo: d.corpo ?? {},
      }),
    chave,
  );

  // O caixa de hoje não foi aberto: oferece abrir com o troco e tenta receber de novo.
  const [caixaPendente, setCaixaPendente] = useState<unknown>(null);
  async function executar(caminho: string, corpo?: unknown, metodo?: string) {
    setErro(null);
    setAviso(null);
    try {
      await acao.mutateAsync({ caminho, corpo, metodo });
    } catch (e) {
      if (caminho === 'fechar' && e instanceof ErroApi && e.codigo === 'caixa_nao_aberto') {
        setCaixaPendente(corpo ?? {});
        return;
      }
      setErro(mensagemDe(e));
    }
  }
  // Receber e fechar: sem itens não há o que receber; atendimento de outro dia (ou de hoje que
  // nem começou) ainda não aconteceu. O servidor confere o mesmo.
  const agora = new Date();
  const futuro =
    !!c.inicio &&
    !!c.agendamentoId &&
    (dataLocal(new Date(c.inicio)) > dataLocal(agora) ||
      (new Date(c.inicio) > agora && c.status === 'prevista'));
  const motivoNaoFecha =
    c.itens.length === 0
      ? 'Sem itens. Lance um serviço ou cancele/marque falta.'
      : futuro
        ? `O atendimento é em ${formatarDiaPorExtenso(c.inicio!)} às ${formatarHora(c.inicio!)}.`
        : null;

  // Painel M7: remover item tem 5 s para desfazer. O item só sai de verdade depois; sair da tela
  // ou "Receber e fechar" nesse meio tempo removem na hora (nada é cobrado do item tirado).
  const [removendo, setRemovendo] = useState<{ id: string; descricao: string } | null>(null);
  const pendente = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  async function removerAgora() {
    const p = pendente.current;
    if (!p) return;
    clearTimeout(p.timer);
    pendente.current = null;
    setRemovendo(null);
    await executar(`itens/${p.id}`, undefined, 'DELETE');
  }
  async function removerItem(i: { id: string; descricao: string }) {
    await removerAgora();
    setRemovendo(i);
    pendente.current = { id: i.id, timer: setTimeout(() => void removerAgora(), 5000) };
  }
  function desfazerRemocao() {
    if (pendente.current) clearTimeout(pendente.current.timer);
    pendente.current = null;
    setRemovendo(null);
  }
  useEffect(
    () => () => {
      // Saiu da tela com a remoção pendente: remove assim mesmo.
      const p = pendente.current;
      if (p) {
        clearTimeout(p.timer);
        void api(`comandas/${c.id}/itens/${p.id}`, { metodo: 'DELETE', corpo: {} }).catch(() => {});
      }
    },
    [c.id],
  );

  /** Lançar item: sem internet, guarda no aparelho e envia depois. */
  async function lancar(
    item: { tipo: 'servico'; servicoId: string } | { tipo: 'produto'; produtoId: string },
    nome: string,
  ) {
    if (!online) {
      await enfileirarLancamento({
        caminho: `comandas/${c.id}/itens`,
        metodo: 'POST',
        corpo: item,
        descricao: `${nome} na comanda de ${c.cliente ?? 'cliente'}`,
      });
      setAviso(`${nome} guardado neste aparelho. Sobe quando a internet voltar.`);
      return;
    }
    await executar('itens', item);
  }

  const editavel = pode('editar_itens');
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="flex min-w-0 flex-col gap-5" aria-labelledby="comanda-titulo">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 id="comanda-titulo" className="text-3xl font-semibold">
              {c.cliente ?? 'Sem cliente'}
            </h1>
            <p className="text-tinta-suave">
              {c.profissional}
              {c.inicio && ` · ${formatarDiaPorExtenso(c.inicio)}, ${formatarHora(c.inicio)}`}
              {c.fim && `–${formatarHora(c.fim)}`}
            </p>
          </div>
          <EtiquetaEstado estado={c.status} className="text-base" />
        </header>
        {c.status === 'pendente' && (
          <Aviso tom="info">
            O horário terminou e o barbeiro não confirmou. Peça a confirmação ou chame o gestor para
            fechar.
          </Aviso>
        )}
        {c.atrasado && (
          <div
            role="status"
            className="flex flex-col gap-3 rounded-lg border-2 border-aviso-texto/60 bg-superficie p-4"
          >
            <p className="font-semibold">Cliente não chegou?</p>
            <p className="text-sm text-tinta-suave">
              Passou da tolerância e o atendimento não começou. Nada acontece sozinho: confirme.
            </p>
            <div className="flex flex-wrap gap-2">
              <Botao carregando={acao.isPending} onClick={() => executar('iniciar')}>
                Chegou
              </Botao>
              <Botao
                variante="secundario"
                carregando={acao.isPending}
                onClick={() => executar('nao-veio')}
              >
                Não veio
              </Botao>
            </div>
          </div>
        )}
        {c.podeDesfazerNaoVeio && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-borda bg-superficie p-4"
          >
            <p className="text-sm">
              Marcado como <strong>não veio (atraso)</strong>. Em 5 minutos o cliente recebe a opção
              de remarcar e o horário vai para a lista de espera.
            </p>
            <Botao
              variante="secundario"
              carregando={acao.isPending}
              onClick={() => executar('desfazer-nao-veio')}
            >
              Desfazer
            </Botao>
          </div>
        )}
        {c.motivoCancelamento && <Aviso tom="info">Cancelada: {c.motivoCancelamento}</Aviso>}
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        {aviso && <Aviso tom="sucesso">{aviso}</Aviso>}

        <ul className="flex flex-col divide-y divide-borda rounded-lg border border-borda bg-superficie">
          {c.itens.length === 0 && (
            <li className="px-4 py-6 text-tinta-suave">Nenhum item lançado ainda.</li>
          )}
          {c.itens.map((i) =>
            removendo?.id === i.id ? (
              <li
                key={i.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                role="status"
              >
                <span className="text-tinta-suave line-through">{i.descricao}</span>
                <span className="flex items-center gap-3 text-sm">
                  Item removido.
                  <Botao variante="secundario" onClick={desfazerRemocao}>
                    Desfazer
                  </Botao>
                </span>
              </li>
            ) : (
              <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 font-semibold">
                    {i.descricao}
                    {i.ehExtra && (
                      <span className="rounded-sm bg-modulo px-1.5 font-denso text-xs font-semibold uppercase text-sobre-modulo">
                        Extra
                      </span>
                    )}
                    {i.tipo === 'produto' && (
                      <span className="rounded-sm border border-borda-forte px-1.5 font-denso text-xs font-semibold uppercase text-tinta-suave">
                        Produto
                      </span>
                    )}
                    {i.cobertoClube && (
                      <span className="rounded-sm bg-acao px-1.5 font-denso text-xs font-semibold uppercase text-sobre-acao">
                        Clube
                      </span>
                    )}
                  </span>
                  <span className="font-denso text-sm tabular-nums text-tinta-suave">
                    {i.cobertoClube
                      ? `${i.quantidade} × coberto pelo plano`
                      : `${i.quantidade} × ${formatarMoeda(i.precoUnitario)}`}
                    {i.precoLivre && ' · preço livre'}
                    {i.desconto > 0 && ` · desconto ${formatarMoeda(i.desconto)}`}
                    {c.status === 'fechada' &&
                      i.comissaoValor > 0 &&
                      ` · comissão ${formatarMoeda(i.comissaoValor)}`}
                  </span>
                </span>
                {editavel && i.precoLivre?.podeAlterar && (
                  <ValorDoItem
                    item={i}
                    onSalvar={(precoUnitario) =>
                      executar(`itens/${i.id}`, { precoUnitario }, 'PATCH')
                    }
                  />
                )}
                {editavel && (
                  <span className="flex items-center gap-1">
                    <Botao
                      variante="fantasma"
                      className="px-3"
                      aria-label={`Diminuir ${i.descricao}`}
                      disabled={i.quantidade <= 1}
                      onClick={() =>
                        executar(`itens/${i.id}`, { quantidade: i.quantidade - 1 }, 'PATCH')
                      }
                    >
                      <Minus aria-hidden className="size-4" />
                    </Botao>
                    <Botao
                      variante="fantasma"
                      className="px-3"
                      aria-label={`Aumentar ${i.descricao}`}
                      onClick={() =>
                        executar(`itens/${i.id}`, { quantidade: i.quantidade + 1 }, 'PATCH')
                      }
                    >
                      <Plus aria-hidden className="size-4" />
                    </Botao>
                    <Botao
                      variante="fantasma"
                      className="px-3"
                      aria-label={`Remover ${i.descricao}`}
                      onClick={() => void removerItem({ id: i.id, descricao: i.descricao })}
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </Botao>
                  </span>
                )}
                <span className="w-24 text-right font-denso text-lg font-semibold tabular-nums">
                  {formatarMoeda(i.quantidade * i.precoUnitario - i.desconto)}
                </span>
              </li>
            ),
          )}
        </ul>
        <dl className="flex flex-col gap-1 self-end font-denso text-lg tabular-nums">
          {c.desconto > 0 && (
            <>
              <div className="flex justify-between gap-8 text-tinta-suave">
                <dt>Subtotal</dt>
                <dd>{formatarMoeda(c.totalBruto)}</dd>
              </div>
              <div className="flex justify-between gap-8 text-tinta-suave">
                <dt>Descontos</dt>
                <dd>−{formatarMoeda(c.desconto)}</dd>
              </div>
            </>
          )}
          <div className="flex justify-between gap-8 text-2xl font-bold">
            <dt>Total</dt>
            <dd>{formatarMoeda(c.totalLiquido)}</dd>
          </div>
          {c.sinais.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-4 text-base">
              <dt className="text-tinta-suave">
                Sinal · {NOME_FORMA[s.forma]}
                {s.devolvidoEm ? ' (devolvido)' : ''}
              </dt>
              <dd className="flex items-center gap-2">
                <span className={s.devolvidoEm ? 'text-tinta-suave line-through' : ''}>
                  −{formatarMoeda(s.valor)}
                </span>
                {balcao && !s.devolvidoEm && c.status !== 'fechada' && (
                  <Botao variante="fantasma" className="px-2" onClick={() => setDevolver(s.id)}>
                    Devolver
                  </Botao>
                )}
              </dd>
            </div>
          ))}
          {sinalRetido > 0 && c.status !== 'fechada' && c.status !== 'cancelada' && (
            <div className="flex justify-between gap-8 font-semibold">
              <dt>A receber</dt>
              <dd>{formatarMoeda(c.aReceber)}</dd>
            </div>
          )}
          {c.pagamentos.map((p) => (
            <div key={p.forma} className="flex justify-between gap-8 text-base text-tinta-suave">
              <dt>{NOME_FORMA[p.forma]}</dt>
              <dd>{formatarMoeda(p.valor)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <aside className="flex flex-col gap-4" aria-label="Ações da comanda">
        <div className="flex flex-col gap-2 rounded-lg border border-borda bg-superficie p-4">
          {pode('iniciar') && (c.status === 'prevista' || c.status === 'reaberta') && (
            <Botao
              variante="secundario"
              onClick={() => executar('iniciar')}
              carregando={acao.isPending}
            >
              Começar atendimento
            </Botao>
          )}
          {pode('confirmar') && (
            <Botao onClick={() => executar('confirmar')} carregando={acao.isPending}>
              Confirmar atendimento
            </Botao>
          )}
          {pode('fechar') && (
            <>
              <Botao
                onClick={async () => {
                  await removerAgora();
                  setFechar(true);
                }}
                disabled={!!motivoNaoFecha}
                aria-describedby={motivoNaoFecha ? 'motivo-nao-fecha' : undefined}
              >
                Receber e fechar
              </Botao>
              {motivoNaoFecha && (
                <p id="motivo-nao-fecha" className="text-sm text-tinta-suave">
                  {motivoNaoFecha}
                </p>
              )}
            </>
          )}
          {pode('reabrir') && (
            <Botao variante="secundario" onClick={() => setReabrir(true)}>
              Reabrir comanda
            </Botao>
          )}
          {podeMover && (
            <Botao variante="secundario" onClick={() => setMover(true)}>
              Mover horário
            </Botao>
          )}
          {balcao && !['fechada', 'cancelada'].includes(c.status) && c.aReceber > 0 && (
            <Botao variante="secundario" onClick={() => setSinal(true)}>
              Receber sinal (adiantado)
            </Botao>
          )}
          {pode('cancelar') && (
            <Botao variante="fantasma" onClick={() => setCancelar(true)}>
              Cancelar ou marcar falta
            </Botao>
          )}
          {!podeMover &&
            !['iniciar', 'confirmar', 'fechar', 'reabrir', 'cancelar'].some((a) =>
              pode(a as AcaoComanda),
            ) && <p className="text-sm text-tinta-suave">Nada a fazer nesta comanda agora.</p>}
        </div>
        {movimento.elementos}
        {editavel && <LancarItens unidadeId={c.unidadeId} onLancar={lancar} podeProduto />}
      </aside>
      {podeMover && (
        <MoverComanda
          c={c}
          profissionais={(profissionais.data ?? [])
            .filter((p) => p.unidadeId === c.unidadeId && p.ativo)
            .map((p) => ({ id: p.id, nome: p.nome }))}
          aberto={mover}
          onFechar={() => setMover(false)}
          onEscolher={movimento.pedir}
        />
      )}

      <Fechamento
        comanda={c}
        aberto={fechar}
        onFechar={() => setFechar(false)}
        onConcluir={(corpo) => executar('fechar', corpo)}
      />
      <AbrirCaixa
        unidadeId={c.unidadeId}
        aberto={caixaPendente !== null}
        onFechar={() => setCaixaPendente(null)}
        onAberto={async () => {
          const corpo = caixaPendente;
          setCaixaPendente(null);
          await executar('fechar', corpo);
        }}
      />
      <ReceberSinal
        aberto={sinal}
        aReceber={c.aReceber}
        onFechar={() => setSinal(false)}
        onConfirmar={(corpo) => executar('sinal', corpo)}
      />
      <DevolverSinal
        aberto={devolver !== null}
        valor={c.sinais.find((s) => s.id === devolver)?.valor ?? 0}
        onFechar={() => setDevolver(null)}
        onConfirmar={(motivo) => executar(`sinal/${devolver}/devolver`, { motivo })}
      />
      <Cancelamento
        aberto={cancelar}
        sinalRetido={sinalRetido}
        inicioAgendado={c.agendamentoId && c.cliente ? c.inicio : null}
        onFechar={() => setCancelar(false)}
        onConfirmar={(corpo) => executar('cancelar', corpo)}
      />
      <ModalConfirmacao
        aberto={reabrir}
        titulo="Reabrir comanda fechada?"
        descricao={`Sai do faturamento e da comissão até ser fechada de novo. Total atual: ${formatarMoeda(c.totalLiquido)}.`}
        textoConfirmar="Reabrir"
        exigirMotivo
        carregando={acao.isPending}
        onCancelar={() => setReabrir(false)}
        onConfirmar={async (motivo) => {
          setReabrir(false);
          await executar('reabrir', { motivo });
        }}
      />
    </div>
  );
}

/** Lançar em poucos toques: um toque no serviço ou produto adiciona à comanda. */
/**
 * Preço livre (química e afins): troca o valor do item dentro da faixa do serviço. A API confere
 * de novo a faixa e quem pode digitar, e guarda no histórico da comanda.
 */
function ValorDoItem({
  item,
  onSalvar,
}: {
  item: ItemComandaDetalhe;
  onSalvar: (precoUnitario: number) => Promise<void>;
}) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const faixa = item.precoLivre!;
  const valor = texto.trim() ? lerMoeda(texto) : null;
  const erro =
    texto.trim() && (valor === null || valor < 0)
      ? 'Valor inválido. Ex.: 120,00'
      : valor !== null && faixa.minimo !== null && valor < faixa.minimo
        ? `Mínimo ${formatarMoeda(faixa.minimo)}.`
        : valor !== null && faixa.maximo !== null && valor > faixa.maximo
          ? `Máximo ${formatarMoeda(faixa.maximo)}.`
          : undefined;
  const dica =
    faixa.minimo !== null && faixa.maximo !== null
      ? `De ${formatarMoeda(faixa.minimo)} a ${formatarMoeda(faixa.maximo)}`
      : faixa.minimo !== null
        ? `A partir de ${formatarMoeda(faixa.minimo)}`
        : faixa.maximo !== null
          ? `Até ${formatarMoeda(faixa.maximo)}`
          : 'Valor cobrado por unidade';

  if (!aberto)
    return (
      <Botao
        variante="fantasma"
        className="px-3"
        aria-label={`Trocar o valor de ${item.descricao}`}
        onClick={() => {
          setTexto(valorParaCampo(item.precoUnitario));
          setAberto(true);
        }}
      >
        <Pencil aria-hidden className="size-4" /> Valor
      </Botao>
    );
  return (
    <form
      className="flex w-full flex-wrap items-end gap-2 sm:w-auto"
      onSubmit={async (e) => {
        e.preventDefault();
        if (erro || valor === null) return;
        setSalvando(true);
        try {
          await onSalvar(valor);
          setAberto(false);
        } finally {
          setSalvando(false);
        }
      }}
    >
      <div className="w-40">
        <Campo
          id={`valor-${item.id}`}
          rotulo={`Valor de ${item.descricao} (R$)`}
          inputMode="decimal"
          autoFocus
          dica={dica}
          erro={erro}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </div>
      <Botao type="submit" carregando={salvando} disabled={!!erro || valor === null}>
        Salvar
      </Botao>
      <Botao variante="secundario" onClick={() => setAberto(false)}>
        Cancelar
      </Botao>
    </form>
  );
}

function LancarItens({
  unidadeId,
  onLancar,
  podeProduto,
}: {
  /** Catálogo por unidade: só o que está na unidade da comanda. */
  unidadeId: string;
  onLancar: (
    item: { tipo: 'servico'; servicoId: string } | { tipo: 'produto'; produtoId: string },
    nome: string,
  ) => Promise<void>;
  podeProduto: boolean;
}) {
  const servicos = useServicos();
  const produtos = useProdutos();
  const [enviando, setEnviando] = useState<string | null>(null);
  const daUnidade = (servicos.data ?? []).filter(
    (s) => s.ativo && disponivelNaUnidade(s, unidadeId),
  );
  const extras = daUnidade.filter((s) => s.ehExtra);
  const principais = daUnidade.filter((s) => !s.ehExtra);
  const grupo = (
    titulo: string,
    itens: { id: string; nome: string; item: Parameters<typeof onLancar>[0] }[],
  ) =>
    itens.length > 0 && (
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
          {titulo}
        </h3>
        <div className="flex flex-wrap gap-2">
          {itens.map((i) => (
            <Botao
              key={i.id}
              variante="secundario"
              className="px-3"
              carregando={enviando === i.id}
              onClick={async () => {
                setEnviando(i.id);
                await onLancar(i.item, i.nome);
                setEnviando(null);
              }}
            >
              <Plus aria-hidden className="size-4" /> {i.nome}
            </Botao>
          ))}
        </div>
      </div>
    );
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-borda bg-superficie p-4">
      <h2 className="text-lg font-semibold">Lançar</h2>
      {grupo(
        'Extras',
        extras.map((s) => ({
          id: s.id,
          nome: s.nome,
          item: { tipo: 'servico' as const, servicoId: s.id },
        })),
      )}
      {grupo(
        'Serviços',
        principais.map((s) => ({
          id: s.id,
          nome: s.nome,
          item: { tipo: 'servico' as const, servicoId: s.id },
        })),
      )}
      {podeProduto &&
        grupo(
          'Produtos',
          (produtos.data ?? [])
            .filter((p) => p.ativo && disponivelNaUnidade(p, unidadeId))
            .map((p) => ({
              id: p.id,
              nome: p.nome,
              item: { tipo: 'produto' as const, produtoId: p.id },
            })),
        )}
    </div>
  );
}

/**
 * "O caixa de hoje não foi aberto": abre com o troco da gaveta e já recebe (briefing do painel,
 * A2). O caixa nunca abre sozinho; quem recebe decide o troco.
 */
function AbrirCaixa({
  unidadeId,
  aberto,
  onFechar,
  onAberto,
}: {
  unidadeId: string;
  aberto: boolean;
  onFechar: () => void;
  onAberto: () => Promise<void>;
}) {
  const [troco, setTroco] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState(false);
  const valor = troco.trim() ? lerMoeda(troco) : 0;
  return (
    <Dialogo
      aberto={aberto}
      titulo="O caixa de hoje não foi aberto"
      descricao="Abra agora com o troco que está na gaveta. Depois, o pagamento é registrado."
      onFechar={onFechar}
    >
      <form
        method="post"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (valor === null || valor < 0) return setErro('Informe o troco. Ex.: 100,00');
          setErro(null);
          setAbrindo(true);
          try {
            await api('caixa/abrir', {
              corpo: { unidadeId, data: dataLocal(new Date()), valorAbertura: valor },
            });
            await onAberto();
          } catch (er) {
            setErro(mensagemDe(er));
          } finally {
            setAbrindo(false);
          }
        }}
      >
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <Campo
          id="abrir-caixa-troco"
          rotulo="Troco na gaveta (R$)"
          inputMode="decimal"
          placeholder="0,00"
          value={troco}
          onChange={(e) => setTroco(e.target.value)}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Botao variante="secundario" onClick={onFechar}>
            Agora não
          </Botao>
          <Botao type="submit" carregando={abrindo}>
            Abrir o caixa e receber
          </Botao>
        </div>
      </form>
    </Dialogo>
  );
}

function Fechamento({
  comanda,
  aberto,
  onFechar,
  onConcluir,
}: {
  comanda: ComandaDetalhe;
  aberto: boolean;
  onFechar: () => void;
  onConcluir: (corpo: object) => Promise<void>;
}) {
  const [descontoTexto, setDescontoTexto] = useState('');
  const [linhas, setLinhas] = useState<
    { forma: (typeof FORMAS_PAGAMENTO)[number]; valor: string }[] | null
  >(null);
  const [confirmar, setConfirmar] = useState(false);
  const desconto = descontoTexto.trim() ? (lerMoeda(descontoTexto) ?? -1) : 0;
  // Sinal recebido adiantado (e não devolvido) já entrou: abate do que falta receber.
  const sinal = comanda.sinais.filter((s) => !s.devolvidoEm).reduce((t, s) => t + s.valor, 0);
  const total = comanda.totalLiquido - Math.max(0, desconto) - sinal;
  const sinalCobre = total === 0 && sinal > 0;
  const atuais = linhas ?? [{ forma: 'pix' as const, valor: valorParaCampo(comanda.aReceber) }];
  const valores = atuais.map((l) => lerMoeda(l.valor));
  const somado = valores.reduce<number>((s, v) => s + (v ?? 0), 0);
  const falta = total - somado;
  // Cada forma uma vez: a usada numa linha sai das outras listas.
  const usadas = new Set(atuais.map((l) => l.forma));
  const livre = FORMAS_PAGAMENTO.find((f) => !usadas.has(f));
  const valido =
    desconto >= 0 &&
    desconto <= comanda.totalLiquido &&
    (sinalCobre || (valores.every((v) => v !== null && v > 0) && falta === 0));

  function fechar() {
    setLinhas(null);
    setDescontoTexto('');
    setConfirmar(false);
    onFechar();
  }

  return (
    <>
      <Dialogo
        aberto={aberto && !confirmar}
        titulo="Receber e fechar"
        descricao={`${comanda.cliente ?? 'Cliente'} · ${comanda.profissional}`}
        onFechar={fechar}
      >
        <form
          method="post"
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valido) setConfirmar(true);
          }}
        >
          <Campo
            id="fechar-desconto"
            rotulo="Desconto (R$)"
            inputMode="decimal"
            placeholder="0,00"
            dica="Dividido entre os itens; a comissão sai sobre o valor pago"
            value={descontoTexto}
            onChange={(e) => setDescontoTexto(e.target.value)}
            erro={
              desconto < 0 || desconto > comanda.totalLiquido ? 'Desconto inválido.' : undefined
            }
          />
          {sinal > 0 && (
            <p className="flex justify-between font-denso text-lg tabular-nums text-tinta-suave">
              <span>Sinal já recebido</span>
              <span>−{formatarMoeda(sinal)}</span>
            </p>
          )}
          <p className="flex justify-between font-denso text-2xl font-bold tabular-nums">
            <span>Total a receber</span>
            <span>{formatarMoeda(Math.max(0, total))}</span>
          </p>
          {total < 0 && (
            <Aviso tom="erro">
              O sinal passa {formatarMoeda(-total)} do total. Devolva o sinal ou lance o que falta.
            </Aviso>
          )}
          {sinalCobre && <p className="text-tinta-suave">O sinal cobre o total: nada a receber.</p>}
          <fieldset className="min-w-0" hidden={sinalCobre || total < 0}>
            <legend className="mb-1 text-sm font-medium">Formas de pagamento</legend>
            <div className="flex flex-col gap-3">
              {atuais.map((l, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_8rem_auto] items-end gap-2">
                  <Selecao
                    id={`fechar-forma-${i}`}
                    rotulo="Forma"
                    value={l.forma}
                    onChange={(e) =>
                      setLinhas(
                        atuais.map((x, k) =>
                          k === i ? { ...x, forma: e.target.value as typeof l.forma } : x,
                        ),
                      )
                    }
                    opcoes={FORMAS_PAGAMENTO.filter((f) => f === l.forma || !usadas.has(f)).map(
                      (f) => ({ valor: f, rotulo: NOME_FORMA[f] }),
                    )}
                  />
                  <Campo
                    id={`fechar-valor-${i}`}
                    rotulo="Valor (R$)"
                    inputMode="decimal"
                    value={l.valor}
                    onChange={(e) =>
                      setLinhas(
                        atuais.map((x, k) => (k === i ? { ...x, valor: e.target.value } : x)),
                      )
                    }
                  />
                  <Botao
                    variante="fantasma"
                    className="px-3"
                    aria-label="Tirar esta forma"
                    disabled={atuais.length === 1}
                    onClick={() => setLinhas(atuais.filter((_, k) => k !== i))}
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </Botao>
                </div>
              ))}
              <Botao
                variante="secundario"
                className="self-start"
                disabled={!livre}
                onClick={() =>
                  livre &&
                  setLinhas([
                    ...atuais,
                    { forma: livre, valor: falta > 0 ? valorParaCampo(falta) : '' },
                  ])
                }
              >
                <Plus aria-hidden className="size-4" /> Dividir em outra forma
              </Botao>
            </div>
          </fieldset>
          {falta !== 0 && !sinalCobre && total >= 0 && (
            <p role="status" className="font-denso text-lg tabular-nums text-aviso-texto">
              {falta > 0
                ? `Faltam ${formatarMoeda(falta)}`
                : `Passou ${formatarMoeda(-falta)} do total`}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Botao variante="secundario" onClick={fechar}>
              Voltar
            </Botao>
            <Botao type="submit" disabled={!valido}>
              Continuar
            </Botao>
          </div>
        </form>
      </Dialogo>
      <ModalConfirmacao
        aberto={aberto && confirmar}
        titulo={`Fechar comanda de ${formatarMoeda(total)}?`}
        descricao={
          <ul className="flex flex-col gap-1 font-denso text-lg tabular-nums">
            {sinal > 0 && (
              <li className="flex justify-between gap-6 text-tinta-suave">
                <span>Sinal já recebido</span>
                <span>{formatarMoeda(sinal)}</span>
              </li>
            )}
            {(sinalCobre ? [] : atuais).map((l, i) => (
              <li key={i} className="flex justify-between gap-6">
                <span>{NOME_FORMA[l.forma]}</span>
                <span>{formatarMoeda(valores[i] ?? 0)}</span>
              </li>
            ))}
          </ul>
        }
        textoConfirmar="Fechar comanda"
        onCancelar={() => setConfirmar(false)}
        onConfirmar={async () => {
          await onConcluir({
            desconto: Math.max(0, desconto),
            pagamentos: sinalCobre
              ? []
              : atuais.map((l, i) => ({ forma: l.forma, valor: valores[i]! })),
          });
          fechar();
        }}
      />
    </>
  );
}

/** Receber adiantado (sinal): entra no caixa de hoje e abate do total ao fechar. */
function ReceberSinal({
  aberto,
  aReceber,
  onFechar,
  onConfirmar,
}: {
  aberto: boolean;
  aReceber: number;
  onFechar: () => void;
  onConfirmar: (corpo: object) => Promise<void>;
}) {
  const formas = FORMAS_PAGAMENTO;
  const [forma, setForma] = useState<(typeof formas)[number]>('pix');
  const [texto, setTexto] = useState('');
  const valor = texto.trim() ? lerMoeda(texto) : null;
  const erro =
    texto.trim() && (valor === null || valor <= 0)
      ? 'Valor inválido. Ex.: 30,00'
      : valor !== null && valor > aReceber
        ? `Até ${formatarMoeda(aReceber)} (o que falta receber).`
        : undefined;
  function fechar() {
    setTexto('');
    onFechar();
  }
  return (
    <Dialogo
      aberto={aberto}
      titulo="Receber sinal"
      descricao="Entra no caixa de hoje e abate do total quando a comanda for fechada."
      onFechar={fechar}
    >
      <form
        method="post"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (erro || valor === null) return;
          fechar();
          await onConfirmar({ forma, valor });
        }}
      >
        <div className="grid grid-cols-2 gap-4">
          <Selecao
            id="sinal-forma"
            rotulo="Forma"
            value={forma}
            onChange={(e) => setForma(e.target.value as typeof forma)}
            opcoes={formas.map((f) => ({ valor: f, rotulo: NOME_FORMA[f] }))}
          />
          <Campo
            id="sinal-valor"
            rotulo="Valor (R$)"
            inputMode="decimal"
            placeholder={valorParaCampo(aReceber)}
            erro={erro}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Botao variante="secundario" onClick={fechar}>
            Voltar
          </Botao>
          <Botao type="submit" disabled={!!erro || valor === null}>
            Receber sinal
          </Botao>
        </div>
      </form>
    </Dialogo>
  );
}

/** Devolver o sinal ao cliente: sai do caixa de hoje (o do dia em que entrou não muda). */
function DevolverSinal({
  aberto,
  valor,
  onFechar,
  onConfirmar,
}: {
  aberto: boolean;
  valor: number;
  onFechar: () => void;
  onConfirmar: (motivo: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState('');
  return (
    <Dialogo
      aberto={aberto}
      titulo={`Devolver o sinal de ${formatarMoeda(valor)}?`}
      descricao="Sai do caixa de hoje. O caixa do dia em que ele entrou não muda."
      onFechar={onFechar}
    >
      <form
        method="post"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (motivo.trim().length < 3) return;
          onFechar();
          await onConfirmar(motivo.trim());
          setMotivo('');
        }}
      >
        <Campo
          id="devolver-sinal-motivo"
          rotulo="Motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Cliente desistiu, combinado no balcão…"
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Botao variante="secundario" onClick={onFechar}>
            Voltar
          </Botao>
          <Botao type="submit" variante="perigo" disabled={motivo.trim().length < 3}>
            Devolver sinal
          </Botao>
        </div>
      </form>
    </Dialogo>
  );
}

function Cancelamento({
  aberto,
  sinalRetido,
  inicioAgendado,
  onFechar,
  onConfirmar,
}: {
  aberto: boolean;
  /** Sinal recebido e ainda não devolvido. */
  sinalRetido: number;
  /** Início do horário com cliente (null = sem agendamento ou sem cliente). */
  inicioAgendado: string | null;
  onFechar: () => void;
  onConfirmar: (corpo: object) => Promise<void>;
}) {
  // Horário ainda vai acontecer e tem cliente: dá para avisar pelo WhatsApp.
  const [podeAvisar] = useState(() => !!inicioAgendado && Date.parse(inicioAgendado) > Date.now());
  const [motivo, setMotivo] = useState('');
  // Antes do horário, o normal é a barbearia desmarcar (avisando); depois, é falta.
  const [falta, setFalta] = useState(!podeAvisar);
  const [avisar, setAvisar] = useState(true);
  const [devolverSinal, setDevolverSinal] = useState(false);
  return (
    <Dialogo
      aberto={aberto}
      titulo="Cancelar comanda"
      descricao="Fica fora do faturamento. Marque falta quando o cliente não veio."
      onFechar={onFechar}
    >
      <form
        method="post"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (motivo.trim().length < 3) return;
          onFechar();
          await onConfirmar({
            motivo: motivo.trim(),
            falta,
            avisarCliente: podeAvisar && !falta && avisar,
            devolverSinal: sinalRetido > 0 && devolverSinal,
          });
          setMotivo('');
        }}
      >
        <Marcador
          id="cancelar-falta"
          rotulo="O cliente não veio (conta como falta)"
          checked={falta}
          onChange={(e) => setFalta(e.target.checked)}
        />
        {podeAvisar && !falta && (
          <Marcador
            id="cancelar-avisar"
            rotulo="Avisar o cliente pelo WhatsApp (com convite para marcar outro horário)"
            checked={avisar}
            onChange={(e) => setAvisar(e.target.checked)}
          />
        )}
        {sinalRetido > 0 && (
          <Marcador
            id="cancelar-devolver-sinal"
            rotulo={`Devolver o sinal de ${formatarMoeda(sinalRetido)} agora (sai do caixa de hoje). Sem marcar, ele fica retido e dá para devolver depois.`}
            checked={devolverSinal}
            onChange={(e) => setDevolverSinal(e.target.checked)}
          />
        )}
        <Campo
          id="cancelar-motivo"
          rotulo="Motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder={falta ? 'Não compareceu' : 'Desistiu, remarcou…'}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Botao variante="secundario" onClick={onFechar}>
            Voltar
          </Botao>
          <Botao type="submit" variante="perigo" disabled={motivo.trim().length < 3}>
            Cancelar comanda
          </Botao>
        </div>
      </form>
    </Dialogo>
  );
}
