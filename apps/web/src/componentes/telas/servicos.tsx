'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  dataLocal,
  formatarData,
  formatarMoeda,
  lerMoeda,
  servicoSchema,
  temAlgumPapel,
  valorParaCampo,
  type ServicoDetalhe,
} from '@pente-fino/shared';
import {
  Abas,
  Botao,
  Campo,
  CampoQuantidade,
  Dialogo,
  EstadoVazio,
  Marcador,
  TabelaEditavel,
  type LinhaEditavel,
} from '@pente-fino/ui';
import { Plus, Scissors } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { api } from '@/lib/api';
import { chaves, useAcao, usePrecos, useServicos, useUnidadesDetalhe } from '@/lib/consultas';
import { aplicarErroDaApi } from '@/lib/formularios';
import { Aviso } from '../aviso';
import { useApp } from '../contexto-app';
import { CabecalhoPagina, Estado, Ficha, Tabela, td, th } from '../pagina';

export function TelaServicos() {
  const { papeis } = useApp();
  const ehDono = papeis.includes('dono');
  const [aba, setAba] = useState('catalogo');
  return (
    <div className="flex flex-col gap-8">
      <CabecalhoPagina
        titulo="Serviços"
        pergunta="Quanto custa cada serviço e quanto sobra dele?"
      />
      <Abas
        rotulo="Serviços"
        atual={aba}
        onTrocar={setAba}
        abas={[
          { id: 'catalogo', rotulo: 'Catálogo', conteudo: <Catalogo podeEditar={ehDono} /> },
          { id: 'precos', rotulo: 'Tabela de preços', conteudo: <Precos podeEditar={ehDono} /> },
        ]}
      />
    </div>
  );
}

// ─── Catálogo ─────────────────────────────────────────────────────────────

function Catalogo({ podeEditar }: { podeEditar: boolean }) {
  const servicos = useServicos();
  const [editando, setEditando] = useState<ServicoDetalhe | 'novo' | null>(null);
  const verCusto = temAlgumPapel(useApp().usuario.papeis, ['dono', 'gestor']);

  return (
    <Estado consulta={servicos}>
      {() => (
        <div className="flex flex-col gap-4">
          {podeEditar && (
            <Botao className="self-start" onClick={() => setEditando('novo')}>
              <Plus aria-hidden className="size-5" /> Novo serviço
            </Botao>
          )}
          {servicos.data!.length === 0 ? (
            <EstadoVazio
              icone={Scissors}
              titulo="Cadastre seu primeiro serviço"
              texto="Duração, custo de produto, se é extra e quanto pesa em atendimentos. Depois, defina o preço em cada unidade."
            />
          ) : (
            <Tabela rotulo="Serviços cadastrados">
              <thead className="bg-superficie-2">
                <tr>
                  <th className={th}>Serviço</th>
                  <th className={th}>Categoria</th>
                  <th className={`${th} text-right`}>Duração</th>
                  {verCusto && <th className={`${th} text-right`}>Custo de produto</th>}
                  <th className={th}>Tipo</th>
                  <th className={`${th} text-right`}>Atendimentos</th>
                  {podeEditar && (
                    <th className={th}>
                      <span className="sr-only">Ações</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {servicos.data!.map((s) => (
                  <tr key={s.id} className="border-t border-borda">
                    <td className={`${td} font-semibold`}>
                      {s.nome} {!s.ativo && <Ficha tom="neutro">Inativo</Ficha>}
                    </td>
                    <td className={`${td} text-tinta-suave`}>{s.categoria ?? '—'}</td>
                    <td className={`${td} text-right font-denso tabular-nums`}>
                      {s.duracaoMin} min
                    </td>
                    {verCusto && (
                      <td className={`${td} text-right font-denso tabular-nums`}>
                        {formatarMoeda(s.custoProduto)}
                      </td>
                    )}
                    <td className={td}>
                      {s.ehExtra ? (
                        <Ficha tom="aviso">Extra</Ficha>
                      ) : (
                        <Ficha tom="neutro">Principal</Ficha>
                      )}
                    </td>
                    <td className={`${td} text-right font-denso tabular-nums`}>
                      {s.pesoAtendimento}
                    </td>
                    {podeEditar && (
                      <td className={`${td} text-right`}>
                        <Botao
                          variante="fantasma"
                          onClick={() => setEditando(s)}
                          aria-label={`Editar ${s.nome}`}
                        >
                          Editar
                        </Botao>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Tabela>
          )}
          <FormularioServico servico={editando} onFechar={() => setEditando(null)} />
        </div>
      )}
    </Estado>
  );
}

const formServico = servicoSchema.extend({ custoTexto: z.string() }).omit({ custoProduto: true });
type FormServico = z.input<typeof formServico>;

function FormularioServico({
  servico,
  onFechar,
}: {
  servico: ServicoDetalhe | 'novo' | null;
  onFechar: () => void;
}) {
  const novo = servico === 'novo';
  const atual = servico && servico !== 'novo' ? servico : null;
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const salvar = useAcao(
    (d: Omit<ServicoDetalhe, 'id'>) =>
      atual
        ? api(`servicos/${atual.id}`, { metodo: 'PATCH', corpo: d })
        : api('servicos', { corpo: d }),
    [chaves.servicos],
  );
  const { register, handleSubmit, setError, control, setValue, formState } = useForm<FormServico>({
    resolver: zodResolver(formServico),
    values: atual
      ? {
          ...atual,
          categoria: atual.categoria ?? '',
          custoTexto: valorParaCampo(atual.custoProduto),
        }
      : {
          nome: '',
          categoria: '',
          duracaoMin: 30,
          custoTexto: '0,00',
          ehExtra: false,
          pesoAtendimento: 1,
          ativo: true,
        },
  });
  const ehExtra = useWatch({ control, name: 'ehExtra' });

  const enviar = handleSubmit(async ({ custoTexto, ...d }) => {
    setErroGeral(null);
    const custoProduto = lerMoeda(custoTexto);
    if (custoProduto === null || custoProduto < 0)
      return setError('custoTexto', { message: 'Valor inválido. Ex.: 1,50' });
    try {
      await salvar.mutateAsync({
        ...d,
        categoria: d.categoria || null,
        custoProduto,
        ativo: d.ativo ?? true,
      } as Omit<ServicoDetalhe, 'id'>);
      onFechar();
    } catch (e) {
      setErroGeral(aplicarErroDaApi(e, setError));
    }
  });

  return (
    <Dialogo
      aberto={servico !== null}
      titulo={novo ? 'Novo serviço' : `Editar ${atual?.nome ?? ''}`}
      onFechar={onFechar}
    >
      <form method="post" noValidate onSubmit={enviar} className="flex flex-col gap-4">
        {erroGeral && <Aviso tom="erro">{erroGeral}</Aviso>}
        <Campo
          id="servico-nome"
          rotulo="Nome"
          erro={formState.errors.nome?.message}
          {...register('nome')}
        />
        <Campo
          id="servico-categoria"
          rotulo="Categoria"
          dica="Ex.: Cabelo, Barba, Química"
          {...register('categoria')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="duracaoMin"
            render={({ field, fieldState }) => (
              <CampoQuantidade
                id="servico-duracao"
                rotulo="Duração (minutos)"
                nomeBotoes="duração"
                min={5}
                max={600}
                passo={5}
                valor={field.value ?? null}
                onMudar={field.onChange}
                erro={fieldState.error?.message}
              />
            )}
          />
          <Campo
            id="servico-custo"
            rotulo="Custo de produto (R$)"
            inputMode="decimal"
            dica="Gasto em produto por atendimento"
            erro={formState.errors.custoTexto?.message}
            {...register('custoTexto')}
          />
        </div>
        <Marcador
          id="servico-extra"
          rotulo="É extra (sobrancelha, hidratação…): conta nos indicadores de extras"
          checked={!!ehExtra}
          onChange={(e) => {
            setValue('ehExtra', e.target.checked);
            setValue('pesoAtendimento', e.target.checked ? 0 : 1);
          }}
        />
        <Controller
          control={control}
          name="pesoAtendimento"
          render={({ field, fieldState }) => (
            <CampoQuantidade
              id="servico-peso"
              rotulo="Peso em atendimentos"
              nomeBotoes="peso"
              dica="Principal 1, extra 0, combo soma os inclusos (corte + barba = 2)"
              min={0}
              max={10}
              valor={field.value ?? null}
              onMudar={field.onChange}
              erro={fieldState.error?.message}
            />
          )}
        />
        {!novo && (
          <Marcador
            id="servico-ativo"
            rotulo="Ativo (aparece na agenda e na comanda)"
            {...register('ativo')}
          />
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Botao variante="secundario" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={formState.isSubmitting}>
            {novo ? 'Cadastrar serviço' : 'Salvar'}
          </Botao>
        </div>
      </form>
    </Dialogo>
  );
}

// ─── Preços ───────────────────────────────────────────────────────────────

function Precos({ podeEditar }: { podeEditar: boolean }) {
  const { unidadeAtiva } = useApp();
  const servicos = useServicos();
  const unidades = useUnidadesDetalhe();
  const precos = usePrecos();
  const consulta = {
    isPending: servicos.isPending || unidades.isPending || precos.isPending,
    isError: servicos.isError || unidades.isError || precos.isError,
    error: servicos.error ?? unidades.error ?? precos.error,
    refetch: () => Promise.all([servicos.refetch(), unidades.refetch(), precos.refetch()]),
  };
  return (
    <Estado consulta={consulta}>
      {() => (
        <TabelaPrecosEditavel
          servicos={servicos.data!.filter((s) => s.ativo)}
          unidades={unidades.data!.filter(
            (u) => u.ativa && (unidadeAtiva === 'todas' || u.id === unidadeAtiva),
          )}
          tabela={precos.data!}
          podeEditar={podeEditar}
        />
      )}
    </Estado>
  );
}

function TabelaPrecosEditavel({
  servicos,
  unidades,
  tabela,
  podeEditar,
}: {
  servicos: ServicoDetalhe[];
  unidades: { id: string; nome: string }[];
  tabela: NonNullable<ReturnType<typeof usePrecos>['data']>;
  podeEditar: boolean;
}) {
  const original = useMemo<LinhaEditavel[]>(
    () =>
      servicos.map((s) => ({
        servico: s.nome,
        ...Object.fromEntries(
          unidades.map((u) => {
            const p = tabela.vigentes.find((v) => v.servicoId === s.id && v.unidadeId === u.id);
            return [u.id, p ? valorParaCampo(p.valor) : ''];
          }),
        ),
      })),
    [servicos, unidades, tabela],
  );
  const [linhas, setLinhas] = useState<LinhaEditavel[] | null>(null);
  const atuais = linhas ?? original;
  const [vigencia, setVigencia] = useState(dataLocal(new Date()));
  const [mensagem, setMensagem] = useState<{ tom: 'erro' | 'sucesso'; texto: string } | null>(null);
  const salvar = useAcao((corpo: object) => api('precos', { corpo }), [chaves.precos]);

  const mudancas: { servicoId: string; unidadeId: string; valor: number }[] = [];
  const invalidos: string[] = [];
  atuais.forEach((l, i) => {
    for (const u of unidades) {
      const texto = (l[u.id] ?? '').trim();
      if (texto === (original[i]?.[u.id] ?? '')) continue;
      if (texto === '') continue;
      const valor = lerMoeda(texto);
      if (valor === null || valor < 0) invalidos.push(`${servicos[i]?.nome} em ${u.nome}`);
      else mudancas.push({ servicoId: servicos[i]!.id, unidadeId: u.id, valor });
    }
  });

  async function enviar() {
    setMensagem(null);
    try {
      await salvar.mutateAsync({ vigenciaInicio: vigencia, precos: mudancas });
      setLinhas(null);
      setMensagem({
        tom: 'sucesso',
        texto: `${mudancas.length} ${mudancas.length === 1 ? 'preço gravado' : 'preços gravados'}, valendo a partir de ${formatarData(`${vigencia}T12:00:00Z`)}.`,
      });
    } catch (e) {
      setMensagem({
        tom: 'erro',
        texto: e instanceof Error ? e.message : 'Não foi possível gravar.',
      });
    }
  }

  if (servicos.length === 0) {
    return (
      <EstadoVazio
        icone={Scissors}
        titulo="Sem serviços ainda"
        texto="Cadastre os serviços no catálogo; depois os preços aparecem aqui, uma coluna por unidade."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-prose text-tinta-suave">
        {podeEditar
          ? 'Edite os valores ou cole direto da planilha (selecione as células no Excel e cole na primeira). Mudar o preço nunca altera comandas já lançadas.'
          : 'Preços vigentes hoje. Só o dono altera a tabela.'}
      </p>
      <TabelaEditavel
        id="precos"
        legenda="Preço de cada serviço por unidade, em reais"
        colunas={[
          { chave: 'servico', rotulo: 'Serviço', somenteLeitura: true },
          ...unidades.map((u) => ({
            chave: u.id,
            rotulo: `${u.nome} (R$)`,
            tipo: 'moeda' as const,
            somenteLeitura: !podeEditar,
          })),
        ]}
        linhas={atuais}
        onChange={(novas) => setLinhas(novas.slice(0, servicos.length))}
      />
      {podeEditar && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48">
            <Campo
              id="precos-vigencia"
              rotulo="Valer a partir de"
              type="date"
              min={dataLocal(new Date())}
              value={vigencia}
              onChange={(e) => setVigencia(e.target.value)}
            />
          </div>
          <Botao
            onClick={enviar}
            disabled={mudancas.length === 0 || invalidos.length > 0}
            carregando={salvar.isPending}
          >
            {mudancas.length
              ? `Gravar ${mudancas.length} ${mudancas.length === 1 ? 'preço' : 'preços'}`
              : 'Nenhuma mudança'}
          </Botao>
          {linhas && (
            <Botao variante="fantasma" onClick={() => setLinhas(null)}>
              Desfazer mudanças
            </Botao>
          )}
        </div>
      )}
      {invalidos.length > 0 && (
        <Aviso tom="erro">Valor inválido em {invalidos.join(', ')}. Use o formato 45,00.</Aviso>
      )}
      {mensagem && <Aviso tom={mensagem.tom}>{mensagem.texto}</Aviso>}
      {tabela.programados.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
            Mudanças programadas
          </h2>
          <ul className="flex flex-col gap-1 text-tinta-suave">
            {tabela.programados.map((p) => (
              <li
                key={`${p.servicoId}-${p.unidadeId}-${p.vigenciaInicio}`}
                className="font-denso tabular-nums"
              >
                {servicos.find((s) => s.id === p.servicoId)?.nome} ·{' '}
                {unidades.find((u) => u.id === p.unidadeId)?.nome ?? 'outra unidade'}:{' '}
                <span className="text-tinta">{formatarMoeda(p.valor)}</span> a partir de{' '}
                {formatarData(`${p.vigenciaInicio}T12:00:00Z`)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
