'use client';

import { useSyncExternalStore } from 'react';

const CONSULTA = '(prefers-reduced-motion: reduce)';
const assinar = (avisar: () => void) => {
  const m = window.matchMedia(CONSULTA);
  m.addEventListener('change', avisar);
  return () => m.removeEventListener('change', avisar);
};

/**
 * Vídeo de 1 minuto do sistema (gravado da conta de demonstração por apps/web/video). Toca sozinho,
 * sem som e em loop; quem pediu menos movimento no aparelho vê a capa e dá o play.
 */
export function VideoApresentacao() {
  const reduzir = useSyncExternalStore(
    assinar,
    () => window.matchMedia(CONSULTA).matches,
    () => true,
  );
  return (
    <video
      // Troca de elemento ao mudar a preferência, para o autoplay valer.
      key={reduzir ? 'parado' : 'tocando'}
      id="apresentacao"
      className="aspect-video w-full rounded-xl border border-borda bg-fundo shadow-2xl"
      poster="/video/apresentacao.jpg"
      width={1280}
      height={720}
      muted
      loop
      playsInline
      controls
      preload={reduzir ? 'none' : 'metadata'}
      autoPlay={!reduzir}
      aria-label="Vídeo de 1 minuto: agenda, comanda no celular do barbeiro, fechamento na recepção, lucro do mês e agendamento pelo WhatsApp"
    >
      <source src="/video/apresentacao.webm" type={`video/webm; codecs="vp9"`} />
      <source src="/video/apresentacao.mp4" type="video/mp4" />
    </video>
  );
}
