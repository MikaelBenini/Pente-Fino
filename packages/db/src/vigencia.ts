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

/**
 * Preço que vale para o profissional na data: o dele (preço por barbeiro, mudado no perfil) ou,
 * sem preço próprio, o da tabela da unidade.
 */
export async function precoDoProfissional(
  tx: Tx,
  servicoId: string,
  profissionalId: string,
  unidadeId: string,
  data: DataISO,
): Promise<number | undefined> {
  const [linha] = await tx.$queryRaw<{ valor: number | null }[]>`
    SELECT preco_do_profissional(${servicoId}::uuid, ${profissionalId}::uuid, ${unidadeId}::uuid, ${dataParaBanco(data)}::date) AS valor`;
  return linha?.valor ?? undefined;
}

/** Preço próprio do profissional na data (sem cair para o da unidade); null = usa o da unidade. */
export async function precoProprioVigente(
  tx: Tx,
  servicoId: string,
  profissionalId: string,
  data: DataISO,
): Promise<number | null> {
  const [p] = await tx.precoProfissional.findMany({
    where: { servicoId, profissionalId, vigenciaInicio: { lte: dataParaBanco(data) } },
    orderBy: { vigenciaInicio: 'desc' },
    take: 1,
  });
  return p?.valor ?? null;
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
