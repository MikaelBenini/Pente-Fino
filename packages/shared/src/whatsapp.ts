// Regras do WhatsApp que não dependem do provedor: telefone vindo do WhatsApp e ritmo de envio.

/**
 * "5511988887777@s.whatsapp.net" → "5511988887777". Grupo, lista de transmissão, status e
 * qualquer coisa que não seja um número viram null: o bot só conversa com pessoas.
 */
export function telefoneDoJid(jid: string | null | undefined): string | null {
  if (!jid) return null;
  const [usuario, servidor] = jid.split('@');
  if (servidor !== 's.whatsapp.net' && servidor !== 'c.us') return null;
  const numero = (usuario ?? '').split(':')[0] ?? '';
  return /^\d{10,15}$/.test(numero) ? numero : null;
}

/**
 * O WhatsApp às vezes entrega celular brasileiro sem o nono dígito ("551188887777").
 * Devolve as duas formas para achar o cliente cadastrado de qualquer jeito; a primeira é a
 * forma com o nono dígito, que é como o cadastro guarda.
 */
export function variantesTelefone(telefone: string): string[] {
  const d = telefone.replace(/\D/g, '');
  const com9 = /^55(\d{2})9([6-9]\d{7})$/.exec(d);
  if (com9) return [d, `55${com9[1]}${com9[2]}`];
  const sem9 = /^55(\d{2})([6-9]\d{7})$/.exec(d);
  if (sem9) return [`55${sem9[1]}9${sem9[2]}`, d];
  return [d];
}

/** Envio para o mesmo número da barbearia: nunca mais que isto por minuto. */
export const LIMITE_ENVIOS_POR_MINUTO = 30;
/** Intervalo mínimo entre duas mensagens do mesmo número (segue do limite por minuto). */
export const INTERVALO_MINIMO_ENVIO_MS = 60_000 / LIMITE_ENVIOS_POR_MINUTO;
/** Parte aleatória somada ao intervalo, para o envio não ter cara de robô. */
export const VARIACAO_ENVIO_MS = 1_500;

/**
 * Quando a próxima mensagem do número pode sair: depois da última agendada, com o intervalo
 * mínimo e uma variação aleatória (`aleatorio` entre 0 e 1). Devolve o horário em ms.
 */
export function proximoEnvio(
  ultimoAgendadoMs: number | null,
  agoraMs: number,
  aleatorio: number,
): number {
  const variacao = Math.round(Math.min(Math.max(aleatorio, 0), 1) * VARIACAO_ENVIO_MS);
  const base =
    ultimoAgendadoMs === null
      ? agoraMs
      : Math.max(agoraMs, ultimoAgendadoMs + INTERVALO_MINIMO_ENVIO_MS);
  // A primeira mensagem de uma conversa parada também espera um pouco (tempo de "digitar").
  return base + variacao;
}
