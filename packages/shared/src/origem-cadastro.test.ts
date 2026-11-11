import { describe, expect, it } from 'vitest';
import {
  origemCadastroSchema,
  origemDaVisita,
  resumoDaOrigem,
  trilhaJsonLd,
} from './origem-cadastro.js';

const agora = new Date('2026-11-11T12:00:00Z');

describe('origem do cadastro (site T2, admin F2)', () => {
  it('clique do anúncio: gclid e utm, sem o endereço inteiro de quem mandou', () => {
    expect(
      origemDaVisita(
        'https://seupentefino.com.br/?gclid=Teste123&utm_source=google&utm_medium=cpc&utm_campaign=lancamento',
        'https://www.google.com/search?q=sistema+barbearia',
        agora,
      ),
    ).toEqual({
      gclid: 'Teste123',
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'lancamento',
      referrer: 'google.com',
      chegouEm: '2026-11-11T12:00:00.000Z',
    });
  });

  it('visita direta ou navegação interna: nada novo (vale o que já estava guardado)', () => {
    expect(origemDaVisita('https://seupentefino.com.br/planos', '', agora)).toBeNull();
    expect(
      origemDaVisita('https://seupentefino.com.br/planos', 'https://seupentefino.com.br/', agora),
    ).toBeNull();
    expect(origemDaVisita('não é endereço', '', agora)).toBeNull();
  });

  it('veio do Instagram sem utm: guarda só o domínio', () => {
    expect(
      origemDaVisita('https://seupentefino.com.br/', 'https://l.instagram.com/?u=x', agora),
    ).toEqual({ referrer: 'l.instagram.com', chegouEm: '2026-11-11T12:00:00.000Z' });
  });

  it('o servidor aceita só os campos conhecidos e com tamanho limitado', () => {
    expect(
      origemCadastroSchema.parse({ gclid: 'a', email: 'x@y.com', utm_source: ' google ' }),
    ).toEqual({ gclid: 'a', utm_source: 'google' });
    expect(origemCadastroSchema.safeParse({ gclid: 'x'.repeat(201) }).success).toBe(false);
  });

  it('resumo para a administração', () => {
    expect(resumoDaOrigem({ gclid: 'a', utm_campaign: 'lancamento' })).toBe(
      'Google Ads · lancamento',
    );
    expect(resumoDaOrigem({ utm_source: 'instagram', utm_medium: 'bio' })).toBe('instagram / bio');
    expect(resumoDaOrigem({ referrer: 'facebook.com' })).toBe('facebook.com');
    expect(resumoDaOrigem(null)).toBeNull();
  });

  it('trilha de navegação para o Google', () => {
    expect(
      trilhaJsonLd([
        { nome: 'Início', url: 'https://x/' },
        { nome: 'Planos', url: 'https://x/planos' },
      ]).itemListElement,
    ).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Início', item: 'https://x/' },
      { '@type': 'ListItem', position: 2, name: 'Planos', item: 'https://x/planos' },
    ]);
  });
});
