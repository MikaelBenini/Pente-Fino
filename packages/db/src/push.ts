// Notificações no celular (push do PWA): o que mandar ao barbeiro quando a agenda dele muda.
// Quem envia é o worker (fila "notificacoes"); aqui só se decide e monta o texto.
import {
  dataLocal,
  diaDaSemana,
  formatarHora,
  lerPreferenciasAvisos,
  podeAvisarAgora,
  rotuloDoDia,
  textoPushDoHorario,
  type MudancaNaAgenda,
  type TrabalhoNotificacao,
  type TrabalhoPushEquipe,
} from '@pente-fino/shared';
import type { Prisma, PrismaClient } from './generated/prisma/client.js';
import { naConta } from './index.js';

type Tx = Prisma.TransactionClient;

const primeiroNome = (n: string | null | undefined) => n?.trim().split(/\s+/)[0] ?? 'Cliente';
/** Minutos desde 00:00 em São Paulo (-03:00 fixo). */
const minutoLocal = (d: Date) => {
  const l = new Date(d.getTime() - 3 * 3_600_000);
  return l.getUTCHours() * 60 + l.getUTCMinutes();
};

/**
 * Horário novo, remarcado ou cancelado: notificação para os aparelhos do profissional, só
 * perto do expediente dele (a mesma janela dos avisos do WhatsApp). null = nada a mandar.
 */
export async function notificacaoDoHorario(
  tx: Tx,
  agendamentoId: string,
  tipo: MudancaNaAgenda,
  agora = new Date(),
): Promise<TrabalhoNotificacao | null> {
  const ag = await tx.agendamento.findUnique({
    where: { id: agendamentoId },
    include: {
      cliente: { select: { nome: true } },
      profissional: { include: { horarios: true } },
      comanda: { include: { itens: { include: { servico: { select: { nome: true } } } } } },
    },
  });
  if (!ag) return null;
  const usuarioId = ag.profissional.usuarioId;
  if ((await tx.inscricaoPush.count({ where: { usuarioId } })) === 0) return null;
  // Desligou "Mudanças na minha agenda" em Perfil → Avisos.
  const dono = await tx.usuario.findUnique({
    where: { id: usuarioId },
    select: { preferenciasAvisos: true },
  });
  if (!lerPreferenciasAvisos(dono?.preferenciasAvisos).agendaNoCelular) return null;
  const hoje = dataLocal(agora);
  const turnos = ag.profissional.horarios.filter((h) => h.diaSemana === diaDaSemana(hoje));
  if (!podeAvisarAgora(turnos, minutoLocal(agora))) return null;
  const { titulo, corpo } = textoPushDoHorario(tipo, {
    quando: `${rotuloDoDia(dataLocal(ag.inicio), hoje)}, ${formatarHora(ag.inicio)}`,
    cliente: primeiroNome(ag.cliente?.nome),
    servicos: (ag.comanda?.itens ?? []).map((i) => i.servico?.nome ?? 'Serviço'),
  });
  return {
    contaId: ag.contaId,
    usuarioId,
    titulo,
    corpo,
    url: '/agenda',
    etiqueta: `horario-${ag.id}`,
  };
}

export interface InscricaoParaEnvio {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}
/** Envia a um aparelho; devolve o status HTTP do serviço de push (201 = entregue). */
export type EnviarPush = (inscricao: InscricaoParaEnvio, carga: string) => Promise<number>;

/**
 * Manda a notificação a todos os aparelhos da pessoa. Aparelho que o serviço diz que não
 * existe mais (404 ou 410) sai da lista. Devolve quantos receberam.
 */
export async function enviarNotificacao(
  prisma: PrismaClient,
  n: TrabalhoNotificacao,
  enviar: EnviarPush,
): Promise<{ entregues: number; aparelhos: number; removidos: number }> {
  const aparelhos = await naConta(prisma, n.contaId, (tx) =>
    tx.inscricaoPush.findMany({ where: { usuarioId: n.usuarioId } }),
  );
  const carga = JSON.stringify({
    titulo: n.titulo,
    corpo: n.corpo,
    url: n.url,
    etiqueta: n.etiqueta,
  });
  let entregues = 0;
  let removidos = 0;
  for (const a of aparelhos) {
    const status = await enviar(
      { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
      carga,
    ).catch((e: { statusCode?: number }) => e.statusCode ?? 0);
    if (status === 404 || status === 410) {
      await naConta(prisma, n.contaId, (tx) => tx.inscricaoPush.delete({ where: { id: a.id } }));
      removidos++;
    } else if (status >= 200 && status < 300) entregues++;
  }
  return { entregues, aparelhos: aparelhos.length, removidos };
}

/** Admin F6: quem atende o chat (e pode receber o push). */
export const PAPEIS_DO_CHAT = ['admin', 'vendedor', 'suporte'] as const;

/**
 * Admin F6: manda o push do chat aos aparelhos de quem da equipe atende o chat (ativo, papel
 * admin, vendedor ou suporte). Aparelho que não existe mais (404 ou 410) sai da lista.
 * `prisma` é a conexão da administração.
 */
export async function enviarPushEquipe(
  prisma: PrismaClient,
  n: TrabalhoPushEquipe,
  enviar: EnviarPush,
): Promise<{ entregues: number; aparelhos: number; removidos: number }> {
  const aparelhos = await prisma.inscricaoPushPlataforma.findMany({
    where: { usuario: { ativo: true, papel: { in: [...PAPEIS_DO_CHAT] } } },
  });
  const carga = JSON.stringify(n);
  let entregues = 0;
  let removidos = 0;
  for (const a of aparelhos) {
    const status = await enviar(
      { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
      carga,
    ).catch((e: { statusCode?: number }) => e.statusCode ?? 0);
    if (status === 404 || status === 410) {
      await prisma.inscricaoPushPlataforma.delete({ where: { id: a.id } });
      removidos++;
    } else if (status >= 200 && status < 300) entregues++;
  }
  return { entregues, aparelhos: aparelhos.length, removidos };
}
