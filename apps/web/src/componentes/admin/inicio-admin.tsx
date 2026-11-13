'use client';

import {
  formatarData,
  formatarMoeda,
  ROTULO_PENDENCIA,
  type Pendencia,
  type ResumoCobrancas,
  type TipoPendencia,
  type UsuarioPlataformaSessao,
} from '@pente-fino/shared';
import { Botao, Selecao } from '@pente-fino/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Estado, Ficha, Tabela, td, th } from '../pagina';
import { adminApi } from './admin-api';
import { MetricasAdmin } from './metricas-admin';
import { MeusAlertas } from './meus-alertas';

/** Data sem hora (AAAA-MM-DD) como DD/MM/AAAA, sem passar por fuso. */
const dia = (d: string) => d.slice(0, 10).split('-').reverse().join('/');

const TOM_PRIORIDADE = { 1: 'perigo', 2: 'aviso', 3: 'neutro' } as const;
const NOME_PRIORIDADE = { 1: 'Urgente', 2: 'Importante', 3: 'Acompanhar' } as const;

export function usePendencias() {
  return useQuery({
    queryKey: ['admin', 'pendencias'],
    queryFn: () => adminApi<Pendencia[]>('pendencias'),
  });
}

export function useCobrancas() {
  return useQuery({
    queryKey: ['admin', 'cobrancas'],
    queryFn: () => adminApi<ResumoCobrancas>('cobrancas'),
  });
}

function Destaque({
  rotulo,
  valor,
  detalhe,
  onClick,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
  onClick?: () => void;
}) {
  const conteudo = (
    <>
      <span className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
        {rotulo}
      </span>
      <span className="font-denso text-3xl font-semibold tabular-nums">{valor}</span>
      <span className="text-sm text-tinta-suave">{detalhe}</span>
    </>
  );
  const classe = 'flex flex-col gap-1 rounded-lg border border-borda bg-superficie p-4 text-left';
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={`${classe} hover:border-borda-forte focus-visible:outline-2 focus-visible:outline-foco`}
    >
      {conteudo}
    </button>
  ) : (
    <div className={classe}>{conteudo}</div>
  );
}

/** Início: o que fazer hoje, os números do dia e (para o admin) os do negócio. */
export function InicioAdmin({
  u,
  onAbrirConta,
  onIrPara,
}: {
  u: UsuarioPlataformaSessao;
  onAbrirConta: (id: string) => void;
  onIrPara: (aba: string) => void;
}) {
  const pendencias = usePendencias();
  const cobrancas = useCobrancas();
  const [tipo, setTipo] = useState<'' | TipoPendencia>('');
  const lista = (pendencias.data ?? []).filter((p) => !tipo || p.tipo === tipo);
  const urgentes = (pendencias.data ?? []).filter((p) => p.prioridade === 1).length;
  const primeiroNome = u.nome.split(' ')[0];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">Olá, {primeiroNome}</h1>
        <p className="text-tinta-suave">
          {u.papel === 'admin'
            ? 'O que precisa de atenção hoje e como está o negócio.'
            : 'O que precisa de atenção nas suas contas hoje.'}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Destaque
          rotulo="Para resolver"
          valor={String(pendencias.data?.length ?? '…')}
          detalhe={urgentes ? `${urgentes} urgente${urgentes > 1 ? 's' : ''}` : 'Nada urgente'}
          onClick={() =>
            document.getElementById('titulo-pendencias')?.scrollIntoView({ behavior: 'smooth' })
          }
        />
        <Destaque
          rotulo="Vencido"
          valor={cobrancas.data ? formatarMoeda(cobrancas.data.totais.vencido) : '…'}
          detalhe={`${cobrancas.data?.totais.quantidadeVencidas ?? 0} cobrança(s) em atraso`}
          onClick={() => onIrPara('cobranca')}
        />
        <Destaque
          rotulo="Vence em 7 dias"
          valor={cobrancas.data ? formatarMoeda(cobrancas.data.totais.aVencer7Dias) : '…'}
          detalhe="Em aberto, ainda no prazo"
          onClick={() => onIrPara('cobranca')}
        />
        <Destaque
          rotulo="Recebido no mês"
          valor={cobrancas.data ? formatarMoeda(cobrancas.data.totais.recebidoNoMes) : '…'}
          detalhe="Asaas e pagamentos registrados"
          onClick={() => onIrPara('cobranca')}
        />
      </div>

      <section aria-labelledby="titulo-pendencias" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="titulo-pendencias" className="text-2xl font-semibold">
              Precisa de atenção
            </h2>
            <p className="text-sm text-tinta-suave">
              Cobranças, testes acabando, donos que não entraram e contas paradas. Toque na conta
              para resolver.
            </p>
          </div>
          <Selecao
            id="filtro-pendencia"
            rotulo="Mostrar"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as '' | TipoPendencia)}
            opcoes={[
              { valor: '', rotulo: 'Tudo' },
              ...(Object.keys(ROTULO_PENDENCIA) as TipoPendencia[]).map((t) => ({
                valor: t,
                rotulo: ROTULO_PENDENCIA[t],
              })),
            ]}
          />
        </div>
        <Estado consulta={pendencias}>
          {() =>
            lista.length === 0 ? (
              <p className="rounded-lg border border-borda bg-superficie p-6 text-tinta-suave">
                {tipo
                  ? 'Nada deste tipo agora. Escolha "Tudo" para ver o resto.'
                  : 'Tudo em dia por aqui. Cobranças vencidas, testes acabando, donos sem entrar e contas paradas aparecem aqui assim que acontecerem.'}
              </p>
            ) : (
              <ul aria-label="Pendências" className="flex flex-col gap-2">
                {lista.map((p, i) => (
                  <li
                    key={`${p.tipo}-${p.contaId}-${i}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-borda bg-superficie p-4"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <Ficha tom={TOM_PRIORIDADE[p.prioridade]}>
                          {NOME_PRIORIDADE[p.prioridade]}
                        </Ficha>
                        <span className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
                          {ROTULO_PENDENCIA[p.tipo]}
                        </span>
                      </span>
                      <span className="font-semibold">{p.conta}</span>
                      <span className="text-sm text-tinta-suave">
                        {p.detalhe} · <span className="text-tinta">{p.acao}</span>
                      </span>
                    </div>
                    {p.contaId ? (
                      <Botao variante="secundario" onClick={() => onAbrirConta(p.contaId!)}>
                        Abrir conta
                      </Botao>
                    ) : (
                      <Botao variante="secundario" onClick={() => onIrPara(p.irPara ?? 'saude')}>
                        Ver na Saúde do sistema
                      </Botao>
                    )}
                  </li>
                ))}
              </ul>
            )
          }
        </Estado>
      </section>

      {u.papel === 'admin' && <MetricasAdmin onIrPara={onIrPara} />}

      {/* Admin F3: cada pessoa da equipe escolhe os alertas que recebe por e-mail. */}
      <MeusAlertas />
    </div>
  );
}

const NOME_FORMA: Record<string, string> = {
  pix: 'Pix',
  cartao: 'Cartão',
  boleto: 'Boleto',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência',
};

/** Cobrança: o que está para receber (vencido primeiro) e o que entrou nos últimos 60 dias. */
export function CobrancaAdmin({ onAbrirConta }: { onAbrirConta: (id: string) => void }) {
  const q = useCobrancas();
  const [ver, setVer] = useState<'pendentes' | 'recebidas'>('pendentes');
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">Cobrança</h1>
        <p className="text-tinta-suave">
          Mensalidades de todas as contas. Para registrar um pagamento, abra a conta.
        </p>
      </div>
      <Estado consulta={q}>
        {() => {
          const r = q.data!;
          const linhas = ver === 'pendentes' ? r.pendentes : r.recebidas;
          return (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Destaque
                  rotulo="Vencido"
                  valor={formatarMoeda(r.totais.vencido)}
                  detalhe={`${r.totais.quantidadeVencidas} cobrança(s)`}
                />
                <Destaque
                  rotulo="Vence em 7 dias"
                  valor={formatarMoeda(r.totais.aVencer7Dias)}
                  detalhe="Ainda no prazo"
                />
                <Destaque
                  rotulo="Recebido no mês"
                  valor={formatarMoeda(r.totais.recebidoNoMes)}
                  detalhe="Asaas e manual"
                />
              </div>
              <Selecao
                id="ver-cobrancas"
                rotulo="Ver"
                value={ver}
                onChange={(e) => setVer(e.target.value as 'pendentes' | 'recebidas')}
                opcoes={[
                  { valor: 'pendentes', rotulo: `Para receber (${r.pendentes.length})` },
                  { valor: 'recebidas', rotulo: `Recebidas em 60 dias (${r.recebidas.length})` },
                ]}
              />
              {linhas.length === 0 ? (
                <p className="rounded-lg border border-borda bg-superficie p-6 text-tinta-suave">
                  {ver === 'pendentes'
                    ? 'Nenhuma cobrança em aberto.'
                    : 'Nada recebido no período.'}
                </p>
              ) : (
                <Tabela
                  rotulo={ver === 'pendentes' ? 'Cobranças para receber' : 'Cobranças recebidas'}
                >
                  <thead>
                    <tr className="border-b border-borda">
                      {[
                        'Barbearia',
                        'Valor',
                        'Vencimento',
                        ver === 'pendentes' ? 'Situação' : 'Paga em',
                        'Como',
                      ].map((c) => (
                        <th key={c} scope="col" className={th}>
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((c, i) => (
                      <tr
                        key={`${c.contaId}-${c.vencimento}-${i}`}
                        className="border-b border-borda"
                      >
                        <th scope="row" className={`${td} font-semibold`}>
                          <button
                            type="button"
                            onClick={() => onAbrirConta(c.contaId)}
                            className="text-left underline decoration-borda-forte underline-offset-4 hover:decoration-modulo focus-visible:outline-2 focus-visible:outline-foco"
                          >
                            {c.conta}
                          </button>
                        </th>
                        <td className={`${td} tabular-nums`}>{formatarMoeda(c.valor)}</td>
                        <td className={`${td} tabular-nums`}>{dia(c.vencimento)}</td>
                        <td className={td}>
                          {ver === 'recebidas' ? (
                            c.pagaEm ? (
                              formatarData(c.pagaEm)
                            ) : (
                              '—'
                            )
                          ) : c.status === 'recusada' ? (
                            <Ficha tom="perigo">Recusada</Ficha>
                          ) : c.diasAtraso > 0 ? (
                            <Ficha tom={c.diasAtraso >= 5 ? 'perigo' : 'aviso'}>
                              {c.diasAtraso} dia{c.diasAtraso > 1 ? 's' : ''} de atraso
                            </Ficha>
                          ) : (
                            <Ficha tom="neutro">No prazo</Ficha>
                          )}
                        </td>
                        <td className={td}>
                          {c.origem === 'asaas' ? 'Asaas' : 'Manual'}
                          {c.forma ? ` · ${NOME_FORMA[c.forma] ?? c.forma}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Tabela>
              )}
            </>
          );
        }}
      </Estado>
    </div>
  );
}
