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
  rotuloDoDia,
  TEXTO_AJUDA_EQUIPE,
  textoAgendaEquipe,
  textoAvisoEquipe,
  textoComissaoEquipe,
  variantesTelefone,
  type MudancaNaAgenda,
} from '@pente-fino/shared';
import type { Prisma } from './generated/prisma/client.js';

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
): Promise<string[] | null> {
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
    return [
      `Pronto, ${primeiroNome(a.usuario.nome)}! Seu número está ligado ao assistente da equipe. Você vai receber os avisos da sua agenda por aqui.`,
      TEXTO_AJUDA_EQUIPE,
    ];
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
