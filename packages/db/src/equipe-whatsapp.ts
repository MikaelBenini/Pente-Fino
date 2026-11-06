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
  rotuloDoDia,
  TEXTO_AJUDA_EQUIPE,
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
      'Avisos desligados. Você ainda pode perguntar AGENDA, AMANHÃ e COMISSÃO. Para voltar a receber, responda LIGAR.',
    ];
  }
  if (comando?.tipo === 'ligar') {
    await tx.assistenteEquipe.update({ where: { id: a.id }, data: { ativo: true } });
    return ['Avisos ligados de novo. ✅'];
  }

  const prof = await tx.profissional.findFirst({
    where: { usuarioId: a.usuarioId, unidadeId: a.unidadeId },
  });
  if (!prof) return ['Você não está mais na agenda desta unidade. Fale com o dono da barbearia.'];
  const hoje = dataLocal(d.agora);

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
  return [TEXTO_AJUDA_EQUIPE];
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
  const prof = await tx.profissional.findFirst({
    where: { usuarioId: a.usuarioId, unidadeId: a.unidadeId },
    include: { horarios: true },
  });
  if (!prof) return [];
  return (['agenda', 'resumo'] as const).flatMap((rotina) => {
    const p = proximaRotina(prof.horarios, rotina, agora);
    return p ? [rotinaAgendada(contaId, assistenteId, rotina, p, agora)] : [];
  });
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
    const prof = await tx.profissional.findFirst({
      where: { usuarioId: a.usuarioId, unidadeId: a.unidadeId, ativo: true },
      include: { horarios: true },
    });
    if (!prof) return { aviso: null, proxima: null };
    const p = proximaRotina(prof.horarios, job.rotina, new Date(agora.getTime() + 60_000));
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

    const instancia = await podeMandar(
      tx,
      a,
      job.rotina === 'agenda' ? 'agendaDoDia' : 'resumoDoDia',
      agora,
    );
    if (!instancia) return { aviso: null, proxima };
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
