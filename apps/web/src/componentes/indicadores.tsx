'use client';

import {
  formatarFracao,
  formatarMoeda,
  formatarNumero,
  variacao,
  type Indicadores,
  type Projecao,
} from '@pente-fino/shared';
import { Botao, CartaoIndicador, type Comparacao } from '@pente-fino/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { mesAnterior, mesAtual, mesSeguinte, nomeDoMes } from '@/lib/periodo';

/** Comparação com o período anterior. `maiorEMelhor` false para custos (% de despesas). */
export function comparar(
  atual: number,
  anterior: number,
  rotulo: string,
  maiorEMelhor = true,
  modo: 'relativo' | 'pontos' = 'relativo',
): Comparacao | undefined {
  if (modo === 'pontos') {
    const delta = (atual - anterior) * 100;
    if (anterior === 0 && atual === 0) return undefined;
    const sentido = Math.abs(delta) < 0.05 ? 'neutro' : delta > 0 === maiorEMelhor ? 'bom' : 'ruim';
    return {
      rotulo,
      variacao: `${delta >= 0 ? '+' : '−'}${Math.abs(delta).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p.`,
      sentido,
    };
  }
  const v = variacao(atual, anterior);
  if (v === null) return undefined;
  const sentido = Math.abs(v) < 0.005 ? 'neutro' : v > 0 === maiorEMelhor ? 'bom' : 'ruim';
  return { rotulo, variacao: `${v >= 0 ? '+' : '−'}${formatarFracao(Math.abs(v))}`, sentido };
}

/** Linha de cartões com os indicadores do período, cada um com a comparação e a origem. */
export function PainelIndicadores({
  atual,
  anterior,
  projecao,
  rotuloAnterior,
  origem,
}: {
  atual: Indicadores;
  anterior: Indicadores;
  projecao: Projecao | null;
  rotuloAnterior: string;
  origem: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <CartaoIndicador
        rotulo="Faturamento"
        valor={formatarMoeda(atual.faturamento)}
        comparacao={comparar(atual.faturamento, anterior.faturamento, rotuloAnterior)}
        origem={`Serviços e produtos das ${origem}, menos descontos. Receita não operacional fica fora.`}
      />
      {projecao && (
        <CartaoIndicador
          rotulo="Projeção do mês"
          valor={formatarMoeda(projecao.projecao)}
          origem={`Faturamento até hoje ÷ ${projecao.diasTrabalhados} ${projecao.diasTrabalhados === 1 ? 'dia trabalhado' : 'dias trabalhados'} × ${projecao.diasDoMes} dias de trabalho no mês, pelo calendário da unidade.`}
        />
      )}
      <CartaoIndicador
        rotulo="Lucro"
        valor={formatarMoeda(atual.lucro)}
        comparacao={comparar(atual.lucro, anterior.lucro, rotuloAnterior)}
        origem="Faturamento − despesas operacionais (fixas, variáveis, manutenção e comissões)."
      />
      <CartaoIndicador
        rotulo="Clientes"
        valor={formatarNumero(atual.clientes)}
        comparacao={comparar(atual.clientes, anterior.clientes, rotuloAnterior)}
        origem="Comandas fechadas com pelo menos um serviço."
      />
      <CartaoIndicador
        rotulo="Ticket médio"
        valor={formatarMoeda(atual.ticketMedio)}
        comparacao={comparar(atual.ticketMedio, anterior.ticketMedio, rotuloAnterior)}
        origem="Faturamento ÷ clientes."
      />
      <CartaoIndicador
        rotulo="Atendimentos"
        valor={formatarNumero(atual.atendimentos)}
        comparacao={comparar(atual.atendimentos, anterior.atendimentos, rotuloAnterior)}
        origem="Soma do peso de cada serviço: principal 1, extra 0, combo soma os inclusos."
      />
      <CartaoIndicador
        rotulo="Extras"
        valor={formatarFracao(atual.percentualExtras)}
        comparacao={comparar(
          atual.percentualExtras,
          anterior.percentualExtras,
          rotuloAnterior,
          true,
          'pontos',
        )}
        origem={`${atual.extrasQuantidade} extras (${formatarMoeda(atual.extrasValor)}) ÷ ${atual.clientes} clientes.`}
      />
      <CartaoIndicador
        rotulo="Despesas sobre o faturamento"
        valor={formatarFracao(atual.percentualDespesas)}
        comparacao={comparar(
          atual.percentualDespesas,
          anterior.percentualDespesas,
          rotuloAnterior,
          false,
          'pontos',
        )}
        origem="(Fixas + comissões + manutenção + variáveis) ÷ faturamento. Investimento, retirada do dono e cartão ficam fora."
      />
    </div>
  );
}

/** Navegação de mês (‹ outubro de 2026 ›), sem ir além do mês atual. */
export function SeletorMes({ mes, onMudar }: { mes: string; onMudar: (m: string) => void }) {
  const atual = mesAtual();
  return (
    <div className="flex items-center gap-1">
      <Botao
        variante="secundario"
        className="px-3"
        aria-label="Mês anterior"
        onClick={() => onMudar(mesAnterior(mes))}
      >
        <ChevronLeft aria-hidden className="size-5" />
      </Botao>
      <p
        className="min-w-44 text-center text-lg font-semibold first-letter:uppercase"
        aria-live="polite"
      >
        {nomeDoMes(mes)}
      </p>
      <Botao
        variante="secundario"
        className="px-3"
        aria-label="Mês seguinte"
        disabled={mes >= atual}
        onClick={() => onMudar(mesSeguinte(mes))}
      >
        <ChevronRight aria-hidden className="size-5" />
      </Botao>
    </div>
  );
}
