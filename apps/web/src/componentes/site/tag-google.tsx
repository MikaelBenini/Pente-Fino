'use client';

import Script from 'next/script';
import { useSyncExternalStore } from 'react';

/** Contêiner do Google Tag Manager (Google Ads). Público: aparece no HTML de qualquer forma. */
export const ID_GTM = process.env.NEXT_PUBLIC_GTM_ID ?? 'GTM-WKWRDX4R';
/** Tag do Google Ads (conversões). */
export const ID_GOOGLE_ADS = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? 'AW-18558704295';
const CHAVE = 'pf-cookies';
type Escolha = 'aceito' | 'recusado';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const lerEscolha = (): Escolha | null => {
  try {
    const v = localStorage.getItem(CHAVE);
    return v === 'aceito' || v === 'recusado' ? v : null;
  } catch {
    return null;
  }
};

/** Liga ou desliga os cookies de anúncio e de medição (Consent Mode v2). */
function aplicar(escolha: Escolha) {
  const valor = escolha === 'aceito' ? 'granted' : 'denied';
  window.gtag?.('consent', 'update', {
    ad_storage: valor,
    ad_user_data: valor,
    ad_personalization: valor,
    analytics_storage: valor,
  });
}

/** Evento para o Google Ads (conversão), ex.: 'cadastro_concluido'. Sem a tag, não faz nada. */
export function eventoGoogle(evento: string, dados: Record<string, unknown> = {}) {
  window.dataLayer?.push({ event: evento, ...dados });
}

/**
 * Tag do Google só no site público. Começa com o consentimento negado (LGPD): sem aceite, o Google
 * não grava cookie de anúncio; a escolha anterior do visitante vale desde o primeiro carregamento.
 */
export function TagGoogle() {
  if (!ID_GTM) return null;
  return (
    <Script id="tag-google" strategy="afterInteractive">
      {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;
var e=null;try{e=localStorage.getItem('${CHAVE}')}catch(_){}var v=e==='aceito'?'granted':'denied';
gtag('consent','default',{ad_storage:v,ad_user_data:v,ad_personalization:v,analytics_storage:v,wait_for_update:500});
gtag('js',new Date());dataLayer.push({'gtm.start':new Date().getTime(),event:'gtm.js'});
function carregar(u){var s=document.createElement('script');s.async=true;s.src=u;document.head.appendChild(s);}
carregar('https://www.googletagmanager.com/gtm.js?id=${ID_GTM}');
${ID_GOOGLE_ADS ? `carregar('https://www.googletagmanager.com/gtag/js?id=${ID_GOOGLE_ADS}');gtag('config','${ID_GOOGLE_ADS}');` : ''}`}
    </Script>
  );
}

const ouvintes = new Set<() => void>();
const assinar = (f: () => void) => {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
};

/** Aviso de cookies: aparece até o visitante escolher; a escolha fica neste navegador. */
export function AvisoCookies() {
  const escolha = useSyncExternalStore(assinar, lerEscolha, () => 'aceito' as Escolha);
  if (escolha || !ID_GTM) return null;
  const escolher = (e: Escolha) => {
    try {
      localStorage.setItem(CHAVE, e);
    } catch {
      // Sem armazenamento (aba anônima): vale só nesta visita.
    }
    aplicar(e);
    ouvintes.forEach((f) => f());
  };
  return (
    <>
      {/* Espaço no fim da página: o aviso não cobre o último botão (ex.: "Criar conta"). */}
      <div aria-hidden className="h-36 sm:h-24" />
      <div
        role="region"
        aria-label="Cookies"
        className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-3xl flex-col gap-3 rounded-xl border border-borda-forte bg-superficie-2 p-4 shadow-2xl sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="text-sm text-tinta-suave">
          Usamos cookies para medir de onde vêm as visitas e melhorar nossos anúncios. Você escolhe.{' '}
          <a href="/privacidade" className="underline underline-offset-4 hover:text-tinta">
            Privacidade
          </a>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => escolher('recusado')}
            className="min-h-11 rounded-md border border-borda px-4 font-semibold hover:bg-superficie-3 focus-visible:outline-2 focus-visible:outline-foco"
          >
            Recusar
          </button>
          <button
            type="button"
            onClick={() => escolher('aceito')}
            className="min-h-11 rounded-md bg-acao px-4 font-semibold text-sobre-acao hover:brightness-95 focus-visible:outline-2 focus-visible:outline-foco"
          >
            Aceitar
          </button>
        </div>
      </div>
    </>
  );
}
