'use client';

// Painel do dia do dono e do gestor (Etapa 23.1), no topo do Início: o dia inteiro numa tela —
// quanto entrou e quanto ainda vai entrar, a agenda, quanto precisa entrar por dia para a meta,
// o que precisa de alguém agora (cada item leva à tela onde se resolve) e os próximos horários.
import {
  dataLocal,
  formatarFracao,
  formatarHora,
  formatarMoeda,
  formatarNumero,
  pendenciasDoDia,
  porDiaParaMeta,
  resumoDasMetas,
  type ItemDoDia,
  type TomPendencia,
} from '@pente-fino/shared';
import { cn } from '@pente-fino/ui';
import { ArrowRight, CircleCheck, Clock } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import {
  useAvaliacoes,
  useBot,
  useCaixa,
  useConversas,
  useMetas,
  useResumoDia,
  useResumoMes,
} from '@/lib/consultas';
import { limitesDoMes, mesAtual } from '@/lib/periodo';
import { useApp } from './contexto-app';

const COR: Record<TomPendencia, string> = {
  perigo: 'border-perigo-texto/50 text-perigo-texto',
  aviso: 'border-aviso-texto/50 text-aviso-texto',
  neutro: 'border-borda-forte text-tinta',
};

function Cartao({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-borda bg-superficie p-3 sm:p-4">
      <span className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
        {rotulo}
      </span>
      <span className="font-denso text-2xl font-bold tabular-nums sm:text-3xl">{valor}</span>
      <span className="text-sm text-tinta-suave">{detalhe}</span>
    </div>
  );
}

export function PainelHoje() {
  const { unidadeAtiva, unidades, papeis } = useApp();
  const [agora] = useState(() => new Date());
  const hoje = dataLocal(agora);
  const mes = mesAtual();
  const [de, ate] = limitesDoMes(mes);
  const unidadeUnica =
    unidadeAtiva && unidadeAtiva !== 'todas'
      ? unidadeAtiva
      : unidades.length === 1
        ? unidades[0]!.id
        : null;
  const gestao = papeis.includes('dono') || papeis.includes('gestor');

  const resumo = useResumoDia(unidadeAtiva, hoje, null);
  const resumoMes = useResumoMes(unidadeAtiva, mes, null);
  const metas = useMetas(unidadeAtiva, mes);
  const caixa = useCaixa(unidadeUnica, hoje);
  const conversas = useConversas(unidadeAtiva ?? 'todas', gestao);
  const bot = useBot(gestao);
  const avaliacoes = useAvaliacoes(unidadeAtiva, de, ate);

  const r = resumo.data;
  if (!r) return null;
  const t = r.totais;

  const caidas = (bot.data?.unidades ?? [])
    .filter((u) => u.conexao?.caiuEm && u.conexao.status !== 'conectado')
    .filter((u) => !unidadeUnica || u.id === unidadeUnica)
    .map((u) => u.nome);
  const pendencias = pendenciasDoDia({
    totais: t,
    caixa: caixa.data
      ? { situacao: caixa.data.situacao, divergencia: caixa.data.divergencia }
      : null,
    depoisDoMeioDia: Number(formatarHora(agora.toISOString()).slice(0, 2)) >= 12,
    esperandoAtendente: conversas.data?.aguardando ?? 0,
    whatsappCaido: caidas,
    notasBaixas: avaliacoes.data?.baixas.length ?? 0,
  });

  // Meta de faturamento do mês (somada quando são várias unidades).
  const metasFat = (metas.data ?? []).filter((m) => m.tipo === 'faturamento');
  // Painel M1: sem meta de faturamento, o card mostra as metas de serviço que existem.
  const outrasMetas = resumoDasMetas(metas.data ?? []);
  const diasDeTrabalho = resumoMes.data?.dias.filter((d) => d.trabalha).length ?? 0;
  const porDia =
    metasFat.length > 0 && diasDeTrabalho > 0
      ? porDiaParaMeta(
          {
            objetivo: metasFat.reduce((s, m) => s + m.objetivo, 0),
            atual: metasFat.reduce((s, m) => s + m.atual, 0),
            fracaoDoMes: metasFat[0]!.fracaoDoMes,
          },
          diasDeTrabalho,
        )
      : null;

  const proximos: (ItemDoDia & { barbeiro: string })[] = r.profissionais
    .flatMap((p) => p.itens.map((i) => ({ ...i, barbeiro: p.nome })))
    .filter((i) => i.situacao === 'a_atender' && Date.parse(i.fim) > agora.getTime())
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .slice(0, 5);

  return (
    <section aria-labelledby="titulo-hoje" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="titulo-hoje" className="text-xl font-semibold">
          Hoje
        </h2>
        <Link
          href="/dia"
          className="flex min-h-11 items-center gap-1 text-sm font-semibold text-tinta-suave underline underline-offset-4 hover:text-tinta"
        >
          Ver o dia completo <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Cartao
          rotulo="Entrou hoje"
          valor={formatarMoeda(t.faturamento)}
          detalhe={`Ainda vai entrar ${formatarMoeda(t.valorEmAberto)} · ticket ${formatarMoeda(t.ticketMedio)}`}
        />
        <Cartao
          rotulo="Atendidos"
          valor={`${formatarNumero(t.fechadas)} de ${formatarNumero(t.marcados)}`}
          detalhe={`${t.aAtender} a atender · ${t.emAtendimento} em atendimento · ${t.faltas} ${t.faltas === 1 ? 'falta' : 'faltas'}`}
        />
        <Cartao
          rotulo="Agenda ocupada"
          valor={formatarFracao(t.ocupacao.fracao, 0)}
          detalhe={`${Math.round(t.ocupacao.agendadoMin / 60)} h marcadas de ${Math.round(t.ocupacao.disponivelMin / 60)} h`}
        />
        {metasFat.length === 0 && outrasMetas ? (
          <Cartao rotulo="Metas do mês" valor={outrasMetas.valor} detalhe={outrasMetas.detalhe} />
        ) : (
          <Cartao
            rotulo="Para bater a meta"
            valor={porDia !== null ? formatarMoeda(porDia) : metasFat.length ? 'Batida' : '—'}
            detalhe={
              porDia !== null
                ? 'por dia, em cada dia de trabalho que sobra no mês'
                : metasFat.length
                  ? 'A meta de faturamento do mês já foi alcançada.'
                  : 'Defina a meta do mês em Resultados do mês.'
            }
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-lg border border-borda bg-superficie p-4">
          <h3 className="font-semibold">Precisa de você agora</h3>
          {pendencias.length === 0 ? (
            <p className="flex items-center gap-2 text-acao-texto">
              <CircleCheck aria-hidden className="size-5" /> Tudo em dia por aqui.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {pendencias.map((p) => (
                <li key={p.chave}>
                  <Link
                    href={p.rota}
                    className={cn(
                      'flex min-h-11 items-center justify-between gap-2 rounded-md border px-3 py-2 hover:bg-superficie-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco',
                      COR[p.tom],
                    )}
                  >
                    <span>{p.texto}</span>
                    <ArrowRight aria-hidden className="size-4 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-borda bg-superficie p-4">
          <h3 className="font-semibold">Próximos horários</h3>
          {proximos.length === 0 ? (
            <p className="text-tinta-suave">Ninguém mais a atender hoje.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-borda">
              {proximos.map((i) => (
                <li key={`${i.comandaId}-${i.inicio}`} className="flex items-center gap-3 py-2">
                  <span className="flex items-center gap-1 font-denso text-lg tabular-nums">
                    <Clock aria-hidden className="size-4 text-tinta-suave" />
                    {formatarHora(i.inicio)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">
                      {i.cliente ?? 'Cliente'}
                      {i.primeiraVez && (
                        <span className="ml-2 text-xs font-semibold uppercase text-modulo-texto">
                          1ª vez
                        </span>
                      )}
                    </span>
                    <span className="truncate text-sm text-tinta-suave">
                      {i.servicos.join(' + ')} · {i.barbeiro}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
