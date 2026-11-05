'use client';

import { formatarHora, formatarMoeda, formatarNumero, statusEfetivo } from '@pente-fino/shared';
import { BarraMeta, BlocoAgenda, CartaoIndicador, EstadoVazio } from '@pente-fino/ui';
import { CalendarCheck, Target } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMeComissoes, useMeHoje } from '@/lib/consultas';
import { limitesDoMes, mesAtual } from '@/lib/periodo';
import { useApp } from '../contexto-app';
import { SeletorMes } from '../indicadores';
import { CabecalhoPagina, Estado } from '../pagina';
import { TabelaExtrato } from './financeiro';

export function TelaHoje() {
  const { usuario } = useApp();
  const hoje = useMeHoje();
  const router = useRouter();
  const primeiroNome = usuario.nome.split(' ')[0];
  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina titulo={`Olá, ${primeiroNome}`} pergunta="Quem é o próximo?" />
      <Estado consulta={hoje}>
        {() => {
          const h = hoje.data!;
          const agora = new Date();
          const pendentes = h.agenda.filter(
            (a) => a.status !== 'fechada' && a.status !== 'cancelada',
          );
          const proximo = pendentes.find((a) => new Date(a.fim) > agora) ?? pendentes[0];
          return (
            <>
              <div className="grid grid-cols-2 gap-3">
                <CartaoIndicador
                  rotulo="Comissão hoje"
                  valor={formatarMoeda(h.comissaoDia)}
                  origem="Itens das suas comandas fechadas hoje."
                />
                <CartaoIndicador
                  rotulo="No mês"
                  valor={formatarMoeda(h.comissaoMes)}
                  origem="Comandas fechadas desde o dia 1º."
                />
              </div>
              {proximo && proximo.comandaId && (
                <Link
                  href={`/comandas?id=${proximo.comandaId}`}
                  className="flex flex-col gap-1 rounded-lg border-2 border-modulo bg-superficie p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
                >
                  <span className="text-xs font-semibold uppercase tracking-wider text-modulo-texto">
                    Próximo
                  </span>
                  <span className="text-2xl font-semibold">{proximo.cliente}</span>
                  <span className="font-denso text-lg tabular-nums text-tinta-suave">
                    {formatarHora(proximo.inicio)}–{formatarHora(proximo.fim)} ·{' '}
                    {proximo.servicos.join(' + ')}
                  </span>
                  <span className="mt-1 font-semibold text-tinta underline underline-offset-4">
                    Abrir comanda
                  </span>
                </Link>
              )}
              <section className="flex flex-col gap-2" aria-labelledby="titulo-dia">
                <h2
                  id="titulo-dia"
                  className="text-xs font-semibold uppercase tracking-wider text-tinta-suave"
                >
                  Seu dia
                </h2>
                {h.agenda.length === 0 ? (
                  <EstadoVazio
                    icone={CalendarCheck}
                    titulo="Nenhum horário hoje"
                    texto="Quando a recepção marcar um cliente com você, ele aparece aqui."
                  />
                ) : (
                  <ul className="flex flex-col gap-2">
                    {h.agenda.map((a) => (
                      <li key={a.agendamentoId}>
                        <BlocoAgenda
                          inicio={formatarHora(a.inicio)}
                          fim={formatarHora(a.fim)}
                          cliente={a.cliente}
                          servico={a.servicos.join(' + ')}
                          estado={statusEfetivo(a.status, new Date(a.fim), agora)}
                          confirmado={a.confirmado}
                          onClick={() => a.comandaId && router.push(`/comandas?id=${a.comandaId}`)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              {h.metas.length > 0 && (
                <section
                  className="flex flex-col gap-4 rounded-lg border border-borda bg-superficie p-4"
                  aria-label="Metas da unidade"
                >
                  {h.metas.map((m) => (
                    <BarraMeta
                      key={m.id}
                      rotulo={m.tipo === 'faturamento' ? 'Meta da unidade' : `Meta: ${m.servico}`}
                      atual={m.atual}
                      objetivo={m.objetivo}
                      fracaoDoMes={m.fracaoDoMes}
                      formatar={m.tipo === 'faturamento' ? formatarMoeda : formatarNumero}
                    />
                  ))}
                </section>
              )}
            </>
          );
        }}
      </Estado>
    </div>
  );
}

export function TelaComissoesBarbeiro() {
  const [mes, setMes] = useState(mesAtual());
  const [de, ate] = limitesDoMes(mes);
  const extratos = useMeComissoes(de, ate);
  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Comissões"
        pergunta="Quanto tenho a receber?"
        acao={<SeletorMes mes={mes} onMudar={setMes} />}
      />
      <Estado consulta={extratos}>
        {() => {
          const lista = extratos.data!;
          const soma = (k: 'previsto' | 'fechado' | 'pago' | 'aReceber') =>
            lista.reduce((s, e) => s + e.resumo[k], 0);
          return (
            <>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <CartaoIndicador
                  rotulo="A receber"
                  valor={formatarMoeda(soma('aReceber'))}
                  origem="Fechado no mês menos o que já foi pago."
                />
                <CartaoIndicador
                  rotulo="Previsto"
                  valor={formatarMoeda(soma('previsto'))}
                  origem="Comandas ainda abertas, pela sua regra de hoje."
                />
                <CartaoIndicador
                  rotulo="Fechado"
                  valor={formatarMoeda(soma('fechado'))}
                  origem="Comandas fechadas pela recepção no mês."
                />
                <CartaoIndicador
                  rotulo="Pago"
                  valor={formatarMoeda(soma('pago'))}
                  origem="Pagamentos registrados pelo dono ou gestor."
                />
              </div>
              <TabelaExtrato itens={lista.flatMap((e) => e.itens)} />
            </>
          );
        }}
      </Estado>
    </div>
  );
}

export function TelaMetasBarbeiro() {
  const hoje = useMeHoje();
  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina titulo="Metas" pergunta="Falta quanto para a meta?" />
      <Estado consulta={hoje}>
        {() =>
          hoje.data!.metas.length === 0 ? (
            <EstadoVazio
              icone={Target}
              titulo="Nenhuma meta neste mês"
              texto="Quando o dono definir as metas da unidade, elas aparecem aqui com a barra de ritmo."
            />
          ) : (
            <section className="flex flex-col gap-6 rounded-lg border border-borda bg-superficie p-5">
              {hoje.data!.metas.map((m) => (
                <BarraMeta
                  key={m.id}
                  rotulo={
                    m.tipo === 'faturamento' ? 'Faturamento da unidade' : `${m.servico} na unidade`
                  }
                  atual={m.atual}
                  objetivo={m.objetivo}
                  fracaoDoMes={m.fracaoDoMes}
                  formatar={m.tipo === 'faturamento' ? formatarMoeda : formatarNumero}
                />
              ))}
              <p className="text-sm text-tinta-suave">
                A marca na barra mostra onde a unidade deveria estar hoje, pelo calendário de
                trabalho do mês.
              </p>
            </section>
          )
        }
      </Estado>
    </div>
  );
}
