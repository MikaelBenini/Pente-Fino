'use client';

// Blocos de Resultados do mês que vieram de "Métricas e metas": metas (com edição), serviços e
// produtos (uma tabela só, juntando o peso no faturamento e o lucro), canais (uma tabela só),
// mapa da agenda do mês escolhido e avaliações.
import {
  formatarFracao,
  formatarMoeda,
  formatarNumero,
  lerMoeda,
  mixDoMes,
  CANAIS,
  NOME_CANAL,
  type LinhaMix,
  type MetaDetalhe,
  type RelatorioDoMes,
  type ResumoAvaliacoes,
  type SituacaoProduto,
} from '@pente-fino/shared';
import { BarraMeta, Botao, Campo, cn, Dialogo, EstadoVazio, Selecao } from '@pente-fino/ui';
import { ChartLine, Package, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import {
  chavesResultados,
  useAcao,
  useAvaliacoes,
  useCanais,
  useLucratividade,
  useMetas,
  useOcupacao,
  useServicos,
} from '@/lib/consultas';
import { useTemRecurso } from '@/lib/plano';
import { Aviso } from '../aviso';
import { useApp } from '../contexto-app';
import { ConvitePlano, SoNoPlano } from '../convite-plano';
import { ComentarioDaPesquisa, NotaBaixa, ResumoDeNotas } from '../notas';
import { CardOcupacao, MapaDaSemana } from '../ocupacao';
import { Estado, Ficha, Tabela, td, th } from '../pagina';
import { useUnidadeTrabalho } from '../unidade-trabalho';

const variacao = (v: number | null) =>
  v === null ? 'novo' : `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
const corVariacao = (v: number | null) =>
  v === null ? 'text-tinta-suave' : v >= 0 ? 'text-acao-texto' : 'text-perigo-texto';

/** Número com a fatia do total logo abaixo (economiza uma coluna e não quebra o valor). */
function ComFatia({ valor, fatia, de }: { valor: string; fatia: number; de: string }) {
  return (
    <span className="flex flex-col items-end whitespace-nowrap">
      {valor}
      <span className="text-xs text-tinta-suave">
        {formatarFracao(fatia, 0)} {de}
      </span>
    </span>
  );
}

// ─── Metas ────────────────────────────────────────────────────────────────

export function MetasDoMes({ mes }: { mes: string }) {
  const { unidadeAtiva, papeis, unidades } = useApp();
  const ehDono = papeis.includes('dono');
  // Sem metas no plano: as já lançadas continuam aparecendo; criar e remover, não.
  const recurso = useTemRecurso('metas');
  const podeMetas = recurso === true;
  const metas = useMetas(unidadeAtiva, mes);
  const [nova, setNova] = useState(false);
  const remover = useAcao(
    (id: string) => api(`metas/${id}`, { metodo: 'DELETE' }),
    [chavesResultados.metas],
  );
  const nomeUnidade = (id: string) => unidades.find((u) => u.id === id)?.nome ?? '';
  return (
    <section className="flex flex-col gap-3" aria-labelledby="titulo-metas">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="titulo-metas" className="text-lg font-semibold">
          Metas
        </h2>
        {ehDono && podeMetas && (
          <Botao variante="secundario" onClick={() => setNova(true)}>
            <Plus aria-hidden className="size-4" /> Definir meta
          </Botao>
        )}
      </div>
      {recurso === false && <ConvitePlano recurso="metas" compacto />}
      <Estado consulta={metas}>
        {() =>
          metas.data!.length === 0 ? (
            <p className="text-tinta-suave">
              Nenhuma meta neste mês.
              {ehDono && podeMetas ? ' Defina o faturamento ou a quantidade de um serviço.' : ''}
            </p>
          ) : (
            <ul className="grid gap-6 rounded-lg border border-borda bg-superficie p-5 md:grid-cols-2">
              {metas.data!.map((m) => (
                <li key={m.id} className="flex items-start gap-2">
                  <BarraMeta
                    className="flex-1"
                    rotulo={`${m.tipo === 'faturamento' ? 'Faturamento' : m.servico} · ${nomeUnidade(m.unidadeId)}`}
                    atual={m.atual}
                    objetivo={m.objetivo}
                    fracaoDoMes={m.fracaoDoMes}
                    formatar={m.tipo === 'faturamento' ? formatarMoeda : formatarNumero}
                  />
                  {ehDono && podeMetas && (
                    <Botao
                      variante="fantasma"
                      className="px-3"
                      aria-label="Remover meta"
                      onClick={() => remover.mutate(m.id)}
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </Botao>
                  )}
                </li>
              ))}
            </ul>
          )
        }
      </Estado>
      {ehDono && <NovaMeta mes={mes} aberto={nova} onFechar={() => setNova(false)} />}
    </section>
  );
}

function NovaMeta({
  mes,
  aberto,
  onFechar,
}: {
  mes: string;
  aberto: boolean;
  onFechar: () => void;
}) {
  const { unidades, unidadeAtiva } = useApp();
  const servicos = useServicos();
  const ativas = unidades.filter((u) => u.ativa);
  const [f, setF] = useState({
    unidadeId: unidadeAtiva !== 'todas' ? unidadeAtiva : (ativas[0]?.id ?? ''),
    tipo: 'faturamento',
    servicoId: '',
    objetivo: '',
  });
  const [erro, setErro] = useState<string | null>(null);
  const salvar = useAcao(
    (corpo: object) => api<MetaDetalhe>('metas', { metodo: 'PUT', corpo }),
    [chavesResultados.metas],
  );
  return (
    <Dialogo
      aberto={aberto}
      titulo="Definir meta do mês"
      descricao="O atual é calculado sozinho pelas comandas fechadas."
      onFechar={onFechar}
    >
      <form
        method="post"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setErro(null);
          const objetivo = f.tipo === 'faturamento' ? lerMoeda(f.objetivo) : Number(f.objetivo);
          if (!objetivo || objetivo <= 0 || !Number.isInteger(objetivo))
            return setErro(
              f.tipo === 'faturamento'
                ? 'Informe o valor. Ex.: 35.000,00'
                : 'Informe a quantidade.',
            );
          try {
            await salvar.mutateAsync({
              unidadeId: f.unidadeId,
              mes,
              tipo: f.tipo,
              servicoId: f.tipo === 'servico' ? f.servicoId || null : null,
              objetivo,
            });
            onFechar();
          } catch (er) {
            setErro(
              er instanceof ErroApi
                ? (er.campos[0]?.mensagem ?? er.message)
                : 'Não foi possível salvar.',
            );
          }
        }}
      >
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <Selecao
          id="meta-unidade"
          rotulo="Unidade"
          value={f.unidadeId}
          onChange={(e) => setF({ ...f, unidadeId: e.target.value })}
          opcoes={ativas.map((u) => ({ valor: u.id, rotulo: u.nome }))}
        />
        <Selecao
          id="meta-tipo"
          rotulo="Meta de"
          value={f.tipo}
          onChange={(e) => setF({ ...f, tipo: e.target.value })}
          opcoes={[
            { valor: 'faturamento', rotulo: 'Faturamento (R$)' },
            { valor: 'servico', rotulo: 'Quantidade de um serviço' },
          ]}
        />
        {f.tipo === 'servico' && (
          <Selecao
            id="meta-servico"
            rotulo="Serviço"
            value={f.servicoId}
            onChange={(e) => setF({ ...f, servicoId: e.target.value })}
            opcoes={[
              { valor: '', rotulo: 'Escolha' },
              ...(servicos.data ?? [])
                .filter((s) => s.ativo)
                .map((s) => ({ valor: s.id, rotulo: s.nome })),
            ]}
          />
        )}
        <Campo
          id="meta-objetivo"
          rotulo={f.tipo === 'faturamento' ? 'Objetivo (R$)' : 'Quantidade'}
          inputMode={f.tipo === 'faturamento' ? 'decimal' : 'numeric'}
          value={f.objetivo}
          onChange={(e) => setF({ ...f, objetivo: e.target.value })}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Botao variante="secundario" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={salvar.isPending}>
            Salvar meta
          </Botao>
        </div>
      </form>
    </Dialogo>
  );
}

// ─── Serviços e produtos ──────────────────────────────────────────────────

const SITUACAO_PRODUTO: Record<
  SituacaoProduto,
  { rotulo: string; tom: 'acao' | 'aviso' | 'neutro' | 'perigo'; dica: string }
> = {
  investir: {
    rotulo: 'Investir',
    tom: 'acao',
    dica: 'Sai bem e sobra bem por unidade: mantenha estoque.',
  },
  divulgar: {
    rotulo: 'Divulgar',
    tom: 'acao',
    dica: 'Sobra bem por unidade, mas sai pouco: vale oferecer na cadeira.',
  },
  rever_preco: {
    rotulo: 'Rever preço',
    tom: 'aviso',
    dica: 'Sai bastante, mas sobra menos por unidade que os outros: confira preço e custo.',
  },
  repensar: {
    rotulo: 'Repensar',
    tom: 'perigo',
    dica: 'Sai pouco e sobra menos que os outros: talvez não valha comprar de novo.',
  },
  parado: { rotulo: 'Parado', tom: 'neutro', dica: 'Nenhuma venda no período.' },
};

/**
 * Serviços e produtos do mês: o peso de cada um (quantidade e faturamento, contra o mês
 * anterior) e, com lucro real no plano, custo, comissão, lucro, margem e a situação do produto.
 */
export function ServicosEProdutos({ r, de, ate }: { r: RelatorioDoMes; de: string; ate: string }) {
  const { unidadeAtiva } = useApp();
  const lucroReal = useTemRecurso('lucroReal') === true;
  const lucro = useLucratividade(unidadeAtiva, de, ate);
  const mix = mixDoMes(r.mixAtual, r.mixAnterior);
  const servicos = mix.filter((l) => l.tipo === 'servico');
  const produtos = mix.filter((l) => l.tipo === 'produto');
  const detalhe = lucro.data;
  return (
    <div className="flex flex-col gap-8">
      <TabelaServicos linhas={servicos} detalhe={lucroReal ? (detalhe?.servicos ?? []) : null} />
      <TabelaProdutos linhas={produtos} detalhe={lucroReal ? (detalhe?.produtos ?? []) : null} />
      {!lucroReal && <ConvitePlano recurso="lucroReal" />}
    </div>
  );
}

type DetalheServicos = NonNullable<ReturnType<typeof useLucratividade>['data']>['servicos'];
type DetalheProdutos = NonNullable<ReturnType<typeof useLucratividade>['data']>['produtos'];

function TabelaServicos({
  linhas,
  detalhe,
}: {
  linhas: LinhaMix[];
  detalhe: DetalheServicos | null;
}) {
  const [ordem, setOrdem] = useState<'receita' | 'quantidade' | 'lucro'>('receita');
  const de = (id: string) => detalhe?.find((d) => d.servicoId === id);
  const lista = [...linhas].sort((a, b) =>
    ordem === 'quantidade'
      ? b.quantidade - a.quantidade
      : ordem === 'lucro'
        ? (de(b.id)?.lucro ?? 0) - (de(a.id)?.lucro ?? 0)
        : b.receita - a.receita,
  );
  return (
    <section className="flex flex-col gap-3" aria-labelledby="titulo-servicos">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="titulo-servicos" className="text-lg font-semibold">
            Serviços
          </h2>
          <p className="text-sm text-tinta-suave">
            Quanto cada serviço pesa no mês.
            {detalhe && ' Lucro = receita − (custo de produto + comissão).'}
          </p>
        </div>
        {linhas.length > 1 && (
          <Selecao
            id="servicos-ordem"
            rotulo="Ordenar por"
            value={ordem}
            onChange={(e) => setOrdem(e.target.value as typeof ordem)}
            opcoes={[
              { valor: 'receita', rotulo: 'Mais faturamento' },
              { valor: 'quantidade', rotulo: 'Mais feitos' },
              ...(detalhe ? [{ valor: 'lucro', rotulo: 'Mais lucro' }] : []),
            ]}
            className="max-w-xs"
          />
        )}
      </div>
      {linhas.length === 0 ? (
        <EstadoVazio
          icone={ChartLine}
          titulo="Nenhum serviço fechado no mês"
          texto="Assim que as comandas forem fechadas, o peso e o lucro de cada serviço aparecem aqui."
        />
      ) : (
        <Tabela rotulo="Serviços do mês">
          <thead className="bg-superficie-2">
            <tr>
              <th className={th}>Serviço</th>
              <th className={`${th} text-right`}>Feitos</th>
              <th className={`${th} text-right`}>Receita</th>
              <th className={`${th} text-right`}>vs. mês anterior</th>
              {detalhe && (
                <>
                  <th className={`${th} text-right`}>Custo de produto</th>
                  <th className={`${th} text-right`}>Comissão</th>
                  <th className={`${th} text-right`}>Lucro</th>
                  <th className={`${th} text-right`}>Margem</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="font-denso tabular-nums [&_td]:whitespace-nowrap">
            {lista.map((l) => {
              const d = de(l.id);
              return (
                <tr key={l.id} className="border-t border-borda">
                  <th scope="row" className={`${td} text-left font-sans font-semibold`}>
                    {l.nome}
                  </th>
                  <td className={`${td} text-right`}>
                    <ComFatia
                      valor={formatarNumero(l.quantidade)}
                      fatia={l.fatiaQuantidade}
                      de="dos feitos"
                    />
                  </td>
                  <td className={`${td} text-right`}>
                    <ComFatia
                      valor={formatarMoeda(l.receita)}
                      fatia={l.fatiaReceita}
                      de="da receita"
                    />
                  </td>
                  <td className={cn(td, 'text-right', corVariacao(l.variacaoReceita))}>
                    {variacao(l.variacaoReceita)}
                  </td>
                  {detalhe && (
                    <>
                      <td className={`${td} text-right text-tinta-suave`}>
                        {d ? formatarMoeda(d.custoProduto) : '—'}
                      </td>
                      <td className={`${td} text-right text-tinta-suave`}>
                        {d ? formatarMoeda(d.comissao) : '—'}
                      </td>
                      <td
                        className={cn(
                          td,
                          'text-right font-semibold',
                          (d?.lucro ?? 0) < 0 && 'text-perigo-texto',
                        )}
                      >
                        {d ? formatarMoeda(d.lucro) : '—'}
                      </td>
                      <td className={`${td} text-right`}>{d ? formatarFracao(d.margem) : '—'}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </Tabela>
      )}
    </section>
  );
}

function TabelaProdutos({
  linhas,
  detalhe,
}: {
  linhas: LinhaMix[];
  detalhe: DetalheProdutos | null;
}) {
  const vendas = new Map(linhas.map((l) => [l.id, l]));
  // Com lucro real, entram também os parados (cadastrados sem venda no mês).
  const ids = detalhe ? detalhe.map((p) => p.produtoId) : linhas.map((l) => l.id);
  const de = (id: string) => detalhe?.find((p) => p.produtoId === id);
  const vendidos = (detalhe ?? []).filter((p) => p.quantidade > 0);
  const maisVendido = [...vendidos].sort((a, b) => b.quantidade - a.quantidade)[0];
  const maisLucro = [...vendidos].sort((a, b) => b.lucro - a.lucro)[0];
  const melhorRetorno = [...vendidos]
    .filter((p) => p.retornoSobreCusto !== null)
    .sort((a, b) => b.retornoSobreCusto! - a.retornoSobreCusto!)[0];
  const destaques = [
    {
      rotulo: 'Mais vendido',
      produto: maisVendido,
      valor: `${formatarNumero(maisVendido?.quantidade ?? 0)} unidades`,
    },
    { rotulo: 'Mais lucro', produto: maisLucro, valor: formatarMoeda(maisLucro?.lucro ?? 0) },
    {
      rotulo: 'Melhor retorno',
      produto: melhorRetorno,
      valor: melhorRetorno
        ? `${formatarMoeda(Math.round(melhorRetorno.retornoSobreCusto! * 100))} por R$ 1,00`
        : 'cadastre o custo dos produtos',
    },
  ];
  return (
    <section className="flex flex-col gap-3" aria-labelledby="titulo-produtos">
      <div>
        <h2 id="titulo-produtos" className="text-lg font-semibold">
          Produtos
        </h2>
        <p className="text-sm text-tinta-suave">
          Quanto cada produto pesa no mês.
          {detalhe &&
            ' “Retorno” é o lucro para cada R$ 1 gasto no estoque que foi vendido; a situação compara cada produto com os outros.'}
        </p>
      </div>
      {ids.length === 0 ? (
        <EstadoVazio
          icone={Package}
          titulo={detalhe ? 'Nenhum produto cadastrado' : 'Nenhum produto vendido no mês'}
          texto="Cadastre os produtos com preço de venda e custo para ver o que vale a pena comprar de novo."
        />
      ) : (
        <>
          {detalhe && vendidos.length > 0 && (
            <dl className="grid gap-3 sm:grid-cols-3">
              {destaques.map((d) => (
                <div key={d.rotulo} className="rounded-lg border border-borda bg-superficie p-4">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
                    {d.rotulo}
                  </dt>
                  <dd className="mt-1 font-semibold">{d.produto?.nome ?? '—'}</dd>
                  <dd className="font-denso text-sm tabular-nums text-tinta-suave">{d.valor}</dd>
                </div>
              ))}
            </dl>
          )}
          <Tabela rotulo="Produtos do mês">
            <thead className="bg-superficie-2">
              <tr>
                <th className={th}>Produto</th>
                <th className={`${th} text-right`}>Vendidos</th>
                <th className={`${th} text-right`}>Receita</th>
                <th className={`${th} text-right`}>vs. mês anterior</th>
                {detalhe && (
                  <>
                    <th className={`${th} text-right`}>Lucro</th>
                    <th className={`${th} text-right`}>Margem</th>
                    <th className={`${th} text-right`}>Retorno</th>
                    <th className={th}>Situação</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="font-denso tabular-nums [&_td]:whitespace-nowrap">
              {ids.map((id) => {
                const v = vendas.get(id);
                const d = de(id);
                const sit = d ? SITUACAO_PRODUTO[d.situacao] : null;
                return (
                  <tr key={id} className="border-t border-borda">
                    <th scope="row" className={`${td} text-left font-sans font-semibold`}>
                      {v?.nome ?? d?.nome ?? 'Produto'}
                    </th>
                    <td className={`${td} text-right`}>
                      <ComFatia
                        valor={formatarNumero(v?.quantidade ?? 0)}
                        fatia={v?.fatiaQuantidade ?? 0}
                        de="dos vendidos"
                      />
                    </td>
                    <td className={`${td} text-right`}>
                      <ComFatia
                        valor={formatarMoeda(v?.receita ?? 0)}
                        fatia={v?.fatiaReceita ?? 0}
                        de="da receita"
                      />
                    </td>
                    <td
                      className={cn(
                        td,
                        'text-right',
                        v ? corVariacao(v.variacaoReceita) : 'text-tinta-suave',
                      )}
                    >
                      {v ? variacao(v.variacaoReceita) : '—'}
                    </td>
                    {detalhe && (
                      <>
                        <td className={`${td} text-right font-semibold`}>
                          {d ? formatarMoeda(d.lucro) : '—'}
                        </td>
                        <td className={`${td} text-right`}>
                          {d && d.quantidade > 0 ? formatarFracao(d.margem) : '—'}
                        </td>
                        <td className={`${td} text-right`}>
                          {d?.retornoSobreCusto == null
                            ? '—'
                            : formatarMoeda(Math.round(d.retornoSobreCusto * 100))}
                        </td>
                        <td className={`${td} min-w-56 font-sans !whitespace-normal`}>
                          {sit && (
                            <span className="flex flex-col items-start gap-1">
                              <Ficha tom={sit.tom}>{sit.rotulo}</Ficha>
                              <span className="text-xs text-tinta-suave">{sit.dica}</span>
                            </span>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </Tabela>
        </>
      )}
    </section>
  );
}

// ─── Canais ───────────────────────────────────────────────────────────────

/**
 * Por onde os clientes chegam: atendidos contra o mês anterior para todos os planos; com o
 * recurso de canais, também marcados, faltas, cancelados, comparecimento e faturamento.
 */
export function Canais({ r, de, ate }: { r: RelatorioDoMes; de: string; ate: string }) {
  const { unidadeAtiva } = useApp();
  const completo = useTemRecurso('canais') === true;
  const canais = useCanais(unidadeAtiva, de, ate);
  const detalhe = completo ? (canais.data ?? []) : [];
  const lista = CANAIS.filter(
    (c) =>
      (r.atual.porCanal[c] ?? 0) + (r.anterior.porCanal[c] ?? 0) > 0 ||
      detalhe.some((l) => l.canal === c && l.agendados > 0),
  );
  const total = lista.reduce((s, c) => s + (r.atual.porCanal[c] ?? 0), 0);
  return (
    <section className="flex flex-col gap-3" aria-labelledby="titulo-canais">
      <div>
        <h2 id="titulo-canais" className="text-lg font-semibold">
          Por onde os clientes chegam
        </h2>
        <p className="text-sm text-tinta-suave">
          Atendidos no mês por canal, contra o mês anterior.
          {completo && ' “Vieram” é quem marcou, não cancelou e foi atendido.'}
        </p>
      </div>
      {lista.length === 0 ? (
        <p className="text-tinta-suave">Nenhum atendimento no mês.</p>
      ) : (
        <Tabela rotulo="Atendimentos por canal">
          <thead className="bg-superficie-2">
            <tr>
              <th className={th}>Canal</th>
              {completo && <th className={`${th} text-right`}>Marcados</th>}
              <th className={`${th} text-right`}>Atendidos</th>
              <th className={`${th} text-right`}>Parte</th>
              <th className={`${th} text-right`}>Mês anterior</th>
              {completo && (
                <>
                  <th className={`${th} text-right`}>Faltas</th>
                  <th className={`${th} text-right`}>Cancelados</th>
                  <th className={`${th} text-right`}>Vieram</th>
                  <th className={`${th} text-right`}>Faturamento</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="font-denso tabular-nums [&_td]:whitespace-nowrap">
            {lista.map((c) => {
              const d = detalhe.find((l) => l.canal === c);
              const atendidos = r.atual.porCanal[c] ?? 0;
              return (
                <tr key={c} className="border-t border-borda">
                  <th scope="row" className={`${td} text-left font-sans font-semibold`}>
                    {NOME_CANAL[c]}
                  </th>
                  {completo && (
                    <td className={`${td} text-right`}>
                      {c === 'sem_horario' || !d ? '—' : formatarNumero(d.agendados)}
                    </td>
                  )}
                  <td className={`${td} text-right`}>{formatarNumero(atendidos)}</td>
                  <td className={`${td} text-right`}>
                    {total > 0 ? formatarFracao(atendidos / total, 0) : '—'}
                  </td>
                  <td className={`${td} text-right text-tinta-suave`}>
                    {formatarNumero(r.anterior.porCanal[c] ?? 0)}
                  </td>
                  {completo && (
                    <>
                      <td className={`${td} text-right`}>{d ? formatarNumero(d.faltas) : '—'}</td>
                      <td className={`${td} text-right`}>
                        {d ? formatarNumero(d.cancelados) : '—'}
                      </td>
                      <td className={`${td} text-right`}>
                        {d?.comparecimento == null ? '—' : formatarFracao(d.comparecimento, 0)}
                      </td>
                      <td className={`${td} text-right font-semibold`}>
                        {d ? formatarMoeda(d.faturamento) : '—'}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </Tabela>
      )}
    </section>
  );
}

// ─── Agenda e avaliações ──────────────────────────────────────────────────

/** Mapa da agenda no mês escolhido (até hoje) e as avaliações do mês. */
export function AgendaEAvaliacoes({ de, ate }: { de: string; ate: string }) {
  const { unidadeAtiva } = useApp();
  const mapa = useUnidadeTrabalho();
  const ocupacao = useOcupacao(mapa.unidadeId, de, ate);
  const avaliacoes = useAvaliacoes(unidadeAtiva, de, ate);
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3" aria-labelledby="titulo-mapa">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="titulo-mapa" className="text-lg font-semibold">
              Agenda ocupada, hora a hora
            </h2>
            <p className="text-sm text-tinta-suave">
              Quanto da agenda foi ocupado em cada hora no mês (até hoje). Use os horários vazios
              para promoção ou folga.
            </p>
          </div>
          {mapa.seletor}
        </div>
        {mapa.unidadeId ? (
          <Estado consulta={ocupacao}>
            {() => (
              <>
                <CardOcupacao o={ocupacao.data!} />
                <MapaDaSemana o={ocupacao.data!} />
              </>
            )}
          </Estado>
        ) : (
          <p className="text-tinta-suave">Escolha uma unidade para ver o mapa.</p>
        )}
      </section>
      <SoNoPlano recurso="avaliacoes">
        <Estado consulta={avaliacoes}>{() => <Avaliacoes r={avaliacoes.data!} />}</Estado>
      </SoNoPlano>
    </div>
  );
}

function Avaliacoes({ r }: { r: ResumoAvaliacoes }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="titulo-avaliacoes">
      <div>
        <h2 id="titulo-avaliacoes" className="text-lg font-semibold">
          Avaliações dos clientes
        </h2>
        <p className="text-sm text-tinta-suave">
          Pesquisa de 1 a 5 pelo WhatsApp depois do atendimento.
          {r.atendimento.taxaResposta !== null &&
            ` ${formatarFracao(r.atendimento.taxaResposta, 0)} responderam (${r.atendimento.respostas} de ${r.atendimento.enviadas}).`}
        </p>
      </div>
      {!r.pesquisaAtiva && (
        <Aviso tom="info">A pesquisa está desligada. O dono liga em Bot → Mensagens.</Aviso>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <ResumoDeNotas titulo="Atendimento" resumo={r.atendimento} />
        <ResumoDeNotas titulo="Barbearia" resumo={r.barbearia} />
      </div>
      {r.baixas.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold">Notas baixas para resolver</h3>
          <p className="text-sm text-tinta-suave">
            Nota 1 ou 2 no atendimento ou na barbearia. Vale uma conversa com o cliente; depois,
            marque como resolvida contando o que foi feito.
          </p>
          <ul className="flex flex-col gap-2" aria-label="Notas baixas">
            {r.baixas.map((c) => (
              <NotaBaixa key={c.id} c={c} />
            ))}
          </ul>
        </div>
      )}
      {r.comentarios.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold">Comentários recentes</h3>
          <ul className="grid gap-2 md:grid-cols-2" aria-label="Comentários recentes">
            {r.comentarios.map((c) => (
              <ComentarioDaPesquisa key={c.comandaId} c={c} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
