'use client';

import {
  dataLocal,
  FORMAS_MENSALIDADE,
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
  type MensalidadePix,
  type RelatorioClube,
  type RecebimentoPix,
  type TipoItemClube,
} from '@pente-fino/shared';
import { Abas, Botao, Campo, Dialogo, EstadoVazio, Marcador, Selecao } from '@pente-fino/ui';
import { useQuery } from '@tanstack/react-query';
import { Crown, Plus } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { useAcao, useServicos } from '@/lib/consultas';
import { useUnidades } from '@/lib/sessao';
import { Aviso } from '../aviso';
import { useApp } from '../contexto-app';
import { CabecalhoPagina, Estado, Ficha, Tabela, td, th } from '../pagina';
import { SeletorMes } from '../indicadores';
import { limitesDoMes, mesAtual } from '@/lib/periodo';
import { BuscaCliente, type ClienteEscolhido } from './busca-cliente';
import { ConviteSeFaltar } from '../convite-plano';
import { CompartilharPlano, PlanosSugeridos, ReceberOnline } from './clube-online';

const chaveItens = ['clube', 'itens'] as const;
const chaveAdesoes = ['clube', 'adesoes'] as const;
const mensagemDe = (e: unknown) =>
  e instanceof ErroApi ? (e.campos[0]?.mensagem ?? e.message) : 'Não foi possível concluir.';

const useItensClube = () =>
  useQuery({ queryKey: chaveItens, queryFn: () => api<ItemClubeDetalhe[]>('clube/itens') });

/** Clube da barbearia: assinantes (balcão) e planos (o dono cadastra). */
export function TelaClube() {
  const [aba, setAba] = useState('assinantes');
  const { papeis } = useApp();
  const gestao = papeis.some((p) => p === 'dono' || p === 'gestor');
  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina titulo="Clube" pergunta="Quem assina e o que o plano cobre?" />
      <ConviteSeFaltar recurso="clube" />
      <Abas
        rotulo="Clube"
        atual={aba}
        onTrocar={setAba}
        abas={[
          { id: 'assinantes', rotulo: 'Assinantes', conteudo: <Assinantes /> },
          { id: 'planos', rotulo: 'Planos', conteudo: <Planos /> },
          ...(gestao ? [{ id: 'resultado', rotulo: 'Resultado', conteudo: <Resultado /> }] : []),
          ...(papeis.includes('dono')
            ? [{ id: 'online', rotulo: 'Receber online', conteudo: <ReceberOnline /> }]
            : []),
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
  const [recebendo, setRecebendo] = useState<AdesaoDetalhe | null>(null);
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
                    <div className="flex flex-wrap gap-2">
                      <Botao variante="secundario" onClick={() => setRecebendo(a)}>
                        Receber mensalidade
                      </Botao>
                      <Botao variante="fantasma" onClick={() => setCancelando(a)}>
                        Cancelar adesão
                      </Botao>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )
        }
      </Estado>
      <NovaAdesao aberto={novo} onFechar={() => setNovo(false)} />
      <CancelarAdesao adesao={cancelando} onFechar={() => setCancelando(null)} />
      {recebendo && <ReceberMensalidade adesao={recebendo} onFechar={() => setRecebendo(null)} />}
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
  const unidades = useUnidades();
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
            <div className="flex flex-col gap-4">
              <EstadoVazio
                icone={Crown}
                titulo="Nenhum plano ainda"
                texto="Assinatura mensal, combo ou convênio com empresa: cada plano diz o que cobre e quantas vezes por mês."
              />
              {dono && unidades.data?.[0] && (
                <PlanosSugeridos
                  unidadeId={unidades.data[0].id}
                  onCriados={() => void itens.refetch()}
                />
              )}
            </div>
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
                  {i.ativo && <CompartilharPlano planoId={i.id} />}
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
      {dono && <PixDaBarbearia />}
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

// ─── Mensalidade ──────────────────────────────────────────────────────────

const NOME_FORMA: Record<(typeof FORMAS_MENSALIDADE)[number], string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  debito: 'Débito',
  credito: 'Crédito',
};

/** QR do Pix (gerado aqui no aparelho, a partir do copia e cola). */
function QrPix({ codigo }: { codigo: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    void QRCode.toDataURL(codigo, { margin: 1, width: 240 }).then((u) => vivo && setSrc(u));
    return () => {
      vivo = false;
    };
  }, [codigo]);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- QR gerado no aparelho (data URL)
    <img
      src={src}
      alt="QR Code do Pix da mensalidade"
      width={240}
      height={240}
      className="rounded-md bg-white p-2"
    />
  ) : (
    <div className="size-60 animate-pulse rounded-md bg-superficie-2" aria-hidden />
  );
}

function ReceberMensalidade({ adesao, onFechar }: { adesao: AdesaoDetalhe; onFechar: () => void }) {
  const m = useQuery({
    queryKey: ['clube', 'mensalidade', adesao.id],
    queryFn: () => api<MensalidadePix>(`clube/adesoes/${adesao.id}/mensalidade`),
  });
  const [forma, setForma] = useState<(typeof FORMAS_MENSALIDADE)[number]>('pix');
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const baixa = useAcao(
    (f: string) =>
      api<{ vencimento: string }>(`clube/adesoes/${adesao.id}/pagamentos`, { corpo: { forma: f } }),
    [chaveAdesoes, ['clube', 'cliente']],
  );
  return (
    <Dialogo
      aberto
      titulo="Receber mensalidade"
      descricao={`${adesao.cliente.nome} · ${adesao.plano.nome}`}
      onFechar={onFechar}
    >
      <Estado consulta={m}>
        {() => (
          <form
            method="post"
            noValidate
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setErro(null);
              try {
                await baixa.mutateAsync(forma);
                onFechar();
              } catch (er) {
                setErro(mensagemDe(er));
              }
            }}
          >
            <p className="font-denso text-3xl tabular-nums">{formatarMoeda(m.data!.valor)}</p>
            <p className="text-sm text-tinta-suave">
              Vencimento {formatarData(m.data!.vencimento)}. Depois da baixa, o plano renova por
              mais um mês.
            </p>
            {forma === 'pix' &&
              (m.data!.copiaECola ? (
                <div className="flex flex-col items-center gap-2">
                  <QrPix codigo={m.data!.copiaECola} />
                  <Botao
                    type="button"
                    variante="secundario"
                    onClick={async () => {
                      await navigator.clipboard
                        .writeText(m.data!.copiaECola!)
                        .catch(() => undefined);
                      setCopiado(true);
                    }}
                  >
                    {copiado ? 'Copiado' : 'Copiar Pix copia e cola'}
                  </Botao>
                  <p className="text-sm text-tinta-suave">
                    Confira o Pix no extrato da barbearia antes de confirmar.
                  </p>
                </div>
              ) : (
                <Aviso tom="aviso">
                  O dono ainda não cadastrou a chave Pix (Clube → Planos). Dá para receber em outra
                  forma.
                </Aviso>
              ))}
            <Selecao
              id="mensalidade-forma"
              rotulo="Recebido em"
              value={forma}
              onChange={(e) => setForma(e.target.value as (typeof FORMAS_MENSALIDADE)[number])}
              opcoes={FORMAS_MENSALIDADE.map((f) => ({ valor: f, rotulo: NOME_FORMA[f] }))}
            />
            {erro && <Aviso tom="erro">{erro}</Aviso>}
            <Botao type="submit" carregando={baixa.isPending}>
              Confirmar recebimento
            </Botao>
          </form>
        )}
      </Estado>
    </Dialogo>
  );
}

/** Dono: a chave Pix que recebe as mensalidades (o QR sai dela). */
function PixDaBarbearia() {
  const atual = useQuery({
    queryKey: ['clube', 'pix'],
    queryFn: () => api<{ pix: RecebimentoPix | null }>('clube/pix'),
  });
  const [f, setF] = useState<RecebimentoPix | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const salvar = useAcao(
    (corpo: RecebimentoPix) => api('clube/pix', { metodo: 'PUT', corpo }),
    [['clube', 'pix']],
  );
  const v = f ?? atual.data?.pix ?? { chave: '', nome: '', cidade: '' };
  const mudar = (k: keyof RecebimentoPix, valor: string) => {
    setF({ ...v, [k]: valor });
    setSalvo(false);
  };
  return (
    <form
      method="post"
      noValidate
      aria-labelledby="titulo-pix-clube"
      className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setErro(null);
        try {
          await salvar.mutateAsync(v);
          setSalvo(true);
        } catch (er) {
          setErro(mensagemDe(er));
        }
      }}
    >
      <h2 id="titulo-pix-clube" className="font-semibold">
        Pix para as mensalidades
      </h2>
      <p className="text-sm text-tinta-suave">
        A recepção mostra o QR com o valor do plano; o dinheiro cai direto na sua conta, sem taxa de
        gateway. A baixa é manual, depois de conferir o extrato.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo
          id="pix-chave"
          rotulo="Chave Pix"
          dica="E-mail, +55 e telefone, CPF/CNPJ só números ou aleatória"
          value={v.chave}
          onChange={(e) => mudar('chave', e.target.value)}
        />
        <Campo
          id="pix-nome"
          rotulo="Nome de quem recebe"
          value={v.nome}
          onChange={(e) => mudar('nome', e.target.value)}
        />
        <Campo
          id="pix-cidade"
          rotulo="Cidade"
          value={v.cidade}
          onChange={(e) => mudar('cidade', e.target.value)}
        />
      </div>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {salvo && <p className="text-sm text-acao-texto">Chave Pix salva.</p>}
      <Botao
        type="submit"
        variante="secundario"
        className="self-start"
        carregando={salvar.isPending}
      >
        Salvar Pix
      </Botao>
    </form>
  );
}

// ─── Resultado ────────────────────────────────────────────────────────────

/** Se o clube dá lucro: mensalidades recebidas contra comissões e produto dos atendimentos. */
function Resultado() {
  const [mes, setMes] = useState(mesAtual());
  const [de, ate] = limitesDoMes(mes);
  const r = useQuery({
    queryKey: ['clube', 'relatorio', de, ate],
    queryFn: () => api<RelatorioClube>(`clube/relatorio?de=${de}&ate=${ate}`),
  });
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-tinta-suave">
          Mensalidades recebidas (receita do clube, fora do faturamento das comandas) contra o que
          custaram os atendimentos cobertos: comissão e produto.
        </p>
        <SeletorMes mes={mes} onMudar={setMes} />
      </div>
      <Estado consulta={r}>
        {() => {
          const d = r.data!;
          const cartoes: [string, string, string?][] = [
            ['Mensalidades', formatarMoeda(d.mensalidades)],
            ['Comissões do clube', formatarMoeda(d.comissoes)],
            ['Produto nos atendimentos', formatarMoeda(d.custoProdutos)],
            [
              'Lucro do clube',
              formatarMoeda(d.lucro),
              d.lucro < 0 ? 'text-perigo-texto' : 'text-acao-texto',
            ],
          ];
          return (
            <>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {cartoes.map(([rotulo, valor, cor]) => (
                  <div key={rotulo} className="rounded-lg border border-borda bg-superficie p-4">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
                      {rotulo}
                    </dt>
                    <dd className={`font-denso text-2xl tabular-nums ${cor ?? ''}`}>{valor}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-sm text-tinta-suave">
                {d.ativos} {d.ativos === 1 ? 'assinante em dia' : 'assinantes em dia'} ·{' '}
                {d.vencidos} {d.vencidos === 1 ? 'vencido' : 'vencidos'} · {d.novos}{' '}
                {d.novos === 1 ? 'novo' : 'novos'} no mês · {d.cancelamentos}{' '}
                {d.cancelamentos === 1 ? 'cancelamento' : 'cancelamentos'} · {d.atendimentos}{' '}
                {d.atendimentos === 1 ? 'atendimento coberto' : 'atendimentos cobertos'}
              </p>
              {d.porPlano.length > 0 && (
                <Tabela rotulo="Resultado do clube por plano">
                  <thead className="bg-superficie-2">
                    <tr>
                      <th className={th}>Plano</th>
                      <th className={`${th} text-right`}>Em dia</th>
                      <th className={`${th} text-right`}>Mensalidades</th>
                      <th className={`${th} text-right`}>Atendimentos</th>
                      <th className={`${th} text-right`}>Comissões</th>
                      <th className={`${th} text-right`}>Produto</th>
                      <th className={`${th} text-right`}>Lucro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.porPlano.map((l) => (
                      <tr key={l.planoId} className="border-t border-borda">
                        <th scope="row" className={`${td} font-medium`}>
                          {l.plano}
                        </th>
                        <td className={`${td} text-right font-denso tabular-nums`}>{l.ativos}</td>
                        <td className={`${td} text-right font-denso tabular-nums`}>
                          {formatarMoeda(l.mensalidades)}
                        </td>
                        <td className={`${td} text-right font-denso tabular-nums`}>
                          {l.atendimentos}
                        </td>
                        <td className={`${td} text-right font-denso tabular-nums`}>
                          {formatarMoeda(l.comissoes)}
                        </td>
                        <td className={`${td} text-right font-denso tabular-nums`}>
                          {formatarMoeda(l.custoProdutos)}
                        </td>
                        <td
                          className={`${td} text-right font-denso tabular-nums ${l.lucro < 0 ? 'text-perigo-texto' : ''}`}
                        >
                          {formatarMoeda(l.lucro)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Tabela>
              )}
              {d.motivosCancelamento.length > 0 && (
                <div className="flex flex-col gap-1">
                  <h3 className="font-semibold">Por que cancelaram</h3>
                  <ul className="list-disc pl-5 text-tinta-suave">
                    {d.motivosCancelamento.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          );
        }}
      </Estado>
    </div>
  );
}
