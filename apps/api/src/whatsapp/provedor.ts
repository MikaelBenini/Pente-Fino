import { Logger } from '@nestjs/common';
import {
  assinarInstancia,
  CABECALHO_ASSINATURA,
  ProvedorEvolution,
  ProvedorFalso,
  type ProvedorWhatsApp,
} from '@pente-fino/whatsapp';
import { CONFIGURACAO, type Configuracao } from '../config/configuracao.js';

export const PROVEDOR_WHATSAPP = Symbol('PROVEDOR_WHATSAPP');

export function criarProvedorWhatsApp(c: Configuracao): ProvedorWhatsApp {
  const w = c.whatsapp;
  if (w.provedor === 'falso') {
    if (c.ambiente !== 'test')
      new Logger('WhatsApp').warn('WHATSAPP_PROVEDOR=falso: nada é enviado de verdade.');
    return new ProvedorFalso();
  }
  return new ProvedorEvolution({
    url: w.evolutionUrl,
    chave: w.evolutionChave,
    cabecalhosWebhook: (instancia) => ({
      [CABECALHO_ASSINATURA]: assinarInstancia(w.webhookSegredo, instancia),
    }),
  });
}

export const provedorWhatsApp = {
  provide: PROVEDOR_WHATSAPP,
  inject: [CONFIGURACAO],
  useFactory: criarProvedorWhatsApp,
};
