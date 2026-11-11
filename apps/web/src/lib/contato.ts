// Contato e dados da empresa no site (briefing do site, C2 e C3). Tudo vazio até o dono passar os
// dados reais: campo vazio não aparece (nada de número, CNPJ ou rede social inventados).
// TODO(dono): preencher WhatsApp comercial, razão social, CNPJ, cidade/UF e redes sociais.

/** WhatsApp comercial, só dígitos com 55 (ex.: '5511999998888'). Vazio = sem botão. */
export const WHATSAPP_COMERCIAL = '';

/** Mensagem que já vem escrita quando o visitante toca no botão. */
export const MENSAGEM_WHATSAPP = 'Oi! Vim pelo site e quero saber mais sobre o Pente Fino.';

export const EMPRESA = {
  razaoSocial: '',
  /** Só dígitos ou já formatado (00.000.000/0000-00). */
  cnpj: '',
  /** Ex.: 'São Paulo/SP'. */
  cidade: '',
  instagram: '',
  youtube: '',
} as const;

/** Link do WhatsApp com a mensagem pronta; null sem número. */
export function linkWhatsappComercial(mensagem: string = MENSAGEM_WHATSAPP): string | null {
  const numero = WHATSAPP_COMERCIAL.replace(/\D/g, '');
  return numero.length >= 12
    ? `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`
    : null;
}

// ─── Suporte para quem já usa o painel (painel M10) ───────────────────────
// TODO(dono): WhatsApp do suporte e o horário de atendimento (o briefing pede que cubra o sábado).
// Vazios, a Ajuda mostra só o e-mail; nada de número ou horário inventado.

export const SUPORTE = {
  /** Só dígitos com 55 (ex.: '5511999998888'). */
  whatsapp: '',
  /** Ex.: 'Segunda a sábado, das 9h às 18h (horário de Brasília)'. */
  horario: '',
} as const;

/** Link do WhatsApp do suporte com a mensagem pronta; null sem número. */
export function linkWhatsappSuporte(
  mensagem = 'Oi! Preciso de ajuda com o Pente Fino.',
): string | null {
  const numero = SUPORTE.whatsapp.replace(/\D/g, '');
  return numero.length >= 12
    ? `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`
    : null;
}
