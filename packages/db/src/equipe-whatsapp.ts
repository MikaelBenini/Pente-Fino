// Assistente da equipe no WhatsApp (Etapa 11): ativação pelo código, perguntas do
// profissional e avisos da agenda dele. O número da equipe nunca vira cliente.
import { createHash } from 'node:crypto';
import {
  dataLocal,
  diaDaSemana,
  formatarHora,
  LIMITE_AVISOS_EQUIPE_DIA,
  lerAvisosEquipe,
  lerComandoEquipe,
  podeAvisarAgora,
  proximaRotina,
  calcularIndicadores,
  NOTA_BAIXA_ATE,
  rotuloDoDia,
  TEXTO_AJUDA_EQUIPE,
  textoAjudaEquipe,
  textoFaltaGestao,
  textoNotaBaixa,
  textoResumoGestao,
  type NotaBaixaParaGestao,
  type ResumoUnidade,
  textoAgendaEquipe,
  textoAvisoEquipe,
  textoComissaoEquipe,
  textoProximoCliente,
  textoResumoDoDia,
  variantesTelefone,
  type MudancaNaAgenda,
  type ProximoClienteDaEquipe,
  type RotinaDaEquipe,
  type RotinaEquipe,
  diasDeTrabalho as diasDeTrabalhoDoMes,
  projetar,
} from '@pente-fino/shared';
import type { Prisma, PrismaClient } from './generated/prisma/client.js';
import { naConta } from './index.js';

type Tx = Prisma.TransactionClient;

export const hashCodigoAssistente = (codigo: string) =>
  createHash('sha256').update(`assistente:${codigo}`).digest('hex');

const primeiroNome = (n: string | null | undefined) => n?.trim().split(/\s+/)[0] ?? 'Cliente';
const inicioDoDia = (dia: string) => new Date(`${dia}T00:00:00-03:00`);
const somarDias = (dia: string, n: number) => {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** Minutos desde 00:00 em São Paulo (-03:00 fixo). */
const minutoLocal = (d: Date) => {
  const l = new Date(d.getTime() - 3 * 3_600_000);
  return l.getUTCHours() * 60 + l.getUTCMinutes();
};

async function agendaDoDia(tx: Tx, profissionalId: string, dia: string) {
  const ags = await tx.agendamento.findMany({
    where: {
      profissionalId,
      inicio: { gte: inicioDoDia(dia), lt: inicioDoDia(somarDias(dia, 1)) },
      status: { in: ['agendado', 'confirmado', 'atendido'] },
    },
    orderBy: { inicio: 'asc' },
    include: {
      cliente: { select: { nome: true } },
      comanda: { include: { itens: { include: { servico: { select: { nome: true } } } } } },
    },
  });
  return ags.map((a) => ({
    inicio: a.inicio.toISOString(),
    cliente: primeiroNome(a.cliente?.nome),
    servicos: (a.comanda?.itens ?? []).map((i) => i.servico?.nome ?? 'Serviço'),
    confirmado: a.status === 'confirmado',
  }));
}

/**
 * Mensagem de alguém da equipe? "ATIVAR 123456" com um código válido liga o número; um número
 * já confirmado recebe as respostas do assistente. Devolve null quando é cliente (segue o bot).
 */
export async function atenderEquipe(
  tx: Tx,
  d: { unidadeId: string; telefone: string; texto: string; agora: Date },
): Promise<{ respostas: string[]; ativado?: string } | null> {
  const r = await responderEquipe(tx, d);
  return r && (Array.isArray(r) ? { respostas: r } : r);
}

async function responderEquipe(
  tx: Tx,
  d: { unidadeId: string; telefone: string; texto: string; agora: Date },
): Promise<string[] | { respostas: string[]; ativado: string } | null> {
  const comando = lerComandoEquipe(d.texto);

  if (comando?.tipo === 'ativar') {
    const a = await tx.assistenteEquipe.findFirst({
      where: {
        unidadeId: d.unidadeId,
        codigoHash: hashCodigoAssistente(comando.codigo),
        codigoExpiraEm: { gt: d.agora },
      },
      include: { usuario: { select: { nome: true } } },
    });
    if (!a) return null; // código que não é de ninguém: segue como cliente
    // O número só pode estar ligado a uma pessoa da unidade.
    await tx.assistenteEquipe.updateMany({
      where: {
        unidadeId: d.unidadeId,
        telefone: { in: variantesTelefone(d.telefone) },
        id: { not: a.id },
      },
      data: { telefone: null, confirmadoEm: null, ativo: false },
    });
    await tx.assistenteEquipe.update({
      where: { id: a.id },
      data: {
        telefone: d.telefone,
        confirmadoEm: d.agora,
        ativo: true,
        codigoHash: null,
        codigoExpiraEm: null,
      },
    });
    return {
      ativado: a.id,
      respostas: [
        `Pronto, ${primeiroNome(a.usuario.nome)}! Seu número está ligado ao assistente da equipe. Você vai receber os avisos da sua agenda por aqui.`,
        TEXTO_AJUDA_EQUIPE,
      ],
    };
  }

  const a = await tx.assistenteEquipe.findFirst({
    where: {
      unidadeId: d.unidadeId,
      telefone: { in: variantesTelefone(d.telefone) },
      confirmadoEm: { not: null },
    },
  });
  if (!a) return null;

  if (comando?.tipo === 'parar') {
    await tx.assistenteEquipe.update({ where: { id: a.id }, data: { ativo: false } });
    return [
      'Avisos desligados. Você ainda pode fazer perguntas (responda AJUDA). Para voltar a receber, responda LIGAR.',
    ];
  }
  if (comando?.tipo === 'ligar') {
    await tx.assistenteEquipe.update({ where: { id: a.id }, data: { ativo: true } });
    return ['Avisos ligados de novo. ✅'];
  }

  const prof = await tx.profissional.findFirst({
    where: { usuarioId: a.usuarioId, unidadeId: a.unidadeId, ativo: true },
  });
  const gestao = (await unidadesQueGere(tx, a.usuarioId)).length > 0;
  const quem = { profissional: !!prof, gestao };
  const hoje = dataLocal(d.agora);
  if (comando?.tipo === 'resumo' && gestao)
    return [
      (await textoDoResumoGestao(tx, a.usuarioId, hoje, 'Hoje até agora')) ??
        'Nenhuma unidade ativa.',
    ];
  if (!prof) {
    if (!gestao)
      return ['Você não está mais na agenda desta unidade. Fale com o dono da barbearia.'];
    return [textoAjudaEquipe(quem)];
  }

  if (comando?.tipo === 'agenda' || comando?.tipo === 'amanha') {
    const dia = comando.tipo === 'agenda' ? hoje : somarDias(hoje, 1);
    return [textoAgendaEquipe(rotuloDoDia(dia, hoje), await agendaDoDia(tx, prof.id, dia))];
  }
  if (comando?.tipo === 'comissao') {
    const mes = hoje.slice(0, 7);
    const itens = await tx.itemComanda.findMany({
      where: {
        profissionalId: prof.id,
        comanda: {
          status: 'fechada',
          fechadaEm: {
            gte: inicioDoDia(`${mes}-01`),
            lt: inicioDoDia(`${somarDias(`${mes}-28`, 4).slice(0, 7)}-01`),
          },
        },
      },
      select: { comissaoValor: true, comandaId: true },
    });
    const nome = new Date(`${mes}-15T12:00:00Z`).toLocaleDateString('pt-BR', {
      month: 'long',
      timeZone: 'UTC',
    });
    return [
      textoComissaoEquipe(
        nome,
        itens.reduce((s, i) => s + i.comissaoValor, 0),
        new Set(itens.map((i) => i.comandaId)).size,
      ),
    ];
  }
  return [textoAjudaEquipe(quem)];
}

export type AvisoParaEquipe = { contaId: string; instancia: string; mensagemIds: string[] } | null;

/**
 * Horário novo, remarcado ou cancelado na agenda de alguém que ligou o assistente: grava o
 * aviso para enviar. Só perto do expediente dele, com o aviso ligado, WhatsApp conectado e
 * dentro do limite do dia. Devolve o que pôr na fila (ou null).
 */
export async function avisarEquipeSobreHorario(
  tx: Tx,
  agendamentoId: string,
  tipo: MudancaNaAgenda,
  agora = new Date(),
): Promise<AvisoParaEquipe> {
  const ag = await tx.agendamento.findUnique({
    where: { id: agendamentoId },
    include: {
      cliente: { select: { nome: true } },
      profissional: { include: { horarios: true } },
      unidade: { include: { botConexao: true } },
      comanda: { include: { itens: { include: { servico: { select: { nome: true } } } } } },
    },
  });
  if (!ag) return null;
  const a = await tx.assistenteEquipe.findFirst({
    where: {
      usuarioId: ag.profissional.usuarioId,
      unidadeId: ag.unidadeId,
      ativo: true,
      confirmadoEm: { not: null },
    },
  });
  if (!a?.telefone) return null;
  const avisos = lerAvisosEquipe(a.avisos);
  if (tipo === 'novo' ? !avisos.horarioNovo : !avisos.mudancas) return null;
  const conexao = ag.unidade.botConexao;
  if (conexao?.status !== 'conectado') return null;

  const hoje = dataLocal(agora);
  const turnos = ag.profissional.horarios.filter((h) => h.diaSemana === diaDaSemana(hoje));
  if (!podeAvisarAgora(turnos, minutoLocal(agora))) return null;
  const enviadasHoje = await tx.mensagem.count({
    where: {
      unidadeId: ag.unidadeId,
      telefone: a.telefone,
      direcao: 'saida',
      criadoEm: { gte: inicioDoDia(hoje) },
    },
  });
  if (enviadasHoje >= LIMITE_AVISOS_EQUIPE_DIA) return null;

  const texto = textoAvisoEquipe(tipo, {
    quando: `${rotuloDoDia(dataLocal(ag.inicio), hoje)}, ${formatarHora(ag.inicio)}`,
    cliente: primeiroNome(ag.cliente?.nome),
    servicos: (ag.comanda?.itens ?? []).map((i) => i.servico?.nome ?? 'Serviço'),
  });
  const m = await tx.mensagem.create({
    data: {
      unidadeId: ag.unidadeId,
      telefone: a.telefone,
      direcao: 'saida',
      texto,
      status: 'pendente',
    },
    select: { id: true },
  });
  return { contaId: a.contaId, instancia: conexao.instancia, mensagemIds: [m.id] };
}

// ─── Avisos com hora marcada ──────────────────────────────────────────────

/** Um trabalho atrasado para a fila `whatsapp-entrada`. */
export interface TrabalhoAgendado<T> {
  dados: T;
  atrasoMs: number;
  jobId: string;
}

/** Assistente ligado e com o aviso escolhido, WhatsApp conectado e dentro do limite do dia. */
async function podeMandar(
  tx: Tx,
  a: { unidadeId: string; telefone: string | null; ativo: boolean; avisos: unknown },
  aviso: keyof ReturnType<typeof lerAvisosEquipe>,
  agora: Date,
) {
  if (!a.ativo || !a.telefone || !lerAvisosEquipe(a.avisos)[aviso]) return null;
  const conexao = await tx.botConexao.findUnique({ where: { unidadeId: a.unidadeId } });
  if (conexao?.status !== 'conectado') return null;
  const enviadasHoje = await tx.mensagem.count({
    where: {
      unidadeId: a.unidadeId,
      telefone: a.telefone,
      direcao: 'saida',
      criadoEm: { gte: inicioDoDia(dataLocal(agora)) },
    },
  });
  return enviadasHoje >= LIMITE_AVISOS_EQUIPE_DIA ? null : conexao.instancia;
}

async function gravarAviso(tx: Tx, a: { unidadeId: string; telefone: string }, texto: string) {
  const m = await tx.mensagem.create({
    data: {
      unidadeId: a.unidadeId,
      telefone: a.telefone,
      direcao: 'saida',
      texto,
      status: 'pendente',
    },
    select: { id: true },
  });
  return m.id;
}

/** Na hora do "próximo cliente": o horário é o mesmo, segue marcado e o profissional quer o aviso. */
export async function avisarProximoCliente(
  prisma: PrismaClient,
  job: Omit<ProximoClienteDaEquipe, 'tipo'>,
  agora = new Date(),
): Promise<AvisoParaEquipe> {
  return naConta(prisma, job.contaId, async (tx) => {
    const ag = await tx.agendamento.findUnique({
      where: { id: job.agendamentoId },
      include: {
        cliente: { select: { id: true, nome: true } },
        profissional: true,
        comanda: { include: { itens: { include: { servico: { select: { nome: true } } } } } },
      },
    });
    if (!ag || ag.inicio.toISOString() !== job.inicio) return null;
    if (!['agendado', 'confirmado'].includes(ag.status) || ag.inicio <= agora) return null;
    const a = await tx.assistenteEquipe.findFirst({
      where: {
        usuarioId: ag.profissional.usuarioId,
        unidadeId: ag.unidadeId,
        confirmadoEm: { not: null },
      },
    });
    if (!a) return null;
    const instancia = await podeMandar(tx, a, 'proximoCliente', agora);
    if (!instancia) return null;
    // Primeira vez: nenhuma comanda fechada antes com este cliente na conta.
    const antes = ag.cliente
      ? await tx.comanda.count({
          where: { clienteId: ag.cliente.id, status: 'fechada', fechadaEm: { lt: ag.inicio } },
        })
      : 0;
    const id = await gravarAviso(
      tx,
      { unidadeId: a.unidadeId, telefone: a.telefone! },
      textoProximoCliente({
        inicio: ag.inicio.toISOString(),
        cliente: primeiroNome(ag.cliente?.nome),
        servicos: (ag.comanda?.itens ?? []).map((i) => i.servico?.nome ?? 'Serviço'),
        primeiraVez: !!ag.cliente && antes === 0,
      }),
    );
    return { contaId: job.contaId, instancia, mensagemIds: [id] };
  });
}

/** As primeiras agenda e resumo depois de ligar o assistente. */
export async function primeirasRotinas(
  tx: Tx,
  contaId: string,
  assistenteId: string,
  agora = new Date(),
): Promise<TrabalhoAgendado<RotinaDaEquipe>[]> {
  const a = await tx.assistenteEquipe.findUnique({ where: { id: assistenteId } });
  if (!a) return [];
  const trabalhos: TrabalhoAgendado<RotinaDaEquipe>[] = [];
  for (const rotina of ['agenda', 'resumo', 'gestao'] as const) {
    const turnos = await turnosDaRotina(tx, a, rotina);
    const p = turnos && proximaRotina(turnos, rotina, agora);
    if (p) trabalhos.push(rotinaAgendada(contaId, assistenteId, rotina, p, agora));
  }
  return trabalhos;
}

/**
 * Expediente que marca a hora da rotina: o do profissional (agenda e resumo) ou o da unidade
 * do número, juntando os turnos de todos (gestão, só dono e gestor). null = não é para ele.
 */
async function turnosDaRotina(
  tx: Tx,
  a: { usuarioId: string; unidadeId: string },
  rotina: RotinaEquipe,
) {
  if (rotina === 'gestao') {
    if ((await unidadesQueGere(tx, a.usuarioId)).length === 0) return null;
    return tx.horarioProfissional.findMany({
      where: { profissional: { unidadeId: a.unidadeId, ativo: true } },
    });
  }
  const prof = await tx.profissional.findFirst({
    where: { usuarioId: a.usuarioId, unidadeId: a.unidadeId, ativo: true },
    include: { horarios: true },
  });
  return prof?.horarios ?? null;
}

const rotinaAgendada = (
  contaId: string,
  assistenteId: string,
  rotina: RotinaEquipe,
  p: { dia: string; quando: Date },
  agora: Date,
): TrabalhoAgendado<RotinaDaEquipe> => ({
  dados: { tipo: 'rotina_equipe', contaId, assistenteId, rotina, dia: p.dia },
  atrasoMs: p.quando.getTime() - agora.getTime(),
  jobId: `rotina_${assistenteId}_${rotina}_${p.dia}`,
});

/**
 * Agenda do dia ou resumo: manda (se o profissional quer e o assistente está ligado) e devolve
 * a próxima da mesma rotina. Desligado no Perfil (sem número confirmado), a sequência acaba.
 */
export async function rodarRotinaEquipe(
  prisma: PrismaClient,
  job: Omit<RotinaDaEquipe, 'tipo'>,
  agora = new Date(),
): Promise<{ aviso: AvisoParaEquipe; proxima: TrabalhoAgendado<RotinaDaEquipe> | null }> {
  return naConta(prisma, job.contaId, async (tx) => {
    const a = await tx.assistenteEquipe.findUnique({ where: { id: job.assistenteId } });
    if (!a?.confirmadoEm || !a.telefone) return { aviso: null, proxima: null };
    const turnos = await turnosDaRotina(tx, a, job.rotina);
    if (!turnos) return { aviso: null, proxima: null };
    const p = proximaRotina(turnos, job.rotina, new Date(agora.getTime() + 60_000));
    const hoje = dataLocal(agora);
    // Sem expediente nos próximos 14 dias: confere de novo em 7 (sem mandar nada nesse dia).
    const proxima = rotinaAgendada(
      job.contaId,
      job.assistenteId,
      job.rotina,
      p ?? {
        dia: `espera-${somarDias(hoje, 7)}`,
        quando: new Date(agora.getTime() + 7 * 86_400_000),
      },
      agora,
    );
    // Worker parado e trabalho atrasado: não manda a agenda de outro dia.
    if (job.dia !== hoje) return { aviso: null, proxima };

    const aviso = (
      { agenda: 'agendaDoDia', resumo: 'resumoDoDia', gestao: 'resumoGestao' } as const
    )[job.rotina];
    const instancia = await podeMandar(tx, a, aviso, agora);
    if (!instancia) return { aviso: null, proxima };
    if (job.rotina === 'gestao') {
      const texto = await textoDoResumoGestao(tx, a.usuarioId, hoje, 'Resumo de hoje');
      if (!texto) return { aviso: null, proxima };
      const id = await gravarAviso(tx, { unidadeId: a.unidadeId, telefone: a.telefone }, texto);
      return { aviso: { contaId: job.contaId, instancia, mensagemIds: [id] }, proxima };
    }
    const prof = await tx.profissional.findFirstOrThrow({
      where: { usuarioId: a.usuarioId, unidadeId: a.unidadeId, ativo: true },
    });
    let texto: string;
    if (job.rotina === 'agenda') {
      const horarios = await agendaDoDia(tx, prof.id, hoje);
      if (horarios.length === 0) return { aviso: null, proxima }; // dia vazio: não incomoda
      texto = `Bom dia! ☀️\n${textoAgendaEquipe(rotuloDoDia(hoje, hoje), horarios)}`;
    } else {
      const doDia = { gte: inicioDoDia(hoje), lt: inicioDoDia(somarDias(hoje, 1)) };
      const fechadas = await tx.comanda.findMany({
        where: { profissionalId: prof.id, status: 'fechada', fechadaEm: doDia },
        include: { itens: { select: { comissaoValor: true, profissionalId: true } } },
      });
      const faltas = await tx.agendamento.count({
        where: { profissionalId: prof.id, status: 'falta', inicio: doDia },
      });
      const amanha = (await agendaDoDia(tx, prof.id, somarDias(hoje, 1))).length;
      texto = textoResumoDoDia({
        atendidos: fechadas.length,
        comissao: fechadas
          .flatMap((c) => c.itens)
          .filter((i) => i.profissionalId === prof.id)
          .reduce((s, i) => s + i.comissaoValor, 0),
        faltas,
        amanha,
      });
    }
    const id = await gravarAviso(tx, { unidadeId: a.unidadeId, telefone: a.telefone }, texto);
    return { aviso: { contaId: job.contaId, instancia, mensagemIds: [id] }, proxima };
  });
}

// ─── Gestão: dono e gestor ────────────────────────────────────────────────

/** Unidades ativas que a pessoa gere (dono em todas; gestor nas dele, ou em todas sem unidade). */
export async function unidadesQueGere(tx: Tx, usuarioId: string): Promise<string[]> {
  const papeis = await tx.papelUsuario.findMany({
    where: { usuarioId, papel: { in: ['dono', 'gestor'] }, usuario: { ativo: true } },
  });
  if (papeis.length === 0) return [];
  const todas = papeis.some((p) => p.papel === 'dono' || p.unidadeId === null);
  const unidades = await tx.unidade.findMany({
    where: {
      ativa: true,
      ...(todas ? {} : { id: { in: papeis.map((p) => p.unidadeId!) } }),
    },
    orderBy: { criadoEm: 'asc' },
    select: { id: true },
  });
  return unidades.map((u) => u.id);
}

/** Como está o dia em cada unidade: faturamento e clientes (só comanda fechada), faltas, notas. */
export async function resumoGestao(
  tx: Tx,
  unidadeIds: readonly string[],
  dia: string,
): Promise<ResumoUnidade[]> {
  const doDia = { gte: inicioDoDia(dia), lt: inicioDoDia(somarDias(dia, 1)) };
  const unidades = await tx.unidade.findMany({
    where: { id: { in: [...unidadeIds] } },
    orderBy: { criadoEm: 'asc' },
    select: { id: true, nome: true, diasTrabalho: true },
  });
  const mes = dia.slice(0, 7);
  const doMes = { gte: inicioDoDia(`${mes}-01`), lt: inicioDoDia(somarDias(dia, 1)) };
  return Promise.all(
    unidades.map(async (u) => {
      const fechadas = await tx.comanda.findMany({
        where: { unidadeId: u.id, status: 'fechada', fechadaEm: doDia },
        include: { itens: true },
      });
      const ind = calcularIndicadores(fechadas);
      const [faltas, notasBaixas, abertas] = await Promise.all([
        tx.agendamento.count({ where: { unidadeId: u.id, status: 'falta', inicio: doDia } }),
        tx.avaliacao.count({
          where: {
            unidadeId: u.id,
            respondidaEm: doDia,
            OR: [
              { notaAtendimento: { lte: NOTA_BAIXA_ATE } },
              { notaBarbearia: { lte: NOTA_BAIXA_ATE } },
            ],
          },
        }),
        tx.comanda.count({
          where: {
            unidadeId: u.id,
            status: { in: ['em_atendimento', 'confirmada', 'pendente', 'reaberta'] },
          },
        }),
      ]);
      // Ritmo do mês: faturamento até hoje e a projeção pelos dias de trabalho da unidade.
      const doMesFechadas = await tx.comanda.findMany({
        where: { unidadeId: u.id, status: 'fechada', fechadaEm: doMes },
        include: { itens: true },
      });
      const excecoes = await tx.calendarioUnidade.findMany({
        where: {
          unidadeId: u.id,
          data: {
            gte: new Date(`${mes}-01T00:00:00Z`),
            lt: new Date(`${somarDias(`${mes}-01`, 32).slice(0, 7)}-01T00:00:00Z`),
          },
        },
      });
      const dias = diasDeTrabalhoDoMes(
        mes,
        u.diasTrabalho,
        excecoes.map((e) => ({ data: e.data.toISOString().slice(0, 10), trabalha: e.trabalha })),
      );
      const faturamentoMes = calcularIndicadores(doMesFechadas).faturamento;
      return {
        unidade: u.nome,
        mes: {
          faturamento: faturamentoMes,
          projecao: projetar(faturamentoMes, dias, dia).projecao,
        },
        faturamento: ind.faturamento,
        clientes: ind.clientes,
        faltas,
        notasBaixas,
        abertas,
      };
    }),
  );
}

async function textoDoResumoGestao(tx: Tx, usuarioId: string, dia: string, rotulo: string) {
  const unidades = await unidadesQueGere(tx, usuarioId);
  if (unidades.length === 0) return null;
  return textoResumoGestao(rotulo, await resumoGestao(tx, unidades, dia));
}

/**
 * Manda o mesmo aviso a cada dono e gestor da unidade que ligou o assistente e quer este aviso
 * (pelo número da unidade em que cada um ligou). Devolve o que pôr na fila.
 */
async function avisarGestao(
  tx: Tx,
  unidadeId: string,
  aviso: 'faltas' | 'notaBaixa',
  texto: string,
  agora: Date,
): Promise<NonNullable<AvisoParaEquipe>[]> {
  const assistentes = await tx.assistenteEquipe.findMany({
    where: { ativo: true, confirmadoEm: { not: null }, telefone: { not: null } },
  });
  const saidas: NonNullable<AvisoParaEquipe>[] = [];
  for (const a of assistentes) {
    if (!(await unidadesQueGere(tx, a.usuarioId)).includes(unidadeId)) continue;
    const instancia = await podeMandar(tx, a, aviso, agora);
    if (!instancia) continue;
    const id = await gravarAviso(tx, { unidadeId: a.unidadeId, telefone: a.telefone! }, texto);
    saidas.push({ contaId: a.contaId, instancia, mensagemIds: [id] });
  }
  return saidas;
}

/** Cliente marcado como falta: dono e gestor da unidade ficam sabendo. */
export async function avisarFaltaParaGestao(
  tx: Tx,
  agendamentoId: string,
  agora = new Date(),
): Promise<NonNullable<AvisoParaEquipe>[]> {
  const ag = await tx.agendamento.findUnique({
    where: { id: agendamentoId },
    include: {
      cliente: { select: { nome: true } },
      profissional: { include: { usuario: { select: { nome: true } } } },
      unidade: { select: { nome: true } },
    },
  });
  if (ag?.status !== 'falta') return [];
  return avisarGestao(
    tx,
    ag.unidadeId,
    'faltas',
    textoFaltaGestao({
      unidade: ag.unidade.nome,
      cliente: ag.cliente?.nome ?? 'Cliente sem cadastro',
      profissional: primeiroNome(ag.profissional.usuario.nome),
      inicio: ag.inicio.toISOString(),
    }),
    agora,
  );
}

/** Nota 1 ou 2 respondida agora: o trabalho a pôr na fila (já no fim da pesquisa, ou depois da espera). */
export function trabalhoNotaBaixa(
  contaId: string,
  avaliacaoId: string,
  concluida: boolean,
  esperaMs: number,
): TrabalhoAgendado<NotaBaixaParaGestao> {
  return {
    dados: { tipo: 'nota_baixa', contaId, avaliacaoId },
    atrasoMs: concluida ? 0 : esperaMs,
    jobId: `nota_baixa_${avaliacaoId}_${concluida ? 'fim' : 'espera'}`,
  };
}

/**
 * Nota baixa para dono e gestor, com o comentário e o link para falar com o cliente.
 * Sai uma vez por avaliação (`gestao_avisada_em`), seja no fim da pesquisa ou depois da espera.
 */
export async function avisarNotaBaixa(
  prisma: PrismaClient,
  job: Omit<NotaBaixaParaGestao, 'tipo'>,
  agora = new Date(),
): Promise<NonNullable<AvisoParaEquipe>[]> {
  return naConta(prisma, job.contaId, async (tx) => {
    const marcada = await tx.avaliacao.updateMany({
      where: {
        id: job.avaliacaoId,
        gestaoAvisadaEm: null,
        OR: [
          { notaAtendimento: { lte: NOTA_BAIXA_ATE } },
          { notaBarbearia: { lte: NOTA_BAIXA_ATE } },
        ],
      },
      data: { gestaoAvisadaEm: agora },
    });
    if (marcada.count === 0) return [];
    const av = await tx.avaliacao.findUniqueOrThrow({
      where: { id: job.avaliacaoId },
      include: {
        cliente: { select: { nome: true } },
        profissional: { include: { usuario: { select: { nome: true } } } },
        unidade: { select: { nome: true } },
      },
    });
    return avisarGestao(
      tx,
      av.unidadeId,
      'notaBaixa',
      textoNotaBaixa({
        unidade: av.unidade.nome,
        profissional: primeiroNome(av.profissional.usuario.nome),
        cliente: av.cliente.nome,
        notaAtendimento: av.notaAtendimento,
        notaBarbearia: av.notaBarbearia,
        comentario: av.comentario,
        link: `https://wa.me/${av.telefone.replace(/\D/g, '')}`,
      }),
      agora,
    );
  });
}
