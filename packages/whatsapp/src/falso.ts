import type { EstadoConexao, ProvedorWhatsApp } from './provedor.js';

/** QR de mentira (um quadrado com "TESTE"), para a tela funcionar sem a Evolution API. */
const QR_FALSO =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#fff"/><rect x="10" y="10" width="80" height="80" fill="none" stroke="#000" stroke-width="6"/><text x="50" y="56" font-size="14" text-anchor="middle" font-family="monospace">TESTE</text></svg>',
  ).toString('base64');

export interface EnvioFalso {
  instancia: string;
  telefone: string;
  texto: string;
}

/**
 * Provedor de mentira para testes e para desenvolver sem celular. Guarda o que "enviou";
 * conectar fica aguardando o QR até alguém chamar `simularLeitura`.
 */
export class ProvedorFalso implements ProvedorWhatsApp {
  readonly nome = 'falso';
  readonly enviados: EnvioFalso[] = [];
  private readonly estados = new Map<string, EstadoConexao>();
  private contador = 0;

  async conectar(instancia: string): Promise<EstadoConexao> {
    const atual = this.estados.get(instancia);
    if (atual?.status === 'conectado') return atual;
    const novo: EstadoConexao = { status: 'aguardando_qr', numero: null, qr: QR_FALSO };
    this.estados.set(instancia, novo);
    return novo;
  }

  async estado(instancia: string): Promise<EstadoConexao> {
    return this.estados.get(instancia) ?? { status: 'desconectado', numero: null, qr: null };
  }

  async desconectar(instancia: string): Promise<void> {
    this.estados.set(instancia, { status: 'desconectado', numero: null, qr: null });
  }

  async enviarTexto(instancia: string, telefone: string, texto: string) {
    this.enviados.push({ instancia, telefone, texto });
    return { idExterno: `falso-${++this.contador}` };
  }

  /** Como se o dono tivesse lido o QR com o celular. */
  simularLeitura(instancia: string, numero = '5511900000000'): void {
    this.estados.set(instancia, { status: 'conectado', numero, qr: null });
  }
}
