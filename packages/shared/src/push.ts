// Notificações no celular (push do PWA, Etapa 11): cada aparelho liga no Perfil.
import { z } from 'zod';

export const inscricaoPushSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({
    p256dh: z.string().min(10).max(200),
    auth: z.string().min(10).max(100),
  }),
});
export type InscricaoPushEntrada = z.infer<typeof inscricaoPushSchema>;

export const removerPushSchema = z.object({ endpoint: z.url().max(1000) });

export interface EstadoPush {
  /** Chave pública VAPID; null quando o servidor está sem push configurado. */
  chavePublica: string | null;
  /** Aparelhos ligados desta pessoa. */
  aparelhos: number;
}

/** Título e texto da notificação de mudança na agenda. */
export function textoPushDoHorario(
  tipo: 'novo' | 'remarcado' | 'cancelado',
  h: { quando: string; cliente: string; servicos: readonly string[] },
): { titulo: string; corpo: string } {
  const titulo =
    tipo === 'novo'
      ? 'Horário novo'
      : tipo === 'remarcado'
        ? 'Horário remarcado'
        : 'Horário cancelado';
  return { titulo, corpo: `${h.quando} · ${h.cliente} · ${h.servicos.join(' + ')}` };
}
