'use client';

// Indique e ganhe do dono (regras de 14/11): o link da barbearia e a escolha entre o Pix (20%
// das mensalidades da indicada nos 12 primeiros meses) e 1 mês grátis por indicada que pagar.
import type { IndicacaoDaContaEntrada, PainelIndicador } from '@pente-fino/shared';
import { Botao, Campo } from '@pente-fino/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { Aviso } from '../aviso';
import { CampoDocumento } from '../campos';
import { Estado } from '../pagina';
import { ConteudoPainel } from '../site/indique';

type Painel = PainelIndicador & { link: string };
const CHAVE = ['conta', 'indicacao'];

export function IndiqueConta() {
  const q = useQuery({ queryKey: CHAVE, queryFn: () => api<Painel | null>('conta/indicacao') });
  return (
    <Estado consulta={q}>
      {() => (
        <div className="flex max-w-4xl flex-col gap-6">
          <p className="text-tinta-suave">
            Indique o Pente Fino para outros negócios. Quem entra pelo seu link ganha 30 dias para
            testar, e você escolhe: 20% das mensalidades dela nos 12 primeiros meses, no Pix, ou 1
            mês grátis na sua assinatura a cada negócio que pagar.
          </p>
          {q.data && <ConteudoPainel p={q.data} link={q.data.link} />}
          <Escolha atual={q.data ?? null} />
        </div>
      )}
    </Estado>
  );
}

function Escolha({ atual }: { atual: Painel | null }) {
  const cliente = useQueryClient();
  const [recebe, setRecebe] = useState<'pix' | 'meses'>(atual?.recebe ?? 'meses');
  const [cpf, setCpf] = useState('');
  const [chavePix, setChavePix] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function salvar() {
    setErro(null);
    setEnviando(true);
    const corpo: IndicacaoDaContaEntrada =
      recebe === 'pix' ? { recebe, cpf, chavePix } : { recebe: 'meses' };
    try {
      await api('conta/indicacao', { metodo: 'PUT', corpo });
      await cliente.invalidateQueries({ queryKey: CHAVE });
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não deu certo. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-5">
      <legend className="px-1 font-semibold">Como você quer ganhar</legend>
      {(
        [
          ['meses', '1 mês grátis na assinatura por negócio que pagar'],
          ['pix', '20% das mensalidades no Pix, nos 12 primeiros meses de cada negócio'],
        ] as const
      ).map(([v, t]) => (
        <label key={v} className="flex min-h-11 cursor-pointer items-center gap-3">
          <input
            type="radio"
            name="indique-recebe"
            checked={recebe === v}
            onChange={() => setRecebe(v)}
            className="size-5 accent-[var(--modulo)]"
          />
          {t}
        </label>
      ))}
      {recebe === 'pix' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoDocumento id="indique-cpf" rotulo="CPF" soCpf valor={cpf} onValor={setCpf} />
          <Campo
            id="indique-pix"
            rotulo="Chave Pix"
            autoComplete="off"
            value={chavePix}
            onChange={(e) => setChavePix(e.target.value)}
          />
        </div>
      )}
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <Botao carregando={enviando} onClick={salvar} className="self-start">
        {atual ? 'Salvar' : 'Gerar meu link'}
      </Botao>
    </fieldset>
  );
}
