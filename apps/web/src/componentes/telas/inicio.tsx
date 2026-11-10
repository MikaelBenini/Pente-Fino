'use client';

import { formatarMoeda, formatarNumero } from '@pente-fino/shared';
import { BarraMeta } from '@pente-fino/ui';
import Link from 'next/link';
import { useAvaliacoes, useIndicadores, useMetas, useOcupacao } from '@/lib/consultas';
import { useEstadoConfiguracao } from './configuracao-inicial';
import { limitesDoMes, mesAtual, nomeDoMes } from '@/lib/periodo';
import { useApp } from '../contexto-app';
import { PainelIndicadores } from '../indicadores';
import { PainelHoje } from '../painel-hoje';
import { PrimeirosPassos } from '../primeiros-passos';
import { CardOcupacao } from '../ocupacao';
import { CabecalhoPagina, Estado } from '../pagina';

export function TelaInicio() {
  const { unidadeAtiva, unidades, papeis } = useApp();
  const configuracao = useEstadoConfiguracao(papeis.includes('dono'));
  const mes = mesAtual();
  const [de, ate] = limitesDoMes(mes);
  const indicadores = useIndicadores(unidadeAtiva, de, ate);
  const metas = useMetas(unidadeAtiva, mes);
  const avaliacoes = useAvaliacoes(unidadeAtiva, de, ate);
  const notas = avaliacoes.data;
  const unidadeUnica =
    unidadeAtiva && unidadeAtiva !== 'todas'
      ? unidadeAtiva
      : unidades.length === 1
        ? unidades[0]!.id
        : null;
  const ocupacao = useOcupacao(
    papeis.some((p) => p === 'dono' || p === 'gestor') ? unidadeUnica : null,
    de,
    ate,
  );
  const nomeUnidade = (id: string) => unidades.find((u) => u.id === id)?.nome ?? '';

  return (
    <div className="flex flex-col gap-8">
      <CabecalhoPagina titulo="Início" pergunta={`O dia de hoje e como está ${nomeDoMes(mes)}`} />
      {configuracao.data && !configuracao.data.configurada && (
        <Link
          href="/configuracao-inicial"
          className="flex flex-col gap-1 rounded-lg border-2 border-modulo bg-superficie p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-modulo-texto">
            Primeiro acesso
          </span>
          <span className="text-xl font-semibold">Termine a configuração da barbearia</span>
          <span className="text-tinta-suave">
            {configuracao.data.servicos} serviços · {configuracao.data.profissionais} barbeiros.
            Faltam poucos passos para o primeiro atendimento.
          </span>
        </Link>
      )}
      <PainelHoje />
      {configuracao.data?.configurada !== false && <PrimeirosPassos />}
      <h2 className="text-xl font-semibold">O mês</h2>
      <Estado consulta={metas}>
        {() =>
          metas.data!.length > 0 ? (
            <section
              className="grid gap-6 rounded-lg border border-borda bg-superficie p-5 md:grid-cols-2"
              aria-label="Metas do mês"
            >
              {metas.data!.map((m) => (
                <BarraMeta
                  key={m.id}
                  rotulo={`${m.tipo === 'faturamento' ? 'Faturamento' : m.servico} · ${nomeUnidade(m.unidadeId)}`}
                  atual={m.atual}
                  objetivo={m.objetivo}
                  fracaoDoMes={m.fracaoDoMes}
                  formatar={m.tipo === 'faturamento' ? formatarMoeda : formatarNumero}
                />
              ))}
            </section>
          ) : (
            <p className="text-tinta-suave">
              Sem meta para este mês.{' '}
              <Link
                href="/metricas"
                className="font-semibold text-tinta underline underline-offset-4 hover:decoration-modulo"
              >
                Definir metas
              </Link>
            </p>
          )
        }
      </Estado>
      {notas && notas.atendimento.respostas > 0 && (
        <Link
          href="/metricas#titulo-avaliacoes"
          className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-borda bg-superficie p-4 hover:bg-superficie-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
            Clientes avaliam
          </span>
          <span>
            Atendimento{' '}
            <strong className="font-denso text-xl tabular-nums">
              {nota(notas.atendimento.media)}
            </strong>
          </span>
          <span>
            Barbearia{' '}
            <strong className="font-denso text-xl tabular-nums">
              {nota(notas.barbearia.media)}
            </strong>
          </span>
          <span className="text-sm text-tinta-suave">
            {notas.atendimento.respostas}{' '}
            {notas.atendimento.respostas === 1 ? 'resposta' : 'respostas'} no mês
          </span>
          {notas.baixas.length > 0 && (
            <span className="text-sm font-semibold text-perigo-texto">
              {notas.baixas.length} {notas.baixas.length === 1 ? 'nota baixa' : 'notas baixas'} para
              resolver
            </span>
          )}
        </Link>
      )}
      {ocupacao.data && <CardOcupacao o={ocupacao.data} />}
      <Estado consulta={indicadores}>
        {() => (
          <PainelIndicadores
            atual={indicadores.data!.atual}
            anterior={indicadores.data!.anterior}
            projecao={indicadores.data!.projecao}
            rotuloAnterior="vs. mesmo período antes"
            origem="comandas fechadas neste mês"
          />
        )}
      </Estado>
    </div>
  );
}

const nota = (n: number | null) =>
  n === null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: 1 });
