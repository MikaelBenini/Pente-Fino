// Dados do site (vitrine). Endereço vem do APP_URL; contato e empresa ficam aqui até
// existir CNPJ e WhatsApp de suporte (ver docs/linha-de-desenvolvimento.md, etapa 14).
export const URL_SITE = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
export const EMAIL_CONTATO = 'contato@pentefino.com.br';
export const EMAIL_PRIVACIDADE = 'privacidade@pentefino.com.br';
export { VERSAO_TERMOS } from '@pente-fino/shared';
