'use client';

import {
  dataLocal,
  formatarData,
  formatarMoeda,
  lerMoeda,
  NOME_TIPO_CLUBE,
  somarMeses,
  TIPOS_ITEM_CLUBE,
  valorParaCampo,
  type AdesaoDetalhe,
  type DataISO,
  type ItemClubeDetalhe,
  type ItemClubeEntrada,
  type TipoItemClube,
} from '@pente-fino/shared';
import { Abas, Botao, Campo, Dialogo, EstadoVazio, Marcador, Selecao } from '@pente-fino/ui';
import { useQuery } from '@tanstack/react-query';
import { Crown, Plus } from 'lucide-react';
import { useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { useAcao, useServicos } from '@/lib/consultas';
import { useUnidades } from '@/lib/sessao';
import { Aviso } from '../aviso';
import { useApp } from '../contexto-app';
import { CabecalhoPagina, Estado, Ficha } from '../pagina';
import { BuscaCliente, type ClienteEscolhido } from './busca-cliente';

const chaveItens = ['clube', 'itens'] as const;
const chaveAdesoes = ['clube', 'adesoes'] as const;
const mensagemDe = (e: unknown) =>
  e instanceof ErroApi ? (e.campos[0]?.mensagem ?? e.message) : 'Não foi possível concluir.';

const useItensClube = () =>
  useQuery({ queryKey: chaveItens, queryFn: () => api<ItemClubeDetalhe[]>('clube/itens') });

/** Clube da barbearia: assinantes (balcão) e planos (o dono cadastra). */
export function TelaClube() {
  const [aba, setAba] = useState('assinantes');
  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina titulo="Clube" pergunta="Quem assina e o que o plano cobre?" />
      <Abas
        rotulo="Clube"
        atual={aba}
        onTrocar={setAba}
        abas={[
          { id: 'assinantes', rotulo: 'Assinantes', conteudo: <Assinantes /> },
          { id: 'planos', rotulo: 'Planos', conteudo: <Planos /> },
        ]}
      />
    </div>
  );
}

// ─── Assinantes ───────────────────────────────────────────────────────────

const TOM: Record<AdesaoDetalhe['situacao'], 'acao' | 'aviso' | 'neutro'> = {
  ativa: 'acao',
  vencida: 'aviso',
  cancelada: 'neutro',
};
const NOME_SITUACAO: Record<AdesaoDetalhe['situacao'], string> = {
  ativa: 'Ativa',
  vencida: 'Vencida',
  cancelada: 'Cancelada',
};

function Assinantes() {
  const [situacao, setSituacao] = useState('');
  const [novo, setNovo] = useState(false);
  const [cancelando, setCancelando] = useState<AdesaoDetalhe | null>(null);
  const lista = useQuery({
    queryKey: [...chaveAdesoes, situacao],
    queryFn: () => api<AdesaoDetalhe[]>(`clube/adesoes${situacao ? `?situacao=${situacao}` : ''}`),
  });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Selecao
          id="clube-situacao"
          rotulo="Mostrar"
          value={situacao}
          onChange={(e) => setSituacao(e.target.value)}
          opcoes={[
            { valor: '', rotulo: 'Ativas e vencidas' },
            { valor: 'ativa', rotulo: 'Em dia' },
            { valor: 'vencida', rotulo: 'Vencidas' },
            { valor: 'cancelada', rotulo: 'Canceladas' },
          ]}
        />
        <Botao onClick={() => setNovo(true)}>
          <Plus aria-hidden className="size-5" /> Novo assinante
        </Botao>
      </div>
      <Estado consulta={lista}>
        {() =>
          lista.data!.length === 0 ? (
            <EstadoVazio
              icone={Crown}
              titulo="Nenhum assinante aqui"
              texto="Cadastre um plano na aba Planos e coloque os clientes nele."
            />
          ) : (
            <ul className="flex flex-col gap-2" aria-label="Assinantes do clube">
              {lista.data!.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-col gap-2 rounded-lg border border-borda bg-superficie p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-lg font-semibold">{a.cliente.nome}</p>
                    <Ficha tom={TOM[a.situacao]}>{NOME_SITUACAO[a.situacao]}</Ficha>
                  </div>
                  <p className="text-sm text-tinta-suave">
                    {a.plano.nome} · {formatarMoeda(a.plano.valor)} ·{' '}
                    {a.situacao === 'cancelada' ? 'era até' : 'vence'} {formatarData(a.vencimento)}
                  </p>
                  {a.situacao !== 'cancelada' && (
                    <p className="text-sm">
                      {a.restantes
                        .map((r) =>
                          r.restam === null
                            ? `${r.servico}: à vontade`
                            : `${r.servico}: restam ${r.restam}`,
                        )
                        .join(' · ')}
                    </p>
                  )}
                  {a.situacao !== 'cancelada' && (
                    <Botao
                      variante="fantasma"
                      className="self-start"
                      onClick={() => setCancelando(a)}
                    >
                      Cancelar adesão
                    </Botao>
                  )}
                </li>
              ))}
            </ul>
          )
        }
      </Estado>
      <NovaAdesao aberto={novo} onFechar={() => setNovo(false)} />
      <CancelarAdesao adesao={cancelando} onFechar={() => setCancelando(null)} />
    </div>
  );
}

function NovaAdesao({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const itens = useItensClube();
  const [cliente, setCliente] = useState<ClienteEscolhido | null>(null);
  const [itemId, setItemId] = useState('');
  const [inicio, setInicio] = useState(dataLocal(new Date()));
  const [erro, setErro] = useState<string | null>(null);
  const aderir = useAcao(
    async (d: { cliente: ClienteEscolhido; itemClubeId: string; inicio: string }) => {
      const clienteId =
        'clienteId' in d.cliente
          ? d.cliente.clienteId
          : (await api<{ id: string }>('clientes', { corpo: d.cliente.clienteNovo })).id;
      return api('clube/adesoes', {
        corpo: { clienteId, itemClubeId: d.itemClubeId, inicio: d.inicio },
      });
    },
    [chaveAdesoes, chaveItens],
  );
  const ativos = (itens.data ?? []).filter((i) => i.ativo);
  const fechar = () => {
    setCliente(null);
    setItemId('');
    setErro(null);
    onFechar();
  };
  return (
    <Dialogo
      aberto={aberto}
      titulo="Novo assinante"
      descricao="O plano passa a cobrir os serviços na comanda até o vencimento."
      onFechar={fechar}
    >
      <form
        method="post"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setErro(null);
          if (!cliente) return setErro('Escolha o cliente.');
          if (!itemId) return setErro('Escolha o plano.');
          try {
            await aderir.mutateAsync({ cliente, itemClubeId: itemId, inicio });
            fechar();
          } catch (er) {
            setErro(mensagemDe(er));
          }
        }}
      >
        <BuscaCliente id="clube-cliente" valor={cliente} onEscolher={setCliente} />
        <Selecao
          id="clube-plano"
          rotulo="Plano"
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
          opcoes={[
            { valor: '', rotulo: ativos.length ? 'Escolha' : 'Cadastre um plano primeiro' },
            ...ativos.map((i) => ({
              valor: i.id,
              rotulo: `${i.nome} · ${formatarMoeda(i.valor)} (${i.unidade})`,
            })),
          ]}
        />
        <Campo
          id="clube-inicio"
          rotulo="Início"
          type="date"
          value={inicio}
          dica={`Vence em ${formatarData(somarMeses(inicio as DataISO, 1))}; a mensalidade renova o vencimento.`}
          onChange={(e) => setInicio(e.target.value)}
        />
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <Botao type="submit" carregando={aderir.isPending}>
          Colocar no plano
        </Botao>
      </form>
    </Dialogo>
  );
}

function CancelarAdesao({
  adesao,
  onFechar,
}: {
  adesao: AdesaoDetalhe | null;
  onFechar: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const cancelar = useAcao(
    (d: { id: string; motivo: string }) =>
      api(`clube/adesoes/${d.id}/cancelar`, { corpo: { motivo: d.motivo } }),
    [chaveAdesoes, chaveItens],
  );
  return (
    <Dialogo
      aberto={!!adesao}
      titulo="Cancelar adesão"
      descricao={adesao ? `${adesao.cliente.nome} · ${adesao.plano.nome}` : undefined}
      onFechar={() => {
        setMotivo('');
        setErro(null);
        onFechar();
      }}
    >
      <form
        method="post"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setErro(null);
          try {
            await cancelar.mutateAsync({ id: adesao!.id, motivo });
            setMotivo('');
            onFechar();
          } catch (er) {
            setErro(mensagemDe(er));
          }
        }}
      >
        <Campo
          id="clube-motivo"
          rotulo="Motivo"
          dica="Ex.: mudou de cidade, achou caro"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <Botao type="submit" variante="perigo" carregando={cancelar.isPending}>
          Cancelar adesão
        </Botao>
      </form>
    </Dialogo>
  );
}

// ─── Planos ───────────────────────────────────────────────────────────────

function Planos() {
  const { papeis } = useApp();
  const dono = papeis.includes('dono');
  const itens = useItensClube();
  const [editando, setEditando] = useState<ItemClubeDetalhe | 'novo' | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-tinta-suave">
          O que o plano cobre entra na comanda sem cobrar e conta no uso do mês; o resto entra com
          preço normal.
        </p>
        {dono && (
          <Botao onClick={() => setEditando('novo')}>
            <Plus aria-hidden className="size-5" /> Novo plano
          </Botao>
        )}
      </div>
      <Estado consulta={itens}>
        {() =>
          itens.data!.length === 0 ? (
            <EstadoVazio
              icone={Crown}
              titulo="Nenhum plano ainda"
              texto="Assinatura mensal, combo ou convênio com empresa: cada plano diz o que cobre e quantas vezes por mês."
            />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2" aria-label="Planos do clube">
              {itens.data!.map((i) => (
                <li
                  key={i.id}
                  className="flex flex-col gap-2 rounded-lg border border-borda bg-superficie p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-lg font-semibold">{i.nome}</p>
                    <Ficha tom={i.ativo ? 'acao' : 'neutro'}>
                      {i.ativo ? NOME_TIPO_CLUBE[i.tipo] : 'Desativado'}
                    </Ficha>
                  </div>
                  <p className="font-denso text-2xl tabular-nums">
                    {formatarMoeda(i.valor)}
                    <span className="font-sans text-sm text-tinta-suave">
                      {' '}
                      por mês · {i.unidade}
                    </span>
                  </p>
                  <ul className="text-sm">
                    {i.servicos.map((s) => (
                      <li key={s.servicoId}>
                        {s.nome}: {s.quantidade === null ? 'à vontade' : `${s.quantidade}× no mês`}
                        {s.comissaoValorFixo !== null &&
                          ` · comissão fixa ${formatarMoeda(s.comissaoValorFixo)}`}
                      </li>
                    ))}
                  </ul>
                  {i.limiteUsoMes !== null && (
                    <p className="text-sm text-tinta-suave">
                      Até {i.limiteUsoMes} atendimentos no mês, somando tudo.
                    </p>
                  )}
                  <p className="text-sm text-tinta-suave">
                    {i.assinantes} {i.assinantes === 1 ? 'assinante' : 'assinantes'}
                  </p>
                  {dono && (
                    <Botao
                      variante="secundario"
                      className="self-start"
                      onClick={() => setEditando(i)}
                    >
                      Editar
                    </Botao>
                  )}
                </li>
              ))}
            </ul>
          )
        }
      </Estado>
      {editando && (
        <FormPlano
          plano={editando === 'novo' ? null : editando}
          onFechar={() => setEditando(null)}
        />
      )}
    </div>
  );
}

interface LinhaServico {
  incluso: boolean;
  quantidade: string;
  comissao: string;
}

function FormPlano({ plano, onFechar }: { plano: ItemClubeDetalhe | null; onFechar: () => void }) {
  const unidades = useUnidades();
  const servicos = useServicos();
  const [unidadeId, setUnidadeId] = useState(plano?.unidadeId ?? '');
  const [tipo, setTipo] = useState<TipoItemClube>(plano?.tipo ?? 'assinatura');
  const [nome, setNome] = useState(plano?.nome ?? '');
  const [valor, setValor] = useState(plano ? valorParaCampo(plano.valor) : '');
  const [limite, setLimite] = useState(plano?.limiteUsoMes ? String(plano.limiteUsoMes) : '');
  const [ativo, setAtivo] = useState(plano?.ativo ?? true);
  const [linhas, setLinhas] = useState<Record<string, LinhaServico>>(() =>
    Object.fromEntries(
      (plano?.servicos ?? []).map((s) => [
        s.servicoId,
        {
          incluso: true,
          quantidade: s.quantidade === null ? '' : String(s.quantidade),
          comissao: s.comissaoValorFixo === null ? '' : valorParaCampo(s.comissaoValorFixo),
        },
      ]),
    ),
  );
  const [erro, setErro] = useState<string | null>(null);
  const salvar = useAcao(
    (corpo: ItemClubeEntrada) =>
      plano
        ? api(`clube/itens/${plano.id}`, { metodo: 'PUT', corpo })
        : api('clube/itens', { corpo }),
    [chaveItens],
  );
  const linha = (id: string): LinhaServico =>
    linhas[id] ?? { incluso: false, quantidade: '', comissao: '' };
  const mudar = (id: string, m: Partial<LinhaServico>) =>
    setLinhas((x) => ({ ...x, [id]: { ...linha(id), ...m } }));
  const unidadePadrao = unidadeId || unidades.data?.[0]?.id || '';

  return (
    <Dialogo
      aberto
      titulo={plano ? 'Editar plano' : 'Novo plano'}
      descricao="Mudanças valem para os próximos atendimentos."
      onFechar={onFechar}
      largura="larga"
    >
      <form
        method="post"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setErro(null);
          const valorCentavos = lerMoeda(valor);
          if (valorCentavos === null) return setErro('Informe o valor do plano.');
          const inclusos = Object.entries(linhas).filter(([, l]) => l.incluso);
          try {
            await salvar.mutateAsync({
              unidadeId: unidadePadrao,
              tipo,
              nome,
              descricao: null,
              valor: valorCentavos,
              limiteUsoMes: limite ? Number(limite) : null,
              ativo,
              servicos: inclusos.map(([servicoId, l]) => ({
                servicoId,
                quantidade: l.quantidade ? Number(l.quantidade) : null,
                comissaoValorFixo: l.comissao ? lerMoeda(l.comissao) : null,
              })),
            });
            onFechar();
          } catch (er) {
            setErro(mensagemDe(er));
          }
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            id="plano-nome"
            rotulo="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <Selecao
            id="plano-tipo"
            rotulo="Tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoItemClube)}
            opcoes={TIPOS_ITEM_CLUBE.map((t) => ({ valor: t, rotulo: NOME_TIPO_CLUBE[t] }))}
          />
          <Campo
            id="plano-valor"
            rotulo="Valor por mês (R$)"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
          <Campo
            id="plano-limite"
            rotulo="Limite de atendimentos no mês (opcional)"
            inputMode="numeric"
            dica="Somando todos os serviços. Vazio = só o limite de cada serviço."
            value={limite}
            onChange={(e) => setLimite(e.target.value.replace(/\D/g, ''))}
          />
          {!plano && (unidades.data?.length ?? 0) > 1 && (
            <Selecao
              id="plano-unidade"
              rotulo="Unidade"
              value={unidadePadrao}
              onChange={(e) => setUnidadeId(e.target.value)}
              opcoes={(unidades.data ?? []).map((u) => ({ valor: u.id, rotulo: u.nome }))}
            />
          )}
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold">Serviços que o plano cobre</legend>
          <p className="text-sm text-tinta-suave">
            Vezes no mês vazio = à vontade. Comissão fixa vazia = o % do barbeiro sobre o preço de
            tabela.
          </p>
          {(servicos.data ?? [])
            .filter((s) => s.ativo)
            .map((s) => {
              const l = linha(s.id);
              return (
                <div
                  key={s.id}
                  className="grid items-end gap-2 rounded-md border border-borda p-3 sm:grid-cols-[1fr_9rem_9rem]"
                >
                  <Marcador
                    id={`plano-servico-${s.id}`}
                    rotulo={s.nome}
                    checked={l.incluso}
                    onChange={(e) => mudar(s.id, { incluso: e.target.checked })}
                  />
                  {l.incluso && (
                    <>
                      <Campo
                        id={`plano-qtd-${s.id}`}
                        rotulo="Vezes no mês"
                        inputMode="numeric"
                        value={l.quantidade}
                        onChange={(e) =>
                          mudar(s.id, { quantidade: e.target.value.replace(/\D/g, '') })
                        }
                      />
                      <Campo
                        id={`plano-comissao-${s.id}`}
                        rotulo="Comissão fixa (R$)"
                        inputMode="decimal"
                        value={l.comissao}
                        onChange={(e) => mudar(s.id, { comissao: e.target.value })}
                      />
                    </>
                  )}
                </div>
              );
            })}
        </fieldset>
        {plano && (
          <Marcador
            id="plano-ativo"
            rotulo="Plano ativo (desativado, não recebe assinantes novos)"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
          />
        )}
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <Botao type="submit" carregando={salvar.isPending}>
          {plano ? 'Salvar plano' : 'Criar plano'}
        </Botao>
      </form>
    </Dialogo>
  );
}
