// Consultas de preço e regra de comissão vigentes numa data.
// Usam as funções SQL da migração "restricoes", que respeitam o RLS de quem chama.
import { dataParaBanco, type DataISO } from '@pente-fino/shared';
import type { Prisma } from './generated/prisma/client.js';
import type { RegraComissao, TipoItemComissao } from './generated/prisma/client.js';

type Tx = Prisma.TransactionClient;

/** Preço (centavos) do serviço na unidade e data; undefined se não havia preço vigente. */
export async function precoServicoVigente(
  tx: Tx,
  servicoId: string,
  unidadeId: string,
  data: DataISO,
): Promise<number | undefined> {
  const [linha] = await tx.$queryRaw<{ valor: number | null }[]>`
    SELECT preco_servico_vigente(${servicoId}::uuid, ${unidadeId}::uuid, ${dataParaBanco(data)}::date) AS valor`;
  return linha?.valor ?? undefined;
}

/** Regra de comissão vigente do profissional para o tipo de item na data. */
export async function regraComissaoVigente(
  tx: Tx,
  profissionalId: string,
  tipoItem: TipoItemComissao,
  data: DataISO,
): Promise<RegraComissao | undefined> {
  const [regra] = await tx.regraComissao.findMany({
    where: { profissionalId, tipoItem, vigenciaInicio: { lte: dataParaBanco(data) } },
    orderBy: { vigenciaInicio: 'desc' },
    take: 1,
  });
  return regra;
}
