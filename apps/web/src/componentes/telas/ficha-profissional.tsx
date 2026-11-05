'use client';

import {
  formatarData,
  formatarDataHora,
  formatarFracao,
  formatarMoeda,
  formatarNumero,
  linkWhatsapp,
  mensagemRetorno,
  type FichaProfissional,
  type SituacaoCliente,
} from '@pente-fino/shared';
import { Botao, Campo, CartaoIndicador, cn, EstadoVazio, EtiquetaEstado } from '@pente-fino/ui';
import { MessageCircle, Printer, Star, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useFichaProfissional } from '@/lib/consultas';
import { limitesDoMes, mesAtual, nomeDoMes } from '@/lib/periodo';
import { comparar, SeletorMes } from '../indicadores';
import { useApp } from '../contexto-app';
import { MandarMensagem } from '../mandar-mensagem';
import { ComentarioDaPesquisa, ResumoDeNotas } from '../notas';
import { CabecalhoPagina, Estado, Ficha, Tabela, td, th } from '../pagina';

// ─── Período ──────────────────────────────────────────────────────────────

export type Periodo = { tipo: 'mes'; mes: string } | { tipo: 'intervalo'; de: string; ate: string };

export function limitesDoPeriodo(p: Periodo): [string, string] {
  return p.tipo === 'mes' ? limitesDoMes(p.mes) : [p.de, p.ate];
}

function rotuloPeriodo(p: Periodo): string {
  if (p.tipo === 'mes') return nomeDoMes(p.mes);
  return `${formatarData(`${p.de}T12:00:00Z`)} a ${formatarData(`${p.ate}T12:00:00Z`)}`;
}

/** Mês a mês (o comum) ou um intervalo livre de até um ano. */
export function SeletorPeriodo({
  periodo,
  onMudar,
}: {
  periodo: Periodo;
  onMudar: (p: Periodo) => void;
}) {
  const [de, ate] = limitesDoPeriodo(periodo);
  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="Tipo de período" className="flex gap-1 self-start">
        {(['mes', 'intervalo'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={periodo.tipo === t}
            onClick={() =>
              onMudar(
                t === 'mes' ? { tipo: 'mes', mes: mesAtual() } : { tipo: 'intervalo', de, ate },
              )
            }
            className={cn(
              'min-h-11 rounded-md px-3 font-medium focus-visible:outline-2 focus-visible:outline-foco',
              periodo.tipo === t
                ? 'bg-superficie-3 text-tinta'
                : 'text-tinta-suave hover:text-tinta',
            )}
          >
            {t === 'mes' ? 'Mês' : 'Intervalo'}
          </button>
        ))}
      </div>
      {periodo.tipo === 'mes' ? (
        <SeletorMes mes={periodo.mes} onMudar={(mes) => onMudar({ tipo: 'mes', mes })} />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Campo
            id="periodo-de"
            rotulo="De"
            type="date"
            value={periodo.de}
            max={periodo.ate}
            onChange={(e) => e.target.value && onMudar({ ...periodo, de: e.target.value })}
          />
          <Campo
            id="periodo-ate"
            rotulo="Até"
            type="date"
            value={periodo.ate}
            min={periodo.de}
            onChange={(e) => e.target.value && onMudar({ ...periodo, ate: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}

// ─── Peças ────────────────────────────────────────────────────────────────

function Secao({
  id,
  titulo,
  pergunta,
  children,
}: {
  id: string;
  titulo: string;
  pergunta?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 break-inside-avoid">
      <div>
        <h2 id={id} className="text-2xl font-semibold">
          {titulo}
        </h2>
        {pergunta && <p className="text-tinta-suave">{pergunta}</p>}
      </div>
      {children}
    </section>
  );
}

/** Número pequeno com rótulo, para grupos onde um cartão inteiro seria demais. */
function Dado({ rotulo, valor, dica }: { rotulo: string; valor: string; dica?: string }) {
  return (
    <div className="flex flex-col rounded-lg border border-borda bg-superficie p-4">
      <dt className="text-sm text-tinta-suave">{rotulo}</dt>
      <dd className="font-denso text-3xl font-bold tabular-nums">{valor}</dd>
      {dica && <dd className="text-sm text-tinta-suave">{dica}</dd>}
    </div>
  );
}

const MESES_CURTOS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];
const mesCurto = (m: string) => MESES_CURTOS[Number(m.slice(5, 7)) - 1] ?? m;

/**
 * Faturamento dos últimos 6 meses: uma série, barras finas ancoradas na base, valor
 * escrito só no mês atual e o resto no toque/foco. Tabela para quem prefere ler.
 */
function GraficoEvolucao({ evolucao }: { evolucao: FichaProfissional['evolucao'] }) {
  const [foco, setFoco] = useState<number | null>(null);
  const maximo = Math.max(...evolucao.map((e) => e.faturamento), 1);
  const ultimo = evolucao.length - 1;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-4">
      <div
        className="relative flex h-48 items-end gap-2 border-b border-borda sm:gap-4"
        role="list"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-borda"
        />
        <span
          aria-hidden
          className="absolute -top-0.5 right-0 text-xs text-tinta-fraca tabular-nums"
        >
          {formatarMoeda(maximo)}
        </span>
        {evolucao.map((e, i) => {
          const altura = Math.max((e.faturamento / maximo) * 100, e.faturamento > 0 ? 2 : 0);
          const ativo = foco === i;
          return (
            <div
              key={e.mes}
              role="listitem"
              tabIndex={0}
              aria-label={`${nomeDoMes(e.mes)}: ${formatarMoeda(e.faturamento)}, ${e.clientes} clientes`}
              onMouseEnter={() => setFoco(i)}
              onMouseLeave={() => setFoco(null)}
              onFocus={() => setFoco(i)}
              onBlur={() => setFoco(null)}
              className="group relative flex h-full flex-1 items-end justify-center outline-none"
            >
              {(ativo || (foco === null && i === ultimo)) && (
                <span
                  className="absolute bottom-[calc(var(--h)+0.375rem)] z-10 whitespace-nowrap rounded-md border border-borda bg-superficie-2 px-2 py-1 text-sm tabular-nums shadow-lg"
                  style={{ ['--h' as string]: `${altura}%` }}
                >
                  <span className="font-semibold">{formatarMoeda(e.faturamento)}</span>
                  {ativo && (
                    <span className="block text-xs text-tinta-suave">{e.clientes} clientes</span>
                  )}
                </span>
              )}
              <span
                aria-hidden
                style={{ height: `${altura}%`, animationDelay: `${i * 50}ms` }}
                className={cn(
                  'animar-barra-y w-full max-w-10 rounded-t-[4px] transition-colors group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-foco',
                  i === ultimo || ativo ? 'bg-modulo-texto' : 'bg-modulo-texto/45',
                )}
              />
            </div>
          );
        })}
      </div>
      <div aria-hidden className="flex gap-2 sm:gap-4">
        {evolucao.map((e) => (
          <span key={e.mes} className="flex-1 text-center text-sm text-tinta-suave">
            {mesCurto(e.mes)}
          </span>
        ))}
      </div>
      <details className="text-sm">
        <summary className="min-h-11 cursor-pointer content-center text-tinta-suave hover:text-tinta">
          Ver em tabela
        </summary>
        <Tabela rotulo="Evolução mês a mês" className="mt-2">
          <thead>
            <tr>
              <th className={th}>Mês</th>
              <th className={`${th} text-right`}>Faturamento</th>
              <th className={`${th} text-right`}>Clientes</th>
              <th className={`${th} text-right`}>Ticket</th>
              <th className={`${th} text-right`}>Comissão</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borda tabular-nums">
            {evolucao.map((e) => (
              <tr key={e.mes}>
                <td className={`${td} first-letter:uppercase`}>{nomeDoMes(e.mes)}</td>
                <td className={`${td} text-right`}>{formatarMoeda(e.faturamento)}</td>
                <td className={`${td} text-right`}>{e.clientes}</td>
                <td className={`${td} text-right`}>{formatarMoeda(e.ticketMedio)}</td>
                <td className={`${td} text-right`}>{formatarMoeda(e.comissao)}</td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      </details>
    </div>
  );
}

const SITUACAO: Record<SituacaoCliente, { rotulo: string; tom: 'acao' | 'neutro' | 'aviso' }> = {
  novo: { rotulo: 'Primeira vez', tom: 'neutro' },
  voltou_no_prazo: { rotulo: 'Voltou', tom: 'acao' },
  voltou_depois: { rotulo: 'Voltou tarde', tom: 'aviso' },
};

const minutos = (n: number | null) => (n === null ? '—' : `${n} min`);
const dataCurta = (d: string) => formatarData(`${d}T12:00:00Z`);

// ─── Ficha ────────────────────────────────────────────────────────────────

/**
 * Tudo sobre um profissional no período. A API já corta o que o papel não vê:
 * margem só para o dono; média da unidade e telefone só para dono e gestor.
 */
export function FichaDoProfissional({
  id,
  periodo,
  onPeriodo,
  titulo,
}: {
  id: string;
  periodo: Periodo;
  onPeriodo: (p: Periodo) => void;
  /** Título fixo (barbeiro vê "Desempenho"); sem ele, o nome do profissional. */
  titulo?: string;
}) {
  const [de, ate] = limitesDoPeriodo(periodo);
  const ficha = useFichaProfissional(id, de, ate);
  const nome = ficha.data?.profissional.nome ?? '';
  const primeiro = nome.split(' ')[0] ?? '';
  return (
    <div className="flex flex-col gap-10">
      <CabecalhoPagina
        titulo={titulo ?? (nome || 'Ficha do profissional')}
        pergunta={
          titulo
            ? `Como foi ${rotuloPeriodo(periodo)}?`
            : `Como foi o trabalho de ${primeiro} em ${rotuloPeriodo(periodo)}?`
        }
        acao={
          <div className="flex flex-wrap items-end gap-3" data-nao-imprimir>
            <SeletorPeriodo periodo={periodo} onMudar={onPeriodo} />
            <Botao variante="secundario" onClick={() => window.print()}>
              <Printer aria-hidden className="size-5" /> Imprimir ou salvar PDF
            </Botao>
          </div>
        }
      />
      <Estado consulta={ficha}>{() => <Conteudo f={ficha.data!} periodo={periodo} />}</Estado>
    </div>
  );
}

function Conteudo({ f, periodo }: { f: FichaProfissional; periodo: Periodo }) {
  // Mandar mensagem pela barbearia é do balcão e da gestão, nunca do barbeiro.
  const { papeis } = useApp();
  const podeChamar = papeis.some((p) => p === 'dono' || p === 'gestor' || p === 'recepcao');
  const r = f.resumo;
  const vsMedia = 'vs. média da unidade';
  const media = f.media;
  const primeiro = f.profissional.nome.split(' ')[0] ?? '';
  const semDados = r.clientes === 0 && f.comandas.length === 0;
  return (
    <>
      <p className="-mt-6 flex flex-wrap items-center gap-2 text-tinta-suave">
        <UserRound aria-hidden className="size-5" />
        {f.profissional.unidade} · desde {dataCurta(f.profissional.dataEntrada)}
        {!f.profissional.ativo && <Ficha tom="neutro">Desligado</Ficha>}
      </p>

      {semDados && (
        <EstadoVazio
          icone={UserRound}
          titulo={`Nenhum atendimento em ${rotuloPeriodo(periodo)}`}
          texto="Os números aparecem quando as comandas deste profissional forem fechadas."
        />
      )}

      <Secao id="ficha-resumo" titulo="Resumo">
        <div className="animar-escalonado grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CartaoIndicador
            rotulo="Faturamento"
            valor={formatarMoeda(r.faturamento)}
            comparacao={media ? comparar(r.faturamento, media.faturamento, vsMedia) : undefined}
            origem="Serviços e produtos das comandas fechadas com ele, menos descontos."
          />
          <CartaoIndicador
            rotulo="Clientes"
            valor={formatarNumero(r.clientes)}
            comparacao={media ? comparar(r.clientes, media.clientes, vsMedia) : undefined}
            origem="Comandas fechadas com pelo menos um serviço."
          />
          <CartaoIndicador
            rotulo="Ticket médio"
            valor={formatarMoeda(r.ticketMedio)}
            comparacao={media ? comparar(r.ticketMedio, media.ticketMedio, vsMedia) : undefined}
            origem="Faturamento ÷ clientes."
          />
          <CartaoIndicador
            rotulo="Extras"
            valor={formatarFracao(r.percentualExtras)}
            comparacao={
              media
                ? comparar(r.percentualExtras, media.percentualExtras, vsMedia, true, 'pontos')
                : undefined
            }
            origem={`${r.extrasQuantidade} extras ÷ ${r.clientes} clientes.`}
          />
          <CartaoIndicador
            rotulo="Atendimentos"
            valor={formatarNumero(r.atendimentos)}
            comparacao={media ? comparar(r.atendimentos, media.atendimentos, vsMedia) : undefined}
            origem="Soma do peso dos serviços."
          />
          <CartaoIndicador
            rotulo="Ocupação da agenda"
            valor={formatarFracao(f.ocupacao.fracao)}
            origem={`${formatarNumero(Math.round(f.ocupacao.agendadoMin / 60))} h agendadas de ${formatarNumero(Math.round(f.ocupacao.disponivelMin / 60))} h de expediente, até hoje.`}
          />
          <CartaoIndicador
            rotulo="Comissão"
            valor={formatarMoeda(f.comissao.fechado)}
            origem={`A receber ${formatarMoeda(f.comissao.aReceber)} · pago ${formatarMoeda(f.comissao.pago)} · previsto em comandas abertas ${formatarMoeda(f.comissao.previsto)}.`}
          />
          {f.meta && (
            <CartaoIndicador
              rotulo="Parte na meta"
              valor={formatarFracao(f.meta.fracao)}
              origem={`Do objetivo de ${formatarMoeda(f.meta.objetivo)} da unidade no mês.`}
            />
          )}
        </div>
      </Secao>

      <Secao id="ficha-evolucao" titulo="Evolução" pergunta="Faturamento dos últimos 6 meses.">
        <GraficoEvolucao evolucao={f.evolucao} />
      </Secao>

      <Secao
        id="ficha-servicos"
        titulo="Serviços"
        pergunta="O que ele faz e quanto tempo leva de verdade."
      >
        {f.servicos.length === 0 ? (
          <p className="text-tinta-suave">Nenhum serviço fechado no período.</p>
        ) : (
          <Tabela rotulo="Serviços feitos no período">
            <thead>
              <tr>
                <th className={th}>Serviço</th>
                <th className={`${th} text-right`}>Vezes</th>
                <th className={`${th} text-right`}>Receita</th>
                <th className={`${th} text-right`}>Tempo real</th>
                {f.verMargem && <th className={`${th} text-right`}>Lucro</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-borda tabular-nums">
              {f.servicos.map((s) => {
                const lento =
                  s.tempoRealMedioMin !== null && s.tempoRealMedioMin > s.duracaoPrevistaMin + 5;
                return (
                  <tr key={s.servicoId}>
                    <th scope="row" className={`${td} text-left font-medium`}>
                      {s.nome}
                      {s.comoExtra > 0 && (
                        <span className="block text-sm font-normal text-tinta-suave">
                          {s.comoExtra} como extra
                        </span>
                      )}
                    </th>
                    <td className={`${td} text-right`}>{s.quantidade}</td>
                    <td className={`${td} text-right`}>{formatarMoeda(s.receita)}</td>
                    <td className={`${td} text-right`}>
                      <span className={lento ? 'text-aviso-texto' : undefined}>
                        {minutos(s.tempoRealMedioMin)}
                      </span>
                      <span className="block text-sm text-tinta-suave">
                        previsto {s.duracaoPrevistaMin} min
                      </span>
                    </td>
                    {f.verMargem && (
                      <td className={`${td} text-right`}>{formatarMoeda(s.lucro ?? 0)}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </Tabela>
        )}
        <p className="text-sm text-tinta-suave">
          Tempo real: de “começar atendimento” até “confirmar”, medido nas comandas com um serviço
          só.
        </p>
        {f.produtos.length > 0 && (
          <p className="text-tinta-suave">
            <span className="font-medium text-tinta">Produtos vendidos: </span>
            {f.produtos
              .slice(0, 5)
              .map((p) => `${p.nome} (${p.quantidade})`)
              .join(' · ')}
          </p>
        )}
      </Secao>

      <Secao id="ficha-clientes" titulo="Clientes" pergunta="Quem volta, quem é novo e quem sumiu.">
        <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Dado
            rotulo="Voltaram em até 45 dias"
            valor={formatarFracao(f.clientes.resumo.taxaRetorno, 0)}
            dica={`${f.clientes.resumo.voltaramNoPrazo} de ${f.clientes.resumo.atendidos} clientes`}
          />
          <Dado rotulo="Primeira vez com ele" valor={formatarNumero(f.clientes.resumo.novos)} />
          <Dado
            rotulo="Volta, em média, a cada"
            valor={
              f.clientes.resumo.intervaloMedioDias === null
                ? '—'
                : `${f.clientes.resumo.intervaloMedioDias} dias`
            }
          />
          <Dado
            rotulo="Faltas"
            valor={formatarNumero(f.clientes.faltas)}
            dica="Agendou e não veio"
          />
        </dl>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold">Quem mais veio</h3>
            {f.clientes.lista.length === 0 ? (
              <p className="text-tinta-suave">Nenhum cliente no período.</p>
            ) : (
              <ul className="divide-y divide-borda rounded-lg border border-borda bg-superficie">
                {f.clientes.lista.slice(0, 15).map((c) => (
                  <li
                    key={c.clienteId}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{c.nome}</span>
                      <span className="text-sm text-tinta-suave">
                        {c.visitas} {c.visitas === 1 ? 'visita' : 'visitas'}
                        {c.intervaloHabitualDias !== null &&
                          ` · a cada ${c.intervaloHabitualDias} dias`}
                      </span>
                    </span>
                    <Ficha tom={SITUACAO[c.situacao].tom}>{SITUACAO[c.situacao].rotulo}</Ficha>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold">Para chamar de volta</h3>
            {f.clientes.sumidos.length === 0 ? (
              <p className="text-tinta-suave">Ninguém passou do costume de voltar. Ótimo sinal.</p>
            ) : (
              <ul className="divide-y divide-borda rounded-lg border border-borda bg-superficie">
                {f.clientes.sumidos.slice(0, 15).map((c) => {
                  const link = linkWhatsapp(
                    c.telefone,
                    mensagemRetorno({
                      cliente: c.nome,
                      barbeiro: f.profissional.nome,
                      unidade: f.profissional.unidade,
                      linkAgendamento: f.linkAgendamento,
                    }),
                  );
                  return (
                    <li
                      key={c.clienteId}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{c.nome}</span>
                        <span className="text-sm text-tinta-suave">
                          {c.diasSemVir} dias sem vir · costumava voltar em {c.limiteDias}
                        </span>
                      </span>
                      {link && podeChamar && (
                        <BotaoChamar
                          clienteId={c.clienteId}
                          nome={c.nome}
                          telefone={c.telefone}
                          texto={mensagemRetorno({
                            cliente: c.nome,
                            barbeiro: f.profissional.nome,
                            unidade: f.profissional.unidade,
                            linkAgendamento: f.linkAgendamento,
                          })}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </Secao>

      <Secao id="ficha-rotina" titulo="Rotina" pergunta="Confirma no app, começa na hora?">
        <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Dado
            rotulo="Confirmou no app"
            valor={formatarFracao(f.rotina.percentualConfirmadas, 0)}
            dica={`${f.rotina.confirmadasPeloBarbeiro} de ${f.rotina.comandas} comandas`}
          />
          <Dado
            rotulo="Confirmou no prazo"
            valor={formatarFracao(f.rotina.percentualNoPrazo, 0)}
            dica="Até 15 min depois do horário"
          />
          <Dado
            rotulo="Demora para confirmar"
            valor={minutos(f.rotina.minutosAteConfirmar)}
            dica="Depois do fim do horário"
          />
          <Dado
            rotulo="Começou atrasado"
            valor={formatarNumero(f.rotina.atrasos)}
            dica={
              f.rotina.atrasoMedioMin === null
                ? 'Mais de 10 min depois do horário'
                : `Em média ${f.rotina.atrasoMedioMin} min`
            }
          />
        </dl>
      </Secao>

      <Secao
        id="ficha-avaliacoes"
        titulo="Avaliações"
        pergunta="O que os clientes acham do atendimento."
      >
        {f.avaliacoes.enviadas === 0 && f.avaliacoes.respostas === 0 ? (
          <div className="flex items-start gap-3 rounded-lg border border-dashed border-borda-forte p-4 text-tinta-suave">
            <Star aria-hidden className="mt-0.5 size-5 shrink-0" />
            <p>
              Nenhuma pesquisa no período. Uma hora depois de fechar a comanda, o cliente que aceita
              avisos e já conversou com o WhatsApp da barbearia recebe a pergunta de 1 a 5.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <div className="flex flex-col gap-2">
              <ResumoDeNotas titulo="Atendimento" resumo={f.avaliacoes} />
              {f.avaliacoes.taxaResposta !== null && (
                <p className="text-sm text-tinta-suave">
                  {formatarFracao(f.avaliacoes.taxaResposta, 0)} responderam (
                  {f.avaliacoes.respostas} de {f.avaliacoes.enviadas} pesquisas).
                </p>
              )}
            </div>
            {f.avaliacoes.comentarios.length === 0 ? (
              <p className="text-tinta-suave">Sem comentários no período.</p>
            ) : (
              <ul className="flex flex-col gap-2" aria-label="Comentários dos clientes">
                {f.avaliacoes.comentarios.map((c) => (
                  <ComentarioDaPesquisa key={c.comandaId} c={c} />
                ))}
              </ul>
            )}
          </div>
        )}
      </Secao>

      <Secao
        id="ficha-comandas"
        titulo="Comandas atendidas"
        pergunta={`${f.comandas.length} no período${f.comandas.some((c) => c.reaberta) ? ', reabertas destacadas' : ''}.`}
      >
        {f.comandas.length === 0 ? (
          <p className="text-tinta-suave">Nenhuma comanda de {primeiro} no período.</p>
        ) : (
          <Tabela rotulo="Comandas atendidas no período">
            <thead>
              <tr>
                <th className={th}>Quando</th>
                <th className={th}>Cliente</th>
                <th className={th}>Itens</th>
                <th className={`${th} text-right`}>Total</th>
                <th className={th}>Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {f.comandas.map((c) => (
                <tr key={c.id} className={c.reaberta ? 'bg-aviso/5' : undefined}>
                  <td className={`${td} whitespace-nowrap tabular-nums`}>
                    <Link
                      href={`/comandas?id=${c.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {formatarDataHora(c.data)}
                    </Link>
                  </td>
                  <td className={td}>{c.cliente ?? 'Sem cadastro'}</td>
                  <td className={`${td} text-tinta-suave`}>{c.itens.join(', ')}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatarMoeda(c.total)}</td>
                  <td className={td}>
                    <span className="flex flex-wrap gap-1">
                      <EtiquetaEstado estado={c.status} />
                      {c.reaberta && <Ficha tom="aviso">Reaberta</Ficha>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </Secao>
    </>
  );
}

/** "Chamar" o cliente sumido: mensagem pronta, pelo WhatsApp da barbearia ou pelo link. */
function BotaoChamar({
  clienteId,
  nome,
  telefone,
  texto,
}: {
  clienteId: string;
  nome: string;
  telefone: string | null;
  texto: string;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Botao
        variante="secundario"
        data-nao-imprimir
        aria-label={`Chamar ${nome} no WhatsApp`}
        className="shrink-0"
        onClick={() => setAberto(true)}
      >
        <MessageCircle aria-hidden className="size-5" /> Chamar
      </Botao>
      <MandarMensagem
        aberto={aberto}
        onFechar={() => setAberto(false)}
        clienteId={clienteId}
        nome={nome}
        telefone={telefone}
        textoInicial={texto}
      />
    </>
  );
}
