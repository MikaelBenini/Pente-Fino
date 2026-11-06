// Lembretes do horário pelo WhatsApp (Etapa 11): o worker manda na hora marcada e a resposta
// 1/2/3 confirma, remarca ou cancela.
import {
  dataLocal,
  preencher,
  rotuloDoDia,
  textoLembrete,
  variantesTelefone,
  type LembreteDeHorario,
  type SessaoBot,
} from '@pente-fino/shared';
import { regrasDaUnidade } from './agenda.js';
import { json, mensagensDoBot } from './bot.js';
import type { Prisma, PrismaClient } from './generated/prisma/client.js';
import { naConta } from './index.js';

type Tx = Prisma.TransactionClient;

export type EnvioDeLembrete =
  | { tipo: 'enviar'; contaId: string; instancia: string; mensagemIds: string[] }
  | { tipo: 'pular'; motivo: string };

/**
 * Na hora do lembrete (worker): confere de novo — o horário é o mesmo (não remarcaram), não
 * foi cancelado, o cliente aceita avisos e já conversou com a unidade, WhatsApp conectado — e
 * manda. A sessão do número fica esperando a resposta 1/2/3.
 */
export async function enviarLembrete(
  prisma: PrismaClient,
  job: Omit<LembreteDeHorario, 'tipo'>,
  agora = new Date(),
): Promise<EnvioDeLembrete> {
  return naConta(prisma, job.contaId, async (tx) => {
    const ag = await tx.agendamento.findUnique({
      where: { id: job.agendamentoId },
      include: {
        cliente: true,
        profissional: { include: { usuario: { select: { nome: true } } } },
        unidade: { include: { botConexao: true } },
        comanda: { include: { itens: { include: { servico: { select: { nome: true } } } } } },
      },
    });
    const pular = (motivo: string) => ({ tipo: 'pular', motivo }) as const;
    if (!ag) return pular('agendamento não existe');
    if (ag.inicio.toISOString() !== job.inicio) return pular('remarcado');
    if (!['agendado', 'confirmado'].includes(ag.status)) return pular('não está mais marcado');
    if (ag.inicio <= agora) return pular('já passou');
    const enviado = job.lembrete === '24h' ? ag.lembrete24hEm : ag.lembrete2hEm;
    if (enviado) return pular('já enviado');
    // Já confirmou no de 24 h: o de 2 h não pergunta de novo.
    if (job.lembrete === '2h' && ag.status === 'confirmado') return pular('já confirmado');
    const cliente = ag.cliente;
    if (!cliente?.telefone || !cliente.consentimentoMsg) return pular('cliente sem avisos');
    const conexao = ag.unidade.botConexao;
    if (conexao?.status !== 'conectado') return pular('WhatsApp desconectado');
    // Proteção do número: só para quem já escreveu para esta unidade.
    const conversa = await tx.mensagem.findFirst({
      where: {
        unidadeId: ag.unidadeId,
        telefone: { in: variantesTelefone(cliente.telefone) },
        direcao: 'entrada',
      },
      orderBy: { criadoEm: 'desc' },
      select: { telefone: true },
    });
    if (!conversa) return pular('cliente nunca escreveu');

    const conta = await tx.conta.findFirst({ select: { nome: true } });
    const barbearia = conta?.nome ?? ag.unidade.nome;
    const profissional = ag.profissional.usuario.nome.trim().split(/\s+/)[0]!;
    const mensagens = await mensagensDoBot(tx);
    const texto = textoLembrete(
      job.lembrete,
      {
        cliente: cliente.nome,
        barbearia,
        diaRotulo: rotuloDoDia(dataLocal(ag.inicio), dataLocal(agora)),
        inicio: ag.inicio.toISOString(),
        servicos: (ag.comanda?.itens ?? []).map((i) => i.servico?.nome ?? 'Serviço'),
        profissional,
        toleranciaMin: (await regrasDaUnidade(tx, ag.unidadeId)).toleranciaAtrasoMin,
      },
      // Abertura editada em Bot → Mensagens (o resto do lembrete é fixo).
      preencher(mensagens[job.lembrete === '24h' ? 'lembrete_primeiro' : 'lembrete_segundo'], {
        cliente: cliente.nome.trim().split(/\s+/)[0],
        barbearia,
        unidade: ag.unidade.nome,
        profissional,
      }),
    );
    const chave = { unidadeId: ag.unidadeId, telefone: conversa.telefone };
    const atual = await tx.botSessao.findUnique({ where: { unidadeId_telefone: chave } });
    const anterior = (atual?.sessao ?? null) as SessaoBot | null;
    const sessao: SessaoBot = {
      caminho: anterior?.caminho ?? [],
      ultimaEm: anterior?.ultimaEm ?? agora.toISOString(),
      comAtendente: anterior?.comAtendente ?? false,
      erros: 0,
      lembrete: { agendamentoId: ag.id, tipo: job.lembrete },
    };
    await tx.botSessao.upsert({
      where: { unidadeId_telefone: chave },
      create: { ...chave, clienteId: cliente.id, sessao: json(sessao) },
      update: { clienteId: cliente.id, sessao: json(sessao) },
    });
    const m = await tx.mensagem.create({
      data: {
        ...chave,
        clienteId: cliente.id,
        direcao: 'saida',
        texto,
        status: 'pendente',
        automacao: 'lembrete',
      },
      select: { id: true },
    });
    await tx.agendamento.update({
      where: { id: ag.id },
      data: job.lembrete === '24h' ? { lembrete24hEm: agora } : { lembrete2hEm: agora },
    });
    return {
      tipo: 'enviar',
      contaId: job.contaId,
      instancia: conexao.instancia,
      mensagemIds: [m.id],
    };
  });
}

/** "1. Confirmo": a agenda passa a mostrar que o cliente confirmou. */
export async function confirmarPeloCliente(tx: Tx, agendamentoId: string, agora: Date) {
  const r = await tx.agendamento.updateMany({
    where: { id: agendamentoId, status: { in: ['agendado', 'confirmado'] }, inicio: { gt: agora } },
    data: { status: 'confirmado', confirmadoEm: agora },
  });
  return r.count > 0;
}
