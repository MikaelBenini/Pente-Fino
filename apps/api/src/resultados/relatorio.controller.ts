// Relatório do mês comparado com o mês anterior (Etapa 23.1): indicadores da barbearia, clientes
// novos e retorno, faltas, canais e nota; custo e lucro de cada barbeiro; mix de serviços e
// produtos; e os últimos 12 meses. As comparações e frases saem de packages/shared/src/relatorio.ts.
import { Controller, Get, Inject, Injectable, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  analisarClientes,
  calcularIndicadores,
  dataLocal,
  lucratividadePorProduto,
  lucratividadePorServico,
  mesAnteriorDe,
  periodoAnterior,
  porCanal,
  relatorioEmArquivo,
  relatorioEmCsv,
  temRecurso,
  type BarbeiroDoMes,
  type ComandaFechada,
  type ItemDoMix,
  type NumerosDoMes,
  type RelatorioDoMes,
  mesesDoHistorico,
} from '@pente-fino/shared';
import type { Response } from 'express';
import { z } from 'zod';
import { Papeis } from '../auth/decoradores.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { Erros } from '../comum/erros.js';
import { Consulta } from '../comum/validacao.js';
import { DesempenhoService } from '../desempenho/desempenho.service.js';
import { relatorioEmPdf } from '../pdf/relatorio-pdf.js';
import {
  escopoUnidades,
  ResultadosService,
  somarDias,
  ultimoDiaDoMes,
} from './resultados.service.js';

const consultaRelatorio = z.object({
  mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: 'Mês no formato AAAA-MM.' }),
  unidadeId: z.uuid().optional(),
});

const consultaArquivo = consultaRelatorio.extend({
  formato: z.enum(['csv', 'pdf'], { error: 'Formato: csv ou pdf.' }),
});

const inicio = (d: string) => new Date(`${d}T00:00:00-03:00`);
const fim = (d: string) => inicio(somarDias(d, 1));
const mesDe = (d: Date) => dataLocal(d).slice(0, 7);

type Fechada = ComandaFechada & {
  id: string;
  unidadeId: string;
  profissionalId: string;
  fechadaEm: Date | null;
};

@Injectable()
export class RelatorioService {
  constructor(
    @Inject(BancoService) private readonly banco: BancoService,
    @Inject(ResultadosService) private readonly resultados: ResultadosService,
    @Inject(DesempenhoService) private readonly desempenho: DesempenhoService,
  ) {}

  async mes(unidadeId: string | undefined, mes: string): Promise<RelatorioDoMes> {
    const hoje = dataLocal(new Date());
    if (mes > hoje.slice(0, 7))
      throw Erros.validacao([
        { campo: 'mes', mensagem: 'Escolha este mês ou um mês que já passou.' },
      ]);
    const { filtro, incluiConta } = escopoUnidades(unidadeId, ['dono', 'gestor']);
    const anterior = mesAnteriorDe(mes);
    const de = `${mes}-01`;
    const ate = ultimoDiaDoMes(mes);
    // Mês corrente: compara com os mesmos dias do mês anterior (1 a hoje), não com o mês inteiro.
    const { de: deAnt, ate: ateAnt } = periodoAnterior(de, ate, hoje);
    const parcial = mes === hoje.slice(0, 7);

    const r = await this.banco.daConta(async (tx) => {
      const conta = await tx.conta.findUniqueOrThrow({ where: { id: Contexto.usuario().contaId } });
      const verLucro = temRecurso(conta.plano, 'lucroReal');
      const verBarbeiros = temRecurso(conta.plano, 'fichaProfissional');
      // Todas as visitas até o fim do mês: "novo" é quem veio pela primeira vez na vida.
      const visitas = (
        await tx.comanda.findMany({
          where: {
            ...filtro,
            status: 'fechada',
            clienteId: { not: null },
            fechadaEm: { lt: fim(ate) },
          },
          select: { clienteId: true, fechadaEm: true },
        })
      ).map((v) => ({ clienteId: v.clienteId!, data: dataLocal(v.fechadaEm!) }));

      const doze = `${somarDias(`${mes}-01`, -335).slice(0, 7)}-01`;
      const fechadasAno = (await this.resultados.fechadas(tx, doze, ate, filtro)) as Fechada[];
      const doMes = (m: string) =>
        fechadasAno.filter((c) => c.fechadaEm && mesDe(c.fechadaEm) === m);
      const doPeriodo = (d: string, a: string) =>
        fechadasAno.filter((c) => {
          if (!c.fechadaEm) return false;
          const dia = dataLocal(c.fechadaEm);
          return dia >= d && dia <= a;
        });

      const numeros = async (d: string, a: string): Promise<NumerosDoMes> => {
        const fechadas = doPeriodo(d, a);
        const despesas = await this.resultados.despesas(tx, d, a, filtro, incluiConta);
        const ind = calcularIndicadores(fechadas, despesas);
        const clientes = analisarClientes(visitas, { de: d, ate: a, hoje: a }).resumo;
        const agendamentos = await tx.agendamento.findMany({
          where: { ...filtro, inicio: { gte: inicio(d), lt: fim(a) } },
          select: {
            origem: true,
            status: true,
            comanda: { select: { status: true, totalLiquido: true } },
          },
        });
        const semAgendamento = await tx.comanda.findMany({
          where: {
            ...filtro,
            status: 'fechada',
            agendamentoId: null,
            fechadaEm: { gte: inicio(d), lt: fim(a) },
          },
          select: { totalLiquido: true },
        });
        const canais = porCanal(
          agendamentos.map((x) => ({
            origem: x.origem,
            status: x.status,
            comanda: x.comanda
              ? { status: x.comanda.status, totalLiquido: x.comanda.totalLiquido ?? 0 }
              : null,
          })),
          semAgendamento.map((c) => ({ totalLiquido: c.totalLiquido ?? 0 })),
        );
        const faltas = agendamentos.filter((x) => x.status === 'falta').length;
        const validos = agendamentos.filter((x) => x.status !== 'cancelado').length;
        const notas = await tx.avaliacao.aggregate({
          where: {
            ...filtro,
            respondidaEm: { gte: inicio(d), lt: fim(a) },
            notaAtendimento: { not: null },
          },
          _avg: { notaAtendimento: true },
          _count: { notaAtendimento: true },
        });
        return {
          faturamento: ind.faturamento,
          lucro: verLucro ? ind.lucro : null,
          atendimentos: ind.atendimentos,
          clientes: ind.clientes,
          ticketMedio: ind.ticketMedio,
          percentualExtras: ind.percentualExtras,
          clientesNovos: clientes.novos,
          taxaRetorno: clientes.taxaRetorno,
          faltas,
          taxaFaltas: validos > 0 ? faltas / validos : null,
          notaMedia: notas._count.notaAtendimento > 0 ? Number(notas._avg.notaAtendimento) : null,
          ocupacao: await this.desempenho.ocupacaoDoPeriodo(tx, filtro, d, a),
          porCanal: Object.fromEntries(canais.map((c) => [c.canal, c.atendidos])),
        };
      };

      const mix = async (fechadas: Fechada[]): Promise<ItemDoMix[]> => {
        const s = lucratividadePorServico(fechadas);
        const p = lucratividadePorProduto(fechadas);
        const nomesS = new Map(
          (await tx.servico.findMany({ where: { id: { in: s.map((x) => x.servicoId) } } })).map(
            (x) => [x.id, x.nome],
          ),
        );
        const nomesP = new Map(
          (await tx.produto.findMany({ where: { id: { in: p.map((x) => x.produtoId) } } })).map(
            (x) => [x.id, x.nome],
          ),
        );
        return [
          ...s.map((x) => ({
            tipo: 'servico' as const,
            id: x.servicoId,
            nome: nomesS.get(x.servicoId) ?? 'Serviço',
            quantidade: x.quantidade,
            receita: x.receita,
            lucro: verLucro ? x.lucro : null,
          })),
          ...p
            .filter((x) => x.quantidade > 0)
            .map((x) => ({
              tipo: 'produto' as const,
              id: x.produtoId,
              nome: nomesP.get(x.produtoId) ?? 'Produto',
              quantidade: x.quantidade,
              receita: x.receita,
              lucro: verLucro ? x.lucro : null,
            })),
        ];
      };

      // Últimos 12 meses (o mais antigo primeiro), sem começar antes da criação da conta (M2).
      const meses = mesesDoHistorico(mes, dataLocal(conta.criadoEm).slice(0, 7));
      const historico: RelatorioDoMes['historico'] = [];
      for (const m of meses) {
        // Lucro com as despesas do próprio mês (só quando o plano tem lucro real).
        const desp = verLucro
          ? await this.resultados.despesas(tx, `${m}-01`, ultimoDiaDoMes(m), filtro, incluiConta)
          : [];
        const ind = calcularIndicadores(doMes(m), desp);
        historico.push({
          mes: m,
          faturamento: ind.faturamento,
          lucro: verLucro ? ind.lucro : null,
        });
      }

      // Por barbeiro: custo de produtos, faltas, serviços mais feitos e valor fixo.
      const profs = await tx.profissional.findMany({
        where: filtro,
        select: { id: true, custoFixoMensal: true },
      });
      const faltasPorProf = await tx.agendamento.groupBy({
        by: ['profissionalId'],
        where: { ...filtro, status: 'falta', inicio: { gte: inicio(de), lt: fim(ate) } },
        _count: { _all: true },
      });
      const atuais = doMes(mes);
      const nomesServico = new Map(
        (await tx.servico.findMany({ select: { id: true, nome: true } })).map((s) => [
          s.id,
          s.nome,
        ]),
      );
      const extras = new Map(
        profs.map((p) => {
          const minhas = atuais.filter((c) => c.profissionalId === p.id);
          const contagem = new Map<string, number>();
          for (const c of minhas)
            for (const i of c.itens)
              if (i.tipo === 'servico' && i.servicoId)
                contagem.set(i.servicoId, (contagem.get(i.servicoId) ?? 0) + i.quantidade);
          return [
            p.id,
            {
              custoFixo: p.custoFixoMensal,
              custoProdutos: calcularIndicadores(minhas).custoProdutos,
              faltas: faltasPorProf.find((f) => f.profissionalId === p.id)?._count._all ?? 0,
              servicosMaisFeitos: [...contagem]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([id, quantidade]) => ({
                  nome: nomesServico.get(id) ?? 'Serviço',
                  quantidade,
                })),
            },
          ];
        }),
      );

      return {
        verLucro,
        verBarbeiros,
        atual: await numeros(de, ate),
        anteriorNumeros: await numeros(deAnt, ateAnt),
        projecao: parcial
          ? await this.resultados.projecao(tx, mes, hoje, filtro, doPeriodo(de, hoje))
          : null,
        mixAtual: await mix(atuais),
        mixAnterior: await mix(doPeriodo(deAnt, ateAnt)),
        historico,
        extras,
      };
    });

    // Sem "Ficha e ranking dos barbeiros" no plano, o relatório não traz os barbeiros.
    const [rankAtual, rankAnterior] = r.verBarbeiros
      ? [
          await this.desempenho.ranking(unidadeId, de, ate),
          await this.desempenho.ranking(unidadeId, deAnt, ateAnt),
        ]
      : [[], []];
    const barbeiros: BarbeiroDoMes[] = rankAtual
      .filter((l) => l.clientes > 0 || l.ativo)
      .map((l) => {
        const x = r.extras.get(l.profissionalId);
        return {
          profissionalId: l.profissionalId,
          nome: l.nome,
          faturamento: l.faturamento,
          comissao: l.comissao,
          custoFixo: x?.custoFixo ?? 0,
          custoProdutos: x?.custoProdutos ?? 0,
          atendimentos: l.atendimentos,
          clientes: l.clientes,
          ticketMedio: l.ticketMedio,
          percentualExtras: l.percentualExtras,
          taxaRetorno: l.taxaRetorno,
          notaMedia: l.notaMedia,
          faltas: x?.faltas ?? 0,
          ocupacao: l.ocupacao,
          percentualNoPrazo: l.percentualNoPrazo,
          servicosMaisFeitos: x?.servicosMaisFeitos ?? [],
          faturamentoAnterior:
            rankAnterior.find((a) => a.profissionalId === l.profissionalId)?.faturamento ?? 0,
        };
      });

    return {
      mes,
      mesAnterior: anterior,
      atual: r.atual,
      anterior: r.anteriorNumeros,
      barbeiros,
      mixAtual: r.mixAtual,
      mixAnterior: r.mixAnterior,
      periodoAnterior: { de: deAnt, ate: ateAnt },
      historico: r.historico,
      verLucro: r.verLucro,
      verBarbeiros: r.verBarbeiros,
      projecao: r.projecao,
    };
  }

  /** O relatório do mês em planilha (CSV) ou PDF, com o mesmo conteúdo da tela. */
  async arquivo(
    unidadeId: string | undefined,
    mes: string,
    formato: 'csv' | 'pdf',
  ): Promise<{ nome: string; tipo: string; conteudo: Buffer }> {
    const r = await this.mes(unidadeId, mes);
    const { barbearia, unidade } = await this.banco.daConta(async (tx) => ({
      barbearia: (await tx.conta.findUniqueOrThrow({ where: { id: Contexto.usuario().contaId } }))
        .nome,
      unidade: unidadeId
        ? ((await tx.unidade.findUnique({ where: { id: unidadeId } }))?.nome ?? null)
        : null,
    }));
    const conteudo = relatorioEmArquivo(r, {
      barbearia,
      unidade,
      parcial: mes === dataLocal(new Date()).slice(0, 7),
    });
    const nome = `relatorio-${mes}`;
    return formato === 'csv'
      ? {
          nome: `${nome}.csv`,
          tipo: 'text/csv; charset=utf-8',
          conteudo: Buffer.from(relatorioEmCsv(conteudo), 'utf-8'),
        }
      : {
          nome: `${nome}.pdf`,
          tipo: 'application/pdf',
          conteudo: Buffer.from(await relatorioEmPdf(conteudo, new Date())),
        };
  }
}

@ApiTags('Indicadores e metas')
@ApiBearerAuth()
@Controller('relatorio')
export class RelatorioController {
  constructor(@Inject(RelatorioService) private readonly servico: RelatorioService) {}

  @Get('mes')
  @Papeis('dono', 'gestor')
  @ApiOperation({
    summary:
      'Relatório do mês contra o anterior: indicadores, clientes, canais, barbeiros (custo e lucro), mix e 12 meses',
  })
  mes(@Consulta(consultaRelatorio) c: z.infer<typeof consultaRelatorio>): Promise<RelatorioDoMes> {
    return this.servico.mes(c.unidadeId, c.mes);
  }

  @Get('mes/arquivo')
  @Papeis('dono', 'gestor')
  @ApiOperation({ summary: 'Relatório do mês para baixar: planilha (CSV) ou PDF' })
  async arquivo(
    @Consulta(consultaArquivo) c: z.infer<typeof consultaArquivo>,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const a = await this.servico.arquivo(c.unidadeId, c.mes, c.formato);
    res.set({
      'Content-Type': a.tipo,
      'Content-Disposition': `attachment; filename="${a.nome}"`,
      'Cache-Control': 'no-store',
    });
    return new StreamableFile(a.conteudo);
  }
}
