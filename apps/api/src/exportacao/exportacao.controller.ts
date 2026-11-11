import { Controller, Get, Inject, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  calcularIndicadores,
  formatarMoeda,
  formatarValor,
  NOME_FORMA,
  NOME_GRUPO_DESPESA,
} from '@pente-fino/shared';
import type { Response } from 'express';
import { z } from 'zod';
import { Papeis } from '../auth/decoradores.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { data, dataTexto, GESTAO } from '../comum/escopo.js';
import { Consulta } from '../comum/validacao.js';
import { A4, LINHA, novoDocumento, SUAVE, texto } from '../pdf/pdf.js';
import {
  escopoUnidades,
  ResultadosService,
  somarDias,
  ultimoDiaDoMes,
} from '../resultados/resultados.service.js';
import { emSequencia } from '../comum/sequencia.js';

const consulta = z.object({
  mes: z.string().regex(/^\d{4}-\d{2}$/, { error: 'Mês inválido (use AAAA-MM).' }),
  formato: z.enum(['csv', 'pdf']).default('csv'),
  unidadeId: z.uuid().optional(),
});

/** Campo CSV seguro: aspas quando precisa e sem fórmula (=, +, -, @ no início viram texto). */
function campo(v: string): string {
  const t = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

@ApiTags('Exportação')
@ApiBearerAuth()
@Controller('exportacao')
export class ExportacaoController {
  constructor(
    @Inject(BancoService) private readonly banco: BancoService,
    @Inject(ResultadosService) private readonly resultados: ResultadosService,
  ) {}

  @Get()
  @Papeis(...GESTAO)
  @ApiOperation({ summary: 'Relatório do mês para o contador (CSV ou PDF)' })
  async exportar(
    @Consulta(consulta) c: z.infer<typeof consulta>,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { filtro, incluiConta } = escopoUnidades(c.unidadeId, GESTAO);
    const de = `${c.mes}-01`;
    const ate = ultimoDiaDoMes(c.mes);
    const dados = await this.banco.daConta(async (tx) => {
      const [conta, unidades, comandas, despesas] = await emSequencia([
        tx.conta.findUniqueOrThrow({ where: { id: Contexto.usuario().contaId } }),
        tx.unidade.findMany(),
        tx.comanda.findMany({
          where: {
            ...filtro,
            status: 'fechada',
            fechadaEm: {
              gte: new Date(`${de}T00:00:00-03:00`),
              lt: new Date(`${somarDias(ate, 1)}T00:00:00-03:00`),
            },
          },
          include: { itens: true, pagamentos: true, cliente: true },
          orderBy: { fechadaEm: 'asc' },
        }),
        tx.despesa.findMany({
          where: { competencia: data(de), ...(incluiConta && !c.unidadeId ? {} : filtro) },
          include: { categoria: true },
          orderBy: { descricao: 'asc' },
        }),
      ]);
      // Mensalidades do clube: receita do mês pelo dia do pagamento (decisão do dono, 11/11/2026).
      const mensalidades = await this.resultados.pagamentosClube(tx, de, ate, filtro);
      return { conta, unidades, comandas, despesas, mensalidades };
    });
    const nomeUnidade = (id: string | null) =>
      id ? (dados.unidades.find((u) => u.id === id)?.nome ?? '') : 'Rede';
    const arquivo = `pente-fino-${c.mes}`;

    if (c.formato === 'csv') {
      const linhas = [
        ['data', 'tipo', 'descricao', 'unidade', 'forma_ou_grupo', 'valor'].join(';'),
      ];
      for (const cm of dados.comandas) {
        for (const p of cm.pagamentos) {
          linhas.push(
            [
              dataTexto(new Date(cm.fechadaEm!.getTime() - 3 * 3_600_000)),
              'receita',
              `Comanda ${cm.cliente?.nome ?? ''}`.trim(),
              nomeUnidade(cm.unidadeId),
              NOME_FORMA[p.forma],
              formatarValor(p.valor),
            ]
              .map(campo)
              .join(';'),
          );
        }
      }
      for (const m of dados.mensalidades) {
        linhas.push(
          [
            m.data,
            'receita',
            'Mensalidade do clube',
            nomeUnidade(m.unidadeId),
            'Clube',
            formatarValor(m.valor),
          ]
            .map(campo)
            .join(';'),
        );
      }
      for (const d of dados.despesas) {
        linhas.push(
          [
            dataTexto(d.competencia),
            'despesa',
            `${d.categoria.nome} - ${d.descricao}`,
            nomeUnidade(d.unidadeId),
            NOME_GRUPO_DESPESA[d.categoria.grupo],
            `-${formatarValor(d.valor)}`,
          ]
            .map(campo)
            .join(';'),
        );
      }
      res.set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${arquivo}.csv"`,
      });
      // BOM: o Excel em português abre com acentos certos.
      return new StreamableFile(Buffer.from(`\uFEFF${linhas.join('\r\n')}\r\n`, 'utf-8'));
    }

    const ind = calcularIndicadores(
      dados.comandas,
      dados.despesas.map((d) => ({ grupo: d.categoria.grupo, valor: d.valor })),
      { mensalidades: dados.mensalidades.reduce((s, m) => s + m.valor, 0) },
    );
    const porForma = new Map<string, number>();
    for (const p of dados.comandas.flatMap((x) => x.pagamentos))
      porForma.set(p.forma, (porForma.get(p.forma) ?? 0) + p.valor);
    const { doc, fonte, negrito } = await novoDocumento(`Relatório ${c.mes}`);
    const pagina = doc.addPage([A4.largura, A4.altura]);
    const x = 56;
    const direita = A4.largura - 56;
    let y = A4.altura - 64;
    const [ano, m] = c.mes.split('-');
    texto(pagina, dados.conta.nome, x, y, negrito, 18);
    y -= 22;
    texto(
      pagina,
      `Relatório do mês ${m}/${ano} · ${c.unidadeId ? nomeUnidade(c.unidadeId) : 'todas as unidades'}`,
      x,
      y,
      fonte,
      11,
      { cor: SUAVE },
    );
    y -= 34;
    const linha = (rotulo: string, valor: string, forte = false) => {
      texto(pagina, rotulo, x, y, forte ? negrito : fonte, 11);
      texto(pagina, valor, direita, y, forte ? negrito : fonte, 11, { direita: true });
      y -= 18;
    };
    const secao = (t: string) => {
      y -= 8;
      texto(pagina, t.toUpperCase(), x, y, negrito, 9, { cor: SUAVE });
      y -= 6;
      pagina.drawLine({ start: { x, y }, end: { x: direita, y }, thickness: 0.5, color: LINHA });
      y -= 16;
    };
    secao('Receitas');
    linha('Serviços', formatarMoeda(ind.receitaServicos));
    linha('Produtos', formatarMoeda(ind.receitaProdutos));
    linha('Clube (mensalidades)', formatarMoeda(ind.receitaClube));
    linha('Faturamento', formatarMoeda(ind.faturamento), true);
    linha('Receita não operacional', formatarMoeda(ind.receitaNaoOperacional));
    linha(`Comandas fechadas / clientes`, `${dados.comandas.length} / ${ind.clientes}`);
    secao('Recebido por forma de pagamento');
    for (const [forma, valor] of porForma)
      linha(NOME_FORMA[forma as keyof typeof NOME_FORMA], formatarMoeda(valor));
    secao('Despesas');
    linha('Comissões', formatarMoeda(ind.comissoes));
    for (const g of ['fixa', 'variavel', 'manutencao'] as const)
      linha(NOME_GRUPO_DESPESA[g], formatarMoeda(ind.despesasPorGrupo[g]));
    linha('Despesas operacionais', formatarMoeda(ind.despesasOperacionais), true);
    linha('Lucro do mês', formatarMoeda(ind.lucro), true);
    secao('Fora do resultado operacional');
    for (const g of ['investimento', 'retirada_dono', 'cartao_resgate'] as const)
      linha(NOME_GRUPO_DESPESA[g], formatarMoeda(ind.despesasPorGrupo[g]));
    texto(
      pagina,
      `Gerado pelo Pente Fino em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Detalhe linha a linha no CSV do mesmo mês.`,
      x,
      48,
      fonte,
      8,
      { cor: SUAVE },
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${arquivo}.pdf"`,
    });
    return new StreamableFile(Buffer.from(await doc.save()));
  }
}
