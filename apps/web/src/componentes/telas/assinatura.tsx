'use client';

import {
  dataLocal,
  formatarData,
  formatarMoeda,
  formatarPercentualBp,
  OFERTA_LANCAMENTO,
  textoVagasOferta,
  NOME_PLANO,
  NOME_SITUACAO_ASSINATURA,
  NOME_STATUS_FATURA,
  documentoValido,
  PLANOS,
  valorDaCobranca,
  type FaturaDetalhe,
  type PlanoConta,
  type PreviaTrocaPlano,
  type TabelaPrecosPlanos,
  type SituacaoAssinatura,
} from '@pente-fino/shared';
import { Botao, Campo, cn, EstadoVazio, ModalConfirmacao, Selecao } from '@pente-fino/ui';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, ExternalLink, Receipt, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { chaveAssinatura, useAcao, useAssinatura } from '@/lib/consultas';
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
                {d.cupom && (
                  <p className="text-sm text-acao-texto">
                    Cupom {d.cupom}: {formatarPercentualBp(d.descontoBp)} de desconto
                  </p>
                )}
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
                <AcaoPagar
                  f={pendente}
                  rotulo="Pagar ou trocar o cartão"
                  semLink={
                    d.cobrancaAutomatica
                      ? undefined
                      : 'Assine abaixo para pagar por Pix, boleto ou cartão.'
                  }
                />
              </section>
            )}
            {pendente?.status === 'aberta' && (
              <AcaoPagar f={pendente} rotulo={`Pagar ${formatarMoeda(pendente.valor)}`} />
            )}
            {!d.cobrancaAutomatica && estado.situacao !== 'ativa' && (
              <Assinar
                planoAtual={d.plano}
                cicloAtual={d.ciclo}
                unidades={d.unidades}
                tabela={d.tabelaPrecos}
                descontoBp={d.descontoBp}
              />
            )}
            {d.cobrancaAutomatica && pendente && <ConferirPagamento />}

            <MudarPlano atual={d.plano} />

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

function AcaoPagar({
  f,
  rotulo,
  semLink = 'O link de pagamento ainda não foi gerado. Fale com o suporte do Pente Fino.',
}: {
  f: FaturaDetalhe;
  rotulo: string;
  semLink?: string;
}) {
  if (!f.linkPagamento) return <p className="text-sm text-tinta-suave">{semLink}</p>;
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

const mensagemDe = (e: unknown) =>
  e instanceof ErroApi ? e.message : 'Não foi possível concluir. Tente de novo.';

/**
 * Assinar pela cobrança automática: plano, ciclo e CPF ou CNPJ de quem paga. A página de
 * pagamento (Pix, boleto ou cartão) abre numa aba nova; ao voltar, "Já paguei, conferir".
 */
function Assinar({
  planoAtual,
  cicloAtual,
  unidades,
  tabela,
  descontoBp,
}: {
  planoAtual: FaturaDetalhe['plano'];
  cicloAtual: FaturaDetalhe['ciclo'];
  unidades: number;
  tabela: TabelaPrecosPlanos;
  descontoBp: number;
}) {
  const [plano, setPlano] = useState(planoAtual);
  const [ciclo, setCiclo] = useState(cicloAtual);
  const [documento, setDocumento] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  // Cupom digitado aqui (quem se cadastrou sem); o da conta já vem em descontoBp.
  const [codigo, setCodigo] = useState('');
  const [cupom, setCupom] = useState<{ codigo: string; descontoBp: number } | null>(null);
  const [erroCupom, setErroCupom] = useState<string | null>(null);
  const oferta = useQuery({
    queryKey: ['cupom', OFERTA_LANCAMENTO.codigo],
    queryFn: () => api<{ restantes: number | null }>(`publico/cupom/${OFERTA_LANCAMENTO.codigo}`),
    enabled: descontoBp === 0,
    retry: false,
    staleTime: 300_000,
  });
  async function aplicarCupom(texto = codigo) {
    setErroCupom(null);
    setCupom(null);
    if (!texto.trim()) return;
    try {
      setCupom(
        await api<{ codigo: string; descontoBp: number }>(
          `publico/cupom/${encodeURIComponent(texto.trim())}`,
        ),
      );
    } catch (e) {
      setErroCupom(mensagemDe(e));
    }
  }
  const descontoEfetivo = cupom?.descontoBp ?? descontoBp;
  const assinar = useAcao(
    (corpo: object) => api<{ linkPagamento: string | null }>('conta/assinatura', { corpo }),
    [chaveAssinatura],
  );
  const docOk = documentoValido(documento);
  const valor = valorDaCobranca(plano, ciclo, unidades, tabela, descontoEfetivo);
  return (
    <section
      aria-labelledby="titulo-assinar"
      className="flex flex-col gap-4 rounded-lg border border-borda bg-superficie p-5"
    >
      <div>
        <h2 id="titulo-assinar" className="text-lg font-semibold">
          Assinar o Pente Fino
        </h2>
        <p className="text-sm text-tinta-suave">
          Pague por Pix, boleto ou cartão na página de pagamento. Nada do que você lançou se perde.
        </p>
      </div>
      {link ? (
        <div className="flex flex-col gap-3">
          <Aviso tom="sucesso">
            Assinatura criada. Pague na página que abriu; depois volte aqui e toque em “Já paguei,
            conferir”.
          </Aviso>
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className={`${classeBotao} self-start`}
          >
            Abrir a página de pagamento <ExternalLink aria-hidden className="size-4" />
          </a>
        </div>
      ) : (
        <form
          method="post"
          noValidate
          className="grid gap-4 sm:grid-cols-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setErro(null);
            if (!docOk) return setErro('Confira o CPF ou CNPJ.');
            try {
              const r = await assinar.mutateAsync({
                plano,
                ciclo,
                documento,
                ...(cupom ? { cupom: cupom.codigo } : {}),
              });
              setLink(r.linkPagamento);
              if (r.linkPagamento) window.open(r.linkPagamento, '_blank', 'noopener');
            } catch (er) {
              setErro(mensagemDe(er));
            }
          }}
        >
          {erro && (
            <div className="sm:col-span-3">
              <Aviso tom="erro">{erro}</Aviso>
            </div>
          )}
          <Selecao
            id="assinar-plano"
            rotulo="Plano"
            value={plano}
            onChange={(e) => setPlano(e.target.value as typeof plano)}
            opcoes={PLANOS.map((p) => ({ valor: p, rotulo: NOME_PLANO[p] }))}
          />
          <Selecao
            id="assinar-ciclo"
            rotulo="Cobrança"
            value={ciclo}
            onChange={(e) => setCiclo(e.target.value as typeof ciclo)}
            opcoes={[
              { valor: 'mensal', rotulo: 'Mensal' },
              { valor: 'anual', rotulo: 'Anual (mais barato)' },
            ]}
          />
          <Campo
            id="assinar-documento"
            rotulo="CPF ou CNPJ de quem paga"
            inputMode="numeric"
            autoComplete="off"
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
            erro={
              documento.replace(/\D/g, '').length >= 11 && !docOk
                ? 'CPF ou CNPJ inválido.'
                : undefined
            }
          />
          {descontoBp === 0 && (
            <div className="flex flex-col gap-2 sm:col-span-3">
              {!cupom && oferta.data && (
                <Aviso tom="info">
                  Oferta de lançamento: 30% de desconto em toda mensalidade, para sempre (enquanto a
                  assinatura estiver ativa), para quem assinar até{' '}
                  {formatarData(`${OFERTA_LANCAMENTO.ate}T12:00:00Z`)}.{' '}
                  {textoVagasOferta(oferta.data.restantes)
                    ? `${textoVagasOferta(oferta.data.restantes)}. `
                    : ''}
                  <button
                    type="button"
                    className="font-semibold underline underline-offset-4"
                    onClick={() => {
                      setCodigo(OFERTA_LANCAMENTO.codigo);
                      void aplicarCupom(OFERTA_LANCAMENTO.codigo);
                    }}
                  >
                    Usar o desconto
                  </button>
                </Aviso>
              )}
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-48 flex-1">
                  <Campo
                    id="assinar-cupom"
                    rotulo="Cupom (opcional)"
                    autoComplete="off"
                    value={codigo}
                    onChange={(e) => {
                      setCodigo(e.target.value.toUpperCase());
                      setCupom(null);
                    }}
                    erro={erroCupom ?? undefined}
                  />
                </div>
                <Botao type="button" variante="secundario" onClick={() => void aplicarCupom()}>
                  Aplicar
                </Botao>
              </div>
              {cupom && (
                <p role="status" className="text-sm text-acao-texto">
                  Cupom {cupom.codigo}: {formatarPercentualBp(cupom.descontoBp)} de desconto em toda
                  cobrança.
                </p>
              )}
            </div>
          )}
          <p className="font-denso text-lg tabular-nums sm:col-span-2">
            {formatarMoeda(valor)}{' '}
            <span className="font-sans text-base text-tinta-suave">
              {ciclo === 'anual' ? 'por ano' : 'por mês'}
              {unidades > 1 && ` · ${unidades} unidades`}
            </span>
          </p>
          <Botao type="submit" carregando={assinar.isPending} className="sm:justify-self-end">
            Assinar e pagar
          </Botao>
        </form>
      )}
    </section>
  );
}

/** Voltou da página de pagamento: confere no Asaas sem esperar o aviso automático. */
function ConferirPagamento() {
  const [erro, setErro] = useState<string | null>(null);
  const conferir = useAcao(
    () => api('conta/assinatura/conferir', { corpo: {} }),
    [chaveAssinatura],
  );
  return (
    <div className="flex flex-col gap-2">
      <Botao
        variante="secundario"
        className="self-start"
        carregando={conferir.isPending}
        onClick={async () => {
          setErro(null);
          try {
            await conferir.mutateAsync(undefined);
          } catch (e) {
            setErro(mensagemDe(e));
          }
        }}
      >
        <RefreshCw aria-hidden className="size-4" /> Já paguei, conferir
      </Botao>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
    </div>
  );
}

/**
 * Mudar de plano (o dono, sem falar com o suporte): subir vale na hora; descer mostra antes o
 * que impede (limites) e o que deixa de usar, e pede confirmação.
 */
function MudarPlano({ atual }: { atual: PlanoConta }) {
  const outros = PLANOS.filter((p) => p !== atual);
  const [para, setPara] = useState<PlanoConta>(outros[0]!);
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);
  const previa = useQuery({
    queryKey: [...chaveAssinatura, 'previa', para],
    queryFn: () => api<PreviaTrocaPlano>(`conta/plano/previa?plano=${para}`),
  });
  const trocar = useAcao(
    (plano: PlanoConta) =>
      api<PreviaTrocaPlano>('conta/plano', { metodo: 'PUT', corpo: { plano } }),
    [chaveAssinatura],
  );
  const p = previa.data;

  async function aplicar() {
    setConfirmar(false);
    setErro(null);
    try {
      await trocar.mutateAsync(para);
      setFeito(`Pronto: a conta está no plano ${NOME_PLANO[para]}.`);
    } catch (e) {
      setErro(mensagemDe(e));
    }
  }

  return (
    <section
      aria-labelledby="titulo-mudar-plano"
      className="flex flex-col gap-4 rounded-lg border border-borda bg-superficie p-5"
    >
      <div>
        <h2 id="titulo-mudar-plano" className="text-lg font-semibold">
          Mudar de plano
        </h2>
        <p className="text-sm text-tinta-suave">
          Vale na hora. Com a cobrança automática, as cobranças em aberto e as próximas já vêm com o
          valor novo. Nada do que foi lançado se perde.
        </p>
      </div>
      {feito && <Aviso tom="sucesso">{feito}</Aviso>}
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <div role="radiogroup" aria-label="Plano novo" className="flex flex-wrap gap-2">
        {outros.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={para === o}
            onClick={() => {
              setPara(o);
              setFeito(null);
              setErro(null);
            }}
            className={cn(
              'min-h-11 rounded-md border px-4 font-semibold focus-visible:outline-2 focus-visible:outline-foco',
              para === o
                ? 'border-modulo bg-modulo text-sobre-modulo'
                : 'border-borda hover:border-borda-forte',
            )}
          >
            {NOME_PLANO[o]}
          </button>
        ))}
      </div>
      {p && p.para === para && (
        <div className="flex flex-col gap-3">
          <p className="font-denso text-lg tabular-nums">
            {formatarMoeda(p.valorAtual)} → <strong>{formatarMoeda(p.valorNovo)}</strong>{' '}
            <span className="font-sans text-base text-tinta-suave">por mês</span>
          </p>
          {p.bloqueios.length > 0 && (
            <Aviso tom="erro">
              <span className="font-semibold">Antes de mudar:</span>
              <ul className="mt-1 list-disc pl-5" aria-label="O que impede a troca">
                {p.bloqueios.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </Aviso>
          )}
          {p.perdas.length > 0 && (
            <div>
              <p className="text-sm font-medium">Deixa de usar:</p>
              <ul
                className="list-disc pl-5 text-sm text-tinta-suave"
                aria-label="O que deixa de usar"
              >
                {p.perdas.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          )}
          <Botao
            className="self-start"
            variante={p.sobe ? 'acao' : 'secundario'}
            disabled={p.bloqueios.length > 0}
            carregando={trocar.isPending}
            onClick={() => (p.sobe ? aplicar() : setConfirmar(true))}
          >
            Mudar para o {NOME_PLANO[para]}
          </Botao>
        </div>
      )}
      <ModalConfirmacao
        aberto={confirmar}
        titulo={`Mudar para o ${NOME_PLANO[para]}?`}
        descricao={`A conta deixa de usar ${p?.perdas.length ?? 0} ${p?.perdas.length === 1 ? 'recurso' : 'recursos'} agora mesmo. O que já foi lançado continua guardado e volta quando subir de plano.`}
        textoConfirmar={`Mudar para o ${NOME_PLANO[para]}`}
        carregando={trocar.isPending}
        onConfirmar={aplicar}
        onCancelar={() => setConfirmar(false)}
      />
    </section>
  );
}
