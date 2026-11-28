'use client';

// Pacotes de sessões (Fase 1d, E2): o dono e o gestor cadastram ("10 drenagens por R$ 1.000, em
// 180 dias"); o balcão vende ao cliente aqui ou na ficha dele. Cada sessão sai com valor zero na
// comanda e conta no saldo; o valor do pacote entra no faturamento no dia da venda.
import {
  disponivelNaUnidade,
  FORMAS_PAGAMENTO,
  formatarMoeda,
  lerMoeda,
  NOME_FORMA,
  valorParaCampo,
  valorPorSessao,
  type PacoteDetalhe,
  type PacoteEntrada,
} from '@pente-fino/shared';
import { Botao, Campo, Dialogo, EstadoVazio, Marcador, Selecao } from '@pente-fino/ui';
import { useQuery } from '@tanstack/react-query';
import { Layers, Plus } from 'lucide-react';
import { useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { useAcao, useServicos } from '@/lib/consultas';
import { useUnidades } from '@/lib/sessao';
import { Aviso } from '../aviso';
import { useApp } from '../contexto-app';
import { CabecalhoPagina, Estado, Ficha } from '../pagina';
import { BuscaCliente, type ClienteEscolhido } from './busca-cliente';

export const chavePacotes = ['pacotes'] as const;
const mensagemDe = (e: unknown) =>
  e instanceof ErroApi ? (e.campos[0]?.mensagem ?? e.message) : 'Não foi possível concluir.';

export const usePacotes = () =>
  useQuery({ queryKey: chavePacotes, queryFn: () => api<PacoteDetalhe[]>('pacotes') });

export function TelaPacotes() {
  const { papeis } = useApp();
  const gestao = papeis.some((p) => p === 'dono' || p === 'gestor');
  const pacotes = usePacotes();
  const [editando, setEditando] = useState<PacoteDetalhe | 'novo' | null>(null);
  const [vendendo, setVendendo] = useState<PacoteDetalhe | null>(null);
  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina titulo="Pacotes" pergunta="Que pacotes de sessões você vende?" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-tinta-suave">
          O cliente paga antes e usa as sessões até a validade. Na comanda, a sessão entra sem
          cobrar e desconta do saldo; o valor do pacote entra no faturamento no dia da venda.
        </p>
        {gestao && (
          <Botao onClick={() => setEditando('novo')}>
            <Plus aria-hidden className="size-5" /> Novo pacote
          </Botao>
        )}
      </div>
      <Estado consulta={pacotes}>
        {() =>
          pacotes.data!.length === 0 ? (
            <EstadoVazio
              icone={Layers}
              titulo="Nenhum pacote ainda"
              texto="Ex.: 10 sessões de drenagem por R$ 1.000, válidas por 6 meses."
            />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2" aria-label="Pacotes">
              {pacotes.data!.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-col gap-2 rounded-lg border border-borda bg-superficie p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-lg font-semibold">{p.nome}</p>
                    {!p.ativo && <Ficha tom="neutro">Desativado</Ficha>}
                  </div>
                  <p className="font-denso text-2xl tabular-nums">{formatarMoeda(p.valor)}</p>
                  <p className="text-sm">
                    {p.sessoes} sessões de {p.servico} ·{' '}
                    {formatarMoeda(valorPorSessao(p.valor, p.sessoes))} cada · vale {p.validadeDias}{' '}
                    dias
                  </p>
                  <p className="text-sm text-tinta-suave">
                    {p.ativos} {p.ativos === 1 ? 'cliente com saldo' : 'clientes com saldo'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {p.ativo && <Botao onClick={() => setVendendo(p)}>Vender</Botao>}
                    {gestao && (
                      <Botao variante="secundario" onClick={() => setEditando(p)}>
                        Editar
                      </Botao>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )
        }
      </Estado>
      {editando && (
        <FormPacote
          pacote={editando === 'novo' ? null : editando}
          onFechar={() => setEditando(null)}
        />
      )}
      {vendendo && <VenderPacote pacote={vendendo} onFechar={() => setVendendo(null)} />}
    </div>
  );
}

function FormPacote({ pacote, onFechar }: { pacote: PacoteDetalhe | null; onFechar: () => void }) {
  const unidades = useUnidades();
  const servicos = useServicos();
  const [unidadeId, setUnidadeId] = useState(pacote?.unidadeId ?? '');
  const [nome, setNome] = useState(pacote?.nome ?? '');
  const [servicoId, setServicoId] = useState(pacote?.servicoId ?? '');
  const [sessoes, setSessoes] = useState(pacote ? String(pacote.sessoes) : '10');
  const [validade, setValidade] = useState(pacote ? String(pacote.validadeDias) : '180');
  const [valor, setValor] = useState(pacote ? valorParaCampo(pacote.valor) : '');
  const [ativo, setAtivo] = useState(pacote?.ativo ?? true);
  const [erro, setErro] = useState<string | null>(null);
  const salvar = useAcao(
    (corpo: PacoteEntrada) =>
      pacote ? api(`pacotes/${pacote.id}`, { metodo: 'PUT', corpo }) : api('pacotes', { corpo }),
    [chavePacotes],
  );
  const unidade = unidadeId || unidades.data?.[0]?.id || '';
  const daUnidade = (servicos.data ?? []).filter((s) => s.ativo && disponivelNaUnidade(s, unidade));
  const centavos = lerMoeda(valor);
  const n = Number(sessoes);
  return (
    <Dialogo
      aberto
      titulo={pacote ? 'Editar pacote' : 'Novo pacote'}
      descricao="Quem já comprou fica com o que comprou."
      onFechar={onFechar}
    >
      <form
        method="post"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setErro(null);
          if (centavos === null) return setErro('Informe o valor do pacote.');
          if (!servicoId) return setErro('Escolha o serviço das sessões.');
          try {
            await salvar.mutateAsync({
              nome,
              unidadeId: unidade,
              servicoId,
              sessoes: n,
              validadeDias: Number(validade),
              valor: centavos,
              ativo,
            });
            onFechar();
          } catch (er) {
            setErro(mensagemDe(er));
          }
        }}
      >
        <Campo
          id="pacote-nome"
          rotulo="Nome"
          placeholder="Ex.: 10 drenagens"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        {!pacote && (unidades.data?.length ?? 0) > 1 && (
          <Selecao
            id="pacote-unidade"
            rotulo="Unidade"
            value={unidade}
            onChange={(e) => setUnidadeId(e.target.value)}
            opcoes={(unidades.data ?? []).map((u) => ({ valor: u.id, rotulo: u.nome }))}
          />
        )}
        <Selecao
          id="pacote-servico"
          rotulo="Serviço das sessões"
          value={servicoId}
          onChange={(e) => setServicoId(e.target.value)}
          opcoes={[
            { valor: '', rotulo: 'Escolha' },
            ...daUnidade.map((s) => ({ valor: s.id, rotulo: s.nome })),
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo
            id="pacote-sessoes"
            rotulo="Sessões"
            inputMode="numeric"
            value={sessoes}
            onChange={(e) => setSessoes(e.target.value.replace(/\D/g, ''))}
          />
          <Campo
            id="pacote-validade"
            rotulo="Vale por (dias)"
            inputMode="numeric"
            value={validade}
            onChange={(e) => setValidade(e.target.value.replace(/\D/g, ''))}
          />
          <Campo
            id="pacote-valor"
            rotulo="Valor (R$)"
            inputMode="decimal"
            value={valor}
            dica={
              centavos !== null && n > 0
                ? `${formatarMoeda(valorPorSessao(centavos, n))} por sessão`
                : undefined
            }
            onChange={(e) => setValor(e.target.value)}
          />
        </div>
        {pacote && (
          <Marcador
            id="pacote-ativo"
            rotulo="À venda (desativado, ninguém compra de novo; quem tem saldo continua usando)"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
          />
        )}
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <Botao type="submit" carregando={salvar.isPending}>
          {pacote ? 'Salvar pacote' : 'Criar pacote'}
        </Botao>
      </form>
    </Dialogo>
  );
}

/** Vender um pacote: o cliente (já escolhido na ficha, ou buscado) e a forma de pagamento. */
export function VenderPacote({
  pacote,
  clienteId,
  onFechar,
}: {
  pacote?: PacoteDetalhe;
  clienteId?: string;
  onFechar: () => void;
}) {
  const pacotes = usePacotes();
  const [pacoteId, setPacoteId] = useState(pacote?.id ?? '');
  const [cliente, setCliente] = useState<ClienteEscolhido | null>(
    clienteId ? { clienteId, nome: '' } : null,
  );
  const [forma, setForma] = useState<(typeof FORMAS_PAGAMENTO)[number]>('pix');
  const [erro, setErro] = useState<string | null>(null);
  const vender = useAcao(
    async (d: { cliente: ClienteEscolhido; pacoteId: string }) => {
      const id =
        'clienteId' in d.cliente
          ? d.cliente.clienteId
          : (await api<{ id: string }>('clientes', { corpo: d.cliente.clienteNovo })).id;
      return api('pacotes/vender', { corpo: { pacoteId: d.pacoteId, clienteId: id, forma } });
    },
    [chavePacotes, ['pacotes-cliente']],
  );
  const escolhido = pacote ?? pacotes.data?.find((p) => p.id === pacoteId);
  return (
    <Dialogo
      aberto
      titulo={pacote ? `Vender ${pacote.nome}` : 'Vender pacote'}
      descricao="O valor entra no faturamento de hoje; as sessões descontam na comanda."
      onFechar={onFechar}
    >
      <form
        method="post"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setErro(null);
          if (!cliente) return setErro('Escolha o cliente.');
          if (!escolhido) return setErro('Escolha o pacote.');
          try {
            await vender.mutateAsync({ cliente, pacoteId: escolhido.id });
            onFechar();
          } catch (er) {
            setErro(mensagemDe(er));
          }
        }}
      >
        {!clienteId && <BuscaCliente id="pacote-cliente" valor={cliente} onEscolher={setCliente} />}
        {!pacote && (
          <Selecao
            id="pacote-escolha"
            rotulo="Pacote"
            value={pacoteId}
            onChange={(e) => setPacoteId(e.target.value)}
            opcoes={[
              { valor: '', rotulo: 'Escolha' },
              ...(pacotes.data ?? [])
                .filter((p) => p.ativo)
                .map((p) => ({ valor: p.id, rotulo: `${p.nome} · ${formatarMoeda(p.valor)}` })),
            ]}
          />
        )}
        <Selecao
          id="pacote-forma"
          rotulo="Forma de pagamento"
          value={forma}
          onChange={(e) => setForma(e.target.value as (typeof FORMAS_PAGAMENTO)[number])}
          opcoes={FORMAS_PAGAMENTO.map((f) => ({ valor: f, rotulo: NOME_FORMA[f] }))}
        />
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <Botao type="submit" carregando={vender.isPending}>
          {escolhido ? `Receber ${formatarMoeda(escolhido.valor)}` : 'Vender'}
        </Botao>
      </form>
    </Dialogo>
  );
}
