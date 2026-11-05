'use client';

import { useCallback, useEffect, useState } from 'react';

/** Avisos deste aparelho: cada pessoa liga e desliga no próprio celular ou computador. */
export interface PreferenciasAvisos {
  /** Toca um som quando um cliente passa a esperar atendente. */
  som: boolean;
  /** Notificação do navegador (aparece mesmo com outra aba ou janela na frente). */
  notificacao: boolean;
}

const CHAVE = 'pf_avisos';
const EVENTO = 'pf-avisos';
const PADRAO: PreferenciasAvisos = { som: true, notificacao: false };

export function lerPreferencias(): PreferenciasAvisos {
  try {
    return { ...PADRAO, ...(JSON.parse(localStorage.getItem(CHAVE) ?? '{}') as object) };
  } catch {
    return PADRAO;
  }
}

function gravar(p: PreferenciasAvisos) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(p));
  } catch {
    // Navegação privada ou armazenamento bloqueado: vale só enquanto a página estiver aberta.
  }
  window.dispatchEvent(new Event(EVENTO));
}

/** Preferências com atualização entre os componentes (e entre abas). */
export function usePreferenciasAvisos(): [PreferenciasAvisos, (p: PreferenciasAvisos) => void] {
  const [p, setP] = useState<PreferenciasAvisos>(PADRAO);
  useEffect(() => {
    const ler = () => setP(lerPreferencias());
    ler();
    window.addEventListener(EVENTO, ler);
    window.addEventListener('storage', ler);
    return () => {
      window.removeEventListener(EVENTO, ler);
      window.removeEventListener('storage', ler);
    };
  }, []);
  const mudar = useCallback((novo: PreferenciasAvisos) => {
    setP(novo);
    gravar(novo);
  }, []);
  return [p, mudar];
}

export const notificacoesSuportadas = () =>
  typeof window !== 'undefined' && 'Notification' in window;

/** Pede a permissão do navegador (precisa vir de um toque do usuário). */
export async function pedirPermissaoNotificacao(): Promise<NotificationPermission> {
  if (!notificacoesSuportadas()) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

let audio: AudioContext | null = null;

/** Dois toques curtos (sem arquivo de som). O navegador só toca depois de algum clique na página. */
export function tocarAviso(): void {
  try {
    audio ??= new AudioContext();
    const agora = audio.currentTime;
    for (const [i, freq] of [880, 1320].entries()) {
      const osc = audio.createOscillator();
      const ganho = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const inicio = agora + i * 0.18;
      ganho.gain.setValueAtTime(0.0001, inicio);
      ganho.gain.exponentialRampToValueAtTime(0.25, inicio + 0.02);
      ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.16);
      osc.connect(ganho).connect(audio.destination);
      osc.start(inicio);
      osc.stop(inicio + 0.17);
    }
  } catch {
    // Sem áudio no aparelho: o aviso na tela continua.
  }
}

/** Notificação do navegador; tocar nela traz a janela e abre a tela indicada. */
export function notificar(titulo: string, corpo: string, rota: string): void {
  if (!notificacoesSuportadas() || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(titulo, { body: corpo, tag: rota, icon: '/icones/icone-192.png' });
    n.onclick = () => {
      window.focus();
      window.location.assign(rota);
      n.close();
    };
  } catch {
    // Alguns celulares só notificam pelo service worker (push, Etapa 15).
  }
}
