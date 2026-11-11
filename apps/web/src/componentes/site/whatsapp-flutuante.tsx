'use client';

// Botão de WhatsApp no canto (briefing do site, C2). Sem número cadastrado em lib/contato.ts, não
// aparece. Fica acima do aviso de cookies e não cobre o botão principal no celular.
import { MessageCircle } from 'lucide-react';
import { linkWhatsappComercial } from '@/lib/contato';
import { eventoGoogle } from './tag-google';

export function WhatsappFlutuante() {
  const link = linkWhatsappComercial();
  if (!link) return null;
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => eventoGoogle('click_whatsapp', { origem: 'flutuante' })}
      aria-label="Falar com o Pente Fino no WhatsApp"
      className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 grid size-14 place-items-center rounded-full bg-acao text-sobre-acao shadow-2xl hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
    >
      <MessageCircle aria-hidden className="size-7" />
    </a>
  );
}
