'use client';

// "Ver em 1 minuto" (briefing do site, C6): rola até o vídeo e já dá o play (sem som, que é o que
// o navegador deixa tocar sozinho). Sem JavaScript, continua sendo o link para #video.
import type { ReactNode } from 'react';
import { eventoGoogle } from './tag-google';
import { LinkBotao } from './link-botao';

export function BotaoVideo({ children }: { children: ReactNode }) {
  return (
    <LinkBotao
      href="#video"
      variante="contorno"
      grande
      onClick={(e) => {
        const video = document.querySelector<HTMLVideoElement>('#apresentacao');
        if (!video) return;
        e.preventDefault();
        const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        document.getElementById('video')?.scrollIntoView({ behavior: reduzir ? 'auto' : 'smooth' });
        video.muted = true;
        void video.play().catch(() => undefined);
        eventoGoogle('play_video', { origem: 'hero' });
      }}
    >
      {children}
    </LinkBotao>
  );
}
