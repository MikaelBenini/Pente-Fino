import { Controller, Get, Inject, Put } from '@nestjs/common';
import { precoProprioVigente, precoServicoVigente, regrasDaUnidade } from '@pente-fino/db';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  calcularIndicadores,
  dataLocal,
  statusEfetivo,
  meusPrecosSchema,
  type DesempenhoBarbeiro,
  type MeuPreco,
  type MeusPrecosEntrada,
  type ExtratoComissao,
  type PainelBarbeiro,
  type StatusComanda,
  estaAtrasado,
} from '@pente-fino/shared';
import { z } from 'zod';
import { Auditada, auditar } from '../auditoria/auditoria.js';
import { ExigeRecurso, Papeis } from '../auth/decoradores.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { TODOS } from '../comum/escopo.js';
import { Consulta, Corpo } from '../comum/validacao.js';
import { data } from '../comum/escopo.js';
import { Erros } from '../comum/erros.js';
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

  @Get('precos')
  @Papeis(...TODOS)
  @ApiOperation({
    summary: 'Meus preços: os serviços da unidade em que atendo, com o preço dela e o meu',
  })
  meusPrecos(): Promise<MeuPreco[]> {
    const quem = Contexto.usuario();
    const hoje = dataLocal(new Date());
    return this.banco.daConta(async (tx) => {
      const profs = await tx.profissional.findMany({
        where: { usuarioId: quem.id, ativo: true },
        include: { unidade: { select: { nome: true } } },
      });
      const linhas: MeuPreco[] = [];
      for (const p of profs) {
        const servicos = await tx.servico.findMany({
          where: { ativo: true, unidadeIds: { has: p.unidadeId } },
          orderBy: [{ ehExtra: 'asc' }, { nome: 'asc' }],
        });
        for (const s of servicos)
          linhas.push({
            profissionalId: p.id,
            unidadeId: p.unidadeId,
            unidade: p.unidade.nome,
            servicoId: s.id,
            servico: s.nome,
            precoUnidade: (await precoServicoVigente(tx, s.id, p.unidadeId, hoje)) ?? null,
            meuPreco: await precoProprioVigente(tx, s.id, p.id, hoje),
          });
      }
      return linhas;
    });
  }

  @Put('precos')
  @Papeis(...TODOS)
  @Auditada()
  @ApiOperation({
    summary: 'Mudar meus preços (vale de hoje em diante; null volta para o preço da unidade)',
  })
  salvarMeusPrecos(@Corpo(meusPrecosSchema) d: MeusPrecosEntrada): Promise<MeuPreco[]> {
    const quem = Contexto.usuario();
    const hoje = dataLocal(new Date());
    return this.banco
      .daConta(async (tx) => {
        for (const item of d.precos) {
          const p = await tx.profissional.findUnique({ where: { id: item.profissionalId } });
          // Só o próprio barbeiro muda o preço dele.
          if (!p || p.usuarioId !== quem.id || !p.ativo)
            throw Erros.semPermissao('Você só muda os seus preços.');
          const s = await tx.servico.findUnique({ where: { id: item.servicoId } });
          if (!s || !s.ativo || !s.unidadeIds.includes(p.unidadeId))
            throw Erros.naoEncontrado('Serviço não encontrado na sua unidade.');
          await tx.precoProfissional.upsert({
            where: {
              contaId_profissionalId_servicoId_vigenciaInicio: {
                contaId: quem.contaId,
                profissionalId: p.id,
                servicoId: s.id,
                vigenciaInicio: data(hoje),
              },
            },
            create: {
              profissionalId: p.id,
              servicoId: s.id,
              valor: item.valor,
              vigenciaInicio: data(hoje),
            },
            update: { valor: item.valor },
          });
        }
        await auditar(tx, {
          entidade: 'profissional',
          entidadeId: d.precos[0]!.profissionalId,
          acao: 'meus_precos',
          depois: { vigenciaInicio: hoje, precos: d.precos },
        });
      })
      .then(() => this.meusPrecos());
  }

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

  @ExigeRecurso('comissoes')
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
