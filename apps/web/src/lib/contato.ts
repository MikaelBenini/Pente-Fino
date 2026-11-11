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
