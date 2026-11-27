'use client';

// Plano Agenda, revenda conforme a necessidade: quem toca numa tela do Básico (cadeado no menu)
// vê o que ela faz e pode experimentar o Básico por 7 dias, uma vez por conta, sem mudar o plano.
import {
  DIAS_EXPERIMENTAR,
  formatarMoeda,
  podeExperimentar,
  PRECOS_PLANO,
  type IdMenu,
} from '@pente-fino/shared';
import { Botao } from '@pente-fino/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { chaveAssinatura, useSituacaoConta } from '@/lib/consultas';
import { Aviso } from '../aviso';
import { useApp } from '../contexto-app';
import { CabecalhoPagina } from '../pagina';

/** O que cada tela do Básico resolve, na língua do balcão. */
const O_QUE_FAZ: Partial<Record<IdMenu, { titulo: string; itens: string[] }>> = {
  comandas: {
    titulo: 'Comanda que nasce do agendamento',
    itens: [
      'Agendou, a comanda já existe: o profissional lança os extras e confirma',
      'A recepção recebe em Pix, dinheiro ou cartão, até dividido',
      'Comanda impressa em PDF com QR code',
    ],
  },
  caixa: {
    titulo: 'Caixa do dia sem susto',
    itens: [
      'Abre com o troco e fecha conferindo a gaveta',
      'Mostra a diferença na hora e avisa o dono',
      'O resumo do fechamento chega no celular do dono',
    ],
  },
  dia: {
    titulo: 'O dia num relance',
    itens: [
      'Quem atendeu, quanto entrou e o que falta receber',
      'Cada profissional com os horários e o que lançou',
    ],
  },
  resultados: {
    titulo: 'Quanto sobra no fim do mês',
    itens: [
      'Faturamento, clientes, ticket médio e extras',
      'Projeção do mês pelos dias que faltam',
      'Comparação com o mês anterior',
    ],
  },
  financeiro: {
    titulo: 'Despesas no lugar certo',
    itens: [
      'Despesas fixas que se repetem todo mês',
      'O peso de cada grupo sobre o faturamento',
      'Retirada do dono e investimento separados',
    ],
  },
  comissoes: {
    titulo: 'Comissão automática',
    itens: [
      'Calculada item por item, do jeito que você combina',
      'Extrato de comissão no celular de cada profissional',
    ],
  },
};

export function TelaConhecer() {
  const tela = (useSearchParams().get('tela') ?? 'comandas') as IdMenu;
  return <ConhecerBasico tela={tela} />;
}

export function ConhecerBasico({ tela }: { tela: IdMenu }) {
  const { papeis, menu, bloqueados } = useApp();
  const situacao = useSituacaoConta().data;
  const cliente = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const dono = papeis.includes('dono');
  const item = [...menu, ...(bloqueados ?? [])].find((i) => i.id === tela);
  const conteudo = O_QUE_FAZ[tela] ?? O_QUE_FAZ.comandas!;
  const pode = !!situacao && podeExperimentar(situacao.plano, situacao.experimentaAte);

  async function experimentar() {
    setErro(null);
    setEnviando(true);
    try {
      await api('conta/experimentar', { corpo: {} });
      await cliente.invalidateQueries({ queryKey: chaveAssinatura });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para começar agora.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <CabecalhoPagina
        titulo={item?.rotulo ?? 'Plano Básico'}
        pergunta="Faz parte do plano Básico"
      />
      <section className="flex flex-col gap-4 rounded-lg border border-borda bg-superficie p-5">
        <h2 className="text-xl font-semibold">{conteudo.titulo}</h2>
        <ul className="flex flex-col gap-2">
          {conteudo.itens.map((t) => (
            <li key={t} className="flex gap-2">
              <Check aria-hidden className="mt-0.5 size-5 shrink-0 text-acao-texto" />
              {t}
            </li>
          ))}
        </ul>
        <p className="text-tinta-suave">
          O Básico custa {formatarMoeda(PRECOS_PLANO.basico.mensal)} por mês e traz a agenda, a
          comanda, o caixa, as despesas e as comissões. O que você já tem continua igual.
        </p>
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <div className="flex flex-wrap items-center gap-3">
          {dono && pode && (
            <Botao carregando={enviando} onClick={experimentar}>
              Experimentar {DIAS_EXPERIMENTAR} dias
            </Botao>
          )}
          {dono ? (
            <Link
              href="/configuracoes?aba=assinatura"
              className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
            >
              Mudar de plano
            </Link>
          ) : (
            <p className="text-tinta-suave">Peça ao dono da conta para mudar de plano.</p>
          )}
        </div>
        {dono && !pode && situacao?.experimentaAte && (
          <p className="text-sm text-tinta-suave">
            A experiência de {DIAS_EXPERIMENTAR} dias já foi usada nesta conta.
          </p>
        )}
      </section>
    </div>
  );
}
