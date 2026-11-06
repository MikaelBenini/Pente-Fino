// Link do cliente para o próprio horário (Etapa 11): ver, remarcar ou cancelar sem login,
// em /horario?t=token. Regras puras; a API confere o token e grava pela agenda única.
import { z } from 'zod';

/** Caminho da página do link (o token vai inteiro na URL, sem dado pessoal). */
export const caminhoDoHorario = (token: string) => `/horario?t=${token}`;

export type SituacaoDoLink = 'marcado' | 'confirmado' | 'cancelado' | 'passou' | 'atendido';

export interface DecisaoDoLink {
  situacao: SituacaoDoLink;
  /** Pode remarcar ou cancelar por aqui agora. */
  podeMudar: boolean;
  /** Por que não pode (para mostrar ao cliente); null quando pode. */
  motivo: string | null;
}

/**
 * O que o cliente vê e pode fazer: só horário marcado ou confirmado, ainda não começado, e
 * com o prazo da unidade antes do início (o mesmo do "Meus horários" do bot).
 */
export function decidirLink(d: {
  status: 'agendado' | 'confirmado' | 'atendido' | 'cancelado' | 'falta';
  comandaPrevista: boolean;
  inicio: Date;
  agora: Date;
  prazoMudarMin: number;
}): DecisaoDoLink {
  if (d.status === 'cancelado')
    return { situacao: 'cancelado', podeMudar: false, motivo: 'Este horário foi cancelado.' };
  if (d.status === 'atendido' || (!d.comandaPrevista && d.status !== 'falta'))
    return { situacao: 'atendido', podeMudar: false, motivo: 'Este atendimento já aconteceu.' };
  if (d.status === 'falta' || d.inicio <= d.agora)
    return { situacao: 'passou', podeMudar: false, motivo: 'Este horário já passou.' };
  const situacao = d.status === 'confirmado' ? 'confirmado' : 'marcado';
  if (d.inicio.getTime() - d.agora.getTime() < d.prazoMudarMin * 60_000) {
    const horas = d.prazoMudarMin / 60;
    const prazo = Number.isInteger(horas)
      ? `${horas} ${horas === 1 ? 'hora' : 'horas'}`
      : `${d.prazoMudarMin} minutos`;
    return {
      situacao,
      podeMudar: false,
      motivo: `Pelo link dá para mudar até ${prazo} antes. Agora, fale com a barbearia.`,
    };
  }
  return { situacao, podeMudar: true, motivo: null };
}

export interface HorarioDoLink {
  barbearia: string;
  unidade: string;
  endereco: string | null;
  /** wa.me da unidade (sem texto), quando tem telefone. */
  linkWhatsapp: string | null;
  inicio: string;
  fim: string;
  servicos: string[];
  total: number;
  /** Primeiro nome de quem atende; remarcar mantém o mesmo profissional. */
  profissional: string;
  situacao: SituacaoDoLink;
  podeMudar: boolean;
  motivo: string | null;
  /** Até quantos dias à frente dá para remarcar. */
  janelaDias: number;
}

export const remarcarPeloLinkSchema = z.object({
  inicio: z.iso.datetime({ offset: true, error: 'Horário inválido.' }),
});
export type RemarcarPeloLinkEntrada = z.infer<typeof remarcarPeloLinkSchema>;

export const consultaHorariosDoLink = z.object({
  data: z.iso.date({ error: 'Data inválida.' }),
});
