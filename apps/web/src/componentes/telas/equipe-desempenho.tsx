'use client';

import {
  formatarFracao,
  formatarMoeda,
  formatarNumero,
  type LinhaRankingEquipe,
} from '@pente-fino/shared';
import { EstadoVazio, Selecao } from '@pente-fino/ui';
import { ArrowLeft, Trophy, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useProfissionais, useRankingEquipe } from '@/lib/consultas';
import { mesAtual } from '@/lib/periodo';
import { useApp } from '../contexto-app';
import { Estado, Ficha, Tabela, td, th } from '../pagina';
import {
  FichaDoProfissional,
  limitesDoPeriodo,
  SeletorPeriodo,
  type Periodo,
} from './ficha-profissional';

const MES = /^\d{4}-\d{2}$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Período vindo da URL (?mes= ou ?de=&ate=), para o link da ficha abrir no mesmo mês do ranking. */
function periodoDaUrl(p: URLSearchParams): Periodo {
  const de = p.get('de');
  const ate = p.get('ate');
  if (de && ate && DATA.test(de) && DATA.test(ate) && de <= ate)
    return { tipo: 'intervalo', de, ate };
  const mes = p.get('mes');
  return { tipo: 'mes', mes: mes && MES.test(mes) && mes <= mesAtual() ? mes : mesAtual() };
}

function paraUrl(p: Periodo) {
  return p.tipo === 'mes' ? `mes=${p.mes}` : `de=${p.de}&ate=${p.ate}`;
}

// ─── Ranking (aba da tela Equipe) ─────────────────────────────────────────

const ORDENS: { valor: keyof LinhaRankingEquipe; rotulo: string }[] = [
  { valor: 'faturamento', rotulo: 'Faturamento' },
  { valor: 'clientes', rotulo: 'Clientes' },
  { valor: 'ticketMedio', rotulo: 'Ticket médio' },
  { valor: 'percentualExtras', rotulo: 'Extras' },
  { valor: 'taxaRetorno', rotulo: 'Clientes que voltam' },
  { valor: 'percentualNoPrazo', rotulo: 'Confirmação no prazo' },
  { valor: 'ocupacao', rotulo: 'Ocupação' },
  { valor: 'notaMedia', rotulo: 'Nota dos clientes' },
];

export function RankingEquipe() {
  const { unidadeAtiva } = useApp();
  const [periodo, setPeriodo] = useState<Periodo>({ tipo: 'mes', mes: mesAtual() });
  const [ordem, setOrdem] = useState<keyof LinhaRankingEquipe>('faturamento');
  const [de, ate] = limitesDoPeriodo(periodo);
  const ranking = useRankingEquipe(unidadeAtiva, de, ate);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SeletorPeriodo periodo={periodo} onMudar={setPeriodo} />
        <Selecao
          id="ranking-ordem"
          rotulo="Ordenar por"
          value={ordem}
          onChange={(e) => setOrdem(e.target.value as keyof LinhaRankingEquipe)}
          opcoes={ORDENS.map((o) => ({ valor: o.valor, rotulo: o.rotulo }))}
          className="min-w-56"
        />
      </div>
      <Estado consulta={ranking}>
        {() => {
          const linhas = [...ranking.data!].sort(
            // Sem nota (ninguém respondeu) vai para o fim quando ordena por nota.
            (a, b) => ((b[ordem] as number | null) ?? -1) - ((a[ordem] as number | null) ?? -1),
          );
          if (linhas.length === 0)
            return (
              <EstadoVazio
                icone={Trophy}
                titulo="Nenhum profissional no período"
                texto="Cadastre a equipe na aba Profissionais para acompanhar o desempenho de cada um."
              />
            );
          return (
            <Tabela rotulo="Desempenho da equipe">
              <thead>
                <tr>
                  <th className={th}>Profissional</th>
                  <th className={`${th} text-right`}>Faturamento</th>
                  <th className={`${th} text-right`}>Clientes</th>
                  <th className={`${th} text-right`}>Ticket</th>
                  <th className={`${th} text-right`}>Extras</th>
                  <th className={`${th} text-right`}>Voltam</th>
                  <th className={`${th} text-right`}>No prazo</th>
                  <th className={`${th} text-right`}>Ocupação</th>
                  <th className={`${th} text-right`}>Nota</th>
                  <th className={`${th} text-right`}>Comissão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borda tabular-nums">
                {linhas.map((l, i) => (
                  <tr key={l.profissionalId}>
                    <th scope="row" className={`${td} text-left font-medium`}>
                      <Link
                        href={`/equipe/ficha?id=${l.profissionalId}&${paraUrl(periodo)}`}
                        className="inline-flex min-h-11 items-center gap-2 underline-offset-4 hover:underline"
                      >
                        <span className="w-5 text-right font-denso text-tinta-fraca">{i + 1}</span>
                        {l.nome}
                      </Link>
                      {!l.ativo && (
                        <span className="ml-2">
                          <Ficha tom="neutro">Desligado</Ficha>
                        </span>
                      )}
                    </th>
                    <td className={`${td} text-right`}>{formatarMoeda(l.faturamento)}</td>
                    <td className={`${td} text-right`}>{formatarNumero(l.clientes)}</td>
                    <td className={`${td} text-right`}>{formatarMoeda(l.ticketMedio)}</td>
                    <td className={`${td} text-right`}>{formatarFracao(l.percentualExtras, 0)}</td>
                    <td className={`${td} text-right`}>{formatarFracao(l.taxaRetorno, 0)}</td>
                    <td className={`${td} text-right`}>{formatarFracao(l.percentualNoPrazo, 0)}</td>
                    <td className={`${td} text-right`}>{formatarFracao(l.ocupacao, 0)}</td>
                    <td className={`${td} text-right`}>
                      {l.notaMedia === null
                        ? '—'
                        : l.notaMedia.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}
                    </td>
                    <td className={`${td} text-right`}>{formatarMoeda(l.comissao)}</td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          );
        }}
      </Estado>
      <p className="text-sm text-tinta-suave">
        Voltam: clientes do período que já tinham vindo com ele nos 45 dias anteriores. No prazo:
        comandas confirmadas pelo barbeiro até 15 minutos depois do horário. Nota: média de 1 a 5 do
        atendimento na pesquisa pelo WhatsApp. Toque no nome para ver a ficha completa.
      </p>
    </div>
  );
}

// ─── Ficha (dono e gestor) ────────────────────────────────────────────────

export function TelaFichaProfissional() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get('id');
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoDaUrl(params));
  const valido = id && /^[0-9a-f-]{36}$/i.test(id);
  const mudar = (p: Periodo) => {
    setPeriodo(p);
    router.replace(`/equipe/ficha?id=${id}&${paraUrl(p)}`, { scroll: false });
  };
  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/equipe"
        data-nao-imprimir
        className="inline-flex min-h-11 items-center gap-2 self-start text-tinta-suave hover:text-tinta"
      >
        <ArrowLeft aria-hidden className="size-5" /> Equipe
      </Link>
      {valido ? (
        <FichaDoProfissional id={id} periodo={periodo} onPeriodo={mudar} />
      ) : (
        <EstadoVazio
          icone={UserRound}
          titulo="Profissional não encontrado"
          texto="Abra a ficha pela tela Equipe."
        />
      )}
    </div>
  );
}

// ─── Desempenho do barbeiro (a própria ficha) ─────────────────────────────

export function TelaDesempenhoBarbeiro() {
  const { usuario, unidades } = useApp();
  const profissionais = useProfissionais();
  const [periodo, setPeriodo] = useState<Periodo>({ tipo: 'mes', mes: mesAtual() });
  const [escolhido, setEscolhido] = useState<string | null>(null);
  return (
    <Estado consulta={profissionais}>
      {() => {
        const meus = profissionais.data!.filter((p) => p.usuarioId === usuario.id);
        const ativos = meus.filter((p) => p.ativo);
        const lista = ativos.length ? ativos : meus;
        if (lista.length === 0)
          return (
            <EstadoVazio
              icone={UserRound}
              titulo="Você ainda não está na agenda"
              texto="Peça ao dono ou ao gestor para cadastrar você como profissional da unidade."
            />
          );
        const id = escolhido ?? lista[0]!.id;
        return (
          <div className="flex flex-col gap-4">
            {lista.length > 1 && (
              <Selecao
                id="desempenho-unidade"
                rotulo="Unidade"
                value={id}
                onChange={(e) => setEscolhido(e.target.value)}
                opcoes={lista.map((p) => ({
                  valor: p.id,
                  rotulo: unidades.find((u) => u.id === p.unidadeId)?.nome ?? p.nome,
                }))}
                className="max-w-xs"
              />
            )}
            <FichaDoProfissional
              id={id}
              periodo={periodo}
              onPeriodo={setPeriodo}
              titulo="Desempenho"
            />
          </div>
        );
      }}
    </Estado>
  );
}
