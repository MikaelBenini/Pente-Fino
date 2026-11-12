// Catálogo por unidade (pedido do dono em 12/11/2026): cada serviço e produto diz em quais
// unidades está ("Disponível em"). Aqui ficam a conferência das unidades pedidas e a trava que
// impede lançar, na comanda ou na agenda, o que não está na unidade.
import type { Transacao } from '@pente-fino/db';
import { Erros } from './erros.js';

/**
 * Unidades do cadastro: as pedidas (conferidas, da conta) ou, sem lista, todas as que existem
 * agora. Unidade criada depois não entra sozinha: começa vazia.
 */
export async function unidadesDoCatalogo(tx: Transacao, pedidas?: string[]): Promise<string[]> {
  if (!pedidas) {
    const todas = await tx.unidade.findMany({ select: { id: true }, orderBy: { criadoEm: 'asc' } });
    return todas.map((u) => u.id);
  }
  const unicas = [...new Set(pedidas)];
  const achadas = await tx.unidade.count({ where: { id: { in: unicas } } });
  if (achadas !== unicas.length)
    throw Erros.validacao([{ campo: 'unidadeIds', mensagem: 'Unidade não encontrada.' }]);
  return unicas;
}

/** Recusa (400) o serviço ou produto que não está na unidade da comanda ou do horário. */
export function exigirNaUnidade(
  item: { nome: string; unidadeIds: string[] },
  unidadeId: string,
): void {
  if (!item.unidadeIds.includes(unidadeId))
    throw Erros.requisicaoInvalida(
      'fora_da_unidade',
      `"${item.nome}" não está disponível nesta unidade. Inclua a unidade no cadastro.`,
    );
}
