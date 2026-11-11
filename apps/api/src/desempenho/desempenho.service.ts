import { Inject, Injectable } from '@nestjs/common';
import type { Transacao } from '@pente-fino/db';
import {
  analisarClientes,
  analisarRotina,
  calcularIndicadores,
  calcularOcupacao,
  dataLocal,
  desempenhoPorServico,
  diasDeTrabalho,
  duracaoReal,
  mesesAte,
  podeNaUnidade,
  produtosVendidos,
  type FichaProfissional,
  type Indicadores,
  type LinhaRankingEquipe,
  type Ocupacao,
  type ResumoDesempenho,
  type VisitaCliente,
  recorrentesNoDia,
  mapaDeOcupacao,
  destaquesDaRede,
  resumirNotas,
  totalDaRede,
  type LinhaDaRede,
  type PainelDaRede,
  type OcupacaoDaUnidade,
  linkDeAgendamento,
} from '@pente-fino/shared';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { Erros } from '../comum/erros.js';
import { data, dataTexto, GESTAO } from '../comum/escopo.js';
import { ComissoesService } from '../comissoes/comissoes.service.js';
import { CONFIGURACAO, type Configuracao } from '../config/configuracao.js';
import { avaliacoesDoProfissional, notaPorProfissional } from '../avaliacoes/avaliacoes.js';
import { escopoUnidades, somarDias, ultimoDiaDoMes } from '../resultados/resultados.service.js';

const inicioDoDia = (d: string) => new Date(`${d}T00:00:00-03:00`);
const noPeriodo = (de: string, ate: string) => ({
  gte: inicioDoDia(de),
  lt: inicioDoDia(somarDias(ate, 1)),
});
/** Histórico usado para retorno e clientes sumidos. */
const HISTORICO_DIAS = 730;
const LIMITE_LISTA_CLIENTES = 100;
const LIMITE_SUMIDOS = 50;
const LIMITE_COMANDAS = 300;

function resumoDe(i: Indicadores): ResumoDesempenho {
  return {
    faturamento: i.faturamento,
    receitaServicos: i.receitaServicos,
    receitaProdutos: i.receitaProdutos,
    atendimentos: i.atendimentos,
    clientes: i.clientes,
    ticketMedio: i.ticketMedio,
    extrasQuantidade: i.extrasQuantidade,
    percentualExtras: i.percentualExtras,
    comissao: i.comissoes,
  };
}

/** Comandas fechadas com o que a ficha usa: itens, horário marcado e marcos do atendimento. */
async function fechadasDetalhadas(tx: Transacao, de: string, ate: string, where: object) {
  return tx.comanda.findMany({
    where: { ...where, status: 'fechada', fechadaEm: noPeriodo(de, ate) },
    include: { itens: true, agendamento: { select: { inicio: true, fim: true } } },
  });
}
type Fechada = Awaited<ReturnType<typeof fechadasDetalhadas>>[number];

const rotinaDe = (c: Fechada, usuarioDoProfissional: string) => ({
  inicioAgendado: c.agendamento?.inicio ?? null,
  fimAgendado: c.agendamento?.fim ?? null,
  iniciadaEm: c.iniciadaEm,
  confirmadaEm: c.confirmadaEm,
  confirmadaPeloProfissional: c.confirmadaPorId === usuarioDoProfissional,
});

@Injectable()
export class DesempenhoService {
  constructor(
    @Inject(BancoService) private readonly banco: BancoService,
    @Inject(ComissoesService) private readonly comissoes: ComissoesService,
    @Inject(CONFIGURACAO) private readonly config: Configuracao,
  ) {}

  /** Visitas (comandas fechadas com cliente) dos profissionais, nos últimos dois anos até hoje. */
  private async visitas(tx: Transacao, profissionalIds: string[], ate: string) {
    const hoje = dataLocal(new Date());
    const fim = ate > hoje ? ate : hoje;
    const lista = await tx.comanda.findMany({
      where: {
        profissionalId: { in: profissionalIds },
        status: 'fechada',
        clienteId: { not: null },
        fechadaEm: noPeriodo(somarDias(fim, -HISTORICO_DIAS), fim),
      },
      select: { profissionalId: true, clienteId: true, fechadaEm: true },
    });
    const porProfissional = new Map<string, VisitaCliente[]>();
    for (const c of lista) {
      const v = porProfissional.get(c.profissionalId) ?? [];
      v.push({ clienteId: c.clienteId!, data: dataLocal(c.fechadaEm!) });
      porProfissional.set(c.profissionalId, v);
    }
    return porProfissional;
  }

  /**
   * O que entra na ocupação de cada profissional entre `de` e `fim`: dias de trabalho da
   * unidade (calendário), expediente, bloqueios (pontuais e os que repetem) e horários marcados.
   */
  private async insumosDeOcupacao(
    tx: Transacao,
    profissionais: readonly {
      id: string;
      unidadeId: string;
      horarios: { diaSemana: number; inicioMin: number; fimMin: number }[];
    }[],
    de: string,
    fim: string,
  ) {
    const ids = profissionais.map((p) => p.id);
    const unidadeIds = [...new Set(profissionais.map((p) => p.unidadeId))];
    const unidades = await tx.unidade.findMany({ where: { id: { in: unidadeIds } } });
    const excecoes = await tx.calendarioUnidade.findMany({
      where: { unidadeId: { in: unidadeIds }, data: { gte: data(de), lte: data(fim) } },
    });
    const intervalo = noPeriodo(de, fim);
    const bloqueios = await tx.bloqueioAgenda.findMany({
      where: {
        profissionalId: { in: ids },
        inicio: { lt: intervalo.lt },
        fim: { gt: intervalo.gte },
      },
    });
    const agendados = await tx.agendamento.findMany({
      where: {
        profissionalId: { in: ids },
        status: { not: 'cancelado' },
        inicio: { lt: intervalo.lt },
        fim: { gt: intervalo.gte },
      },
      select: { profissionalId: true, inicio: true, fim: true },
    });
    const meses = [...new Set([de.slice(0, 7), fim.slice(0, 7)])];
    for (let m = de.slice(0, 7); m < fim.slice(0, 7);) {
      m = somarDias(`${m}-01`, 32).slice(0, 7);
      meses.push(m);
    }
    const diasPorUnidade = new Map<string, string[]>();
    for (const u of unidades) {
      const exc = excecoes
        .filter((e) => e.unidadeId === u.id)
        .map((e) => ({ data: dataTexto(e.data), trabalha: e.trabalha }));
      const dias = [...new Set(meses)]
        .flatMap((m) => diasDeTrabalho(m, u.diasTrabalho, exc))
        .filter((d) => d >= de && d <= fim);
      diasPorUnidade.set(u.id, dias);
    }
    // Bloqueios que repetem toda semana (almoço) também saem do expediente.
    const recorrentes = await tx.bloqueioRecorrente.findMany({
      where: { profissionalId: { in: ids } },
    });
    return profissionais.map((p) => {
      const dias = diasPorUnidade.get(p.unidadeId) ?? [];
      const dele = recorrentes
        .filter((r) => r.profissionalId === p.id)
        .map((r) => ({
          diaSemana: r.diaSemana,
          inicioMin: r.inicioMin,
          fimMin: r.fimMin,
          desde: dataTexto(r.desde),
          ate: r.ate ? dataTexto(r.ate) : null,
        }));
      return {
        id: p.id,
        dias,
        turnos: p.horarios,
        bloqueios: [
          ...bloqueios.filter((b) => b.profissionalId === p.id),
          ...dias.flatMap((d) => recorrentesNoDia(dele, d)),
        ],
        agendados: agendados.filter((a) => a.profissionalId === p.id),
      };
    });
  }

  /** Ocupação de cada profissional; por padrão, do início do período até hoje (o futuro ainda não aconteceu). */
  async ocupacoes(
    tx: Transacao,
    profissionais: {
      id: string;
      unidadeId: string;
      horarios: { diaSemana: number; inicioMin: number; fimMin: number }[];
    }[],
    de: string,
    ate: string,
    /** false: conta também o que está marcado para depois de hoje (agenda do dia). */
    soAteHoje = true,
  ): Promise<Map<string, Ocupacao>> {
    const hoje = dataLocal(new Date());
    const fim = !soAteHoje || ate < hoje ? ate : hoje;
    const resultado = new Map<string, Ocupacao>();
    if (fim < de) {
      for (const p of profissionais)
        resultado.set(p.id, { disponivelMin: 0, agendadoMin: 0, fracao: 0 });
      return resultado;
    }
    for (const i of await this.insumosDeOcupacao(tx, profissionais, de, fim))
      resultado.set(i.id, calcularOcupacao(i));
    return resultado;
  }

  /**
   * Ocupação da unidade (cadeiras × expediente), hora a hora, para o card do Início e o mapa
   * da semana. Conta só até hoje: o futuro ainda não aconteceu.
   */
  async ocupacaoDaUnidade(unidadeId: string, de: string, ate: string): Promise<OcupacaoDaUnidade> {
    escopoUnidades(unidadeId, GESTAO);
    return this.banco.daConta(async (tx) => {
      const unidade = await tx.unidade.findUnique({ where: { id: unidadeId } });
      if (!unidade) throw Erros.naoEncontrado('Unidade não encontrada.');
      const { mapa, fim } = await this.mapaDaUnidade(tx, unidade, de, ate);
      return { ...mapa, de, ate: fim < de ? ate : fim, capacidade: unidade.capacidade };
    });
  }

  /**
   * Ocupação somada das unidades do filtro (uma, as permitidas ou a rede), contada até hoje:
   * minutos marcados ÷ minutos disponíveis. null quando não houve expediente no período.
   */
  async ocupacaoDoPeriodo(
    tx: Transacao,
    filtro: Record<string, unknown>,
    de: string,
    ate: string,
  ): Promise<number | null> {
    const alvo = filtro.unidadeId;
    const unidades = await tx.unidade.findMany({
      where: {
        ativa: true,
        ...(typeof alvo === 'string' ? { id: alvo } : alvo ? { id: alvo as object } : {}),
      },
      select: { id: true, capacidade: true },
    });
    let disponivel = 0;
    let marcado = 0;
    for (const u of unidades) {
      const { mapa } = await this.mapaDaUnidade(tx, u, de, ate);
      disponivel += mapa.total.disponivelMin;
      marcado += mapa.total.agendadoMin;
    }
    return disponivel > 0 ? marcado / disponivel : null;
  }

  /** Mapa de ocupação de uma unidade, contado até hoje. */
  private async mapaDaUnidade(
    tx: Transacao,
    unidade: { id: string; capacidade: number },
    de: string,
    ate: string,
  ) {
    const hoje = dataLocal(new Date());
    const fim = ate < hoje ? ate : hoje;
    const profs =
      fim < de
        ? []
        : await tx.profissional.findMany({
            where: { unidadeId: unidade.id, ativo: true },
            include: { horarios: true },
          });
    const insumos = profs.length ? await this.insumosDeOcupacao(tx, profs, de, fim) : [];
    const mapa = mapaDeOcupacao({
      dias: insumos[0]?.dias ?? [],
      capacidade: unidade.capacidade,
      profissionais: insumos,
    });
    return { mapa, fim };
  }

  /**
   * Painel da rede: cada unidade com faturamento, lucro, ticket, ocupação, nota e retorno,
   * mais o total (com as despesas da conta, sem unidade, só no lucro da rede).
   */
  async painelDaRede(de: string, ate: string): Promise<PainelDaRede> {
    const { filtro, incluiConta } = escopoUnidades(undefined, GESTAO);
    return this.banco.daConta(async (tx) => {
      const unidades = await tx.unidade.findMany({
        where: { ativa: true, ...(filtro.unidadeId ? { id: filtro.unidadeId as object } : {}) },
        orderBy: { criadoEm: 'asc' },
      });
      const hoje = dataLocal(new Date());
      const competencia = {
        gte: data(`${de.slice(0, 7)}-01`),
        lte: data(`${ate.slice(0, 7)}-01`),
      };
      const linhas: LinhaDaRede[] = [];
      for (const u of unidades) {
        const fechadas = await tx.comanda.findMany({
          where: { unidadeId: u.id, status: 'fechada', fechadaEm: noPeriodo(de, ate) },
          include: { itens: true },
        });
        const despesas = await tx.despesa.findMany({
          where: { unidadeId: u.id, competencia },
          include: { categoria: true },
        });
        const ind = calcularIndicadores(
          fechadas,
          despesas.map((d) => ({ grupo: d.categoria.grupo, valor: d.valor })),
        );
        const { mapa } = await this.mapaDaUnidade(tx, u, de, ate);
        const notas = await tx.avaliacao.findMany({
          where: { unidadeId: u.id, status: 'respondida', respondidaEm: noPeriodo(de, ate) },
          select: { notaBarbearia: true },
        });
        const resumoNotas = resumirNotas(notas.map((n) => n.notaBarbearia));
        const fimVisitas = ate > hoje ? ate : hoje;
        const visitas = await tx.comanda.findMany({
          where: {
            unidadeId: u.id,
            status: 'fechada',
            clienteId: { not: null },
            fechadaEm: noPeriodo(somarDias(fimVisitas, -HISTORICO_DIAS), fimVisitas),
          },
          select: { clienteId: true, fechadaEm: true },
        });
        const clientes = analisarClientes(
          visitas.map((v) => ({ clienteId: v.clienteId!, data: dataLocal(v.fechadaEm!) })),
          { de, ate, hoje },
        ).resumo;
        linhas.push({
          unidadeId: u.id,
          unidade: u.nome,
          faturamento: ind.faturamento,
          lucro: ind.lucro,
          clientes: ind.clientes,
          ticketMedio: ind.ticketMedio,
          ocupacao: mapa.total,
          nota: { media: resumoNotas.media, respostas: resumoNotas.respostas },
          retorno: {
            atendidos: clientes.atendidos,
            voltaramNoPrazo: clientes.voltaramNoPrazo,
            taxa: clientes.taxaRetorno,
          },
        });
      }
      // Despesas da conta (sem unidade): só o dono vê a rede inteira, então só ele as soma.
      const daConta = incluiConta
        ? await tx.despesa.findMany({
            where: { unidadeId: null, competencia },
            include: { categoria: true },
          })
        : [];
      const despesasDaConta = calcularIndicadores(
        [],
        daConta.map((d) => ({ grupo: d.categoria.grupo, valor: d.valor })),
      ).despesasOperacionais;
      return {
        de,
        ate,
        unidades: linhas,
        rede: totalDaRede(linhas, despesasDaConta),
        destaques: destaquesDaRede(linhas),
      };
    });
  }

  /** Ranking da equipe no período: dono vê a rede, gestor a unidade dele. */
  async ranking(
    unidadeId: string | undefined,
    de: string,
    ate: string,
  ): Promise<LinhaRankingEquipe[]> {
    const { filtro } = escopoUnidades(unidadeId, GESTAO);
    return this.banco.daConta(async (tx) => {
      const profs = await tx.profissional.findMany({
        where: filtro,
        include: { usuario: { select: { nome: true } }, horarios: true },
        orderBy: { usuario: { nome: 'asc' } },
      });
      const ids = profs.map((p) => p.id);
      const fechadas = await fechadasDetalhadas(tx, de, ate, { profissionalId: { in: ids } });
      const visitas = await this.visitas(tx, ids, ate);
      const ocupacoes = await this.ocupacoes(tx, profs, de, ate);
      const notas = await notaPorProfissional(tx, ids, de, ate);
      const hoje = dataLocal(new Date());
      return profs
        .map((p) => {
          const minhas = fechadas.filter((c) => c.profissionalId === p.id);
          const clientes = analisarClientes(visitas.get(p.id) ?? [], { de, ate, hoje });
          return {
            profissionalId: p.id,
            nome: p.usuario.nome,
            unidadeId: p.unidadeId,
            ativo: p.ativo,
            ...resumoDe(calcularIndicadores(minhas)),
            taxaRetorno: clientes.resumo.taxaRetorno,
            percentualNoPrazo: analisarRotina(minhas.map((c) => rotinaDe(c, p.usuarioId)))
              .percentualNoPrazo,
            ocupacao: ocupacoes.get(p.id)?.fracao ?? 0,
            notaMedia: notas.get(p.id) ?? null,
          };
        })
        .filter((l) => l.ativo || l.clientes > 0)
        .sort((a, b) => b.faturamento - a.faturamento);
    });
  }

  /**
   * Ficha de um profissional. Dono vê todos; gestor, os da unidade dele; quem é o próprio
   * profissional vê a sua (sem margem e sem comparação com os colegas).
   */
  async ficha(id: string, de: string, ate: string): Promise<FichaProfissional> {
    const papeis = Contexto.usuario().papeis;
    return this.banco.daConta(async (tx) => {
      const p = await tx.profissional.findUnique({
        where: { id },
        include: { usuario: { select: { nome: true } }, unidade: true, horarios: true },
      });
      if (!p) throw Erros.naoEncontrado('Profissional não encontrado.');
      const gestao = podeNaUnidade(papeis, p.unidadeId, GESTAO);
      const proprio = p.usuarioId === Contexto.usuario().id;
      if (!gestao && !proprio) throw Erros.semPermissao();
      const verMargem = podeNaUnidade(papeis, p.unidadeId, ['dono']);
      const hoje = dataLocal(new Date());

      const fechadas = await fechadasDetalhadas(tx, de, ate, { profissionalId: id });
      const indicadores = calcularIndicadores(fechadas);
      const comServico = fechadas.map((c) => ({
        itens: c.itens,
        // Recepção fechando sem confirmação não mede o tempo do atendimento.
        duracaoRealMin: c.confirmadaPorId === p.usuarioId ? duracaoReal(c) : null,
      }));
      const servicos = desempenhoPorServico(comServico);
      const produtos = produtosVendidos(comServico);
      const [catalogo, catalogoProdutos] = [
        await tx.servico.findMany({
          where: { id: { in: servicos.map((s) => s.servicoId) } },
          select: { id: true, nome: true, duracaoMin: true },
        }),
        await tx.produto.findMany({
          where: { id: { in: produtos.map((x) => x.produtoId) } },
          select: { id: true, nome: true },
        }),
      ];

      const analise = analisarClientes((await this.visitas(tx, [id], ate)).get(id) ?? [], {
        de,
        ate,
        hoje,
      });
      const lista = analise.clientes.slice(0, LIMITE_LISTA_CLIENTES);
      const sumidos = analise.sumidos.slice(0, LIMITE_SUMIDOS);
      const nomes = new Map(
        (
          await tx.cliente.findMany({
            where: { id: { in: [...lista, ...sumidos].map((c) => c.clienteId) } },
            select: { id: true, nome: true, telefone: true },
          })
        ).map((c) => [c.id, c]),
      );
      const faltas = await tx.agendamento.count({
        where: { profissionalId: id, status: 'falta', inicio: noPeriodo(de, ate) },
      });

      const periodo = noPeriodo(de, ate);
      const comandas = await tx.comanda.findMany({
        where: {
          profissionalId: id,
          OR: [
            { fechadaEm: periodo },
            { canceladaEm: periodo },
            { status: { notIn: ['fechada', 'cancelada'] }, agendamento: { inicio: periodo } },
            { status: { notIn: ['fechada', 'cancelada'] }, agendamentoId: null, criadoEm: periodo },
          ],
        },
        include: {
          cliente: { select: { nome: true } },
          agendamento: { select: { inicio: true } },
          itens: {
            include: { servico: { select: { nome: true } }, produto: { select: { nome: true } } },
          },
        },
        orderBy: { criadoEm: 'desc' },
        take: LIMITE_COMANDAS,
      });
      const reabertas = new Set(
        (
          await tx.auditoria.findMany({
            where: {
              entidade: 'comanda',
              acao: 'reabrir',
              entidadeId: { in: comandas.map((c) => c.id) },
            },
            select: { entidadeId: true },
          })
        ).map((a) => a.entidadeId),
      );

      const ocupacao = (await this.ocupacoes(tx, [p], de, ate)).get(id)!;
      const comissao = await this.comissoes.resumo(tx, p, de, ate);

      // Meta só faz sentido quando o período é exatamente um mês.
      const mes = de.slice(0, 7);
      let meta: FichaProfissional['meta'] = null;
      if (de === `${mes}-01` && ate === ultimoDiaDoMes(mes)) {
        const m = await tx.meta.findFirst({
          where: { unidadeId: p.unidadeId, mes: data(de), tipo: 'faturamento' },
        });
        if (m && m.objetivo > 0)
          meta = { objetivo: m.objetivo, fracao: indicadores.faturamento / m.objetivo };
      }

      const meses = mesesAte(ate.slice(0, 7), 6);
      const historico = await fechadasDetalhadas(tx, `${meses[0]}-01`, ultimoDiaDoMes(meses[5]!), {
        profissionalId: id,
      });
      const evolucao = meses.map((m) => {
        const i = calcularIndicadores(
          historico.filter((c) => dataLocal(c.fechadaEm!).startsWith(m)),
        );
        return {
          mes: m,
          faturamento: i.faturamento,
          clientes: i.clientes,
          ticketMedio: i.ticketMedio,
          comissao: i.comissoes,
        };
      });

      let media: FichaProfissional['media'] = null;
      if (gestao) {
        const daUnidade = await fechadasDetalhadas(tx, de, ate, { unidadeId: p.unidadeId });
        const n = new Set(daUnidade.map((c) => c.profissionalId)).size;
        if (n > 0) {
          const u = calcularIndicadores(daUnidade);
          media = {
            faturamento: Math.round(u.faturamento / n),
            clientes: Math.round(u.clientes / n),
            atendimentos: Math.round(u.atendimentos / n),
            ticketMedio: u.ticketMedio,
            percentualExtras: u.percentualExtras,
          };
        }
      }

      const nomeServico = new Map(catalogo.map((s) => [s.id, s]));
      const dataDaComanda = (c: (typeof comandas)[number]) =>
        (c.fechadaEm ?? c.canceladaEm ?? c.agendamento?.inicio ?? c.criadoEm).toISOString();
      return {
        profissional: {
          id: p.id,
          nome: p.usuario.nome,
          unidadeId: p.unidadeId,
          unidade: p.unidade.nome,
          dataEntrada: dataTexto(p.dataEntrada),
          ativo: p.ativo,
        },
        periodo: { de, ate },
        linkAgendamento:
          p.unidade.agendamentoPublico && p.unidade.slug
            ? linkDeAgendamento(this.config.appUrl, p.unidade.slug)
            : null,
        verMargem,
        resumo: resumoDe(indicadores),
        comissao: {
          previsto: comissao.previsto,
          fechado: comissao.fechado,
          pago: comissao.pago,
          aReceber: comissao.aReceber,
        },
        ocupacao,
        meta,
        servicos: servicos.map((s) => ({
          ...s,
          nome: nomeServico.get(s.servicoId)?.nome ?? 'Serviço',
          duracaoPrevistaMin: nomeServico.get(s.servicoId)?.duracaoMin ?? 0,
          custo: verMargem ? s.custo : null,
          lucro: verMargem ? s.lucro : null,
        })),
        produtos: produtos.map((x) => ({
          ...x,
          nome: catalogoProdutos.find((c) => c.id === x.produtoId)?.nome ?? 'Produto',
        })),
        clientes: {
          resumo: analise.resumo,
          lista: lista.map((c) => ({ ...c, nome: nomes.get(c.clienteId)?.nome ?? 'Cliente' })),
          sumidos: sumidos.map((c) => ({
            ...c,
            nome: nomes.get(c.clienteId)?.nome ?? 'Cliente',
            // O barbeiro nunca recebe telefone por aqui.
            telefone: gestao ? (nomes.get(c.clienteId)?.telefone ?? null) : null,
          })),
          faltas,
        },
        rotina: analisarRotina(fechadas.map((c) => rotinaDe(c, p.usuarioId))),
        comandas: comandas
          .map((c) => ({
            id: c.id,
            data: dataDaComanda(c),
            cliente: c.cliente?.nome ?? null,
            itens: c.itens.map((i) => i.servico?.nome ?? i.produto?.nome ?? i.descricao ?? 'Item'),
            total: c.totalLiquido,
            status: c.status,
            reaberta: reabertas.has(c.id),
          }))
          .sort((a, b) => b.data.localeCompare(a.data)),
        evolucao,
        media,
        avaliacoes: await avaliacoesDoProfissional(tx, id, de, ate),
      };
    });
  }
}
