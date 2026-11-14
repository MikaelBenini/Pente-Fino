'use client';

import {
  barbeirosSemCadastro,
  dataLocal,
  formatarData,
  formatarMoeda,
  formatarPercentualBp,
  lerMoeda,
  NOMES_DIAS,
  NOMES_DIAS_CURTOS,
  selecionarVigente,
  type BarbeiroSemCadastro,
  type Papel,
  type ProfissionalDetalhe,
  type UsuarioEquipe,
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
import { ChartColumn, MessageCircle, Plus, UserPlus, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import {
  chaves,
  useAcao,
  useProfissionais,
  useServicos,
  useUnidadesDetalhe,
  useUsuariosEquipe,
} from '@/lib/consultas';
import { NOME_PAPEL } from '@/lib/sessao';
import { Aviso } from '../aviso';
import { useApp } from '../contexto-app';
import { CabecalhoPagina, Estado, Ficha, Tabela, td, th } from '../pagina';

const mensagemDe = (e: unknown) =>
  e instanceof ErroApi ? e.message : 'Não foi possível concluir. Tente de novo.';
const hora = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const minutos = (texto: string) => {
  const [h, m] = texto.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export function TelaEquipe() {
  const [aba, setAba] = useState('profissionais');
  return (
    <div className="flex flex-col gap-8">
      <CabecalhoPagina
        titulo="Equipe"
        pergunta="Quem trabalha aqui, com que regra e com que acesso?"
      />
      <Abas
        rotulo="Equipe"
        atual={aba}
        onTrocar={setAba}
        abas={[
          { id: 'profissionais', rotulo: 'Profissionais', conteudo: <Profissionais /> },
          { id: 'acessos', rotulo: 'Acessos ao sistema', conteudo: <Acessos /> },
        ]}
      />
    </div>
  );
}

// ─── Profissionais ────────────────────────────────────────────────────────

function textoRegra(r?: { percentualBp: number | null; valorFixo: number | null }) {
  if (!r) return '—';
  return r.percentualBp !== null
    ? formatarPercentualBp(r.percentualBp)
    : `${formatarMoeda(r.valorFixo ?? 0)} fixo`;
}

function Profissionais() {
  const { unidadeAtiva } = useApp();
  const profissionais = useProfissionais();
  const unidades = useUnidadesDetalhe();
  const usuarios = useUsuariosEquipe();
  const [novo, setNovo] = useState(false);
  const [completar, setCompletar] = useState<BarbeiroSemCadastro | null>(null);
  const [horarios, setHorarios] = useState<ProfissionalDetalhe | null>(null);
  const [servicosDe, setServicosDe] = useState<ProfissionalDetalhe | null>(null);
  const [regra, setRegra] = useState<ProfissionalDetalhe | null>(null);
  const [fixo, setFixo] = useState<ProfissionalDetalhe | null>(null);
  const [desligar, setDesligar] = useState<ProfissionalDetalhe | null>(null);
  const hoje = dataLocal(new Date());
  const alterar = useAcao(
    (d: { id: string; corpo: object }) =>
      api(`profissionais/${d.id}`, { metodo: 'PATCH', corpo: d.corpo }),
    [chaves.profissionais, chaves.conta],
  );
  const [erro, setErro] = useState<string | null>(null);

  return (
    <Estado consulta={profissionais}>
      {() => {
        const lista = profissionais.data!.filter(
          (p) => unidadeAtiva === 'todas' || p.unidadeId === unidadeAtiva,
        );
        const nomeUnidade = (id: string) => unidades.data?.find((u) => u.id === id)?.nome ?? '';
        const faltam = barbeirosSemCadastro(usuarios.data ?? [], profissionais.data!).filter(
          (b) => unidadeAtiva === 'todas' || b.unidadeId === unidadeAtiva,
        );
        return (
          <div className="flex flex-col gap-4">
            <Botao className="self-start" onClick={() => setNovo(true)}>
              <UserPlus aria-hidden className="size-5" /> Adicionar barbeiro
            </Botao>
            {erro && <Aviso tom="erro">{erro}</Aviso>}
            {faltam.length > 0 && (
              <section
                aria-labelledby="titulo-sem-cadastro"
                className="flex flex-col gap-3 rounded-lg border border-aviso-texto/50 bg-aviso/5 p-4"
              >
                <div>
                  <h2 id="titulo-sem-cadastro" className="font-semibold text-tinta">
                    Falta completar o cadastro
                  </h2>
                  <p className="text-sm text-tinta-suave">
                    Convidados como barbeiro em “Acessos ao sistema”. Sem comissão e horários, não
                    aparecem na agenda nem nos indicadores.
                  </p>
                </div>
                <ul className="flex flex-col gap-2">
                  {faltam.map((b) => (
                    <li
                      key={`${b.usuarioId}:${b.unidadeId}`}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="min-w-0">
                        <span className="block font-semibold">{b.nome}</span>
                        <span className="block text-sm break-all text-tinta-suave">
                          {b.email}
                          {unidadeAtiva === 'todas' && ` · ${nomeUnidade(b.unidadeId)}`}
                          {b.pendente && ' · convite pendente'}
                        </span>
                      </span>
                      <Botao variante="secundario" onClick={() => setCompletar(b)}>
                        Completar cadastro
                      </Botao>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {lista.length === 0 ? (
              <EstadoVazio
                icone={Users}
                titulo="Cadastre sua equipe"
                texto="Adicione os barbeiros com data de entrada e comissão. Quem ainda não tem acesso recebe o convite por e-mail e WhatsApp."
              />
            ) : (
              <ul className="animar-escalonado grid gap-3 lg:grid-cols-2">
                {lista.map((p) => {
                  const servico = selecionarVigente(
                    p.regras.filter((r) => r.tipoItem === 'servico'),
                    hoje,
                  );
                  const produto = selecionarVigente(
                    p.regras.filter((r) => r.tipoItem === 'produto'),
                    hoje,
                  );
                  const futuras = p.regras.filter((r) => r.vigenciaInicio > hoje);
                  return (
                    <li
                      key={p.id}
                      className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h2 className="truncate text-xl font-semibold">{p.nome}</h2>
                          <p className="text-sm text-tinta-suave">
                            {nomeUnidade(p.unidadeId)} · desde{' '}
                            {formatarData(`${p.dataEntrada}T12:00:00Z`)}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          {p.pendente && <Ficha tom="aviso">Convite pendente</Ficha>}
                          {!p.ativo && <Ficha tom="neutro">Desligado</Ficha>}
                        </div>
                      </div>
                      <dl className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <dt className="text-tinta-suave">Comissão em serviços</dt>
                          <dd className="font-denso text-lg font-semibold tabular-nums">
                            {textoRegra(servico)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-tinta-suave">Em produtos</dt>
                          <dd className="font-denso text-lg font-semibold tabular-nums">
                            {textoRegra(produto)}
                          </dd>
                        </div>
                        {p.custoFixoMensal !== null && (
                          <div className="col-span-2">
                            <dt className="text-tinta-suave">Valor fixo por mês</dt>
                            <dd className="font-denso text-lg font-semibold tabular-nums">
                              {p.custoFixoMensal ? formatarMoeda(p.custoFixoMensal) : 'Só comissão'}
                            </dd>
                          </div>
                        )}
                      </dl>
                      {futuras.length > 0 && (
                        <p className="text-sm text-aviso-texto">
                          Nova regra a partir de{' '}
                          {formatarData(`${futuras[0]!.vigenciaInicio}T12:00:00Z`)}:{' '}
                          {textoRegra(futuras[0])} em{' '}
                          {futuras[0]!.tipoItem === 'servico' ? 'serviços' : 'produtos'}
                        </p>
                      )}
                      <p className="flex flex-wrap gap-1 text-sm">
                        {NOMES_DIAS_CURTOS.map((d, i) => {
                          const turnos = p.horarios.filter((h) => h.diaSemana === i);
                          return (
                            <span
                              key={d}
                              className={`rounded-sm px-2 py-0.5 font-denso ${turnos.length ? 'bg-superficie-3 text-tinta' : 'text-tinta-fraca line-through'}`}
                            >
                              {d}
                              {turnos.length > 0 &&
                                ` ${hora(turnos[0]!.inicioMin)}–${hora(turnos[turnos.length - 1]!.fimMin)}`}
                            </span>
                          );
                        })}
                      </p>
                      {p.ativo ? (
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/equipe/ficha?id=${p.id}`}
                            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-superficie-3 px-4 font-semibold hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
                          >
                            <ChartColumn aria-hidden className="size-5" /> Ver ficha
                          </Link>
                          <Botao variante="secundario" onClick={() => setHorarios(p)}>
                            Horários
                          </Botao>
                          <Botao variante="secundario" onClick={() => setServicosDe(p)}>
                            Serviços que faz
                          </Botao>
                          <Botao variante="secundario" onClick={() => setRegra(p)}>
                            Mudar comissão
                          </Botao>
                          {p.custoFixoMensal !== null && (
                            <Botao variante="secundario" onClick={() => setFixo(p)}>
                              Mudar valor fixo
                            </Botao>
                          )}
                          <Botao variante="fantasma" onClick={() => setDesligar(p)}>
                            Desligar
                          </Botao>
                        </div>
                      ) : (
                        <Botao
                          variante="secundario"
                          className="self-start"
                          onClick={async () => {
                            setErro(null);
                            try {
                              await alterar.mutateAsync({
                                id: p.id,
                                corpo: { ativo: true, dataSaida: null },
                              });
                            } catch (e) {
                              setErro(mensagemDe(e));
                            }
                          }}
                        >
                          Reativar
                        </Botao>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <NovoProfissional
              key={completar ? `${completar.usuarioId}:${completar.unidadeId}` : 'novo'}
              aberto={novo || completar !== null}
              pessoa={completar}
              onFechar={() => {
                setNovo(false);
                setCompletar(null);
              }}
            />
            <Horarios profissional={horarios} onFechar={() => setHorarios(null)} />
            {servicosDe && (
              <ServicosQueFaz profissional={servicosDe} onFechar={() => setServicosDe(null)} />
            )}
            <NovaRegra profissional={regra} onFechar={() => setRegra(null)} />
            <ValorFixo profissional={fixo} onFechar={() => setFixo(null)} />
            <ModalConfirmacao
              aberto={desligar !== null}
              titulo={`Desligar ${desligar?.nome ?? ''}?`}
              descricao="Sai da agenda a partir de hoje e libera a vaga do plano. O histórico de comandas e comissões continua."
              textoConfirmar="Desligar"
              tom="perigo"
              carregando={alterar.isPending}
              onCancelar={() => setDesligar(null)}
              onConfirmar={async () => {
                setErro(null);
                try {
                  await alterar.mutateAsync({ id: desligar!.id, corpo: { dataSaida: hoje } });
                } catch (e) {
                  setErro(mensagemDe(e));
                }
                setDesligar(null);
              }}
            />
          </div>
        );
      }}
    </Estado>
  );
}

export function NovoProfissional({
  aberto,
  onFechar,
  pessoa = null,
}: {
  aberto: boolean;
  onFechar: () => void;
  /** Já tem acesso como barbeiro: só falta a comissão e a data de entrada. */
  pessoa?: BarbeiroSemCadastro | null;
}) {
  const { usuario, unidadeAtiva } = useApp();
  const unidades = useUnidadesDetalhe();
  const usuarios = useUsuariosEquipe();
  const opcoesUnidade = (unidades.data ?? []).filter((u) =>
    usuario.papeis.some(
      (p) =>
        (p.papel === 'dono' && p.unidadeId === null) ||
        (p.papel === 'gestor' && p.unidadeId === u.id),
    ),
  );
  const inicial = {
    unidadeId: pessoa?.unidadeId ?? (unidadeAtiva !== 'todas' ? unidadeAtiva : ''),
    usuarioId: pessoa?.usuarioId ?? '',
    nome: '',
    email: '',
    telefone: '',
    dataEntrada: dataLocal(new Date()),
    servico: '40',
    produto: '10',
  };
  const [f, setF] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [convite, setConvite] = useState<{
    linkWhatsapp: string | null;
    linkConvite?: string;
  } | null>(null);
  const criar = useAcao(
    (corpo: object) =>
      api<{ linkWhatsapp?: string | null; linkConvite?: string }>('profissionais', { corpo }),
    [chaves.profissionais, chaves.usuarios, chaves.conta],
  );
  const unidadeId = f.unidadeId || opcoesUnidade[0]?.id || '';

  function fechar() {
    setF(inicial);
    setErro(null);
    setConvite(null);
    onFechar();
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const pct = (t: string) => Math.round(Number(t.replace(',', '.')) * 100);
    const s = pct(f.servico);
    const p = pct(f.produto);
    if (!(s >= 0 && s <= 10000) || !(p >= 0 && p <= 10000))
      return setErro('Comissão entre 0 e 100%.');
    try {
      const r = await criar.mutateAsync({
        unidadeId,
        ...(f.usuarioId
          ? { usuarioId: f.usuarioId }
          : { nome: f.nome, email: f.email, telefone: f.telefone || undefined }),
        dataEntrada: f.dataEntrada,
        comissaoServico: { percentualBp: s, valorFixo: null },
        comissaoProduto: { percentualBp: p, valorFixo: null },
      });
      if (r.linkConvite)
        setConvite({ linkWhatsapp: r.linkWhatsapp ?? null, linkConvite: r.linkConvite });
      else fechar();
    } catch (er) {
      setErro(mensagemDe(er));
    }
  }

  const semProfissional = (usuarios.data ?? []).filter((u) => u.ativo);
  return (
    <Dialogo
      aberto={aberto}
      titulo={pessoa ? `Completar cadastro de ${pessoa.nome}` : 'Adicionar barbeiro'}
      descricao={
        pessoa
          ? 'Defina a data de entrada e a comissão. O horário padrão segue os dias da unidade.'
          : 'Quem ainda não tem acesso recebe o convite por e-mail.'
      }
      onFechar={fechar}
    >
      {convite ? (
        <div className="flex flex-col gap-4">
          <Aviso tom="sucesso">Barbeiro cadastrado e convite enviado por e-mail.</Aviso>
          {convite.linkWhatsapp && (
            <a
              href={convite.linkWhatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-md bg-acao px-4 font-semibold text-sobre-acao focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
            >
              <MessageCircle aria-hidden className="size-5" /> Enviar convite pelo WhatsApp
            </a>
          )}
          <p className="text-sm text-tinta-suave break-all">
            Link do convite (vale 7 dias): {convite.linkConvite}
          </p>
          <Botao variante="secundario" className="self-start" onClick={fechar}>
            Concluir
          </Botao>
        </div>
      ) : (
        <form method="post" noValidate onSubmit={enviar} className="flex flex-col gap-4">
          {erro && <Aviso tom="erro">{erro}</Aviso>}
          {opcoesUnidade.length > 1 && (
            <Selecao
              id="prof-unidade"
              rotulo="Unidade"
              value={unidadeId}
              onChange={(e) => setF({ ...f, unidadeId: e.target.value })}
              opcoes={opcoesUnidade.map((u) => ({ valor: u.id, rotulo: u.nome }))}
            />
          )}
          <Selecao
            id="prof-usuario"
            rotulo="Quem"
            value={f.usuarioId}
            onChange={(e) => setF({ ...f, usuarioId: e.target.value })}
            opcoes={[
              { valor: '', rotulo: 'Pessoa nova (convidar)' },
              ...semProfissional.map((u) => ({ valor: u.id, rotulo: `${u.nome} · ${u.email}` })),
            ]}
          />
          {!f.usuarioId && (
            <>
              <Campo
                id="prof-nome"
                rotulo="Nome"
                required
                value={f.nome}
                onChange={(e) => setF({ ...f, nome: e.target.value })}
              />
              <Campo
                id="prof-email"
                rotulo="E-mail"
                type="email"
                required
                value={f.email}
                onChange={(e) => setF({ ...f, email: e.target.value })}
              />
              <Campo
                id="prof-telefone"
                rotulo="WhatsApp (opcional)"
                inputMode="tel"
                dica="Para mandar o convite pelo WhatsApp"
                value={f.telefone}
                onChange={(e) => setF({ ...f, telefone: e.target.value })}
              />
            </>
          )}
          <Campo
            id="prof-entrada"
            rotulo="Data de entrada"
            type="date"
            value={f.dataEntrada}
            onChange={(e) => setF({ ...f, dataEntrada: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Campo
              id="prof-servico"
              rotulo="Comissão em serviços (%)"
              inputMode="decimal"
              value={f.servico}
              onChange={(e) => setF({ ...f, servico: e.target.value })}
            />
            <Campo
              id="prof-produto"
              rotulo="Em produtos (%)"
              inputMode="decimal"
              value={f.produto}
              onChange={(e) => setF({ ...f, produto: e.target.value })}
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Botao variante="secundario" onClick={fechar}>
              Cancelar
            </Botao>
            <Botao type="submit" carregando={criar.isPending} disabled={!unidadeId}>
              Adicionar
            </Botao>
          </div>
        </form>
      )}
    </Dialogo>
  );
}

function Horarios({
  profissional,
  onFechar,
}: {
  profissional: ProfissionalDetalhe | null;
  onFechar: () => void;
}) {
  const [turnos, setTurnos] = useState<Record<
    number,
    { ativo: boolean; inicio: string; fim: string }
  > | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const salvar = useAcao(
    (corpo: object) => api(`profissionais/${profissional!.id}/horarios`, { metodo: 'PUT', corpo }),
    [chaves.profissionais],
  );
  const atuais =
    turnos ??
    Object.fromEntries(
      NOMES_DIAS.map((_, i) => {
        const h = profissional?.horarios.filter((x) => x.diaSemana === i) ?? [];
        return [
          i,
          {
            ativo: h.length > 0,
            inicio: hora(h[0]?.inicioMin ?? 540),
            fim: hora(h[h.length - 1]?.fimMin ?? 1140),
          },
        ];
      }),
    );
  function fechar() {
    setTurnos(null);
    setErro(null);
    onFechar();
  }
  return (
    <Dialogo
      aberto={profissional !== null}
      titulo={`Horários de ${profissional?.nome ?? ''}`}
      descricao="Expediente de cada dia. Almoço e folgas pontuais entram como bloqueio na agenda."
      onFechar={fechar}
    >
      <form
        method="post"
        noValidate
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setErro(null);
          const horarios = Object.entries(atuais)
            .filter(([, t]) => t.ativo)
            .map(([dia, t]) => ({
              diaSemana: Number(dia),
              inicioMin: minutos(t.inicio),
              fimMin: minutos(t.fim),
            }));
          try {
            await salvar.mutateAsync({ horarios });
            fechar();
          } catch (er) {
            setErro(mensagemDe(er));
          }
        }}
      >
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        {NOMES_DIAS.map((nome, i) => {
          const t = atuais[i]!;
          const mudar = (d: Partial<typeof t>) => setTurnos({ ...atuais, [i]: { ...t, ...d } });
          return (
            <div key={nome} className="grid grid-cols-[8rem_1fr_1fr] items-center gap-2">
              <Marcador
                id={`horario-${i}`}
                rotulo={nome}
                checked={t.ativo}
                onChange={(e) => mudar({ ativo: e.target.checked })}
              />
              <input
                aria-label={`${nome}: início`}
                type="time"
                disabled={!t.ativo}
                value={t.inicio}
                onChange={(e) => mudar({ inicio: e.target.value })}
                className="min-h-11 rounded-md border border-borda bg-superficie px-2 font-denso text-tinta tabular-nums disabled:opacity-40"
              />
              <input
                aria-label={`${nome}: fim`}
                type="time"
                disabled={!t.ativo}
                value={t.fim}
                onChange={(e) => mudar({ fim: e.target.value })}
                className="min-h-11 rounded-md border border-borda bg-superficie px-2 font-denso text-tinta tabular-nums disabled:opacity-40"
              />
            </div>
          );
        })}
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Botao variante="secundario" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={salvar.isPending}>
            Salvar horários
          </Botao>
        </div>
      </form>
    </Dialogo>
  );
}

/** Salário ou ajuda de custo além da comissão: entra no custo do barbeiro no relatório do mês. */
function ValorFixo({
  profissional,
  onFechar,
}: {
  profissional: ProfissionalDetalhe | null;
  onFechar: () => void;
}) {
  const [valor, setValor] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const salvar = useAcao(
    (custoFixoMensal: number) =>
      api(`profissionais/${profissional!.id}`, { metodo: 'PATCH', corpo: { custoFixoMensal } }),
    [chaves.profissionais],
  );
  const inicial = profissional?.custoFixoMensal
    ? (profissional.custoFixoMensal / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    : '';
  const atual = valor ?? inicial;
  function fechar() {
    setValor(null);
    setErro(null);
    onFechar();
  }
  return (
    <Dialogo
      aberto={profissional !== null}
      titulo={`Valor fixo de ${profissional?.nome ?? ''}`}
      descricao="Salário, ajuda de custo ou pró-labore pago todo mês além da comissão. Entra no custo dele no relatório do mês. Deixe em branco se ele ganha só comissão."
      onFechar={fechar}
    >
      <form
        method="post"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setErro(null);
          const centavos = atual.trim() ? lerMoeda(atual) : 0;
          if (centavos === null || centavos < 0) return setErro('Valor inválido.');
          try {
            await salvar.mutateAsync(centavos);
            fechar();
          } catch (er) {
            setErro(mensagemDe(er));
          }
        }}
      >
        <Campo
          id="valor-fixo"
          rotulo="Valor fixo por mês (R$)"
          inputMode="decimal"
          placeholder="0,00"
          value={atual}
          onChange={(e) => setValor(e.target.value)}
        />
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <Botao type="submit" carregando={salvar.isPending} className="self-start">
          Salvar
        </Botao>
      </form>
    </Dialogo>
  );
}

function NovaRegra({
  profissional,
  onFechar,
}: {
  profissional: ProfissionalDetalhe | null;
  onFechar: () => void;
}) {
  const hoje = dataLocal(new Date());
  const [f, setF] = useState({
    tipoItem: 'servico',
    forma: 'percentual',
    valor: '',
    vigenciaInicio: hoje,
  });
  const [erro, setErro] = useState<string | null>(null);
  const salvar = useAcao(
    (corpo: object) => api(`profissionais/${profissional!.id}/regras-comissao`, { corpo }),
    [chaves.profissionais],
  );
  function fechar() {
    setF({ tipoItem: 'servico', forma: 'percentual', valor: '', vigenciaInicio: hoje });
    setErro(null);
    onFechar();
  }
  return (
    <Dialogo
      aberto={profissional !== null}
      titulo={`Comissão de ${profissional?.nome ?? ''}`}
      descricao="A nova regra vale a partir da data escolhida. O que já foi fechado não muda."
      onFechar={fechar}
    >
      <form
        method="post"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setErro(null);
          let regra;
          if (f.forma === 'percentual') {
            const bp = Math.round(Number(f.valor.replace(',', '.')) * 100);
            if (!(bp >= 0 && bp <= 10000)) return setErro('Percentual entre 0 e 100.');
            regra = { percentualBp: bp, valorFixo: null };
          } else {
            const c = lerMoeda(f.valor);
            if (c === null || c < 0) return setErro('Valor fixo inválido. Ex.: 15,00');
            regra = { percentualBp: null, valorFixo: c };
          }
          try {
            await salvar.mutateAsync({
              tipoItem: f.tipoItem,
              vigenciaInicio: f.vigenciaInicio,
              regra,
            });
            fechar();
          } catch (er) {
            setErro(mensagemDe(er));
          }
        }}
      >
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <Selecao
          id="regra-tipo"
          rotulo="Vale para"
          value={f.tipoItem}
          onChange={(e) => setF({ ...f, tipoItem: e.target.value })}
          opcoes={[
            { valor: 'servico', rotulo: 'Serviços' },
            { valor: 'produto', rotulo: 'Produtos' },
          ]}
        />
        <Selecao
          id="regra-forma"
          rotulo="Forma"
          value={f.forma}
          onChange={(e) => setF({ ...f, forma: e.target.value })}
          opcoes={[
            { valor: 'percentual', rotulo: 'Percentual do valor' },
            { valor: 'fixo', rotulo: 'Valor fixo por item' },
          ]}
        />
        <Campo
          id="regra-valor"
          rotulo={f.forma === 'percentual' ? 'Percentual (%)' : 'Valor por item (R$)'}
          inputMode="decimal"
          value={f.valor}
          onChange={(e) => setF({ ...f, valor: e.target.value })}
        />
        <Campo
          id="regra-vigencia"
          rotulo="Valer a partir de"
          type="date"
          min={hoje}
          value={f.vigenciaInicio}
          onChange={(e) => setF({ ...f, vigenciaInicio: e.target.value })}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Botao variante="secundario" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={salvar.isPending}>
            Salvar regra
          </Botao>
        </div>
      </form>
    </Dialogo>
  );
}

// ─── Acessos ──────────────────────────────────────────────────────────────

function Acessos() {
  const usuarios = useUsuariosEquipe();
  const unidades = useUnidadesDetalhe();
  const { usuario: eu } = useApp();
  const [convidar, setConvidar] = useState(false);
  const [papeis, setPapeis] = useState<UsuarioEquipe | null>(null);
  const [situacao, setSituacao] = useState<UsuarioEquipe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const mudarSituacao = useAcao(
    (d: { id: string; ativo: boolean }) =>
      api(`usuarios/${d.id}`, { metodo: 'PATCH', corpo: { ativo: d.ativo } }),
    [chaves.usuarios],
  );
  const nomeUnidade = (id: string | null) =>
    id === null
      ? 'todas as unidades'
      : (unidades.data?.find((u) => u.id === id)?.nome ?? 'outra unidade');

  return (
    <Estado consulta={usuarios}>
      {() => (
        <div className="flex flex-col gap-4">
          <Botao className="self-start" onClick={() => setConvidar(true)}>
            <Plus aria-hidden className="size-5" /> Convidar pessoa
          </Botao>
          {erro && <Aviso tom="erro">{erro}</Aviso>}
          <Tabela rotulo="Pessoas com acesso ao sistema">
            <thead className="bg-superficie-2">
              <tr>
                <th className={th}>Nome</th>
                <th className={th}>Papéis</th>
                <th className={th}>Situação</th>
                <th className={th}>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {usuarios.data!.map((u) => (
                <tr key={u.id} className="border-t border-borda">
                  <td className={td}>
                    <span className="block font-semibold">{u.nome}</span>
                    <span className="block text-sm text-tinta-suave">{u.email}</span>
                  </td>
                  <td className={`${td} text-sm`}>
                    {u.papeis.map((p) => (
                      <span key={`${p.papel}-${p.unidadeId}`} className="block whitespace-nowrap">
                        {NOME_PAPEL[p.papel]} ·{' '}
                        <span className="text-tinta-suave">{nomeUnidade(p.unidadeId)}</span>
                      </span>
                    ))}
                  </td>
                  <td className={td}>
                    {!u.ativo ? (
                      <Ficha tom="neutro">Desativado</Ficha>
                    ) : u.pendente ? (
                      <Ficha tom="aviso">Convite pendente</Ficha>
                    ) : (
                      <Ficha tom="acao">Ativo</Ficha>
                    )}
                  </td>
                  <td className={`${td} text-right whitespace-nowrap`}>
                    {u.id !== eu.id && (
                      <>
                        <Botao variante="fantasma" onClick={() => setPapeis(u)}>
                          Papéis
                        </Botao>
                        <Botao variante="fantasma" onClick={() => setSituacao(u)}>
                          {u.ativo ? 'Desativar' : 'Reativar'}
                        </Botao>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabela>
          <Convidar aberto={convidar} onFechar={() => setConvidar(false)} />
          <EditarPapeis usuario={papeis} onFechar={() => setPapeis(null)} />
          <ModalConfirmacao
            aberto={situacao !== null}
            titulo={
              situacao?.ativo ? `Desativar ${situacao?.nome}?` : `Reativar ${situacao?.nome ?? ''}?`
            }
            descricao={
              situacao?.ativo
                ? 'A pessoa sai do sistema na hora e não entra mais até ser reativada. O histórico fica.'
                : 'A pessoa volta a entrar com a mesma senha.'
            }
            textoConfirmar={situacao?.ativo ? 'Desativar' : 'Reativar'}
            tom={situacao?.ativo ? 'perigo' : 'acao'}
            carregando={mudarSituacao.isPending}
            onCancelar={() => setSituacao(null)}
            onConfirmar={async () => {
              setErro(null);
              try {
                await mudarSituacao.mutateAsync({ id: situacao!.id, ativo: !situacao!.ativo });
              } catch (e) {
                setErro(mensagemDe(e));
              }
              setSituacao(null);
            }}
          />
        </div>
      )}
    </Estado>
  );
}

function papeisQuePossoDar(eu: ReturnType<typeof useApp>['usuario']): Papel[] {
  return eu.papeis.some((p) => p.papel === 'dono')
    ? ['dono', 'gestor', 'recepcao', 'barbeiro']
    : ['recepcao', 'barbeiro'];
}

function Convidar({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const { usuario: eu, unidadeAtiva } = useApp();
  const unidades = useUnidadesDetalhe();
  const opcoesPapel = papeisQuePossoDar(eu);
  const inicial = {
    nome: '',
    email: '',
    telefone: '',
    papel: 'barbeiro' as Papel,
    unidadeId: unidadeAtiva !== 'todas' ? unidadeAtiva : '',
  };
  const [f, setF] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<{ linkWhatsapp: string | null; linkConvite: string } | null>(
    null,
  );
  const enviar = useAcao(
    (corpo: object) =>
      api<{ linkWhatsapp: string | null; linkConvite: string }>('usuarios/convites', { corpo }),
    [chaves.usuarios],
  );
  const unidadesPermitidas = (unidades.data ?? []).filter((u) =>
    eu.papeis.some((p) => p.unidadeId === null || p.unidadeId === u.id),
  );
  const unidadeId = f.papel === 'dono' ? null : f.unidadeId || unidadesPermitidas[0]?.id || null;
  function fechar() {
    setF(inicial);
    setErro(null);
    setFeito(null);
    onFechar();
  }
  return (
    <Dialogo
      aberto={aberto}
      titulo="Convidar pessoa"
      descricao="Ela recebe um e-mail para criar a senha. O convite vale 7 dias."
      onFechar={fechar}
    >
      {feito ? (
        <div className="flex flex-col gap-4">
          <Aviso tom="sucesso">Convite enviado por e-mail.</Aviso>
          {f.papel === 'barbeiro' && (
            <p className="text-sm text-tinta-suave">
              Falta a comissão e a data de entrada: na aba “Profissionais”, toque em “Completar
              cadastro” ao lado do nome. Da próxima vez, use “Adicionar barbeiro” lá, que convida e
              cadastra de uma vez.
            </p>
          )}
          {feito.linkWhatsapp && (
            <a
              href={feito.linkWhatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-md bg-acao px-4 font-semibold text-sobre-acao"
            >
              <MessageCircle aria-hidden className="size-5" /> Enviar também pelo WhatsApp
            </a>
          )}
          <Botao variante="secundario" className="self-start" onClick={fechar}>
            Concluir
          </Botao>
        </div>
      ) : (
        <form
          method="post"
          noValidate
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setErro(null);
            try {
              setFeito(
                await enviar.mutateAsync({
                  nome: f.nome,
                  email: f.email,
                  telefone: f.telefone || undefined,
                  papel: f.papel,
                  unidadeId,
                }),
              );
            } catch (er) {
              setErro(
                er instanceof ErroApi && er.campos.length
                  ? er.campos.map((c) => c.mensagem).join(' ')
                  : mensagemDe(er),
              );
            }
          }}
        >
          {erro && <Aviso tom="erro">{erro}</Aviso>}
          <Campo
            id="convite-nome"
            rotulo="Nome"
            value={f.nome}
            onChange={(e) => setF({ ...f, nome: e.target.value })}
          />
          <Campo
            id="convite-email"
            rotulo="E-mail"
            type="email"
            value={f.email}
            onChange={(e) => setF({ ...f, email: e.target.value })}
          />
          <Campo
            id="convite-telefone"
            rotulo="WhatsApp (opcional)"
            inputMode="tel"
            value={f.telefone}
            onChange={(e) => setF({ ...f, telefone: e.target.value })}
          />
          <Selecao
            id="convite-papel"
            rotulo="Papel"
            value={f.papel}
            onChange={(e) => setF({ ...f, papel: e.target.value as Papel })}
            opcoes={opcoesPapel.map((p) => ({ valor: p, rotulo: NOME_PAPEL[p] }))}
          />
          {f.papel !== 'dono' && (
            <Selecao
              id="convite-unidade"
              rotulo="Unidade"
              value={unidadeId ?? ''}
              onChange={(e) => setF({ ...f, unidadeId: e.target.value })}
              opcoes={unidadesPermitidas.map((u) => ({ valor: u.id, rotulo: u.nome }))}
            />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Botao variante="secundario" onClick={fechar}>
              Cancelar
            </Botao>
            <Botao type="submit" carregando={enviar.isPending}>
              Enviar convite
            </Botao>
          </div>
        </form>
      )}
    </Dialogo>
  );
}

function EditarPapeis({
  usuario,
  onFechar,
}: {
  usuario: UsuarioEquipe | null;
  onFechar: () => void;
}) {
  const { usuario: eu } = useApp();
  const unidades = useUnidadesDetalhe();
  const [marcados, setMarcados] = useState<Set<string> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const salvar = useAcao(
    (corpo: object) => api(`usuarios/${usuario!.id}/papeis`, { metodo: 'PUT', corpo }),
    [chaves.usuarios],
  );
  const possiveis = papeisQuePossoDar(eu);
  const chave = (papel: string, unidadeId: string | null) => `${papel}|${unidadeId ?? ''}`;
  const atuais =
    marcados ?? new Set((usuario?.papeis ?? []).map((p) => chave(p.papel, p.unidadeId)));
  const linhas: { papel: Papel; unidadeId: string | null; rotulo: string }[] = [];
  if (possiveis.includes('dono'))
    linhas.push({ papel: 'dono', unidadeId: null, rotulo: 'Dono · todas as unidades' });
  for (const u of unidades.data ?? []) {
    if (!eu.papeis.some((p) => p.unidadeId === null || p.unidadeId === u.id)) continue;
    for (const papel of possiveis.filter((p) => p !== 'dono'))
      linhas.push({ papel, unidadeId: u.id, rotulo: `${NOME_PAPEL[papel]} · ${u.nome}` });
  }
  function fechar() {
    setMarcados(null);
    setErro(null);
    onFechar();
  }
  return (
    <Dialogo
      aberto={usuario !== null}
      titulo={`Papéis de ${usuario?.nome ?? ''}`}
      descricao="Ao salvar, a pessoa precisa entrar de novo para ver o menu novo."
      onFechar={fechar}
    >
      <form
        method="post"
        noValidate
        className="flex flex-col gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setErro(null);
          const papeis = [...atuais].map((k) => {
            const [papel, unidadeId] = k.split('|');
            return { papel, unidadeId: unidadeId || null };
          });
          try {
            await salvar.mutateAsync({ papeis });
            fechar();
          } catch (er) {
            setErro(
              er instanceof ErroApi && er.campos.length
                ? er.campos.map((c) => c.mensagem).join(' ')
                : mensagemDe(er),
            );
          }
        }}
      >
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        {linhas.map((l) => {
          const k = chave(l.papel, l.unidadeId);
          return (
            <Marcador
              key={k}
              id={`papel-${k}`}
              rotulo={l.rotulo}
              checked={atuais.has(k)}
              onChange={(e) => {
                const novo = new Set(atuais);
                if (e.target.checked) novo.add(k);
                else novo.delete(k);
                setMarcados(novo);
              }}
            />
          );
        })}
        <div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-end">
          <Botao variante="secundario" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={salvar.isPending} disabled={atuais.size === 0}>
            Salvar papéis
          </Botao>
        </div>
      </form>
    </Dialogo>
  );
}

/**
 * P5 (lote 7g): os serviços que o barbeiro faz. Vale no link, no bot, no balcão e no site. Com
 * tudo marcado, guarda "faz todos" (serviço novo também entra).
 */
function ServicosQueFaz({
  profissional,
  onFechar,
}: {
  profissional: ProfissionalDetalhe;
  onFechar: () => void;
}) {
  const servicos = useServicos();
  const daUnidade = (servicos.data ?? []).filter(
    (s) => s.ativo !== false && s.unidadeIds.includes(profissional.unidadeId),
  );
  const [marcados, setMarcados] = useState<string[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const salvar = useAcao(
    (servicoIds: string[]) =>
      api(`profissionais/${profissional.id}/servicos`, { metodo: 'PUT', corpo: { servicoIds } }),
    [chaves.profissionais],
  );
  const atuais =
    marcados ??
    (profissional.servicoIds.length ? profissional.servicoIds : daUnidade.map((s) => s.id));
  const todos = daUnidade.length > 0 && daUnidade.every((s) => atuais.includes(s.id));
  return (
    <Dialogo
      aberto
      titulo={`Serviços que ${profissional.nome.split(' ')[0]} faz`}
      descricao="O cliente só consegue marcar com ele o que estiver marcado aqui, pelo link, pelo WhatsApp ou no balcão."
      onFechar={onFechar}
    >
      <form
        method="post"
        noValidate
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setErro(null);
          if (!atuais.some((id) => daUnidade.some((s) => s.id === id)))
            return setErro('Marque pelo menos um serviço.');
          try {
            await salvar.mutateAsync(todos ? [] : atuais);
            onFechar();
          } catch (er) {
            setErro(mensagemDe(er));
          }
        }}
      >
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        {servicos.isPending ? (
          <p className="text-tinta-suave">Carregando os serviços…</p>
        ) : daUnidade.length === 0 ? (
          <p className="text-tinta-suave">Nenhum serviço nesta unidade ainda.</p>
        ) : (
          <>
            <Marcador
              id="faz-todos"
              rotulo="Faz todos os serviços (inclusive os que forem criados depois)"
              checked={todos}
              onChange={(e) => setMarcados(e.target.checked ? daUnidade.map((s) => s.id) : [])}
            />
            <div className="flex flex-col gap-1 border-t border-borda pt-2">
              {daUnidade.map((s) => (
                <Marcador
                  key={s.id}
                  id={`faz-${s.id}`}
                  rotulo={s.nome}
                  checked={atuais.includes(s.id)}
                  onChange={(e) =>
                    setMarcados(
                      e.target.checked ? [...atuais, s.id] : atuais.filter((x) => x !== s.id),
                    )
                  }
                />
              ))}
            </div>
          </>
        )}
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Botao variante="secundario" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={salvar.isPending}>
            Salvar serviços
          </Botao>
        </div>
      </form>
    </Dialogo>
  );
}
