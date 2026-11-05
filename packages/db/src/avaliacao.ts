// Pesquisa depois do atendimento: criada no fechamento da comanda, enviada pelo worker uma
// hora depois e respondida pela conversa do bot (packages/shared/src/bot.ts).
import {
  PESQUISA_ATRASO_MIN,
  PESQUISA_INTERVALO_DIAS,
  PESQUISA_VALIDADE_HORAS,
  preencher,
  variantesTelefone,
  type RespostaPesquisa,
  type SessaoBot,
} from '@pente-fino/shared';
import { json, mensagensDoBot } from './bot.js';
import type { Prisma, PrismaClient } from './generated/prisma/client.js';
import { naConta } from './index.js';

type Tx = Prisma.TransactionClient;

const primeiroNome = (nome: string | null | undefined) => nome?.trim().split(/\s+/)[0] ?? null;

/**
 * No fechamento: agenda a pesquisa se a conta usa, o cliente aceitou avisos e já conversou
 * com o WhatsApp da unidade (proteção do número), sem pesquisa nos últimos 7 dias.
 * Devolve o id e quando sair, ou null quando não cabe pesquisa.
 */
export async function agendarPesquisa(
  tx: Tx,
  comandaId: string,
  agora = new Date(),
): Promise<{ avaliacaoId: string; enviarEm: Date } | null> {
  const conta = await tx.conta.findFirst({ select: { pesquisaPosAtendimento: true } });
  if (!conta?.pesquisaPosAtendimento) return null;
  const c = await tx.comanda.findUnique({ where: { id: comandaId }, include: { cliente: true } });
  const cliente = c?.cliente;
  if (!c || !c.profissionalId || !cliente?.telefone || !cliente.consentimentoMsg) return null;
  if (await tx.avaliacao.findUnique({ where: { comandaId }, select: { id: true } })) return null;
  const desde = new Date(agora.getTime() - PESQUISA_INTERVALO_DIAS * 86_400_000);
  const recente = await tx.avaliacao.findFirst({
    where: { clienteId: cliente.id, criadoEm: { gte: desde } },
    select: { id: true },
  });
  if (recente) return null;
  const conversa = await tx.mensagem.findFirst({
    where: {
      unidadeId: c.unidadeId,
      telefone: { in: variantesTelefone(cliente.telefone) },
      direcao: 'entrada',
    },
    orderBy: { criadoEm: 'desc' },
    select: { telefone: true },
  });
  if (!conversa) return null;
  const enviarEm = new Date(agora.getTime() + PESQUISA_ATRASO_MIN * 60_000);
  const a = await tx.avaliacao.create({
    data: {
      unidadeId: c.unidadeId,
      comandaId,
      profissionalId: c.profissionalId,
      clienteId: cliente.id,
      telefone: conversa.telefone,
      enviarEm,
      expiraEm: new Date(enviarEm.getTime() + PESQUISA_VALIDADE_HORAS * 3_600_000),
    },
    select: { id: true },
  });
  return { avaliacaoId: a.id, enviarEm };
}

export type InicioPesquisa =
  | { tipo: 'enviar'; contaId: string; instancia: string; mensagemIds: string[] }
  | { tipo: 'pular'; motivo: string };

/**
 * Na hora marcada (worker): confere de novo se pode e manda a primeira pergunta, deixando a
 * sessão do número na pesquisa. Quando não pode, cancela com o motivo e não insiste.
 */
export async function iniciarPesquisa(
  prisma: PrismaClient,
  contaId: string,
  avaliacaoId: string,
  agora = new Date(),
): Promise<InicioPesquisa> {
  return naConta(prisma, contaId, async (tx) => {
    const a = await tx.avaliacao.findUnique({
      where: { id: avaliacaoId },
      include: {
        comanda: { select: { status: true } },
        cliente: true,
        profissional: { include: { usuario: { select: { nome: true } } } },
        unidade: { include: { botConexao: true } },
      },
    });
    if (!a || a.status !== 'agendada') return { tipo: 'pular', motivo: 'já tratada' } as const;
    const cancelar = async (motivo: string) => {
      await tx.avaliacao.update({ where: { id: a.id }, data: { status: 'cancelada', motivo } });
      return { tipo: 'pular', motivo } as const;
    };
    if (a.comanda.status !== 'fechada') return cancelar('comanda reaberta ou cancelada');
    if (!a.cliente.consentimentoMsg) return cancelar('cliente não quer receber mensagens');
    if (agora >= a.expiraEm) return cancelar('passou do prazo');
    const conexao = a.unidade.botConexao;
    if (conexao?.status !== 'conectado') return cancelar('WhatsApp da unidade desconectado');

    const chave = { unidadeId: a.unidadeId, telefone: a.telefone };
    const atual = await tx.botSessao.findUnique({ where: { unidadeId_telefone: chave } });
    const anterior = (atual?.sessao ?? null) as Partial<SessaoBot> | null;
    // Conversando com a equipe agora: não interrompe com pesquisa.
    if (anterior?.comAtendente) return cancelar('cliente em atendimento pela equipe');
    const sessao: SessaoBot = {
      caminho: [],
      ultimaEm: anterior?.ultimaEm ?? agora.toISOString(),
      comAtendente: false,
      erros: 0,
      pesquisa: { avaliacaoId: a.id, passo: 'atendimento' },
    };
    await tx.botSessao.upsert({
      where: { unidadeId_telefone: chave },
      create: { ...chave, clienteId: a.clienteId, sessao: json(sessao) },
      update: { clienteId: a.clienteId, sessao: json(sessao) },
    });

    const conta = await tx.conta.findFirst({ select: { nome: true } });
    const texto = preencher((await mensagensDoBot(tx)).pesquisa_atendimento, {
      cliente: primeiroNome(a.cliente.nome),
      barbearia: conta?.nome ?? a.unidade.nome,
      unidade: a.unidade.nome,
      profissional: primeiroNome(a.profissional.usuario.nome),
    });
    const m = await tx.mensagem.create({
      data: {
        ...chave,
        clienteId: a.clienteId,
        direcao: 'saida',
        texto,
        status: 'pendente',
      },
      select: { id: true },
    });
    await tx.avaliacao.update({
      where: { id: a.id },
      data: { status: 'enviada', enviadaEm: agora },
    });
    return { tipo: 'enviar', contaId, instancia: conexao.instancia, mensagemIds: [m.id] } as const;
  });
}

/** A sessão salva só segue na pesquisa se ela ainda vale (enviada ou respondida, no prazo). */
export async function pesquisaValida(
  tx: Tx,
  sessao: SessaoBot | null,
  agora: Date,
): Promise<SessaoBot | null> {
  if (!sessao?.pesquisa) return sessao;
  const a = await tx.avaliacao.findUnique({
    where: { id: sessao.pesquisa.avaliacaoId },
    select: { status: true, expiraEm: true },
  });
  const vale = a && (a.status === 'enviada' || a.status === 'respondida') && agora < a.expiraEm;
  if (vale) return sessao;
  const resto = { ...sessao };
  delete resto.pesquisa;
  return resto;
}

/** Grava o que o cliente respondeu na pesquisa. A nota do atendimento já conta como respondida. */
export async function gravarRespostaPesquisa(
  tx: Tx,
  r: RespostaPesquisa,
  agora: Date,
): Promise<void> {
  const data: Prisma.AvaliacaoUpdateManyMutationInput = {};
  if (r.notaAtendimento !== undefined) {
    data.notaAtendimento = r.notaAtendimento;
    data.status = 'respondida';
    data.respondidaEm = agora;
  }
  if (r.notaBarbearia !== undefined) data.notaBarbearia = r.notaBarbearia;
  if (r.comentario !== undefined) data.comentario = r.comentario;
  if (Object.keys(data).length === 0) return;
  await tx.avaliacao.updateMany({
    where: { id: r.avaliacaoId, status: { in: ['enviada', 'respondida'] } },
    data,
  });
}
