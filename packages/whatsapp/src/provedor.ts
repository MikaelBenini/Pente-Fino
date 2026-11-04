import type { StatusConexaoWhatsapp } from '@pente-fino/shared';

export interface EstadoConexao {
  status: StatusConexaoWhatsapp;
  /** Número conectado, só dígitos. */
  numero: string | null;
  /** QR Code para ler no celular (data URL de imagem), só enquanto aguarda a leitura. */
  qr: string | null;
}

/**
 * O que o sistema precisa de um provedor de WhatsApp. Trocar a Evolution API por outro
 * provedor é escrever outra implementação desta interface; o fluxo não muda.
 * Uma instância = um número = uma unidade.
 */
export interface ProvedorWhatsApp {
  readonly nome: string;
  /** Cria a instância se precisar, aponta o webhook e devolve o estado (com QR para ler). */
  conectar(instancia: string, webhookUrl: string): Promise<EstadoConexao>;
  estado(instancia: string): Promise<EstadoConexao>;
  /** Desliga o número da instância (o celular sai de "Aparelhos conectados"). */
  desconectar(instancia: string): Promise<void>;
  enviarTexto(
    instancia: string,
    telefone: string,
    texto: string,
  ): Promise<{ idExterno: string | null }>;
}

/** Provedor fora do ar ou recusou o pedido. A mensagem é para o log, não para o cliente. */
export class ErroProvedorWhatsApp extends Error {
  constructor(
    mensagem: string,
    readonly status: number | null = null,
  ) {
    super(mensagem);
    this.name = 'ErroProvedorWhatsApp';
  }
}
