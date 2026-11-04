'use client';

import { lerMoeda, NOMES_DIAS, NOMES_DIAS_CURTOS, valorParaCampo } from '@pente-fino/shared';
import { Botao, Campo, EstadoVazio, Marcador } from '@pente-fino/ui';
import { useQuery } from '@tanstack/react-query';
import { CircleCheck, CircleSlash, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { chaves, useAcao, useProfissionais, useUnidadesDetalhe } from '@/lib/consultas';
import { Aviso } from '../aviso';
import { useApp } from '../contexto-app';
import { Estado } from '../pagina';
import { NovoProfissional } from './equipe';

interface Modelo {
  nome: string;
  categoria: string;
  duracaoMin: number;
  custoProduto: number;
  ehExtra: boolean;
  pesoAtendimento: number;
  precoSugerido: number;
}
interface EstadoConfiguracao {
  configurada: boolean;
  unidades: number;
  servicos: number;
  servicosComPreco: number;
  profissionais: number;
  modelos: Modelo[];
}

const PASSOS = ['Unidade', 'Serviços e preços', 'Equipe', 'Pronto'] as const;
const mensagemDe = (e: unknown) =>
  e instanceof ErroApi ? (e.campos[0]?.mensagem ?? e.message) : 'Não foi possível salvar.';

export function useEstadoConfiguracao(habilitado = true) {
  return useQuery({
    queryKey: ['configuracao'],
    queryFn: () => api<EstadoConfiguracao>('configuracao/estado'),
    enabled: habilitado,
  });
}

export function TelaConfiguracaoInicial() {
  const { papeis } = useApp();
  const estado = useEstadoConfiguracao(papeis.includes('dono'));
  const [passo, setPasso] = useState(0);
  if (!papeis.includes('dono')) {
    return (
      <EstadoVazio
        icone={CircleSlash}
        titulo="Configuração feita pelo dono"
        texto="O assistente de primeiro acesso é do dono da barbearia."
      />
    );
  }
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase tracking-wider text-modulo-texto">
          Primeiro acesso
        </p>
        <h1 className="text-3xl font-semibold sm:text-4xl">Vamos deixar a barbearia pronta</h1>
        <p className="text-lg text-tinta-suave">Quatro passos. Dá para mudar tudo depois.</p>
      </header>
      <ol className="grid grid-cols-4 gap-2" aria-label="Passos">
        {PASSOS.map((p, i) => (
          <li
            key={p}
            aria-current={i === passo ? 'step' : undefined}
            className="flex flex-col gap-1.5"
          >
            <span
              className={`h-1.5 rounded-full ${i <= passo ? 'bg-modulo' : 'bg-superficie-3'}`}
            />
            <span
              className={`text-sm ${i === passo ? 'font-semibold text-tinta' : 'text-tinta-suave'}`}
            >
              {i + 1}. {p}
            </span>
          </li>
        ))}
      </ol>
      <Estado consulta={estado}>
        {() => (
          <>
            {passo === 0 && <PassoUnidade onSeguir={() => setPasso(1)} />}
            {passo === 1 && (
              <PassoServicos
                estado={estado.data!}
                onSeguir={() => setPasso(2)}
                onVoltar={() => setPasso(0)}
              />
            )}
            {passo === 2 && (
              <PassoEquipe onSeguir={() => setPasso(3)} onVoltar={() => setPasso(1)} />
            )}
            {passo === 3 && <PassoPronto />}
          </>
        )}
      </Estado>
    </div>
  );
}

function PassoUnidade({ onSeguir }: { onSeguir: () => void }) {
  const unidades = useUnidadesDetalhe();
  return (
    <Estado consulta={unidades}>
      {() => <FormUnidade u={unidades.data![0]!} onSeguir={onSeguir} />}
    </Estado>
  );
}

function FormUnidade({
  u,
  onSeguir,
}: {
  u: NonNullable<ReturnType<typeof useUnidadesDetalhe>['data']>[number];
  onSeguir: () => void;
}) {
  const [f, setF] = useState({
    nome: u.nome,
    endereco: u.endereco ?? '',
    telefone: u.telefone ?? '',
    diasTrabalho: u.diasTrabalho,
    capacidade: String(u.capacidade),
  });
  const [erro, setErro] = useState<string | null>(null);
  const salvar = useAcao(
    (corpo: object) => api(`unidades/${u.id}`, { metodo: 'PATCH', corpo }),
    [chaves.unidades],
  );
  return (
    <form
      method="post"
      noValidate
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setErro(null);
        try {
          await salvar.mutateAsync({ ...f, capacidade: Number(f.capacidade) });
          onSeguir();
        } catch (er) {
          setErro(mensagemDe(er));
        }
      }}
    >
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <Campo
        id="ci-nome"
        rotulo="Nome da unidade"
        dica="Como a equipe chama: Centro, Shopping…"
        value={f.nome}
        onChange={(e) => setF({ ...f, nome: e.target.value })}
      />
      <Campo
        id="ci-endereco"
        rotulo="Endereço"
        value={f.endereco}
        onChange={(e) => setF({ ...f, endereco: e.target.value })}
      />
      <Campo
        id="ci-telefone"
        rotulo="WhatsApp da unidade"
        inputMode="tel"
        dica="Aparece no link de agendamento para o cliente confirmar."
        value={f.telefone}
        onChange={(e) => setF({ ...f, telefone: e.target.value })}
      />
      <fieldset className="min-w-0">
        <legend className="mb-1.5 text-sm font-medium">Dias de trabalho</legend>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {NOMES_DIAS_CURTOS.map((d, i) => (
              <Marcador
                key={d}
                id={`ci-dia-${i}`}
                forma="ficha"
                rotulo={d}
                aria-label={NOMES_DIAS[i]}
                checked={f.diasTrabalho.includes(i)}
                onChange={(e) =>
                  setF({
                    ...f,
                    diasTrabalho: e.target.checked
                      ? [...f.diasTrabalho, i]
                      : f.diasTrabalho.filter((x) => x !== i),
                  })
                }
              />
            ))}
          </div>
        </div>
      </fieldset>
      <Campo
        id="ci-capacidade"
        rotulo="Cadeiras"
        type="number"
        inputMode="numeric"
        value={f.capacidade}
        onChange={(e) => setF({ ...f, capacidade: e.target.value })}
      />
      <Botao type="submit" className="self-end" carregando={salvar.isPending}>
        Salvar e seguir
      </Botao>
    </form>
  );
}

function PassoServicos({
  estado,
  onSeguir,
  onVoltar,
}: {
  estado: EstadoConfiguracao;
  onSeguir: () => void;
  onVoltar: () => void;
}) {
  const [escolhas, setEscolhas] = useState(() =>
    estado.modelos.map((m) => ({
      ...m,
      marcado: !m.ehExtra || ['Sobrancelha', 'Pezinho'].includes(m.nome),
      preco: valorParaCampo(m.precoSugerido),
    })),
  );
  const [erro, setErro] = useState<string | null>(null);
  const criar = useAcao(
    (corpo: object) => api('configuracao/servicos', { corpo }),
    [['configuracao'], chaves.servicos, chaves.precos],
  );

  if (estado.servicos > 0) {
    return (
      <div className="flex flex-col gap-4">
        <Aviso tom="sucesso">
          Você já tem {estado.servicos} {estado.servicos === 1 ? 'serviço' : 'serviços'}{' '}
          cadastrados. Ajuste em Serviços quando quiser.
        </Aviso>
        <div className="flex justify-between">
          <Botao variante="secundario" onClick={onVoltar}>
            Voltar
          </Botao>
          <Botao onClick={onSeguir}>Seguir</Botao>
        </div>
      </div>
    );
  }

  const marcados = escolhas.filter((e) => e.marcado);
  return (
    <form
      method="post"
      noValidate
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setErro(null);
        const servicos = [];
        for (const m of marcados) {
          const preco = lerMoeda(m.preco);
          if (preco === null || preco < 0)
            return setErro(`Preço inválido em ${m.nome}. Ex.: 45,00`);
          servicos.push({
            nome: m.nome,
            categoria: m.categoria,
            duracaoMin: m.duracaoMin,
            custoProduto: m.custoProduto,
            ehExtra: m.ehExtra,
            pesoAtendimento: m.pesoAtendimento,
            ativo: true,
            preco,
          });
        }
        try {
          await criar.mutateAsync({ servicos });
          onSeguir();
        } catch (er) {
          setErro(mensagemDe(er));
        }
      }}
    >
      <p className="text-tinta-suave">
        Marque o que a barbearia faz e ponha o seu preço. Custo de produto, duração e peso vêm
        prontos; ajuste depois em Serviços.
      </p>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <ul className="flex flex-col divide-y divide-borda rounded-lg border border-borda bg-superficie">
        {escolhas.map((m, i) => (
          <li key={m.nome} className="flex flex-wrap items-center justify-between gap-3 px-3 py-1">
            <Marcador
              id={`ci-servico-${i}`}
              rotulo={`${m.nome} · ${m.duracaoMin} min${m.ehExtra ? ' · extra' : ''}`}
              checked={m.marcado}
              onChange={(e) =>
                setEscolhas(
                  escolhas.map((x, k) => (k === i ? { ...x, marcado: e.target.checked } : x)),
                )
              }
            />
            <label className="flex items-center gap-2 text-sm text-tinta-suave">
              R$
              <input
                aria-label={`Preço de ${m.nome}`}
                inputMode="decimal"
                disabled={!m.marcado}
                value={m.preco}
                onChange={(e) =>
                  setEscolhas(
                    escolhas.map((x, k) => (k === i ? { ...x, preco: e.target.value } : x)),
                  )
                }
                className="min-h-11 w-24 rounded-md border border-borda bg-fundo px-2 text-right font-denso text-base text-tinta tabular-nums disabled:opacity-40"
              />
            </label>
          </li>
        ))}
      </ul>
      <div className="flex justify-between gap-3">
        <Botao variante="secundario" onClick={onVoltar}>
          Voltar
        </Botao>
        <Botao type="submit" carregando={criar.isPending} disabled={marcados.length === 0}>
          Criar {marcados.length} serviços e seguir
        </Botao>
      </div>
    </form>
  );
}

function PassoEquipe({ onSeguir, onVoltar }: { onSeguir: () => void; onVoltar: () => void }) {
  const profissionais = useProfissionais();
  const [aberto, setAberto] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-tinta-suave">
        Cadastre os barbeiros com a comissão de cada um. Eles recebem um convite por e-mail e pelo
        WhatsApp. Pode pular e fazer depois em Equipe.
      </p>
      <ul className="flex flex-col gap-2">
        {(profissionais.data ?? []).map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between rounded-md border border-borda bg-superficie px-3 py-2"
          >
            <span className="font-semibold">{p.nome}</span>
            <span className="text-sm text-tinta-suave">
              {p.pendente ? 'Convite enviado' : 'Ativo'}
            </span>
          </li>
        ))}
      </ul>
      <Botao variante="secundario" className="self-start" onClick={() => setAberto(true)}>
        <UserPlus aria-hidden className="size-5" /> Adicionar barbeiro
      </Botao>
      <NovoProfissional aberto={aberto} onFechar={() => setAberto(false)} />
      <div className="flex justify-between gap-3">
        <Botao variante="secundario" onClick={onVoltar}>
          Voltar
        </Botao>
        <Botao onClick={onSeguir}>
          {(profissionais.data ?? []).length ? 'Seguir' : 'Pular por agora'}
        </Botao>
      </div>
    </div>
  );
}

function PassoPronto() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const concluir = useAcao(() => api('configuracao/concluir', { corpo: {} }), [['configuracao']]);
  return (
    <div className="flex flex-col items-start gap-4">
      <CircleCheck aria-hidden className="size-12 text-acao-texto" strokeWidth={1.5} />
      <h2 className="text-2xl font-semibold">Tudo pronto para o primeiro atendimento</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-tinta-suave">
        <li>
          Agende na <strong className="text-tinta">Agenda</strong>: a comanda já nasce com os
          serviços e preços.
        </li>
        <li>
          Ligue o link de agendamento em <strong className="text-tinta">Configurações</strong> para
          o cliente marcar sozinho.
        </li>
        <li>
          Lance as despesas do mês em <strong className="text-tinta">Financeiro</strong> para ver
          quanto sobra.
        </li>
      </ul>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <Botao
        carregando={concluir.isPending}
        onClick={async () => {
          setErro(null);
          try {
            await concluir.mutateAsync(undefined as never);
            router.replace('/inicio');
          } catch (e) {
            setErro(mensagemDe(e));
          }
        }}
      >
        Ir para o Início
      </Botao>
    </div>
  );
}
