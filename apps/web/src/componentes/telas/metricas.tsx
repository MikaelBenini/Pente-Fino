'use client';

import {
  formatarFracao,
  formatarMoeda,
  formatarNumero,
  lerMoeda,
  type MetaDetalhe,
} from '@pente-fino/shared';
import { BarraMeta, Botao, Campo, Dialogo, EstadoVazio, Selecao } from '@pente-fino/ui';
import { ChartLine, Plus, Trash2 } from 'lucide-react';
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
import { CabecalhoPagina, Estado, Tabela, td, th } from '../pagina';

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

      <section className="flex flex-col gap-4" aria-labelledby="titulo-lucro">
        <div>
          <h2 id="titulo-lucro" className="text-xl font-semibold">
            Lucro por serviço
          </h2>
          <p className="text-tinta-suave">
            Receita − (custo de produto + comissão), do maior lucro para o menor.
          </p>
        </div>
        <Estado consulta={lucro}>
          {() =>
            lucro.data!.servicos.length === 0 ? (
              <EstadoVazio
                icone={ChartLine}
                titulo="Nenhum serviço fechado no mês"
                texto="Assim que as comandas forem fechadas, a margem de cada serviço aparece aqui."
              />
            ) : (
              <Tabela rotulo="Lucro por serviço">
                <thead className="bg-superficie-2">
                  <tr>
                    <th className={th}>Serviço</th>
                    <th className={`${th} text-right`}>Qtde</th>
                    <th className={`${th} text-right`}>Receita</th>
                    <th className={`${th} text-right`}>Custo de produto</th>
                    <th className={`${th} text-right`}>Comissão</th>
                    <th className={`${th} text-right`}>Lucro</th>
                    <th className={`${th} text-right`}>Margem</th>
                  </tr>
                </thead>
                <tbody className="font-denso tabular-nums">
                  {lucro.data!.servicos.map((s) => (
                    <tr key={s.servicoId} className="border-t border-borda">
                      <td className={`${td} font-sans font-semibold`}>{s.nome}</td>
                      <td className={`${td} text-right`}>{formatarNumero(s.quantidade)}</td>
                      <td className={`${td} text-right`}>{formatarMoeda(s.receita)}</td>
                      <td className={`${td} text-right text-tinta-suave`}>
                        {formatarMoeda(s.custoProduto)}
                      </td>
                      <td className={`${td} text-right text-tinta-suave`}>
                        {formatarMoeda(s.comissao)}
                      </td>
                      <td className={`${td} text-right font-semibold`}>{formatarMoeda(s.lucro)}</td>
                      <td className={`${td} text-right`}>{formatarFracao(s.margem)}</td>
                    </tr>
                  ))}
                </tbody>
              </Tabela>
            )
          }
        </Estado>
      </section>
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
