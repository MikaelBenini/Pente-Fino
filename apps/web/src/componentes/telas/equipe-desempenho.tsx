'use client';

import { EstadoVazio, Selecao } from '@pente-fino/ui';
import { ArrowLeft, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useProfissionais } from '@/lib/consultas';
import { mesAtual } from '@/lib/periodo';
import { useApp } from '../contexto-app';
import { Estado } from '../pagina';
import { SoNoPlano } from '../convite-plano';
import { FichaDoProfissional, type Periodo } from './ficha-profissional';

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

// ─── Ficha (dono e gestor) ────────────────────────────────────────────────

export function TelaFichaProfissional() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get('id');
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoDaUrl(params));
  const valido = id && /^[0-9a-f-]{36}$/i.test(id);
  // Aberta pela aba Barbeiros de Resultados do mês: volta para lá, no mesmo mês.
  const deResultados = params.get('voltar') === 'resultados';
  const voltarPara = !deResultados
    ? '/equipe'
    : periodo.tipo === 'mes'
      ? `/resultados?mes=${periodo.mes}&aba=barbeiros`
      : '/resultados?aba=barbeiros';
  const mudar = (p: Periodo) => {
    setPeriodo(p);
    router.replace(
      `/equipe/ficha?id=${id}&${paraUrl(p)}${deResultados ? '&voltar=resultados' : ''}`,
      { scroll: false },
    );
  };
  return (
    <div className="flex flex-col gap-4">
      <Link
        href={voltarPara}
        data-nao-imprimir
        className="inline-flex min-h-11 items-center gap-2 self-start text-tinta-suave hover:text-tinta"
      >
        <ArrowLeft aria-hidden className="size-5" /> {deResultados ? 'Resultados do mês' : 'Equipe'}
      </Link>
      {valido ? (
        <SoNoPlano recurso="fichaProfissional">
          <FichaDoProfissional id={id} periodo={periodo} onPeriodo={mudar} />
        </SoNoPlano>
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
            <SoNoPlano recurso="fichaProfissional">
              <FichaDoProfissional
                id={id}
                periodo={periodo}
                onPeriodo={setPeriodo}
                titulo="Desempenho"
              />
            </SoNoPlano>
          </div>
        );
      }}
    </Estado>
  );
}
