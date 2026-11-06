import { Controller, Get, Inject } from '@nestjs/common';
import { regrasDaUnidade } from '@pente-fino/db';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  calcularIndicadores,
  dataLocal,
  statusEfetivo,
  type DesempenhoBarbeiro,
  type ExtratoComissao,
  type PainelBarbeiro,
  type StatusComanda,
  estaAtrasado,
} from '@pente-fino/shared';
import { z } from 'zod';
import { Papeis } from '../auth/decoradores.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { TODOS } from '../comum/escopo.js';
import { Consulta } from '../comum/validacao.js';
import { ComissoesService } from '../comissoes/comissoes.service.js';
import { ResultadosService, somarDias, ultimoDiaDoMes } from '../resultados/resultados.service.js';

const mesSchema = z.object({
  mes: z
    .string()
    .regex(/^\d{4}-\d{2}$/, { error: 'Mês inválido.' })
    .optional(),
});
const periodo = z.object({
  de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** App do barbeiro: tudo do próprio usuário, sem parâmetro de quem é. */
@ApiTags('Área do barbeiro')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(
    @Inject(BancoService) private readonly banco: BancoService,
    @Inject(ResultadosService) private readonly resultados: ResultadosService,
    @Inject(ComissoesService) private readonly comissoes: ComissoesService,
  ) {}

  @Get('hoje')
  @Papeis(...TODOS)
  @ApiOperation({ summary: 'Próximos clientes do dia, comissão do dia e do mês, metas da unidade' })
  hoje(): Promise<PainelBarbeiro> {
    const quem = Contexto.usuario();
    const hoje = dataLocal(new Date());
    const mes = hoje.slice(0, 7);
    return this.banco.daConta(async (tx) => {
      const profs = await tx.profissional.findMany({ where: { usuarioId: quem.id, ativo: true } });
      const ids = profs.map((p) => p.id);
      const inicio = new Date(`${hoje}T00:00:00-03:00`);
      const fim = new Date(inicio.getTime() + 86_400_000);
      const agendamentos = await tx.agendamento.findMany({
        where: {
          profissionalId: { in: ids },
          inicio: { gte: inicio, lt: fim },
          status: { notIn: ['cancelado', 'falta'] },
        },
        include: { cliente: true, comanda: { include: { itens: { include: { servico: true } } } } },
        orderBy: { inicio: 'asc' },
      });
      const soma = async (de: string) =>
        (
          await tx.itemComanda.aggregate({
            _sum: { comissaoValor: true },
            where: {
              profissionalId: { in: ids },
              comanda: {
                status: 'fechada',
                fechadaEm: { gte: new Date(`${de}T00:00:00-03:00`), lt: fim },
              },
            },
          })
        )._sum.comissaoValor ?? 0;
      const agora = new Date();
      const tolerancias = new Map<string, number>();
      for (const uid of new Set(agendamentos.map((a) => a.unidadeId)))
        tolerancias.set(uid, (await regrasDaUnidade(tx, uid)).toleranciaAtrasoMin);
      return {
        hoje,
        agenda: agendamentos.map((a) => ({
          agendamentoId: a.id,
          comandaId: a.comanda?.id ?? null,
          profissionalId: a.profissionalId,
          cliente: a.cliente?.nome ?? 'Cliente',
          servicos:
            a.comanda?.itens
              .filter((i) => i.tipo === 'servico')
              .map((i) => i.servico?.nome ?? 'Serviço') ?? [],
          inicio: a.inicio.toISOString(),
          fim: a.fim.toISOString(),
          status: statusEfetivo((a.comanda?.status ?? 'prevista') as StatusComanda, a.fim, agora),
          origem: a.origem,
          confirmado: a.status === 'confirmado',
          atrasado: estaAtrasado({
            statusComanda: a.comanda?.status ?? 'prevista',
            statusAgendamento: a.status,
            inicio: a.inicio,
            agora,
            toleranciaMin: tolerancias.get(a.unidadeId) ?? 10,
          }),
        })),
        comissaoDia: await soma(hoje),
        comissaoMes: await soma(`${mes}-01`),
        metas: ids.length
          ? await this.resultados.metas(tx, mes, {
              unidadeId: { in: [...new Set(profs.map((p) => p.unidadeId))] },
            })
          : [],
      };
    });
  }

  @Get('desempenho')
  @Papeis(...TODOS)
  @ApiOperation({ summary: 'Meu mês contra o mês anterior' })
  desempenho(@Consulta(mesSchema) c: z.infer<typeof mesSchema>): Promise<DesempenhoBarbeiro> {
    const quem = Contexto.usuario();
    const mes = c.mes ?? dataLocal(new Date()).slice(0, 7);
    const anterior = somarDias(`${mes}-01`, -1).slice(0, 7);
    return this.banco.daConta(async (tx) => {
      const ids = (await tx.profissional.findMany({ where: { usuarioId: quem.id } })).map(
        (p) => p.id,
      );
      const calc = async (m: string) => {
        const comandas = await this.resultados.fechadas(tx, `${m}-01`, ultimoDiaDoMes(m), {
          profissionalId: { in: ids },
        });
        const i = calcularIndicadores(comandas);
        return {
          faturamento: i.faturamento,
          clientes: i.clientes,
          ticketMedio: i.ticketMedio,
          extrasQuantidade: i.extrasQuantidade,
          percentualExtras: i.percentualExtras,
          comissao: i.comissoes,
          atendimentos: i.atendimentos,
        };
      };
      return { mes, atual: await calc(mes), anterior: await calc(anterior) };
    });
  }

  @Get('comissoes')
  @Papeis(...TODOS)
  @ApiOperation({ summary: 'Meu extrato de comissões no período' })
  async minhasComissoes(@Consulta(periodo) p: z.infer<typeof periodo>): Promise<ExtratoComissao[]> {
    const quem = Contexto.usuario();
    const ids = await this.banco.daConta((tx) =>
      tx.profissional.findMany({ where: { usuarioId: quem.id }, select: { id: true } }),
    );
    return Promise.all(ids.map((x) => this.comissoes.extrato(x.id, p.de, p.ate)));
  }
}
