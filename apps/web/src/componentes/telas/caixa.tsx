'use client';

import { dataLocal, formatarMoeda, lerMoeda, NOME_FORMA, type CaixaDia } from '@pente-fino/shared';
import { Botao, Campo, ModalConfirmacao } from '@pente-fino/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { chavesOperacao, useAcao, useCaixa } from '@/lib/consultas';
import { Aviso } from '../aviso';
import { useApp } from '../contexto-app';
import { CabecalhoPagina, Estado, Ficha } from '../pagina';
import { useUnidadeTrabalho } from '../unidade-trabalho';

export function TelaCaixa() {
  return (
    <Suspense>
      <ConteudoCaixa />
    </Suspense>
  );
}

function ConteudoCaixa() {
  const { unidadeId, seletor } = useUnidadeTrabalho();
  // ?dia=AAAA-MM-DD (link do aviso de caixa com diferença).
  const pedido = useSearchParams().get('dia');
  const [dia, setDia] = useState(
    pedido && /^\d{4}-\d{2}-\d{2}$/.test(pedido) ? pedido : dataLocal(new Date()),
  );
  const caixa = useCaixa(unidadeId, dia);
  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina titulo="Caixa do dia" pergunta="O caixa bate?" />
      <div className="flex flex-wrap items-end gap-3">
        {seletor}
        <div className="w-44">
          <Campo
            id="caixa-dia"
            rotulo="Dia"
            type="date"
            max={dataLocal(new Date())}
            value={dia}
            onChange={(e) => e.target.value && setDia(e.target.value)}
          />
        </div>
      </div>
      <Estado consulta={caixa}>{() => <Caixa c={caixa.data!} />}</Estado>
    </div>
  );
}

function Caixa({ c }: { c: CaixaDia }) {
  const { papeis } = useApp();
  const gestao = papeis.includes('dono') || papeis.includes('gestor');
  const [troco, setTroco] = useState('');
  const [contagem, setContagem] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [reabrir, setReabrir] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const acao = useAcao(
    (d: { caminho: string; corpo: object }) =>
      api<CaixaDia>(`caixa/${d.caminho}`, { corpo: d.corpo }),
    [chavesOperacao.caixa],
  );
  const informado = lerMoeda(contagem);

  async function executar(caminho: string, corpo: object) {
    setErro(null);
    try {
      await acao.mutateAsync({
        caminho,
        corpo: { unidadeId: c.unidadeId, data: c.data, ...corpo },
      });
    } catch (e) {
      setErro(
        e instanceof ErroApi ? (e.campos[0]?.mensagem ?? e.message) : 'Não foi possível concluir.',
      );
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="flex flex-col gap-4" aria-label="Entradas do dia">
        <div className="flex flex-wrap items-center gap-3">
          {c.situacao === 'fechado' ? (
            <Ficha tom="neutro">Caixa fechado</Ficha>
          ) : c.situacao === 'aberto' ? (
            <Ficha tom="acao">Caixa aberto</Ficha>
          ) : (
            <Ficha tom="aviso">Caixa não aberto</Ficha>
          )}
          <span className="text-tinta-suave">
            {c.fechadas} {c.fechadas === 1 ? 'comanda fechada' : 'comandas fechadas'}
          </span>
        </div>
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <div className="grid gap-3 sm:grid-cols-2">
          {c.porForma.length === 0 && <p className="text-tinta-suave">Nenhum recebimento ainda.</p>}
          {c.porForma.map((f) => (
            <div key={f.forma} className="rounded-lg border border-borda bg-superficie p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
                {NOME_FORMA[f.forma]}
              </p>
              <p className="font-denso text-3xl font-semibold tabular-nums">
                {formatarMoeda(f.total)}
              </p>
              <p className="text-sm text-tinta-suave">
                {f.quantidade} {f.quantidade === 1 ? 'pagamento' : 'pagamentos'}
              </p>
            </div>
          ))}
        </div>
        <p className="flex justify-between border-t border-borda pt-3 font-denso text-2xl font-bold tabular-nums">
          <span>Total recebido</span>
          <span>{formatarMoeda(c.totalRecebido)}</span>
        </p>
        {(c.sinais.recebidos > 0 || c.sinais.devolvidos > 0) && (
          <p className="text-sm text-tinta-suave">
            {c.sinais.recebidos > 0 &&
              `Inclui ${formatarMoeda(c.sinais.recebidos)} de sinal recebido adiantado. `}
            {c.sinais.devolvidos > 0 &&
              `Já descontado ${formatarMoeda(c.sinais.devolvidos)} de sinal devolvido ao cliente.`}
          </p>
        )}
        {c.aReceber.quantidade > 0 && (
          <Aviso tom="info">
            {c.aReceber.quantidade}{' '}
            {c.aReceber.quantidade === 1 ? 'comanda ainda aberta' : 'comandas ainda abertas'} (
            {formatarMoeda(c.aReceber.total)}).{' '}
            <Link href="/comandas" className="font-semibold underline underline-offset-4">
              Ver comandas
            </Link>
          </Aviso>
        )}
      </section>

      <aside
        className="flex flex-col gap-4 rounded-lg border border-borda bg-superficie p-4"
        aria-label="Gaveta"
      >
        <h2 className="text-lg font-semibold">Gaveta de dinheiro</h2>
        <dl className="flex flex-col gap-1 font-denso text-lg tabular-nums">
          <div className="flex justify-between">
            <dt className="text-tinta-suave">Troco inicial</dt>
            <dd>{formatarMoeda(c.valorAbertura)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-tinta-suave">Recebido em dinheiro</dt>
            <dd>{formatarMoeda(c.dinheiroEsperado - c.valorAbertura)}</dd>
          </div>
          <div className="flex justify-between text-xl font-bold">
            <dt>Deve ter na gaveta</dt>
            <dd>{formatarMoeda(c.dinheiroEsperado)}</dd>
          </div>
          {c.totalInformado !== null && (
            <>
              <div className="flex justify-between">
                <dt className="text-tinta-suave">Contado</dt>
                <dd>{formatarMoeda(c.totalInformado)}</dd>
              </div>
              <div
                className={`flex justify-between font-bold ${c.divergencia ? 'text-perigo-texto' : 'text-acao-texto'}`}
              >
                <dt>Diferença</dt>
                <dd>{c.divergencia ? formatarMoeda(c.divergencia) : 'Bateu'}</dd>
              </div>
            </>
          )}
        </dl>
        {c.situacao === 'nao_aberto' && (
          <form
            method="post"
            noValidate
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const v = lerMoeda(troco || '0');
              if (v !== null && v >= 0) void executar('abrir', { valorAbertura: v });
            }}
          >
            <Campo
              id="caixa-troco"
              rotulo="Troco na gaveta (R$)"
              inputMode="decimal"
              placeholder="200,00"
              value={troco}
              onChange={(e) => setTroco(e.target.value)}
            />
            <Botao type="submit" carregando={acao.isPending}>
              Abrir caixa
            </Botao>
          </form>
        )}
        {c.situacao === 'aberto' && (
          <form
            method="post"
            noValidate
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (informado !== null && informado >= 0) setConfirmar(true);
            }}
          >
            <Campo
              id="caixa-contagem"
              rotulo="Dinheiro contado na gaveta (R$)"
              inputMode="decimal"
              dica="Conte notas e moedas, incluindo o troco"
              value={contagem}
              onChange={(e) => setContagem(e.target.value)}
            />
            <Botao type="submit" disabled={informado === null}>
              Fechar caixa
            </Botao>
          </form>
        )}
        {c.situacao === 'fechado' && gestao && (
          <Botao variante="secundario" onClick={() => setReabrir(true)}>
            Reabrir caixa
          </Botao>
        )}
      </aside>

      <ModalConfirmacao
        aberto={confirmar}
        titulo="Fechar o caixa do dia?"
        descricao={
          informado !== null && informado !== c.dinheiroEsperado
            ? `A contagem (${formatarMoeda(informado)}) não bate com o esperado (${formatarMoeda(c.dinheiroEsperado)}). A diferença de ${formatarMoeda(informado - c.dinheiroEsperado)} fica registrada.`
            : 'A contagem bate com o sistema. Depois de fechado, nenhuma comanda deste dia muda sem o gestor.'
        }
        textoConfirmar="Fechar caixa"
        carregando={acao.isPending}
        onCancelar={() => setConfirmar(false)}
        onConfirmar={async () => {
          setConfirmar(false);
          await executar('fechar', { totalInformado: informado });
          setContagem('');
        }}
      />
      <ModalConfirmacao
        aberto={reabrir}
        titulo="Reabrir o caixa?"
        descricao="Libera mudanças nas comandas deste dia. A contagem anterior é descartada."
        textoConfirmar="Reabrir caixa"
        exigirMotivo
        onCancelar={() => setReabrir(false)}
        onConfirmar={async (motivo) => {
          setReabrir(false);
          await executar('reabrir', { motivo });
        }}
      />
    </div>
  );
}
