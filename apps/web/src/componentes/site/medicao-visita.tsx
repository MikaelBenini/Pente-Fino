'use client';

// O que o visitante faz na página de vendas (pedido do dono em 13/11). Medição nossa, sem cookie:
// - um id anônimo por visita (sessionStorage, some ao fechar a aba);
// - "primeira vez neste navegador" só com o aceite de cookies;
// - a entrada em cada página, as marcas de rolagem (25, 50, 75 e 100%) e os cliques do funil;
// - de onde veio (campanha ou site de origem).
// Com o "não rastrear" (DNT ou GPC) ligado, nada sai do navegador. Os eventos vão em lote para
// /api/visitas a cada 5 s e ao sair da página (fetch com keepalive).
import {
  alvoDoClique,
  MARCAS_ROLAGEM,
  origemCurta,
  type EventoVisita,
  type LoteVisita,
} from '@pente-fino/shared';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

const SESSAO_ID = 'pf-visita';
const SESSAO_ORIGEM = 'pf-visita-origem';
const SESSAO_NOVA = 'pf-visita-nova';
const JA_VEIO = 'pf-ja-veio';

declare global {
  interface Navigator {
    globalPrivacyControl?: boolean;
  }
}

function naoRastrear(): boolean {
  return navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true;
}

function lerSessao(chave: string): string | null {
  try {
    return sessionStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravarSessao(chave: string, valor: string) {
  try {
    sessionStorage.setItem(chave, valor);
  } catch {
    // Sem armazenamento: vale só enquanto a página estiver aberta.
  }
}

/** A visita: id anônimo, se é nova (só com aceite de cookies) e de onde veio. */
function dadosDaVisita(): Omit<LoteVisita, 'eventos'> {
  let visitaId = lerSessao(SESSAO_ID);
  if (!visitaId) {
    visitaId = crypto.randomUUID();
    gravarSessao(SESSAO_ID, visitaId);
    gravarSessao(SESSAO_ORIGEM, origemCurta(location.href, document.referrer) ?? '');
  }
  let novo: boolean | null = null;
  try {
    if (localStorage.getItem('pf-cookies') === 'aceito') {
      // Decide uma vez por visita: é nova se este navegador nunca veio antes.
      const marcada = lerSessao(SESSAO_NOVA);
      novo = marcada !== null ? marcada === '1' : localStorage.getItem(JA_VEIO) === null;
      localStorage.setItem(JA_VEIO, '1');
      gravarSessao(SESSAO_NOVA, novo ? '1' : '0');
    }
  } catch {
    novo = null;
  }
  return { visitaId, novo, origem: lerSessao(SESSAO_ORIGEM) || null };
}

/** O caminho como o servidor aceita (letras, números, -, _ e /), sem o resto do endereço. */
const caminho = (p: string) => (p.replace(/[^\w\-/]/g, '-') || '/').slice(0, 120);

export function MedicaoVisita() {
  const pathname = usePathname();
  const fila = useRef<EventoVisita[]>([]);

  // Envio em lote: a cada 5 s e quando a página some (troca de aba, fechar, ir embora).
  useEffect(() => {
    if (naoRastrear()) return;
    const enviar = () => {
      if (fila.current.length === 0) return;
      const eventos = fila.current.splice(0, 30);
      const lote: LoteVisita = { ...dadosDaVisita(), eventos };
      void fetch('/api/visitas', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(lote),
        keepalive: true,
      }).catch(() => undefined);
    };
    const t = setInterval(enviar, 5000);
    const aoSumir = () => {
      if (document.visibilityState === 'hidden') enviar();
    };
    document.addEventListener('visibilitychange', aoSumir);
    window.addEventListener('pagehide', enviar);

    // Cliques do funil, num ouvinte só: nenhum botão novo fica de fora.
    const aoClicar = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('a[href], button, [data-medir]');
      if (!el) return;
      const alvo = alvoDoClique(el.getAttribute('href'), (el as HTMLElement).dataset.medir);
      if (alvo)
        fila.current.push({ tipo: 'clique', pagina: caminho(location.pathname), valor: alvo });
    };
    // O vídeo também conta quando começa a tocar pelo próprio player.
    const aoTocar = (e: Event) => {
      if (!(e.target instanceof HTMLVideoElement)) return;
      const ja = fila.current.some((x) => x.tipo === 'clique' && x.valor === 'video');
      if (!ja)
        fila.current.push({ tipo: 'clique', pagina: caminho(location.pathname), valor: 'video' });
    };
    document.addEventListener('click', aoClicar, true);
    document.addEventListener('play', aoTocar, true);
    return () => {
      enviar();
      clearInterval(t);
      document.removeEventListener('visibilitychange', aoSumir);
      window.removeEventListener('pagehide', enviar);
      document.removeEventListener('click', aoClicar, true);
      document.removeEventListener('play', aoTocar, true);
    };
  }, []);

  // A entrada e a rolagem de cada página.
  useEffect(() => {
    if (naoRastrear()) return;
    const pagina = caminho(pathname || '/');
    fila.current.push({ tipo: 'entrada', pagina });
    const vistas = new Set<number>();
    const aoRolar = () => {
      const altura = document.documentElement.scrollHeight;
      if (altura <= 0) return;
      const pct = ((window.scrollY + window.innerHeight) / altura) * 100;
      for (const m of MARCAS_ROLAGEM)
        if (pct >= m - 1 && !vistas.has(m)) {
          vistas.add(m);
          fila.current.push({ tipo: 'rolagem', pagina, valor: m });
        }
    };
    let pendente = false;
    const aoRolarComCalma = () => {
      if (pendente) return;
      pendente = true;
      requestAnimationFrame(() => {
        pendente = false;
        aoRolar();
      });
    };
    // Página curta já mostra tudo sem rolar.
    const inicio = setTimeout(aoRolar, 1000);
    window.addEventListener('scroll', aoRolarComCalma, { passive: true });
    return () => {
      clearTimeout(inicio);
      window.removeEventListener('scroll', aoRolarComCalma);
    };
  }, [pathname]);

  return null;
}
