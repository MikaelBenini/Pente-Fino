// Remarcação rápida depois do "Não veio" por atraso (Etapa 14): 5 minutos depois (tempo de
// desfazer), o bot manda ao cliente os próximos horários livres com o mesmo barbeiro, mais o
// link do site para outro dia; responder o número já marca.
import {
  agendaNova,
  dataLocal,
  HORARIOS_REMARCAR_ATRASO,
  proximosHorariosParaRemarcar,
  rotuloDoDia,
  textoRemarcarAtraso,
  variantesTelefone,
  type RemarcacaoPorAtraso,
  type SessaoBot,
} from '@pente-fino/shared';
import { calcularLivres, regrasDaUnidade } from './agenda.js';
import { json } from './bot.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { naConta } from './index.js';
import { criarTokenDeAgendamento } from './token-agendamento.js';

const primeiroNome = (n: string) => n.trim().split(/\s+/)[0] ?? n;
const somarDias = (dia: string, n: number) => {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Manda a remarcação rápida, se o "Não veio" não foi desfeito e o cliente aceita mensagens e
 * já conversou com a unidade. Os horários são os próximos livres com o mesmo barbeiro (até
 * 7 dias). null = nada a mandar.
 */
export async function remarcacaoPorAtraso(
  prisma: PrismaClient,
  job: Omit<RemarcacaoPorAtraso, 'tipo'>,
  agora = new Date(),
  appUrl = '',
): Promise<{ contaId: string; instancia: string; mensagemIds: string[] } | null> {
  return naConta(prisma, job.contaId, async (tx) => {
    const ag = await tx.agendamento.findUnique({
      where: { id: job.agendamentoId },
      include: {
        cliente: true,
        comanda: { include: { itens: true } },
        unidade: { include: { botConexao: true } },
      },
    });
    if (!ag || ag.status !== 'falta' || !ag.atrasou) return null;
    const cliente = ag.cliente;
    if (!cliente?.consentimentoMsg || !cliente.telefone) return null;
    const conexao = ag.unidade.botConexao;
    if (conexao?.status !== 'conectado') return null;
    const falou = await tx.mensagem.findFirst({
      where: {
        unidadeId: ag.unidadeId,
        telefone: { in: variantesTelefone(cliente.telefone) },
        direcao: 'entrada',
      },
      select: { telefone: true },
    });
    if (!falou) return null;

    const regras = await regrasDaUnidade(tx, ag.unidadeId);
    const duracao = Math.round((ag.fim.getTime() - ag.inicio.getTime()) / 60_000);
    const servicoIds = (ag.comanda?.itens ?? []).flatMap((i) => (i.servicoId ? [i.servicoId] : []));
    const hoje = dataLocal(agora);
    const depoisDe = new Date(agora.getTime() + regras.antecedenciaMin * 60_000);
    const inicios: string[] = [];
    for (let n = 0; n < 7 && inicios.length < HORARIOS_REMARCAR_ATRASO; n++) {
      const livres = await calcularLivres(
        tx,
        ag.unidadeId,
        somarDias(hoje, n),
        duracao,
        ag.profissionalId,
        agora,
        { antecedenciaMin: regras.antecedenciaMin },
      ).catch(() => []);
      inicios.push(
        ...proximosHorariosParaRemarcar(
          livres.flatMap((l) => l.inicios),
          depoisDe,
          HORARIOS_REMARCAR_ATRASO - inicios.length,
        ),
      );
    }
    const link =
      ag.unidade.agendamentoPublico && ag.unidade.slug
        ? `${appUrl}/agendar?u=${encodeURIComponent(ag.unidade.slug)}&c=${await criarTokenDeAgendamento(tx, ag.unidadeId, cliente.id, agora)}`
        : null;
    const texto = textoRemarcarAtraso({
      cliente: primeiroNome(cliente.nome),
      horaCancelada: ag.inicio.toISOString(),
      opcoes: inicios.map((i) => ({
        inicio: i,
        rotulo: rotuloDoDia(dataLocal(new Date(i)), hoje),
      })),
      link,
    });

    // A próxima resposta (o número) vale para estes horários: "atraso" no passo a passo.
    const chave = { unidadeId: ag.unidadeId, telefone: falou.telefone };
    const salva = await tx.botSessao.findUnique({ where: { unidadeId_telefone: chave } });
    const anterior = (salva?.sessao ?? null) as SessaoBot | null;
    const sessao: SessaoBot = {
      caminho: [],
      ultimaEm: agora.toISOString(),
      comAtendente: anterior?.comAtendente ?? false,
      erros: 0,
      agenda: {
        ...agendaNova(),
        passo: 'atraso',
        servicoIds,
        profissionalId: ag.profissionalId,
        opcoes: inicios.map((i) => `${i}|${ag.profissionalId}`),
      },
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
      },
      select: { id: true },
    });
    return { contaId: job.contaId, instancia: conexao.instancia, mensagemIds: [m.id] };
  });
}
