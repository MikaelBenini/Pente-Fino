'use client';

// Oferta de lançamento (briefing do site, C1): 30% para sempre para quem assinar até a data. A
// urgência vem da data; o contador de vagas só aparece quando sobra pouco. Acabou (data, vagas ou
// desligada na administração)? A faixa do topo, o bloco e os botões com cupom somem juntos.
import {
  dataLocal,
  DIAS_TESTE,
  formatarData,
  OFERTA_LANCAMENTO,
  ofertaVigente,
  textoVagasOferta,
} from '@pente-fino/shared';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import Link from 'next/link';
import { useSyncExternalStore, type ComponentProps } from 'react';
import { api } from '@/lib/api';
import { LinkBotao } from './link-botao';

const DATA = formatarData(`${OFERTA_LANCAMENTO.ate}T12:00:00Z`);
export const LINK_OFERTA = `/cadastro?cupom=${OFERTA_LANCAMENTO.codigo}`;

/** A oferta vale agora? undefined enquanto confere (a página não pisca com um botão errado). */
const nada = () => () => undefined;
const noPrazoAgora = () => ofertaVigente(dataLocal(new Date()));

export function useOfertaAtiva(): { ativa: boolean | undefined; restantes: number | null } {
  // A data só é lida no navegador; a página pré-renderizada sai com a oferta (o navegador corrige).
  const noPrazo = useSyncExternalStore(nada, noPrazoAgora, () => true);
  const cupom = useQuery({
    queryKey: ['oferta-lancamento'],
    queryFn: () => api<{ restantes: number | null }>(`publico/cupom/${OFERTA_LANCAMENTO.codigo}`),
    enabled: noPrazo,
    retry: false,
    staleTime: 10 * 60_000,
  });
  if (!noPrazo) return { ativa: false, restantes: null };
  if (cupom.isError) return { ativa: false, restantes: null };
  return { ativa: cupom.data ? true : undefined, restantes: cupom.data?.restantes ?? null };
}

/** Bloco da oferta em /planos e na home. */
export function OfertaLancamento() {
  const { ativa, restantes } = useOfertaAtiva();
  if (ativa === false) return null;
  const vagas = textoVagasOferta(restantes);
  return (
    <section aria-labelledby="oferta" className="border-y border-borda bg-superficie">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wider text-modulo-texto">
            Oferta de lançamento · até {DATA}
          </p>
          <h2 id="oferta" className="font-denso text-3xl font-bold uppercase">
            30% de desconto <span className="text-modulo-texto">para sempre</span>
          </h2>
          <p className="max-w-2xl text-tinta-suave">
            Assine até {DATA}, em qualquer plano, e pague 30% a menos em todas as mensalidades
            enquanto a assinatura estiver ativa. Os {DIAS_TESTE} dias de teste continuam grátis e
            sem cartão: o desconto já fica guardado no cadastro.
          </p>
          {vagas && <p className="font-semibold text-perigo-texto">{vagas} com este desconto.</p>}
        </div>
        <LinkBotao href={LINK_OFERTA} variante="modulo" className="shrink-0">
          Testar grátis com 30% off
        </LinkBotao>
      </div>
    </section>
  );
}

const CHAVE_FECHADA = 'pf-faixa-oferta';
const ouvintes = new Set<() => void>();
const assinar = (f: () => void) => {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
};
const lerFechada = () => {
  try {
    return localStorage.getItem(CHAVE_FECHADA) === OFERTA_LANCAMENTO.ate;
  } catch {
    return false;
  }
};

/** Faixa fina no topo de todas as páginas do site; fechada, não volta neste navegador. */
export function FaixaOferta() {
  const { ativa } = useOfertaAtiva();
  const fechada = useSyncExternalStore(assinar, lerFechada, () => false);
  if (ativa === false || fechada) return null;
  const fechar = () => {
    try {
      localStorage.setItem(CHAVE_FECHADA, OFERTA_LANCAMENTO.ate);
    } catch {
      // Sem armazenamento (aba anônima): some só nesta visita.
    }
    ouvintes.forEach((f) => f());
  };
  return (
    <div
      role="region"
      aria-label="Oferta de lançamento"
      className="relative border-b border-modulo/40 bg-modulo/10 text-sm"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-x-3 gap-y-1 px-12 py-2 text-center sm:px-6">
        <p>
          <strong>Oferta de lançamento:</strong> 30% off para sempre em qualquer plano. Até {DATA}.{' '}
          <Link
            href={LINK_OFERTA}
            className="font-semibold whitespace-nowrap text-modulo-texto underline underline-offset-4"
          >
            Ativar desconto
          </Link>
        </p>
      </div>
      <button
        type="button"
        onClick={fechar}
        aria-label="Fechar a faixa da oferta"
        className="absolute top-1/2 right-1 grid size-11 -translate-y-1/2 place-items-center rounded-md text-tinta-suave hover:text-tinta focus-visible:outline-2 focus-visible:outline-foco"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}

/** Link de cadastro com o cupom enquanto a oferta vale; sem ela, o cadastro normal. */
export function useLinkCadastro(extra = ''): string {
  const { ativa } = useOfertaAtiva();
  const base = ativa === false ? '/cadastro' : LINK_OFERTA;
  if (!extra) return base;
  return `${base}${base.includes('?') ? '&' : '?'}${extra}`;
}

/** Botão de cadastro que leva o cupom enquanto a oferta vale (o resto do link é o `extra`). */
export function LinkCadastro({
  extra = '',
  ...props
}: Omit<ComponentProps<typeof LinkBotao>, 'href'> & { extra?: string }) {
  return <LinkBotao href={useLinkCadastro(extra)} {...props} />;
}

/** "Testar grátis com 30% off" enquanto a oferta vale; depois, "Testar N dias grátis". */
export function BotaoTesteOferta({
  extra = '',
  ...props
}: Omit<ComponentProps<typeof LinkBotao>, 'href' | 'children'> & { extra?: string }) {
  const { ativa } = useOfertaAtiva();
  return (
    <LinkBotao href={useLinkCadastro(extra)} {...props}>
      {ativa === false ? `Testar ${DIAS_TESTE} dias grátis` : 'Testar grátis com 30% off'}
    </LinkBotao>
  );
}
