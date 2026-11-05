'use client';

import {
  formatarFracao,
  formatarMoeda,
  formatarNumero,
  lerMoeda,
  type MetaDetalhe,
  type RespostaLucratividade,
  type SituacaoProduto,
} from '@pente-fino/shared';
import { BarraMeta, Botao, Campo, Dialogo, EstadoVazio, Selecao } from '@pente-fino/ui';
import { ChartLine, Package, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import {
  chavesResultados,
  useAcao,
  useIndicadores,
  useLucratividade,
  useMetas,
  useServicos,
} from '@/lib/consultas';
import { limitesDoMes, mesAtual } from '@/lib/periodo';
import { Aviso } from '../aviso';
import { useApp } from '../contexto-app';
import { PainelIndicadores, SeletorMes } from '../indicadores';
import { CabecalhoPagina, Estado, Ficha, Tabela, td, th } from '../pagina';

export function TelaMetricas() {
  const { unidadeAtiva, papeis, unidades } = useApp();
  const ehDono = papeis.includes('dono');
  const [mes, setMes] = useState(mesAtual());
  const [de, ate] = limitesDoMes(mes);
  const indicadores = useIndicadores(unidadeAtiva, de, ate);
  const metas = useMetas(unidadeAtiva, mes);
  const lucro = useLucratividade(unidadeAtiva, de, ate);
  const [nova, setNova] = useState(false);
  const remover = useAcao(
    (id: string) => api(`metas/${id}`, { metodo: 'DELETE' }),
    [chavesResultados.metas],
  );
  const nomeUnidade = (id: string) => unidades.find((u) => u.id === id)?.nome ?? '';

  return (
    <div className="flex flex-col gap-8">
      <CabecalhoPagina
        titulo="Métricas e metas"
        pergunta="Bati a meta? O que dá mais lucro?"
        acao={<SeletorMes mes={mes} onMudar={setMes} />}
      />

      <section className="flex flex-col gap-4" aria-labelledby="titulo-metas">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="titulo-metas" className="text-xl font-semibold">
            Metas
          </h2>
          {ehDono && (
            <Botao variante="secundario" onClick={() => setNova(true)}>
              <Plus aria-hidden className="size-4" /> Definir meta
            </Botao>
          )}
        </div>
        <Estado consulta={metas}>
          {() =>
            metas.data!.length === 0 ? (
              <p className="text-tinta-suave">
                Nenhuma meta neste mês.
                {ehDono ? ' Defina o faturamento ou a quantidade de um serviço.' : ''}
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
                    {ehDono && (
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
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="titulo-indicadores">
        <h2 id="titulo-indicadores" className="text-xl font-semibold">
          Indicadores
        </h2>
        <Estado consulta={indicadores}>
          {() => (
            <PainelIndicadores
              atual={indicadores.data!.atual}
              anterior={indicadores.data!.anterior}
              projecao={indicadores.data!.projecao}
              rotuloAnterior="vs. mês anterior"
              origem="comandas fechadas no mês"
            />
          )}
        </Estado>
      </section>

      <Estado consulta={lucro}>
        {() => (
          <>
            <LucroServicos servicos={lucro.data!.servicos} />
            <LucroProdutos produtos={lucro.data!.produtos} />
          </>
        )}
      </Estado>
      {ehDono && <NovaMeta mes={mes} aberto={nova} onFechar={() => setNova(false)} />}
    </div>
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

// ─── Serviços: mais lucro e mais consumidos ───────────────────────────────

function LucroServicos({ servicos }: { servicos: RespostaLucratividade['servicos'] }) {
  const [ordem, setOrdem] = useState<'lucro' | 'quantidade'>('lucro');
  const total = servicos.reduce((soma, s) => soma + s.quantidade, 0);
  const lista = [...servicos].sort((a, b) =>
    ordem === 'lucro' ? b.lucro - a.lucro : b.quantidade - a.quantidade || b.lucro - a.lucro,
  );
  return (
    <section className="flex flex-col gap-4" aria-labelledby="titulo-lucro">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="titulo-lucro" className="text-xl font-semibold">
            Serviços: lucro e procura
          </h2>
          <p className="text-tinta-suave">
            Lucro = receita − (custo de produto + comissão). “Procura” é a fatia de cada serviço no
            total feito no mês.
          </p>
        </div>
        {servicos.length > 1 && (
          <Selecao
            id="servicos-ordem"
            rotulo="Ordenar por"
            value={ordem}
            onChange={(e) => setOrdem(e.target.value as typeof ordem)}
            opcoes={[
              { valor: 'lucro', rotulo: 'Mais lucro' },
              { valor: 'quantidade', rotulo: 'Mais consumidos' },
            ]}
            className="max-w-xs"
          />
        )}
      </div>
      {servicos.length === 0 ? (
        <EstadoVazio
          icone={ChartLine}
          titulo="Nenhum serviço fechado no mês"
          texto="Assim que as comandas forem fechadas, a margem e a procura de cada serviço aparecem aqui."
        />
      ) : (
        <Tabela rotulo="Lucro por serviço">
          <thead className="bg-superficie-2">
            <tr>
              <th className={th}>Serviço</th>
              <th className={`${th} text-right`}>Qtde</th>
              <th className={`${th} text-right`}>Procura</th>
              <th className={`${th} text-right`}>Receita</th>
              <th className={`${th} text-right`}>Custo de produto</th>
              <th className={`${th} text-right`}>Comissão</th>
              <th className={`${th} text-right`}>Lucro</th>
              <th className={`${th} text-right`}>Margem</th>
            </tr>
          </thead>
          <tbody className="font-denso tabular-nums">
            {lista.map((s) => (
              <tr key={s.servicoId} className="border-t border-borda">
                <td className={`${td} font-sans font-semibold`}>{s.nome}</td>
                <td className={`${td} text-right`}>{formatarNumero(s.quantidade)}</td>
                <td className={`${td} text-right`}>
                  {formatarFracao(total > 0 ? s.quantidade / total : 0, 0)}
                </td>
                <td className={`${td} text-right`}>{formatarMoeda(s.receita)}</td>
                <td className={`${td} text-right text-tinta-suave`}>
                  {formatarMoeda(s.custoProduto)}
                </td>
                <td className={`${td} text-right text-tinta-suave`}>{formatarMoeda(s.comissao)}</td>
                <td className={`${td} text-right font-semibold`}>{formatarMoeda(s.lucro)}</td>
                <td className={`${td} text-right`}>{formatarFracao(s.margem)}</td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      )}
    </section>
  );
}

// ─── Produtos: o que vende e o que vale a pena ────────────────────────────

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

function LucroProdutos({ produtos }: { produtos: RespostaLucratividade['produtos'] }) {
  const vendidos = produtos.filter((p) => p.quantidade > 0);
  const maisVendido = [...vendidos].sort((a, b) => b.quantidade - a.quantidade)[0];
  const maisLucro = vendidos[0];
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
    <section className="flex flex-col gap-4" aria-labelledby="titulo-produtos">
      <div>
        <h2 id="titulo-produtos" className="text-xl font-semibold">
          Produtos: o que vende e o que vale a pena
        </h2>
        <p className="text-tinta-suave">
          Cada produto comparado com os outros do mês: quanto sai e quanto sobra por unidade.
          “Retorno” é o lucro para cada R$ 1 gasto no estoque que foi vendido.
        </p>
      </div>
      {produtos.length === 0 ? (
        <EstadoVazio
          icone={Package}
          titulo="Nenhum produto cadastrado"
          texto="Cadastre os produtos com preço de venda e custo para ver o que vale a pena comprar de novo."
        />
      ) : (
        <>
          {vendidos.length > 0 && (
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
          <Tabela rotulo="Lucro por produto">
            <thead className="bg-superficie-2">
              <tr>
                <th className={th}>Produto</th>
                <th className={`${th} text-right`}>Vendidos</th>
                <th className={`${th} text-right`}>Receita</th>
                <th className={`${th} text-right`}>Lucro</th>
                <th className={`${th} text-right`}>Margem</th>
                <th className={`${th} text-right`}>Retorno</th>
                <th className={th}>Situação</th>
              </tr>
            </thead>
            <tbody className="font-denso tabular-nums">
              {produtos.map((p) => {
                const sit = SITUACAO_PRODUTO[p.situacao];
                return (
                  <tr key={p.produtoId} className="border-t border-borda">
                    <td className={`${td} font-sans font-semibold`}>{p.nome}</td>
                    <td className={`${td} text-right`}>{formatarNumero(p.quantidade)}</td>
                    <td className={`${td} text-right`}>{formatarMoeda(p.receita)}</td>
                    <td className={`${td} text-right font-semibold`}>{formatarMoeda(p.lucro)}</td>
                    <td className={`${td} text-right`}>
                      {p.quantidade > 0 ? formatarFracao(p.margem) : '—'}
                    </td>
                    <td className={`${td} text-right`}>
                      {p.retornoSobreCusto === null
                        ? '—'
                        : formatarMoeda(Math.round(p.retornoSobreCusto * 100))}
                    </td>
                    <td className={`${td} font-sans`}>
                      <span className="flex flex-col items-start gap-1">
                        <Ficha tom={sit.tom}>{sit.rotulo}</Ficha>
                        <span className="text-xs text-tinta-suave">{sit.dica}</span>
                      </span>
                    </td>
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
