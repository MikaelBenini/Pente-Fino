// Alerta quando o WhatsApp de uma unidade cai sozinho (Etapa 19): aviso na central (dono e
// gestor), notificação no celular de quem ligou o push e e-mail para os donos. Chamado depois de
// gravar o estado novo da conexão (webhook da Evolution ou consulta da tela Bot).
import { Inject, Injectable, Logger } from '@nestjs/common';
import { avisarConexaoCaida } from '@pente-fino/db';
import { BancoService } from '../comum/banco.service.js';
import { EmailsService } from '../emails/emails.service.js';
import { Filas } from '../filas/filas.module.js';

@Injectable()
export class AlertaConexaoService {
  private readonly log = new Logger('WhatsApp');

  constructor(
    @Inject(BancoService) private readonly banco: BancoService,
    @Inject(Filas) private readonly filas: Filas,
    @Inject(EmailsService) private readonly emails: EmailsService,
  ) {}

  /** Caiu agora = o registro acabou de gravar `caiuEm` com este instante. */
  caiuAgora(linha: { status: string; caiuEm: Date | null } | null, agora: Date): boolean {
    return linha?.status === 'desconectado' && linha.caiuEm?.getTime() === agora.getTime();
  }

  /** Nunca derruba quem chamou: o estado já está gravado; o alerta é melhor esforço. */
  async avisar(contaId: string, unidadeId: string, caiuEm: Date): Promise<void> {
    try {
      const r = await this.banco.naConta(contaId, (tx) =>
        avisarConexaoCaida(tx, contaId, unidadeId, caiuEm),
      );
      for (const n of r.notificacoes) await this.filas.notificacoes.add('aviso', n);
      for (const d of r.donos)
        await this.emails.whatsappCaiu({
          para: d.email,
          nome: d.nome,
          conta: r.conta,
          unidade: r.unidade,
          caiuEm,
        });
      this.log.warn(`WhatsApp caiu: ${r.conta} · ${r.unidade}`);
    } catch (e) {
      this.log.error(`Alerta de WhatsApp caído (unidade ${unidadeId}): ${(e as Error).message}`);
    }
  }
}
