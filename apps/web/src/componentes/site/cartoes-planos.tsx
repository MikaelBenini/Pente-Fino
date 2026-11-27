'use client';

import {
  type Ciclo,
  DIAS_TESTE,
  formatarMoeda,
  LIMITES_PLANO,
  NOME_PLANO,
  PLANOS,
  type PlanoConta,
  precoPorMes,
  resumoAnual,
  textoEconomiaAnual,
} from '@pente-fino/shared';
import { eventoGoogle } from './tag-google';
import { cn } from '@pente-fino/ui';
import { Check, Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTabelaPrecos } from '@/lib/consultas';
import { LinkCadastro } from './oferta-lancamento';

const CHAMADA: Record<PlanoConta, string> = {
  agenda: 'Só a agenda, o link e o site, para começar.',
  basico: 'Para quem trabalha sozinho ou com um ou dois parceiros.',
  pro: 'Para a barbearia com equipe, meta e clube.',
  premium: 'Para a rede: várias unidades e o lucro de cada uma.',
};

const DESTAQUES: Record<PlanoConta, readonly string[]> = {
  agenda: [
    'Agenda online e link de agendamento',
    'Site da barbearia',
    'Avisos no WhatsApp da barbearia',
    'Só o bot? Licença Atendimento, R$ 49,90 por mês',
  ],
  basico: [
    'Agenda online, comanda e caixa',
    'Comissão automática e extrato do barbeiro',
    'App do barbeiro no celular',
    'Indicadores do mês',
  ],
  pro: [
    'Tudo do Básico',
    'Metas com ritmo e projeção',
    'Ficha e ranking dos barbeiros',
    'Clube de assinatura e bot de WhatsApp',
  ],
  premium: [
    'Tudo do Pro',
    'Painel da rede e preço por unidade',
    'Lucro real e margem por serviço',
    'Campeonato dos barbeiros (em breve)',
  ],
};

const COR: Record<PlanoConta, string> = {
  agenda: 'bg-plano-basico',
  basico: 'bg-plano-basico',
  pro: 'bg-plano-pro',
  premium: 'bg-plano-premium',
};

function limiteTexto(p: PlanoConta) {
  const l = LIMITES_PLANO[p];
  if (p === 'premium') return 'Unidades e profissionais ilimitados';
  return `${l.unidades} unidade, até ${l.profissionais} profissionais`;
}

/** Os três planos completos nos cartões; o Agenda fica na faixa logo abaixo. */
const NOS_CARTOES = PLANOS.filter((p) => p !== 'agenda');

/**
 * Plano Agenda (pedido do dono em 13/11): a porta de entrada, numa faixa abaixo dos cartões, para
 * quem só precisa da agenda, do link e do site agora.
 */
function FaixaAgenda({
  ciclo,
  tabela,
  compacto,
}: {
  ciclo: Ciclo;
  tabela: ReturnType<typeof useTabelaPrecos>;
  compacto: boolean;
}) {
  const preco = precoPorMes('agenda', ciclo, 1, tabela);
  return (
    <section
      aria-labelledby="titulo-plano-agenda"
      className="flex flex-col gap-4 rounded-xl border border-borda bg-superficie p-6 md:flex-row md:items-center md:justify-between"
    >
      <div className="flex flex-col gap-2">
        <h3
          id="titulo-plano-agenda"
          className="flex items-center gap-2 font-denso text-2xl font-bold uppercase tracking-wide"
        >
          <span aria-hidden className={cn('size-2.5 rounded-full', COR.agenda)} />
          Só precisa da agenda?
        </h3>
        <p className="text-tinta-suave">
          Plano {NOME_PLANO.agenda}: {limiteTexto('agenda')}.{' '}
          {DESTAQUES.agenda.slice(0, 3).join(', ')}.
          {!compacto &&
            ' Quer o bot que responde e marca pela conversa, sem comanda nem caixa? A Licença Atendimento traz tudo isso por R$ 49,90 por mês.'}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <p className="flex items-baseline gap-1">
          <span className="font-denso text-4xl font-bold tabular-nums">{formatarMoeda(preco)}</span>
          <span className="text-tinta-suave">/mês</span>
        </p>
        <LinkCadastro extra={`plano=agenda&ciclo=${ciclo}`} variante="contorno">
          Testar {DIAS_TESTE} dias grátis
          <span className="sr-only"> no plano {NOME_PLANO.agenda}</span>
        </LinkCadastro>
      </div>
    </section>
  );
}

/** Os três planos com a escolha mensal/anual e a conta das unidades do Premium. */
export function CartoesPlanos({ compacto = false }: { compacto?: boolean }) {
  const tabela = useTabelaPrecos();
  const [ciclo, setCiclo] = useState<Ciclo>('anual');
  const [unidades, setUnidades] = useState(2);
  const economiaPro = resumoAnual('pro', 1, tabela).economia;

  return (
    <div className="flex flex-col gap-8">
      <div
        role="radiogroup"
        aria-label="Forma de pagamento"
        className="mx-auto inline-flex rounded-lg border border-borda bg-superficie p-1"
      >
        {(['mensal', 'anual'] as const).map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={ciclo === c}
            onClick={() => {
              setCiclo(c);
              eventoGoogle('toggle_ciclo', { ciclo: c });
            }}
            className={cn(
              'min-h-11 rounded-md px-5 font-semibold transition focus-visible:outline-2 focus-visible:outline-foco',
              ciclo === c ? 'bg-superficie-3 text-tinta' : 'text-tinta-suave hover:text-tinta',
              'transition-colors duration-200',
            )}
          >
            {c === 'mensal' ? 'Mensal' : 'Anual'}
          </button>
        ))}
      </div>
      <p className="-mt-5 text-center text-sm font-medium text-acao-texto">
        No anual, {textoEconomiaAnual(tabela)}
      </p>

      <ul className="animar-escalonado grid gap-4 md:grid-cols-3">
        {NOS_CARTOES.map((p) => {
          const preco = precoPorMes(p, ciclo, 1, tabela);
          const anual = resumoAnual(p, 1, tabela);
          const destaque = p === 'pro';
          return (
            <li
              key={p}
              className={cn(
                'relative flex flex-col gap-5 rounded-xl border bg-superficie p-6 transition-[border-color,transform] duration-200 hover:-translate-y-0.5',
                destaque ? 'border-modulo md:-my-3 md:py-9' : 'border-borda',
              )}
            >
              {destaque && (
                <span className="absolute -top-3 left-6 rounded-sm bg-modulo px-2 py-0.5 text-sm font-semibold text-sobre-modulo">
                  Mais escolhido
                </span>
              )}
              <div className="flex flex-col gap-1">
                <h3 className="flex items-center gap-2 font-denso text-2xl font-bold uppercase tracking-wide">
                  <span aria-hidden className={cn('size-2.5 rounded-full', COR[p])} />
                  {NOME_PLANO[p]}
                </h3>
                <p className="text-tinta-suave">{CHAMADA[p]}</p>
              </div>
              <div>
                <p className="flex items-baseline gap-1">
                  <span
                    key={ciclo}
                    className="animar-entrada font-denso text-5xl font-bold tabular-nums"
                  >
                    {formatarMoeda(preco)}
                  </span>
                  <span className="text-tinta-suave">/mês</span>
                </p>
                <p className="min-h-6 text-sm text-tinta-suave">
                  {ciclo === 'anual'
                    ? `${formatarMoeda(anual.total)} por ano · economia de ${formatarMoeda(anual.economia)}`
                    : 'Sem fidelidade. Cancele quando quiser.'}
                </p>
                {p === 'premium' && (
                  <p className="text-sm text-tinta-suave">
                    +{' '}
                    {formatarMoeda(
                      tabela.unidadeExtra[ciclo === 'mensal' ? 'mensal' : 'anualPorMes'],
                    )}{' '}
                    por unidade a partir da 2ª
                  </p>
                )}
              </div>
              <p className="font-medium">{limiteTexto(p)}</p>
              {!compacto && (
                <ul className="flex flex-col gap-2 text-tinta-suave">
                  {DESTAQUES[p].map((d) => (
                    <li key={d} className="flex gap-2">
                      <Check aria-hidden className="mt-0.5 size-5 shrink-0 text-acao-texto" />
                      {d}
                    </li>
                  ))}
                </ul>
              )}
              <LinkCadastro
                extra={`plano=${p}&ciclo=${ciclo}`}
                variante={destaque ? 'acao' : 'contorno'}
                className="mt-auto"
              >
                Testar {DIAS_TESTE} dias grátis
                <span className="sr-only"> no plano {NOME_PLANO[p]}</span>
              </LinkCadastro>
            </li>
          );
        })}
      </ul>

      <FaixaAgenda ciclo={ciclo} tabela={tabela} compacto={compacto} />

      {!compacto && (
        <section
          aria-labelledby="calc-titulo"
          className="flex flex-col gap-4 rounded-xl border border-borda bg-superficie p-6 md:flex-row md:items-center md:justify-between"
        >
          <div className="flex flex-col gap-1">
            <h3 id="calc-titulo" className="text-xl font-semibold">
              Quanto fica a sua rede no Premium?
            </h3>
            <p className="text-tinta-suave">
              Cada unidade a partir da 2ª custa{' '}
              {formatarMoeda(tabela.unidadeExtra[ciclo === 'mensal' ? 'mensal' : 'anualPorMes'])}{' '}
              por mês.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setUnidades((u) => Math.max(1, u - 1))}
                disabled={unidades <= 1}
                aria-label="Uma unidade a menos"
                className="grid size-11 place-items-center rounded-md border border-borda-forte disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-foco"
              >
                <Minus aria-hidden className="size-5" />
              </button>
              <output
                aria-live="polite"
                aria-label="Unidades"
                className="min-w-24 text-center font-denso text-2xl font-bold tabular-nums"
              >
                {unidades} {unidades === 1 ? 'unidade' : 'unidades'}
              </output>
              <button
                type="button"
                onClick={() => setUnidades((u) => Math.min(50, u + 1))}
                disabled={unidades >= 50}
                aria-label="Uma unidade a mais"
                className="grid size-11 place-items-center rounded-md border border-borda-forte disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-foco"
              >
                <Plus aria-hidden className="size-5" />
              </button>
            </div>
            <p aria-live="polite" className="flex flex-col">
              <span className="font-denso text-3xl font-bold tabular-nums">
                {formatarMoeda(precoPorMes('premium', ciclo, unidades, tabela))}
                <span className="font-sans text-base font-normal text-tinta-suave">/mês</span>
              </span>
              {ciclo === 'anual' && (
                <span className="text-sm text-tinta-suave">
                  {formatarMoeda(resumoAnual('premium', unidades, tabela).total)} por ano
                </span>
              )}
            </p>
          </div>
        </section>
      )}
      {compacto && ciclo === 'mensal' && (
        <p className="text-center text-sm text-tinta-suave">
          No anual, o Pro sai {formatarMoeda(economiaPro)} mais barato por ano.
        </p>
      )}
      {!compacto && (
        <AvisosEAutomacoes
          preco={tabela.automacoes[ciclo === 'mensal' ? 'mensal' : 'anualPorMes']}
        />
      )}
    </div>
  );
}

/**
 * Revisão de 16/11/2026: avisos (todo plano), bot que marca pela conversa e o adicional das
 * Automações lado a lado, para ninguém confundir lembrete com bot.
 */
function AvisosEAutomacoes({ preco }: { preco: number }) {
  const colunas = [
    {
      titulo: 'Avisos no WhatsApp',
      quem: 'Todos os planos',
      texto:
        'Confirmação do agendamento e lembrete antes do horário, pelo número da barbearia. O cliente confirma pelo próprio lembrete.',
    },
    {
      titulo: 'Bot que marca pela conversa',
      quem: 'Pro e Premium; no Básico, com as Automações; ou só ele, na Licença Atendimento',
      texto:
        'O cliente escreve e o bot responde pelo menu que você monta (sem IA): vê preços e horários e marca o horário sozinho.',
    },
    {
      titulo: 'Automações',
      quem: `Adicional de ${formatarMoeda(preco)} por mês no Básico; já vêm no Pro, no Premium e na Licença Atendimento`,
      texto:
        'Liberam o bot, a lista de espera, a pesquisa depois do atendimento, o retorno de quem sumiu, o aniversário e o aviso do clube.',
    },
  ];
  return (
    <section aria-labelledby="avisos-automacoes" className="flex flex-col gap-4">
      <h2 id="avisos-automacoes" className="text-center text-xl font-semibold">
        Avisos, bot e Automações: o que vem em cada um
      </h2>
      <ul className="grid gap-3 md:grid-cols-3">
        {colunas.map((c) => (
          <li
            key={c.titulo}
            className="flex flex-col gap-2 rounded-lg border border-borda bg-superficie p-4"
          >
            <h3 className="font-semibold">{c.titulo}</h3>
            <p className="text-sm font-medium text-acao-texto">{c.quem}</p>
            <p className="text-sm text-tinta-suave">{c.texto}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
