import {
  avisarEquipeSobreHorario,
  avisarFaltaParaGestao,
  notificacaoDoHorario,
} from '@pente-fino/db';
import type { MudancaNaAgenda } from '@pente-fino/shared';
import type { BancoService } from '../comum/banco.service.js';
import type { Filas } from '../filas/filas.module.js';

/**
 * Aviso ao profissional (assistente da equipe no WhatsApp) quando a agenda dele muda pelo
 * painel ou pelo site. Grava a mensagem e põe na fila do worker; nunca impede a operação.
 */
export async function avisarEquipe(
  banco: BancoService,
  filas: Filas,
  contaId: string,
  agendamentoId: string,
  tipo: MudancaNaAgenda,
): Promise<void> {
  try {
    const [aviso, notificacao] = await banco.naConta(contaId, async (tx) => [
      await avisarEquipeSobreHorario(tx, agendamentoId, tipo),
      await notificacaoDoHorario(tx, agendamentoId, tipo),
    ]);
    // No celular (push), para os aparelhos que ele ligou no Perfil.
    if (notificacao) await filas.notificacoes.add('push', notificacao);
    if (aviso)
      await filas.whatsappEntrada.add(
        'enviar',
        { tipo: 'enviar', ...aviso },
        { jobId: `enviar_${aviso.mensagemIds[0]}` },
      );
  } catch {
    // Sem aviso o horário continua valendo; o profissional vê na agenda.
  }
}

/** Falta marcada: aviso para dono e gestor que ligaram o assistente. Nunca impede a operação. */
export async function avisarFalta(
  banco: BancoService,
  filas: Filas,
  contaId: string,
  agendamentoId: string,
): Promise<void> {
  try {
    const avisos = await banco.naConta(contaId, (tx) => avisarFaltaParaGestao(tx, agendamentoId));
    for (const aviso of avisos)
      await filas.whatsappEntrada.add(
        'enviar',
        { tipo: 'enviar', ...aviso },
        { jobId: `enviar_${aviso.mensagemIds[0]}` },
      );
  } catch {
    // Sem aviso a falta continua registrada; aparece no resumo e nas métricas.
  }
}
