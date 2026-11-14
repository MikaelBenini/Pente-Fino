// Quem faz cada serviço (P5, lote 7g): o dono marca os serviços de cada barbeiro. Vale no link, no
// bot, no balcão e no site. Lista vazia = faz todos (o padrão: nada muda para quem não configurar).
import { z } from 'zod';

export const servicosDoProfissionalSchema = z.object({
  servicoIds: z.array(z.uuid()).max(300),
});
export type ServicosDoProfissional = z.infer<typeof servicosDoProfissionalSchema>;

/** O barbeiro faz todos os serviços escolhidos? */
export function fazOsServicos(
  servicosDoBarbeiro: readonly string[],
  escolhidos: readonly string[],
): boolean {
  return servicosDoBarbeiro.length === 0 || escolhidos.every((s) => servicosDoBarbeiro.includes(s));
}

/** Quem faz o serviço, entre os barbeiros (na ordem deles). */
export function quemFaz<P extends { servicoIds: readonly string[] }>(
  profissionais: readonly P[],
  servicoId: string,
): P[] {
  return profissionais.filter((p) => fazOsServicos(p.servicoIds, [servicoId]));
}
