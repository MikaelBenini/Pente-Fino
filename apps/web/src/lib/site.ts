// Dados do site (vitrine). Endereço vem do APP_URL; contato e empresa ficam aqui até
// existir CNPJ e WhatsApp de suporte (ver docs/linha-de-desenvolvimento.md, etapas 21 e 23).
import { NOME_PLANO, PLANOS, precoPorMes } from '@pente-fino/shared';
export const URL_SITE = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
export const EMAIL_CONTATO = 'contato@seupentefino.com.br';
export const EMAIL_PRIVACIDADE = 'privacidade@seupentefino.com.br';
export { VERSAO_TERMOS } from '@pente-fino/shared';

const reais = (centavos: number) => (centavos / 100).toFixed(2);

/**
 * Preços para o Google (briefing do site, B4), da mesma tabela que a página mostra: a faixa vai
 * do menor anual por mês ao maior mensal, e cada plano tem o mensal e o anual por mês.
 */
export function ofertasJsonLd() {
  const precos = PLANOS.flatMap((p) => [precoPorMes(p, 'anual'), precoPorMes(p, 'mensal')]);
  return {
    '@type': 'AggregateOffer',
    priceCurrency: 'BRL',
    lowPrice: reais(Math.min(...precos)),
    highPrice: reais(Math.max(...precos)),
    offerCount: PLANOS.length,
    offers: PLANOS.map((p) => ({
      '@type': 'Offer',
      name: `Plano ${NOME_PLANO[p]}`,
      priceCurrency: 'BRL',
      price: reais(precoPorMes(p, 'mensal')),
      url: `${URL_SITE}/cadastro?plano=${p}`,
      priceSpecification: [
        {
          '@type': 'UnitPriceSpecification',
          price: reais(precoPorMes(p, 'mensal')),
          priceCurrency: 'BRL',
          billingDuration: 'P1M',
          unitText: 'mês, no plano mensal',
        },
        {
          '@type': 'UnitPriceSpecification',
          price: reais(precoPorMes(p, 'anual')),
          priceCurrency: 'BRL',
          billingDuration: 'P1M',
          unitText: 'mês, no plano anual',
        },
      ],
    })),
  };
}
