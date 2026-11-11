'use client';

import {
  formatarData,
  formatarFracao,
  formatarMoeda,
  GRUPOS_DESPESA,
  GRUPOS_FORA_OPERACIONAL,
  lerMoeda,
  NOME_GRUPO_DESPESA,
  valorParaCampo,
  type DespesaDetalhe,
  type ResumoComissao,
} from '@pente-fino/shared';
import {
  Abas,
  Botao,
  Campo,
  Dialogo,
  EstadoVazio,
  Marcador,
  ModalConfirmacao,
  Selecao,
} from '@pente-fino/ui';
import { Coins, FileSpreadsheet, FileText, Plus, ReceiptText } from 'lucide-react';
import { useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import {
  chavesResultados,
  useAcao,
  useCategoriasDespesa,
  useDespesas,
  useExtrato,
  useIndicadores,
  useResumoComissoes,
} from '@/lib/consultas';
import { limitesDoMes, mesAtual } from '@/lib/periodo';
import { Aviso } from '../aviso';
import { useApp } from '../contexto-app';
import { SeletorMes } from '../indicadores';
import { CabecalhoPagina, Estado, Ficha, Tabela, td, th } from '../pagina';
import { SoNoPlano } from '../convite-plano';

const mensagemDe = (e: unknown) =>
  e instanceof ErroApi ? (e.campos[0]?.mensagem ?? e.message) : 'Não foi possível concluir.';

export function TelaFinanceiro() {
  const [mes, setMes] = useState(mesAtual());
  const [aba, setAba] = useState('resultado');
  return (
    <div className="flex flex-col gap-8">
      <CabecalhoPagina
        titulo="Financeiro"
        pergunta="Quanto sobrou?"
        acao={<SeletorMes mes={mes} onMudar={setMes} />}
      />
      <Exportar mes={mes} />
      <Abas
        rotulo="Financeiro"
        atual={aba}
        onTrocar={setAba}
        abas={[
          { id: 'resultado', rotulo: 'Resultado do mês', conteudo: <Resultado mes={mes} /> },
          { id: 'despesas', rotulo: 'Despesas', conteudo: <Despesas mes={mes} /> },
          {
            id: 'comissoes',
            rotulo: 'Comissões',
            conteudo: (
              <SoNoPlano recurso="comissoes">
                <Comissoes mes={mes} />
              </SoNoPlano>
            ),
          },
        ]}
      />
    </div>
  );
}

function Exportar({ mes }: { mes: string }) {
  const { unidadeAtiva } = useApp();
  const unidade = unidadeAtiva !== 'todas' ? `&unidadeId=${unidadeAtiva}` : '';
  const classe =
    'inline-flex min-h-11 items-center gap-2 rounded-md border border-borda bg-superficie-2 px-4 font-semibold hover:bg-superficie-3 focus-visible:outline-2 focus-visible:outline-foco';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-tinta-suave">Para o contador:</span>
      <a href={`/api/exportacao?mes=${mes}&formato=csv${unidade}`} className={classe}>
        <FileSpreadsheet aria-hidden className="size-4" /> Planilha do mês (CSV)
      </a>
      <a href={`/api/exportacao?mes=${mes}&formato=pdf${unidade}`} className={classe}>
        <FileText aria-hidden className="size-4" /> Resumo (PDF)
      </a>
    </div>
  );
}

// ─── Resultado (demonstrativo simples) ────────────────────────────────────

function Resultado({ mes }: { mes: string }) {
  const { unidadeAtiva } = useApp();
  const [de, ate] = limitesDoMes(mes);
  const r = useIndicadores(unidadeAtiva, de, ate);
  return (
    <Estado consulta={r}>
      {() => {
        const i = r.data!.atual;
        const linha = (
          rotulo: string,
          valor: number,
          opcoes: { forte?: boolean; recuo?: boolean; sinal?: '−' } = {},
        ) => (
          <div
            key={rotulo}
            className={`flex justify-between gap-6 py-2 ${opcoes.forte ? 'border-t border-borda text-xl font-bold' : ''} ${opcoes.recuo ? 'pl-4 text-tinta-suave' : ''}`}
          >
            <dt>{rotulo}</dt>
            <dd className="font-denso tabular-nums">
              {opcoes.sinal ? `−${formatarMoeda(valor)}` : formatarMoeda(valor)}
            </dd>
          </div>
        );
        return (
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="flex flex-col rounded-lg border border-borda bg-superficie px-5 py-3 text-lg">
              <dl className="flex flex-col">
                {linha('Serviços', i.receitaServicos)}
                {linha('Produtos', i.receitaProdutos)}
                {i.receitaClube > 0 && linha('Clube (mensalidades)', i.receitaClube)}
                {linha('Faturamento', i.faturamento, { forte: true })}
                {linha('Comissões', i.comissoes, { sinal: '−', recuo: true })}
                {linha('Fixas', i.despesasPorGrupo.fixa, { sinal: '−', recuo: true })}
                {linha('Variáveis', i.despesasPorGrupo.variavel, { sinal: '−', recuo: true })}
                {linha('Manutenção', i.despesasPorGrupo.manutencao, { sinal: '−', recuo: true })}
                {linha('Lucro do mês', i.lucro, { forte: true })}
              </dl>
              <p className="pt-1 text-sm text-tinta-suave">
                Custos operacionais: {formatarFracao(i.percentualDespesas)} do faturamento
                (comissões {formatarFracao(i.percentualComissoes)} · despesas{' '}
                {formatarFracao(Math.max(0, i.percentualDespesas - i.percentualComissoes))}).
              </p>
            </div>
            <div className="flex flex-col self-start rounded-lg border border-borda bg-superficie px-5 py-3 text-lg">
              <p className="py-2 text-xs font-semibold uppercase tracking-wider text-tinta-suave">
                Fora do resultado operacional
              </p>
              <dl className="flex flex-col">
                {GRUPOS_FORA_OPERACIONAL.map((g) =>
                  linha(NOME_GRUPO_DESPESA[g], i.despesasPorGrupo[g]),
                )}
                {linha('Receita não operacional', i.receitaNaoOperacional)}
              </dl>
              <p className="pt-1 text-sm text-tinta-suave">
                Investimento, retirada do dono e cartão aparecem aqui para o caixa da casa, mas não
                entram no % de despesas.
              </p>
            </div>
          </div>
        );
      }}
    </Estado>
  );
}

// ─── Despesas ─────────────────────────────────────────────────────────────

function Despesas({ mes }: { mes: string }) {
  const { unidadeAtiva, unidades } = useApp();
  const despesas = useDespesas(unidadeAtiva, mes);
  const [editando, setEditando] = useState<DespesaDetalhe | 'nova' | null>(null);
  const [excluir, setExcluir] = useState<DespesaDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const invalidar = [chavesResultados.despesas, chavesResultados.indicadores];
  const pagar = useAcao(
    (d: DespesaDetalhe) => api(`despesas/${d.id}`, { metodo: 'PATCH', corpo: { pago: !d.pago } }),
    invalidar,
  );
  const apagar = useAcao((id: string) => api(`despesas/${id}`, { metodo: 'DELETE' }), invalidar);
  const nomeUnidade = (id: string | null) =>
    id === null ? 'Rede' : (unidades.find((u) => u.id === id)?.nome ?? '');

  return (
    <Estado consulta={despesas}>
      {() => {
        const lista = despesas.data!;
        const total = lista.reduce((s, d) => s + d.valor, 0);
        const aPagar = lista.filter((d) => !d.pago).reduce((s, d) => s + d.valor, 0);
        return (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-denso text-lg tabular-nums text-tinta-suave">
                Total <span className="text-tinta">{formatarMoeda(total)}</span> · a pagar{' '}
                <span className="text-tinta">{formatarMoeda(aPagar)}</span>
              </p>
              <Botao onClick={() => setEditando('nova')}>
                <Plus aria-hidden className="size-5" /> Nova despesa
              </Botao>
            </div>
            {erro && <Aviso tom="erro">{erro}</Aviso>}
            {lista.length === 0 ? (
              <EstadoVazio
                icone={ReceiptText}
                titulo="Nenhuma despesa neste mês"
                texto="Lance aluguel, energia, produtos e o resto. O % de despesas e o lucro do mês saem daqui."
              />
            ) : (
              <Tabela rotulo="Despesas do mês">
                <thead className="bg-superficie-2">
                  <tr>
                    <th className={th}>Despesa</th>
                    <th className={th}>Grupo</th>
                    <th className={th}>Unidade</th>
                    <th className={`${th} text-right`}>Valor</th>
                    <th className={th}>Situação</th>
                    <th className={th}>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((d) => (
                    <tr key={d.id} className="border-t border-borda">
                      <td className={td}>
                        <span className="block font-semibold">{d.descricao}</span>
                        <span className="block text-sm text-tinta-suave">
                          {d.categoria}
                          {d.vencimento
                            ? ` · vence ${formatarData(`${d.vencimento}T12:00:00Z`)}`
                            : ''}
                        </span>
                      </td>
                      <td className={`${td} text-sm`}>{NOME_GRUPO_DESPESA[d.grupo]}</td>
                      <td className={`${td} text-sm text-tinta-suave`}>
                        {nomeUnidade(d.unidadeId)}
                      </td>
                      <td className={`${td} text-right font-denso text-lg tabular-nums`}>
                        {formatarMoeda(d.valor)}
                      </td>
                      <td className={td}>
                        {d.pago ? (
                          <Ficha tom="acao">Paga</Ficha>
                        ) : (
                          <Ficha tom="aviso">A pagar</Ficha>
                        )}
                      </td>
                      <td className={`${td} whitespace-nowrap text-right`}>
                        <Botao
                          variante="fantasma"
                          onClick={async () => {
                            setErro(null);
                            try {
                              await pagar.mutateAsync(d);
                            } catch (e) {
                              setErro(mensagemDe(e));
                            }
                          }}
                        >
                          {d.pago ? 'Desmarcar' : 'Marcar paga'}
                        </Botao>
                        <Botao variante="fantasma" onClick={() => setEditando(d)}>
                          Editar
                        </Botao>
                        <Botao variante="fantasma" onClick={() => setExcluir(d)}>
                          Excluir
                        </Botao>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Tabela>
            )}
            <FormDespesa mes={mes} despesa={editando} onFechar={() => setEditando(null)} />
            <ModalConfirmacao
              aberto={excluir !== null}
              titulo={`Excluir "${excluir?.descricao ?? ''}"?`}
              descricao={`${formatarMoeda(excluir?.valor ?? 0)} sai das despesas do mês. A exclusão fica registrada.`}
              textoConfirmar="Excluir"
              tom="perigo"
              onCancelar={() => setExcluir(null)}
              onConfirmar={async () => {
                setErro(null);
                try {
                  await apagar.mutateAsync(excluir!.id);
                } catch (e) {
                  setErro(mensagemDe(e));
                }
                setExcluir(null);
              }}
            />
          </div>
        );
      }}
    </Estado>
  );
}

function FormDespesa({
  mes,
  despesa,
  onFechar,
}: {
  mes: string;
  despesa: DespesaDetalhe | 'nova' | null;
  onFechar: () => void;
}) {
  const { usuario, unidades, unidadeAtiva } = useApp();
  const categorias = useCategoriasDespesa();
  const atual = despesa && despesa !== 'nova' ? despesa : null;
  const ehDonoRede = usuario.papeis.some((p) => p.papel === 'dono' && p.unidadeId === null);
  const unidadesPermitidas = unidades.filter(
    (u) => ehDonoRede || usuario.papeis.some((p) => p.papel === 'gestor' && p.unidadeId === u.id),
  );
  const inicial = atual
    ? {
        descricao: atual.descricao,
        categoriaId: atual.categoriaId,
        unidadeId: atual.unidadeId ?? '',
        valor: valorParaCampo(atual.valor),
        vencimento: atual.vencimento ?? '',
        pago: atual.pago,
      }
    : {
        descricao: '',
        categoriaId: '',
        unidadeId:
          unidadeAtiva !== 'todas'
            ? unidadeAtiva
            : ehDonoRede
              ? ''
              : (unidadesPermitidas[0]?.id ?? ''),
        valor: '',
        vencimento: '',
        pago: false,
      };
  const [f, setF] = useState<typeof inicial | null>(null);
  const v = f ?? inicial;
  const [erro, setErro] = useState<string | null>(null);
  const salvar = useAcao(
    (corpo: object) =>
      atual ? api(`despesas/${atual.id}`, { metodo: 'PATCH', corpo }) : api('despesas', { corpo }),
    [chavesResultados.despesas, chavesResultados.indicadores],
  );
  const categoria = categorias.data?.find(
    (c) => c.id === (v.categoriaId || categorias.data?.[0]?.id),
  );
  function fechar() {
    setF(null);
    setErro(null);
    onFechar();
  }
  return (
    <Dialogo
      aberto={despesa !== null}
      titulo={atual ? 'Editar despesa' : 'Nova despesa'}
      onFechar={fechar}
    >
      <form
        method="post"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setErro(null);
          const valor = lerMoeda(v.valor);
          if (!valor || valor <= 0) return setErro('Informe o valor. Ex.: 1.250,00');
          try {
            await salvar.mutateAsync({
              descricao: v.descricao,
              categoriaId: v.categoriaId || categorias.data?.[0]?.id,
              unidadeId: v.unidadeId || null,
              valor,
              competencia: atual?.competencia ?? mes,
              vencimento: v.vencimento || null,
              pago: v.pago,
            });
            fechar();
          } catch (er) {
            setErro(mensagemDe(er));
          }
        }}
      >
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <Campo
          id="despesa-descricao"
          rotulo="Descrição"
          value={v.descricao}
          onChange={(e) => setF({ ...v, descricao: e.target.value })}
        />
        <Selecao
          id="despesa-categoria"
          rotulo="Categoria"
          value={v.categoriaId || categorias.data?.[0]?.id || ''}
          onChange={(e) => setF({ ...v, categoriaId: e.target.value })}
          opcoes={GRUPOS_DESPESA.flatMap((g) =>
            (categorias.data ?? [])
              .filter((c) => c.grupo === g)
              .map((c) => ({ valor: c.id, rotulo: `${NOME_GRUPO_DESPESA[g]} · ${c.nome}` })),
          )}
          dica={
            categoria &&
            GRUPOS_FORA_OPERACIONAL.includes(
              categoria.grupo as (typeof GRUPOS_FORA_OPERACIONAL)[number],
            )
              ? 'Fica fora do % de despesas operacionais.'
              : undefined
          }
        />
        <Selecao
          id="despesa-unidade"
          rotulo="Unidade"
          value={v.unidadeId}
          onChange={(e) => setF({ ...v, unidadeId: e.target.value })}
          opcoes={[
            ...(ehDonoRede ? [{ valor: '', rotulo: 'Rede inteira' }] : []),
            ...unidadesPermitidas.map((u) => ({ valor: u.id, rotulo: u.nome })),
          ]}
        />
        <div className="grid grid-cols-2 gap-4">
          <Campo
            id="despesa-valor"
            rotulo="Valor (R$)"
            inputMode="decimal"
            value={v.valor}
            onChange={(e) => setF({ ...v, valor: e.target.value })}
          />
          <Campo
            id="despesa-vencimento"
            rotulo="Vencimento"
            type="date"
            value={v.vencimento}
            onChange={(e) => setF({ ...v, vencimento: e.target.value })}
          />
        </div>
        <Marcador
          id="despesa-paga"
          rotulo="Já foi paga"
          checked={v.pago}
          onChange={(e) => setF({ ...v, pago: e.target.checked })}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Botao variante="secundario" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={salvar.isPending}>
            {atual ? 'Salvar' : 'Lançar despesa'}
          </Botao>
        </div>
      </form>
    </Dialogo>
  );
}

// ─── Comissões ────────────────────────────────────────────────────────────

function Comissoes({ mes }: { mes: string }) {
  const { unidadeAtiva } = useApp();
  const [de, ate] = limitesDoMes(mes);
  const resumo = useResumoComissoes(unidadeAtiva, de, ate);
  const [extrato, setExtrato] = useState<ResumoComissao | null>(null);
  const [pagar, setPagar] = useState<ResumoComissao | null>(null);
  return (
    <Estado consulta={resumo}>
      {() =>
        resumo.data!.length === 0 ? (
          <EstadoVazio
            icone={Coins}
            titulo="Nenhuma comissão no mês"
            texto="A comissão de cada item entra quando a recepção fecha a comanda."
          />
        ) : (
          <>
            <Tabela rotulo="Comissões por barbeiro">
              <thead className="bg-superficie-2">
                <tr>
                  <th className={th}>Barbeiro</th>
                  <th className={`${th} text-right`}>Previsto</th>
                  <th className={`${th} text-right`}>Fechado</th>
                  <th className={`${th} text-right`}>Pago</th>
                  <th className={`${th} text-right`}>A receber</th>
                  <th className={th}>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="font-denso text-lg tabular-nums">
                {resumo.data!.map((r) => (
                  <tr key={r.profissionalId} className="border-t border-borda">
                    <td className={`${td} font-sans font-semibold`}>{r.nome}</td>
                    <td className={`${td} text-right text-tinta-suave`}>
                      {formatarMoeda(r.previsto)}
                    </td>
                    <td className={`${td} text-right`}>{formatarMoeda(r.fechado)}</td>
                    <td className={`${td} text-right text-tinta-suave`}>{formatarMoeda(r.pago)}</td>
                    <td className={`${td} text-right font-semibold`}>
                      {formatarMoeda(r.aReceber)}
                    </td>
                    <td className={`${td} whitespace-nowrap text-right font-sans`}>
                      <Botao variante="fantasma" onClick={() => setExtrato(r)}>
                        Extrato
                      </Botao>
                      <Botao
                        variante="fantasma"
                        disabled={r.aReceber === 0}
                        onClick={() => setPagar(r)}
                      >
                        Registrar pagamento
                      </Botao>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
            <p className="text-sm text-tinta-suave">
              Previsto: comandas ainda abertas, pela regra de hoje. Fechado: comandas fechadas no
              mês. A receber: fechado menos o que já foi pago.
            </p>
            <Extrato resumo={extrato} de={de} ate={ate} onFechar={() => setExtrato(null)} />
            <RegistrarPagamento resumo={pagar} de={de} ate={ate} onFechar={() => setPagar(null)} />
          </>
        )
      }
    </Estado>
  );
}

export function TabelaExtrato({
  itens,
}: {
  itens: {
    comandaId: string;
    fechadaEm: string;
    cliente: string | null;
    descricao: string;
    valor: number;
    comissao: number;
  }[];
}) {
  if (itens.length === 0)
    return <p className="text-tinta-suave">Nenhum item fechado no período.</p>;
  return (
    <Tabela rotulo="Extrato de comissões">
      <thead className="bg-superficie-2">
        <tr>
          <th className={th}>Data</th>
          <th className={th}>Cliente</th>
          <th className={th}>Item</th>
          <th className={`${th} text-right`}>Valor</th>
          <th className={`${th} text-right`}>Comissão</th>
        </tr>
      </thead>
      <tbody className="font-denso tabular-nums">
        {itens.map((i, k) => (
          <tr key={`${i.comandaId}-${k}`} className="border-t border-borda">
            <td className={td}>{formatarData(i.fechadaEm)}</td>
            <td className={`${td} font-sans`}>{i.cliente ?? '—'}</td>
            <td className={`${td} font-sans`}>{i.descricao}</td>
            <td className={`${td} text-right text-tinta-suave`}>{formatarMoeda(i.valor)}</td>
            <td className={`${td} text-right font-semibold`}>{formatarMoeda(i.comissao)}</td>
          </tr>
        ))}
      </tbody>
    </Tabela>
  );
}

function Extrato({
  resumo,
  de,
  ate,
  onFechar,
}: {
  resumo: ResumoComissao | null;
  de: string;
  ate: string;
  onFechar: () => void;
}) {
  const extrato = useExtrato(resumo?.profissionalId ?? null, de, ate);
  return (
    <Dialogo
      aberto={resumo !== null}
      titulo={`Extrato de ${resumo?.nome ?? ''}`}
      onFechar={onFechar}
      largura="larga"
    >
      <Estado consulta={extrato}>{() => <TabelaExtrato itens={extrato.data!.itens} />}</Estado>
    </Dialogo>
  );
}

function RegistrarPagamento({
  resumo,
  de,
  ate,
  onFechar,
}: {
  resumo: ResumoComissao | null;
  de: string;
  ate: string;
  onFechar: () => void;
}) {
  const [valor, setValor] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const pagar = useAcao(
    (corpo: object) => api('comissoes/pagamentos', { corpo }),
    [chavesResultados.comissoes],
  );
  const v = valor ?? (resumo ? valorParaCampo(resumo.aReceber) : '');
  function fechar() {
    setValor(null);
    setErro(null);
    onFechar();
  }
  return (
    <Dialogo
      aberto={resumo !== null}
      titulo={`Pagar comissão de ${resumo?.nome ?? ''}`}
      descricao={`Falta pagar ${formatarMoeda(resumo?.aReceber ?? 0)} no mês.`}
      onFechar={fechar}
    >
      <form
        method="post"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setErro(null);
          const centavos = lerMoeda(v);
          if (!centavos || centavos <= 0) return setErro('Informe o valor pago.');
          try {
            await pagar.mutateAsync({
              profissionalId: resumo!.profissionalId,
              periodoInicio: de,
              periodoFim: ate,
              valor: centavos,
            });
            fechar();
          } catch (er) {
            setErro(mensagemDe(er));
          }
        }}
      >
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <Campo
          id="pagar-valor"
          rotulo="Valor pago (R$)"
          inputMode="decimal"
          value={v}
          onChange={(e) => setValor(e.target.value)}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Botao variante="secundario" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={pagar.isPending}>
            Registrar pagamento
          </Botao>
        </div>
      </form>
    </Dialogo>
  );
}
