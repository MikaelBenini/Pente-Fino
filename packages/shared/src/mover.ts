// Mover agendamento arrastando (Etapa 14, pedido de 2026-11-05): regras puras do movimento na
// agenda, da confirmação e do aviso ao cliente. A API grava; o worker manda o aviso.
import { formatarHora } from './formatacao.js';

/** Tempo do botão "Desfazer" depois de mover; o aviso ao cliente só sai depois dele. */
export const DESFAZER_MOVER_S = 10;
/** O arrasto anda de 15 em 15 minutos. */
export const PASSO_MOVER_MIN = 15;

/** Deslocamento do arrasto (em minutos) arredondado para o passo da agenda. */
export function minutosDoArrasto(deltaPx: number, pxPorMin: number, passo = PASSO_MOVER_MIN) {
  const min = Math.round(deltaPx / pxPorMin / passo) * passo;
  return min === 0 ? 0 : min; // sem -0
}

/**
 * Mudou o horário: o cliente é avisado (se aceita mensagens), a não ser que peçam para não
 * avisar (o "Desfazer" não avisa). Mudou só o barbeiro: avisa só se quem moveu escolheu avisar.
 */
export function deveAvisarClienteDoMovimento(d: {
  mudouHorario: boolean;
  mudouBarbeiro: boolean;
  avisarCliente?: boolean | undefined;
}): boolean {
  if (d.mudouHorario) return d.avisarCliente !== false;
  return d.mudouBarbeiro && d.avisarCliente === true;
}

const primeiro = (n: string) => n.trim().split(/\s+/)[0] ?? n;

/** "Mover o Corte do João das 14:00 com Rafael para 14:30 com Thiago?" */
export function textoConfirmarMovimento(d: {
  servico: string;
  cliente: string | null;
  de: { inicio: string; profissional: string };
  para: { inicio: string; profissional: string; diaRotulo?: string | null };
}): string {
  const doCliente = d.cliente ? ` do ${primeiro(d.cliente)}` : '';
  const mesmoBarbeiro = d.de.profissional === d.para.profissional;
  const dia = d.para.diaRotulo ? `${d.para.diaRotulo}, ` : '';
  const destino = mesmoBarbeiro
    ? `${dia}${formatarHora(d.para.inicio)}`
    : `${dia}${formatarHora(d.para.inicio)} com ${primeiro(d.para.profissional)}`;
  return `Mover ${d.servico}${doCliente} das ${formatarHora(d.de.inicio)} com ${primeiro(d.de.profissional)} para ${destino}?`;
}

/** Mensagem ao cliente depois que a barbearia moveu o horário. */
export function textoHorarioMudou(d: {
  cliente: string | null;
  diaRotulo: string;
  inicio: string;
  profissional: string;
  mudouHorario: boolean;
  link: string | null;
}): string {
  const ola = d.cliente ? `Oi, ${primeiro(d.cliente)}!` : 'Oi!';
  const quando = `${d.diaRotulo}, às ${formatarHora(d.inicio)}`;
  return [
    d.mudouHorario
      ? `${ola} Seu horário mudou: agora é ${quando}, com ${primeiro(d.profissional)}.`
      : `${ola} Seu horário de ${quando} continua, agora com ${primeiro(d.profissional)}.`,
    d.link
      ? `Se não der para você, remarque ou cancele por aqui: ${d.link}`
      : 'Se não der para você, é só responder esta mensagem.',
  ].join('\n');
}
