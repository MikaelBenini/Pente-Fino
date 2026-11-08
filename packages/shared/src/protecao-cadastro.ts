// Proteção do cadastro pelo site contra robôs (Etapa 15.4): campo isca, tempo mínimo de
// preenchimento, limite por IP e e-mail descartável. A confirmação do e-mail fica na API.

/** Menos que isto entre abrir o formulário e enviar: ninguém preenche tão rápido. */
export const TEMPO_MINIMO_CADASTRO_MS = 2500;
/** Formulário aberto há mais de um dia: o carimbo é velho ou forjado. */
export const TEMPO_MAXIMO_CADASTRO_MS = 24 * 3_600_000;
/** Cadastros pelo mesmo IP. */
export const LIMITE_CADASTRO_POR_HORA = 3;
export const LIMITE_CADASTRO_POR_DIA = 10;
/** Validade do link de confirmação do e-mail. */
export const VALIDADE_CONFIRMAR_EMAIL_H = 48;

/** Domínios de e-mail temporário mais usados por robôs (a lista não precisa ser completa). */
export const DOMINIOS_DESCARTAVEIS: ReadonlySet<string> = new Set([
  '10minutemail.com',
  '10minutemail.net',
  '20minutemail.com',
  'dispostable.com',
  'discard.email',
  'dropmail.me',
  'emailondeck.com',
  'fakeinbox.com',
  'getairmail.com',
  'getnada.com',
  'guerrillamail.biz',
  'guerrillamail.com',
  'guerrillamail.de',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'inboxkitten.com',
  'mail.tm',
  'mailcatch.com',
  'maildrop.cc',
  'mailinator.com',
  'mailinator.net',
  'mailnesia.com',
  'mintemail.com',
  'moakt.com',
  'mohmal.com',
  'mytemp.email',
  'sharklasers.com',
  'spam4.me',
  'spamgourmet.com',
  'temp-mail.io',
  'temp-mail.org',
  'tempail.com',
  'tempmail.com',
  'tempmail.dev',
  'tempmail.net',
  'tempmailo.com',
  'tempr.email',
  'throwawaymail.com',
  'trashmail.com',
  'trashmail.de',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
]);

export function emailDescartavel(email: string): boolean {
  const dominio = email.trim().toLowerCase().split('@')[1] ?? '';
  return DOMINIOS_DESCARTAVEIS.has(dominio);
}

/**
 * Sinais de robô no envio do formulário: o campo isca (invisível para pessoas) veio preenchido,
 * o carimbo de abertura falta ou o envio foi rápido (ou tardio) demais.
 */
export function pareceRobo(
  d: { site?: string | undefined; abertoEm?: number | undefined },
  agora = Date.now(),
  minimoMs = TEMPO_MINIMO_CADASTRO_MS,
): boolean {
  if (d.site && d.site.trim() !== '') return true;
  if (typeof d.abertoEm !== 'number' || !Number.isFinite(d.abertoEm)) return true;
  const passou = agora - d.abertoEm;
  return passou < minimoMs || passou > TEMPO_MAXIMO_CADASTRO_MS;
}
