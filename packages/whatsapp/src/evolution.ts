import { telefoneDoJid, type StatusConexaoWhatsapp } from '@pente-fino/shared';
import { ErroProvedorWhatsApp, type EstadoConexao, type ProvedorWhatsApp } from './provedor.js';

/** Eventos que o sistema escuta. O resto a Evolution nem manda. */
export const EVENTOS_WEBHOOK_EVOLUTION = [
  'MESSAGES_UPSERT',
  'CONNECTION_UPDATE',
  'QRCODE_UPDATED',
] as const;

/** Cabeçalho com a assinatura que a Evolution repete em todo webhook desta instância. */
export const CABECALHO_ASSINATURA = 'x-pente-fino-assinatura';

export interface OpcoesEvolution {
  url: string;
  chave: string;
  /** Cabeçalhos que a Evolution manda de volta no webhook (a assinatura da instância). */
  cabecalhosWebhook?: (instancia: string) => Record<string, string>;
  /** Tempo máximo de cada chamada. */
  tempoLimiteMs?: number;
  fetch?: typeof fetch;
}

export function statusEvolution(estado: string | undefined): StatusConexaoWhatsapp {
  if (estado === 'open') return 'conectado';
  if (estado === 'connecting') return 'aguardando_qr';
  return 'desconectado';
}

/** Evolution API self-hosted (WhatsApp Web pelo Baileys, conexão por QR Code). */
export class ProvedorEvolution implements ProvedorWhatsApp {
  readonly nome = 'evolution';
  private readonly url: string;
  private readonly buscar: typeof fetch;

  constructor(private readonly opcoes: OpcoesEvolution) {
    this.url = opcoes.url.replace(/\/$/, '');
    this.buscar = opcoes.fetch ?? fetch;
  }

  private async api<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
    let resposta: Response;
    try {
      resposta = await this.buscar(`${this.url}${caminho}`, {
        method: metodo,
        headers: { apikey: this.opcoes.chave, 'Content-Type': 'application/json' },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
        signal: AbortSignal.timeout(this.opcoes.tempoLimiteMs ?? 15_000),
      });
    } catch (e) {
      throw new ErroProvedorWhatsApp(
        `Evolution API não respondeu em ${this.url}: ${(e as Error).message}`,
      );
    }
    const dados = (await resposta.json().catch(() => ({}))) as T & {
      response?: { message?: unknown };
    };
    if (!resposta.ok) {
      const detalhe = JSON.stringify(dados?.response?.message ?? dados).slice(0, 300);
      throw new ErroProvedorWhatsApp(
        `${metodo} ${caminho} → ${resposta.status}: ${detalhe}`,
        resposta.status,
      );
    }
    return dados;
  }

  private async existe(instancia: string): Promise<boolean> {
    try {
      await this.api('GET', `/instance/connectionState/${encodeURIComponent(instancia)}`);
      return true;
    } catch (e) {
      if (e instanceof ErroProvedorWhatsApp && e.status === 404) return false;
      throw e;
    }
  }

  async conectar(instancia: string, webhookUrl: string): Promise<EstadoConexao> {
    const nome = encodeURIComponent(instancia);
    if (!(await this.existe(instancia))) {
      await this.api('POST', '/instance/create', {
        instanceName: instancia,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: false,
        groupsIgnore: true,
        readMessages: false,
        alwaysOnline: false,
        syncFullHistory: false,
      });
    }
    await this.api('POST', `/webhook/set/${nome}`, {
      webhook: {
        enabled: true,
        url: webhookUrl,
        byEvents: false,
        base64: false,
        headers: this.opcoes.cabecalhosWebhook?.(instancia) ?? {},
        events: EVENTOS_WEBHOOK_EVOLUTION,
      },
    });
    const atual = await this.estado(instancia);
    if (atual.status !== 'desconectado') return atual;
    const qr = await this.api<{ base64?: string }>('GET', `/instance/connect/${nome}`);
    return { status: 'aguardando_qr', numero: null, qr: qr.base64 ?? null };
  }

  async estado(instancia: string): Promise<EstadoConexao> {
    const nome = encodeURIComponent(instancia);
    let estado: string | undefined;
    try {
      const r = await this.api<{ instance?: { state?: string } }>(
        'GET',
        `/instance/connectionState/${nome}`,
      );
      estado = r.instance?.state;
    } catch (e) {
      if (e instanceof ErroProvedorWhatsApp && e.status === 404)
        return { status: 'desconectado', numero: null, qr: null };
      throw e;
    }
    const status = statusEvolution(estado);
    if (status === 'conectado') {
      const lista = await this.api<{ name?: string; ownerJid?: string | null }[]>(
        'GET',
        `/instance/fetchInstances?instanceName=${nome}`,
      ).catch(() => []);
      const dona = Array.isArray(lista) ? lista.find((i) => i?.name === instancia) : undefined;
      return { status, numero: telefoneDoJid(dona?.ownerJid), qr: null };
    }
    if (status === 'aguardando_qr') {
      // Enquanto aguarda, a Evolution devolve o QR atual (não gera outra sessão).
      const qr = await this.api<{ base64?: string }>('GET', `/instance/connect/${nome}`);
      return { status, numero: null, qr: qr.base64 ?? null };
    }
    return { status, numero: null, qr: null };
  }

  async desconectar(instancia: string): Promise<void> {
    if (!(await this.existe(instancia))) return;
    try {
      await this.api('DELETE', `/instance/logout/${encodeURIComponent(instancia)}`);
    } catch (e) {
      // Já desconectada: nada a fazer.
      if (!(e instanceof ErroProvedorWhatsApp && (e.status === 400 || e.status === 404))) throw e;
    }
  }

  async enviarTexto(instancia: string, telefone: string, texto: string) {
    const r = await this.api<{ key?: { id?: string } }>(
      'POST',
      `/message/sendText/${encodeURIComponent(instancia)}`,
      { number: telefone, text: texto },
    );
    return { idExterno: r.key?.id ?? null };
  }
}
