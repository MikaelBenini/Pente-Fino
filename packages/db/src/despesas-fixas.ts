// Despesas fixas no mês seguinte (pedido do dono em 11/11/2026). A rotina diária do worker lança no
// mês atual as despesas marcadas "Repetir todo mês" no mês anterior. A origem é única no banco:
// rodar de novo (ou alguém já ter copiado à mão) não duplica.
import { mesAnteriorDe, vencimentoNoMesSeguinte } from '@pente-fino/shared';
import type { PrismaClient } from './generated/prisma/client.js';
import { naConta } from './index.js';

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const texto = (d: Date) => d.toISOString().slice(0, 10);

/** Lança as cópias que faltam no mês de `hoje` (AAAA-MM-DD). Devolve quantas lançou. */
export async function repetirDespesasDoMes(
  prisma: PrismaClient,
  contaId: string,
  hoje: string,
): Promise<number> {
  const mes = hoje.slice(0, 7);
  const anterior = mesAnteriorDe(mes);
  return naConta(prisma, contaId, async (tx) => {
    const origens = await tx.despesa.findMany({
      where: { competencia: dia(`${anterior}-01`), repetir: true, copia: null },
      orderBy: { criadoEm: 'asc' },
    });
    let lancadas = 0;
    for (const o of origens) {
      const r = await tx.despesa.createMany({
        data: [
          {
            unidadeId: o.unidadeId,
            categoriaId: o.categoriaId,
            descricao: o.descricao,
            valor: o.valor,
            competencia: dia(`${mes}-01`),
            vencimento: o.vencimento ? dia(vencimentoNoMesSeguinte(texto(o.vencimento))!) : null,
            repetir: true,
            origemId: o.id,
          },
        ],
        // Corrida com a cópia manual: a origem única segura, e aqui só pula.
        skipDuplicates: true,
      });
      lancadas += r.count;
    }
    return lancadas;
  });
}
