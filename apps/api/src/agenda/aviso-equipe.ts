import { avisarEquipeSobreHorario } from '@pente-fino/db';
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
    const aviso = await banco.naConta(contaId, (tx) =>
      avisarEquipeSobreHorario(tx, agendamentoId, tipo),
    );
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
