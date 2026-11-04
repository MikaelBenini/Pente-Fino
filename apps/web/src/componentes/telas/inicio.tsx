'use client';

import { formatarMoeda, formatarNumero } from '@pente-fino/shared';
import { BarraMeta } from '@pente-fino/ui';
import Link from 'next/link';
import { useIndicadores, useMetas } from '@/lib/consultas';
import { useEstadoConfiguracao } from './configuracao-inicial';
import { limitesDoMes, mesAtual, nomeDoMes } from '@/lib/periodo';
import { useApp } from '../contexto-app';
import { PainelIndicadores } from '../indicadores';
import { CabecalhoPagina, Estado } from '../pagina';

export function TelaInicio() {
  const { unidadeAtiva, unidades, papeis } = useApp();
  const configuracao = useEstadoConfiguracao(papeis.includes('dono'));
  const mes = mesAtual();
  const [de, ate] = limitesDoMes(mes);
  const indicadores = useIndicadores(unidadeAtiva, de, ate);
  const metas = useMetas(unidadeAtiva, mes);
  const nomeUnidade = (id: string) => unidades.find((u) => u.id === id)?.nome ?? '';

  return (
    <div className="flex flex-col gap-8">
      <CabecalhoPagina titulo="Início" pergunta={`Como está ${nomeDoMes(mes)}?`} />
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
