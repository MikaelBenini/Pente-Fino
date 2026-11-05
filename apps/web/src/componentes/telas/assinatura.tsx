'use client';

import {
  dataLocal,
  formatarData,
  formatarMoeda,
  NOME_PLANO,
  NOME_SITUACAO_ASSINATURA,
  NOME_STATUS_FATURA,
  type FaturaDetalhe,
  type SituacaoAssinatura,
} from '@pente-fino/shared';
import { EstadoVazio } from '@pente-fino/ui';
import { CreditCard, ExternalLink, Receipt } from 'lucide-react';
import Link from 'next/link';
import { useAssinatura } from '@/lib/consultas';
import { Aviso } from '../aviso';
import { Estado, Ficha, Tabela, td, th } from '../pagina';

const TOM_SITUACAO: Record<SituacaoAssinatura, 'acao' | 'aviso' | 'neutro' | 'perigo'> = {
  teste: 'aviso',
  teste_vencido: 'perigo',
  ativa: 'acao',
  em_atraso: 'aviso',
  bloqueada: 'perigo',
  suspensa: 'perigo',
  cancelada: 'neutro',
};
const TOM_FATURA: Record<FaturaDetalhe['status'], 'acao' | 'aviso' | 'neutro' | 'perigo'> = {
  aberta: 'aviso',
  paga: 'acao',
  recusada: 'perigo',
  cancelada: 'neutro',
};
const NOME_FORMA: Record<NonNullable<FaturaDetalhe['forma']>, string> = {
  pix: 'Pix',
  cartao: 'Cartão',
  boleto: 'Boleto',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência',
};

const classeBotao =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-acao px-4 font-semibold text-sobre-acao hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco';

/**
 * Aba Assinatura (só o dono): situação, plano e preço, o que falta pagar e o histórico.
 * Pagar abre a página do provedor; o retorno do pagamento chega pela cobrança automática.
 */
export function Assinatura() {
  const a = useAssinatura(true);
  return (
    <Estado consulta={a}>
      {() => {
        const d = a.data!;
        const { estado, pendente } = d;
        return (
          <div className="flex max-w-4xl flex-col gap-6">
            <section
              aria-labelledby="titulo-plano"
              className="grid gap-4 rounded-lg border border-borda bg-superficie p-5 md:grid-cols-3"
            >
              <div className="flex flex-col gap-1">
                <h2
                  id="titulo-plano"
                  className="text-xs font-semibold uppercase tracking-wider text-tinta-suave"
                >
                  Plano
                </h2>
                <p className="text-xl font-semibold">
                  {NOME_PLANO[d.plano]}{' '}
                  <span className="text-base font-normal text-tinta-suave">
                    · {d.ciclo === 'anual' ? 'anual' : 'mensal'}
                  </span>
                </p>
                <p className="font-denso tabular-nums text-tinta-suave">
                  {formatarMoeda(d.precoPorMes)} por mês
                  {d.unidades > 1 && ` · ${d.unidades} unidades`}
                </p>
              </div>
              <div className="flex flex-col items-start gap-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
                  Situação
                </p>
                <Ficha tom={TOM_SITUACAO[estado.situacao]}>
                  {NOME_SITUACAO_ASSINATURA[estado.situacao]}
                </Ficha>
                {estado.situacao === 'teste' && d.testeAte && (
                  <p className="text-sm text-tinta-suave">
                    {estado.mensagem} Até {formatarData(d.testeAte)}.
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
                  Próxima cobrança
                </p>
                {pendente ? (
                  <p>
                    <span className="font-denso text-lg tabular-nums">
                      {formatarMoeda(pendente.valor)}
                    </span>{' '}
                    <span
                      className={
                        pendente.vencimento < dataLocal(new Date())
                          ? 'font-semibold text-perigo-texto'
                          : 'text-tinta-suave'
                      }
                    >
                      {pendente.vencimento < dataLocal(new Date()) ? 'venceu em' : 'vence'}{' '}
                      {formatarData(pendente.vencimento)}
                    </span>
                  </p>
                ) : (
                  <p className="text-tinta-suave">
                    {estado.situacao === 'teste' || estado.situacao === 'teste_vencido'
                      ? 'Nenhuma ainda: o teste é sem cartão.'
                      : 'Nada em aberto.'}
                  </p>
                )}
              </div>
            </section>

            {estado.situacao !== 'ativa' && estado.situacao !== 'teste' && (
              <Aviso tom={estado.somenteLeitura ? 'erro' : 'aviso'}>{estado.mensagem}</Aviso>
            )}

            {pendente?.status === 'recusada' && (
              <section
                aria-labelledby="titulo-recusada"
                className="flex flex-col gap-3 rounded-lg border border-perigo-texto/50 bg-superficie p-5"
              >
                <h2 id="titulo-recusada" className="flex items-center gap-2 text-lg font-semibold">
                  <CreditCard aria-hidden className="size-5 text-perigo-texto" />
                  Pagamento recusado
                </h2>
                <p>{pendente.motivoRecusa}</p>
                <p className="text-sm text-tinta-suave">
                  Fatura de {formatarMoeda(pendente.valor)}, vencida em{' '}
                  {formatarData(pendente.vencimento)}. Pague por Pix ou boleto, ou use outro cartão,
                  na página de pagamento.
                </p>
                <AcaoPagar f={pendente} rotulo="Pagar ou trocar o cartão" />
              </section>
            )}
            {pendente?.status === 'aberta' && (
              <AcaoPagar f={pendente} rotulo={`Pagar ${formatarMoeda(pendente.valor)}`} />
            )}
            {(estado.situacao === 'teste' || estado.situacao === 'teste_vencido') && !pendente && (
              <p className="text-tinta-suave">
                Para assinar, veja os planos em{' '}
                <Link href="/planos" className="font-semibold text-tinta underline">
                  /planos
                </Link>{' '}
                ou fale com o suporte do Pente Fino. Nada do que você lançou se perde.
              </p>
            )}

            <section aria-labelledby="titulo-faturas" className="flex flex-col gap-3">
              <h2 id="titulo-faturas" className="text-xl font-semibold">
                Faturas
              </h2>
              {d.faturas.length === 0 ? (
                <EstadoVazio
                  icone={Receipt}
                  titulo="Nenhuma fatura ainda"
                  texto="As faturas da assinatura aparecem aqui, com o que foi pago e o que está em aberto."
                />
              ) : (
                <Tabela rotulo="Faturas da assinatura">
                  <thead className="bg-superficie-2">
                    <tr>
                      <th className={th}>Vencimento</th>
                      <th className={th}>Período</th>
                      <th className={`${th} text-right`}>Valor</th>
                      <th className={th}>Situação</th>
                      <th className={th}>Pagamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.faturas.map((f) => (
                      <tr key={f.id} className="border-t border-borda">
                        <td className={`${td} font-denso tabular-nums`}>
                          {formatarData(f.vencimento)}
                        </td>
                        <td className={`${td} text-sm text-tinta-suave`}>
                          {formatarData(f.periodoInicio)} a {formatarData(f.periodoFim)}
                        </td>
                        <td className={`${td} text-right font-denso tabular-nums`}>
                          {formatarMoeda(f.valor)}
                        </td>
                        <td className={td}>
                          <Ficha tom={TOM_FATURA[f.status]}>{NOME_STATUS_FATURA[f.status]}</Ficha>
                          {f.status === 'recusada' && f.motivoRecusa && (
                            <span className="mt-1 block text-xs text-perigo-texto">
                              {f.motivoRecusa}
                            </span>
                          )}
                        </td>
                        <td className={`${td} text-sm`}>
                          {f.status === 'paga' && f.pagaEm ? (
                            `${f.forma ? NOME_FORMA[f.forma] : 'Pago'} em ${formatarData(f.pagaEm)}`
                          ) : f.linkPagamento &&
                            (f.status === 'aberta' || f.status === 'recusada') ? (
                            <a
                              href={f.linkPagamento}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-acao-texto underline"
                            >
                              Pagar
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Tabela>
              )}
            </section>
          </div>
        );
      }}
    </Estado>
  );
}

function AcaoPagar({ f, rotulo }: { f: FaturaDetalhe; rotulo: string }) {
  if (!f.linkPagamento)
    return (
      <p className="text-sm text-tinta-suave">
        O link de pagamento ainda não foi gerado. Fale com o suporte do Pente Fino.
      </p>
    );
  return (
    <a
      href={f.linkPagamento}
      target="_blank"
      rel="noopener noreferrer"
      className={`${classeBotao} self-start`}
    >
      {rotulo} <ExternalLink aria-hidden className="size-4" />
    </a>
  );
}
