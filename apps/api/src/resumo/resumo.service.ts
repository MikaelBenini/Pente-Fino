import { Inject, Injectable } from '@nestjs/common';
import type { Transacao } from '@pente-fino/db';
import {
  calcularIndicadores,
  contarDia,
  dataLocal,
  diasDeTrabalho,
  fazAniversario,
  instanteLocal,
  proximoAtendimento,
  resumoPorDia,
  situacaoNoDia,
  statusEfetivo,
  type ItemDoDia,
  type Ocupacao,
  type ResumoDoDia,
  type ResumoDoMes,
  type SaudeDaConta,
  type StatusComanda,
} from '@pente-fino/shared';
import { BancoService } from '../comum/banco.service.js';
import { Erros } from '../comum/erros.js';
import { data, dataTexto, exigirUnidade, filtroUnidade, GESTAO } from '../comum/escopo.js';
import { DesempenhoService } from '../desempenho/desempenho.service.js';
import {
  escopoUnidades,
  ResultadosService,
  somarDias,
  ultimoDiaDoMes,
} from '../resultados/resultados.service.js';

const inicioDoDia = (d: string) => new Date(`${d}T00:00:00-03:00`);
const doDia = (d: string) => ({ gte: inicioDoDia(d), lt: inicioDoDia(somarDias(d, 1)) });
const somar = (xs: readonly Ocupacao[]): Ocupacao => {
  const disponivelMin = xs.reduce((s, o) => s + o.disponivelMin, 0);
  const agendadoMin = xs.reduce((s, o) => s + o.agendadoMin, 0);
  return { disponivelMin, agendadoMin, fracao: disponivelMin ? agendadoMin / disponivelMin : 0 };
};

@Injectable()
export class ResumoService {
  constructor(
    @Inject(BancoService) private readonly banco: BancoService,
    @Inject(DesempenhoService) private readonly desempenho: DesempenhoService,
    @Inject(ResultadosService) private readonly resultados: ResultadosService,
  ) {}

  /** Filtro de unidade e, se pedido, de um profissional (conferido contra o escopo). */
  private async escopo(tx: Transacao, unidadeId?: string, profissionalId?: string) {
    const { filtro } = escopoUnidades(unidadeId, GESTAO);
    if (!profissionalId) return { filtro, unidadeDoProfissional: null as string | null };
    const p = await tx.profissional.findUnique({ where: { id: profissionalId } });
    if (!p) throw Erros.naoEncontrado('Profissional não encontrado.');
    exigirUnidade(p.unidadeId, GESTAO);
    if (unidadeId && p.unidadeId !== unidadeId)
      throw Erros.validacao([
        { campo: 'profissionalId', mensagem: 'Este profissional é de outra unidade.' },
      ]);
    return { filtro: { ...filtro, id: profissionalId }, unidadeDoProfissional: p.unidadeId };
  }

  async dia(dia: string, unidadeId?: string, profissionalId?: string): Promise<ResumoDoDia> {
    return this.banco.daConta(async (tx) => {
      const { filtro } = await this.escopo(tx, unidadeId, profissionalId);
      const todos = await tx.profissional.findMany({
        where: filtro,
        include: { usuario: { select: { nome: true } }, horarios: true },
        orderBy: { usuario: { nome: 'asc' } },
      });
      const ids = todos.map((p) => p.id);
      const periodo = doDia(dia);
      const incluir = {
        cliente: { select: { id: true, nome: true, aniversario: true } },
        itens: {
          include: { servico: { select: { nome: true } }, produto: { select: { nome: true } } },
        },
      } as const;
      const agendamentos = await tx.agendamento.findMany({
        where: { profissionalId: { in: ids }, inicio: periodo },
        include: {
          comanda: { include: incluir },
          cliente: { select: { id: true, nome: true, aniversario: true } },
        },
        orderBy: { inicio: 'asc' },
      });
      const avulsas = await tx.comanda.findMany({
        where: { profissionalId: { in: ids }, agendamentoId: null, criadoEm: periodo },
        include: incluir,
      });
      const fechadas = await tx.comanda.findMany({
        where: { profissionalId: { in: ids }, status: 'fechada', fechadaEm: periodo },
        include: { itens: true },
      });
      const clienteIds = [
        ...new Set(
          [...agendamentos.map((a) => a.clienteId), ...avulsas.map((c) => c.clienteId)].filter(
            (x): x is string => !!x,
          ),
        ),
      ];
      const jaVieram = new Set(
        (
          await tx.comanda.findMany({
            where: {
              clienteId: { in: clienteIds },
              status: 'fechada',
              fechadaEm: { lt: periodo.gte },
            },
            select: { clienteId: true },
            distinct: ['clienteId'],
          })
        ).map((c) => c.clienteId),
      );

      const agora = new Date();
      const nomeItens = (
        itens: {
          tipo: string;
          servico: { nome: string } | null;
          produto: { nome: string } | null;
          descricao: string | null;
        }[],
      ) =>
        itens
          .filter((i) => i.tipo !== 'nao_operacional')
          .map((i) => i.servico?.nome ?? i.produto?.nome ?? i.descricao ?? 'Item');
      const cliente = (c: { id: string; nome: string; aniversario: Date | null } | null) => ({
        cliente: c?.nome ?? null,
        clienteId: c?.id ?? null,
        primeiraVez: !!c && !jaVieram.has(c.id),
        aniversario: !!c && fazAniversario(c.aniversario ? dataTexto(c.aniversario) : null, dia),
      });
      const itens: (ItemDoDia & { _inicio: Date; _fim: Date })[] = [
        ...agendamentos.map((a) => {
          const status = statusEfetivo(
            (a.comanda?.status ?? 'prevista') as StatusComanda,
            a.fim,
            agora,
          );
          return {
            agendamentoId: a.id,
            comandaId: a.comanda?.id ?? null,
            profissionalId: a.profissionalId,
            inicio: a.inicio.toISOString(),
            fim: a.fim.toISOString(),
            ...cliente(a.cliente),
            servicos: a.comanda ? nomeItens(a.comanda.itens) : [],
            valor: a.comanda?.totalLiquido ?? 0,
            situacao: situacaoNoDia(status, a.status),
            status,
            pendente: status === 'pendente',
            origem: a.origem,
            observacao: a.observacao,
            _inicio: a.inicio,
            _fim: a.fim,
          };
        }),
        ...avulsas.map((c) => {
          const inicio = c.iniciadaEm ?? c.criadoEm;
          const fim = c.confirmadaEm ?? c.fechadaEm ?? new Date(inicio.getTime() + 30 * 60_000);
          const status = statusEfetivo(c.status as StatusComanda, null, agora);
          return {
            agendamentoId: null,
            comandaId: c.id,
            profissionalId: c.profissionalId,
            inicio: inicio.toISOString(),
            fim: fim.toISOString(),
            ...cliente(c.cliente),
            servicos: nomeItens(c.itens),
            valor: c.totalLiquido,
            situacao: situacaoNoDia(status),
            status,
            pendente: status === 'pendente',
            origem: 'sem_agendamento',
            observacao: null,
            _inicio: inicio,
            _fim: fim,
          };
        }),
      ].sort((a, b) => a._inicio.getTime() - b._inicio.getTime());

      const ocupacoes = await this.desempenho.ocupacoes(tx, todos, dia, dia, false);
      const limpar = ({ _inicio, _fim, ...i }: (typeof itens)[number]): ItemDoDia => i;
      const entrada = (i: (typeof itens)[number]) => ({ ...i, inicio: i._inicio, fim: i._fim });

      const profissionais = todos
        .map((p) => {
          const meus = itens.filter((i) => i.profissionalId === p.id);
          const ind = calcularIndicadores(fechadas.filter((c) => c.profissionalId === p.id));
          const proximo = proximoAtendimento(meus.map(entrada), agora);
          return {
            profissionalId: p.id,
            nome: p.usuario.nome,
            unidadeId: p.unidadeId,
            contagem: contarDia(meus.map(entrada)),
            faturamento: ind.faturamento,
            comissao: ind.comissoes,
            clientes: ind.clientes,
            ocupacao: ocupacoes.get(p.id) ?? { disponivelMin: 0, agendadoMin: 0, fracao: 0 },
            proximo: proximo
              ? limpar(
                  meus.find(
                    (m) =>
                      m.agendamentoId === proximo.agendamentoId &&
                      m.comandaId === proximo.comandaId,
                  )!,
                )
              : null,
            itens: meus.map(limpar),
            ativo: p.ativo,
          };
        })
        .filter((p) => p.ativo || p.itens.length > 0 || p.clientes > 0)
        .map(({ ativo: _ativo, ...p }) => p);

      // A mensalidade do clube paga hoje entra no faturamento do dia (não é de um barbeiro só).
      const ind = calcularIndicadores(
        fechadas,
        [],
        profissionalId ? null : await this.resultados.clube(tx, dia, dia, filtro),
      );
      const visiveis = itens.filter((i) => i.situacao !== 'cancelada');
      return {
        data: dia,
        totais: {
          ...contarDia(itens.map(entrada)),
          faturamento: ind.faturamento,
          comissao: ind.comissoes,
          clientes: ind.clientes,
          ticketMedio: ind.ticketMedio,
          ocupacao: somar(profissionais.map((p) => p.ocupacao)),
          primeiraVez: visiveis.filter((i) => i.primeiraVez).length,
          aniversariantes: visiveis.filter((i) => i.aniversario).length,
        },
        profissionais,
      };
    });
  }

  async mes(mes: string, unidadeId?: string, profissionalId?: string): Promise<ResumoDoMes> {
    return this.banco.daConta(async (tx) => {
      const { filtro, unidadeDoProfissional } = await this.escopo(tx, unidadeId, profissionalId);
      const de = `${mes}-01`;
      const ate = ultimoDiaDoMes(mes);
      const periodo = { gte: inicioDoDia(de), lt: inicioDoDia(somarDias(ate, 1)) };
      // Escopo das unidades: a pedida, as do gestor ou todas (dono).
      const unidadesDoEscopo = (filtro as { unidadeId?: string | { in: string[] } }).unidadeId;
      const filtroComanda: { profissionalId?: string; unidadeId?: string | { in: string[] } } =
        profissionalId
          ? { profissionalId }
          : unidadesDoEscopo
            ? { unidadeId: unidadesDoEscopo }
            : {};
      const fechadas = await tx.comanda.findMany({
        where: { ...filtroComanda, status: 'fechada', fechadaEm: periodo },
        include: { itens: true },
      });
      const agendamentos = await tx.agendamento.findMany({
        where: { ...filtroComanda, inicio: periodo },
        select: { inicio: true, status: true },
      });
      const unidadeAlvo = unidadeDoProfissional ?? unidadeId;
      const unidades = await tx.unidade.findMany({
        where: unidadeAlvo
          ? { id: unidadeAlvo }
          : { ativa: true, ...(unidadesDoEscopo ? { id: unidadesDoEscopo } : {}) },
      });
      const excecoes = await tx.calendarioUnidade.findMany({
        where: {
          unidadeId: { in: unidades.map((u) => u.id) },
          data: { gte: data(de), lte: data(ate) },
        },
      });
      // Com várias unidades, o dia conta como de trabalho se alguma abriu.
      const trabalho = new Set(
        unidades.flatMap((u) =>
          diasDeTrabalho(
            mes,
            u.diasTrabalho,
            excecoes
              .filter((e) => e.unidadeId === u.id)
              .map((e) => ({ data: dataTexto(e.data), trabalha: e.trabalha })),
          ),
        ),
      );
      const dias: string[] = [];
      for (let d = de; d <= ate; d = somarDias(d, 1)) dias.push(d);
      const mensalidades = profissionalId
        ? []
        : await this.resultados.pagamentosClube(tx, de, ate, filtroComanda);
      const linhas = resumoPorDia(
        dias,
        [...trabalho],
        fechadas.map((c) => ({ data: dataLocal(c.fechadaEm!), comanda: c })),
        agendamentos.map((a) => ({ data: dataLocal(a.inicio), status: a.status })),
        mensalidades,
      );
      const total = calcularIndicadores(fechadas, [], {
        mensalidades: mensalidades.reduce((s, m) => s + m.valor, 0),
      });
      const hoje = dataLocal(new Date());
      return {
        mes,
        dias: linhas,
        totais: {
          agendados: linhas.reduce((s, l) => s + l.agendados, 0),
          faltas: linhas.reduce((s, l) => s + l.faltas, 0),
          cancelados: linhas.reduce((s, l) => s + l.cancelados, 0),
          clientes: total.clientes,
          atendimentos: total.atendimentos,
          faturamento: total.faturamento,
          ticketMedio: total.ticketMedio,
          comissao: total.comissoes,
          diasTrabalhados: linhas.filter((l) => l.trabalha && l.data <= hoje).length,
        },
      };
    });
  }

  /**
   * Saúde da conta no Início (seção 7): o caixa mais recente de um dia anterior que ficou aberto
   * e as comandas de dias anteriores que não foram fechadas nem canceladas.
   */
  async saude(unidadeId?: string): Promise<SaudeDaConta> {
    if (unidadeId) exigirUnidade(unidadeId, GESTAO);
    const hoje = dataLocal(new Date());
    const inicioDeHoje = instanteLocal(hoje, 0);
    return this.banco.daConta(async (tx) => {
      const filtro = unidadeId ? { unidadeId } : filtroUnidade(GESTAO);
      const caixa = await tx.caixaDia.findFirst({
        where: { ...filtro, fechadoEm: null, data: { lt: data(hoje) } },
        orderBy: { data: 'desc' },
        include: { unidade: { select: { nome: true } } },
      });
      const comandasParadas = await tx.comanda.count({
        where: {
          ...filtro,
          OR: [
            {
              status: { in: ['em_atendimento', 'confirmada', 'pendente', 'reaberta'] },
              criadoEm: { lt: inicioDeHoje },
            },
            // Horário de dia anterior que ninguém atendeu nem marcou como falta.
            { status: 'prevista', agendamento: { inicio: { lt: inicioDeHoje } } },
          ],
        },
      });
      return {
        caixaAnterior: caixa ? { data: dataTexto(caixa.data), unidade: caixa.unidade.nome } : null,
        comandasParadas,
      };
    });
  }
}
