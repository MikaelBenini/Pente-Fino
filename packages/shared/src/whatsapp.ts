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

/**
 * Telefone do cliente como o banco guarda: só dígitos, com o 55 e, no celular, com o nono dígito
 * (o mesmo do gatilho cliente_telefone_canonico). "44 9976-4653" e "44 99976-4653" viram um só
 * cadastro (pedido do dono em 20/11/2026: com ou sem o 9, nasciam dois clientes).
 */
export function telefoneCanonico(telefone: string): string {
  const d = telefone.replace(/\D/g, '');
  const completo = d.length === 10 || d.length === 11 ? `55${d}` : d;
  return variantesTelefone(completo)[0]!;
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

/**
 * O WhatsApp da unidade para os botões do cliente (testes de 19/11/2026: o agendamento abria o
 * número do bot e a confirmação e a gestão da reserva, o telefone do cadastro). Regra única: o
 * número conectado ao bot da unidade; sem ele, o telefone da unidade. Só dígitos com o 55.
 */
export function numeroWhatsappDaUnidade(d: {
  conexao?: { status: string; numero: string | null } | null;
  telefone: string | null;
}): string | null {
  const doBot = d.conexao?.status === 'conectado' ? (d.conexao.numero ?? '') : '';
  const bruto = doBot.replace(/\D/g, '') || (d.telefone ?? '').replace(/\D/g, '');
  const completo = bruto.length === 10 || bruto.length === 11 ? `55${bruto}` : bruto;
  return /^\d{12,13}$/.test(completo) ? completo : null;
}

/** wa.me do número, com a mensagem pronta quando houver. */
export function linkWaMe(numero: string | null, mensagem?: string): string | null {
  if (!numero) return null;
  return `https://wa.me/${numero}${mensagem ? `?text=${encodeURIComponent(mensagem)}` : ''}`;
}
