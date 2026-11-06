// Aviso ao cliente depois que a barbearia moveu o horário na agenda (Etapa 14). Sai depois do
// tempo de "Desfazer" e só se o horário ainda é o do movimento.
import {
  caminhoDoHorario,
  dataLocal,
  rotuloDoDia,
  textoHorarioMudou,
  variantesTelefone,
  type HorarioMudou,
} from '@pente-fino/shared';
import type { PrismaClient } from './generated/prisma/client.js';
import { naConta } from './index.js';
import { criarLinkDoHorario } from './link-horario.js';

/** null = nada a mandar (desfeito, cancelado, sem aceite ou sem conversa com a unidade). */
export async function avisoHorarioMudou(
  prisma: PrismaClient,
  job: Omit<HorarioMudou, 'tipo'>,
  agora = new Date(),
  appUrl = '',
): Promise<{ contaId: string; instancia: string; mensagemIds: string[] } | null> {
  return naConta(prisma, job.contaId, async (tx) => {
    const ag = await tx.agendamento.findUnique({
      where: { id: job.agendamentoId },
      include: {
        cliente: true,
        profissional: { include: { usuario: { select: { nome: true } } } },
        unidade: { include: { botConexao: true } },
      },
    });
    if (!ag || !['agendado', 'confirmado'].includes(ag.status)) return null;
    if (ag.inicio.toISOString() !== job.inicio || ag.profissionalId !== job.profissionalId)
      return null;
    if (ag.inicio <= agora) return null;
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
      orderBy: { criadoEm: 'desc' },
      select: { telefone: true },
    });
    if (!falou) return null;
    const link = appUrl
      ? `${appUrl}${caminhoDoHorario(await criarLinkDoHorario(tx, ag.id))}`
      : null;
    const texto = textoHorarioMudou({
      cliente: cliente.nome,
      diaRotulo: rotuloDoDia(dataLocal(ag.inicio), dataLocal(agora)),
      inicio: ag.inicio.toISOString(),
      profissional: ag.profissional.usuario.nome,
      mudouHorario: job.mudouHorario,
      link,
    });
    const m = await tx.mensagem.create({
      data: {
        unidadeId: ag.unidadeId,
        telefone: falou.telefone,
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
