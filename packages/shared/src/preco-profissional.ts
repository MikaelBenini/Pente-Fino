// Preço por barbeiro (detalhe do dono em 12/11/2026): os serviços e a tabela continuam da unidade;
// o barbeiro muda o próprio preço de um serviço no perfil dele. Vale quando marcam com ele (agenda,
// bot, site) e na comanda dele. Sem preço próprio, vale o da unidade.
import { z } from 'zod';

/** Uma linha de "Meus preços": o serviço na unidade em que a pessoa atende. */
export interface MeuPreco {
  profissionalId: string;
  unidadeId: string;
  unidade: string;
  servicoId: string;
  servico: string;
  /** Preço da tabela da unidade hoje (null = a unidade não tem preço). */
  precoUnidade: number | null;
  /** Preço próprio hoje (null = usa o da unidade). */
  meuPreco: number | null;
}

/** O que o barbeiro salvou: valor próprio, ou null para voltar ao preço da unidade (vale hoje). */
export const meusPrecosSchema = z.object({
  precos: z
    .array(
      z.object({
        profissionalId: z.uuid({ error: 'Profissional inválido.' }),
        servicoId: z.uuid({ error: 'Serviço inválido.' }),
        valor: z.number().int().min(0).max(100_000_000).nullable(),
      }),
    )
    .min(1, { error: 'Nenhum preço mudou.' })
    .max(500),
});
export type MeusPrecosEntrada = z.infer<typeof meusPrecosSchema>;

/** O preço que vale: o próprio, se houver, ou o da unidade. */
export function precoQueVale(m: Pick<MeuPreco, 'meuPreco' | 'precoUnidade'>): number | null {
  return m.meuPreco ?? m.precoUnidade;
}
