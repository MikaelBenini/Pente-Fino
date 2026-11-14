import { describe, expect, it } from 'vitest';
import {
  alvoDoClique,
  loteVisitaSchema,
  origemCurta,
  resumirVisitas,
  visitasPorDia,
  type VisitaResumida,
} from './visitas-site.js';

const v = (p: Partial<VisitaResumida>): VisitaResumida => ({
  inicio: '2026-11-14T12:00:00Z',
  novo: null,
  origem: null,
  rolou: 0,
  cliques: [],
  ...p,
});

describe('resumirVisitas', () => {
  it('conta visitas, novas, rolagem, cliques (um por visita) e o funil', () => {
    const r = resumirVisitas([
      v({
        novo: true,
        rolou: 100,
        cliques: ['planos', 'planos', 'cadastro'],
        origem: 'google ads',
      }),
      v({ novo: false, rolou: 50, cliques: ['whatsapp'], origem: 'instagram.com' }),
      v({ novo: true, rolou: 25, origem: 'google ads' }),
      v({ rolou: 0 }),
    ]);
    expect(r.visitas).toBe(4);
    expect(r.novas).toBe(2);
    expect(r.rolagem).toEqual({ 25: 3, 50: 2, 75: 1, 100: 1 });
    expect(r.cliques).toEqual({ planos: 1, cadastro: 1, whatsapp: 1, video: 0, chat: 0 });
    expect(r.funil.map((e) => e.visitas)).toEqual([4, 2, 1, 1]);
    expect(r.origens).toEqual([
      { origem: 'google ads', visitas: 2 },
      { origem: 'Direto', visitas: 1 },
      { origem: 'instagram.com', visitas: 1 },
    ]);
  });

  it('sem visitas, tudo zero', () => {
    const r = resumirVisitas([]);
    expect(r.visitas).toBe(0);
    expect(r.funil.every((e) => e.visitas === 0)).toBe(true);
    expect(r.origens).toEqual([]);
  });
});

describe('origemCurta', () => {
  it('prefere a campanha, depois o anúncio do Google, depois o site de origem', () => {
    expect(origemCurta('https://seupentefino.com.br/?utm_source=Instagram', '')).toBe('instagram');
    expect(origemCurta('https://seupentefino.com.br/?gclid=abc', 'https://www.google.com/')).toBe(
      'google ads',
    );
    expect(origemCurta('https://seupentefino.com.br/', 'https://www.google.com/search')).toBe(
      'google.com',
    );
  });

  it('o próprio site e a entrada direta não têm origem', () => {
    expect(origemCurta('https://seupentefino.com.br/planos', 'https://seupentefino.com.br/')).toBe(
      null,
    );
    expect(origemCurta('https://seupentefino.com.br/', '')).toBe(null);
    expect(origemCurta('lixo', 'lixo')).toBe(null);
  });
});

describe('loteVisitaSchema', () => {
  const base = { visitaId: '0190f5c2-7b1a-7cde-8f00-123456789abc', novo: null, origem: null };
  it('aceita os eventos conhecidos', () => {
    expect(
      loteVisitaSchema.safeParse({
        ...base,
        eventos: [
          { tipo: 'entrada', pagina: '/' },
          { tipo: 'rolagem', pagina: '/', valor: 50 },
          { tipo: 'clique', pagina: '/planos', valor: 'cadastro' },
        ],
      }).success,
    ).toBe(true);
  });

  it('recusa marca de rolagem, alvo ou página fora da lista', () => {
    for (const e of [
      { tipo: 'rolagem', pagina: '/', valor: 33 },
      { tipo: 'clique', pagina: '/', valor: 'qualquer' },
      { tipo: 'entrada', pagina: 'https://outro.site/' },
    ])
      expect(loteVisitaSchema.safeParse({ ...base, eventos: [e] }).success).toBe(false);
    expect(loteVisitaSchema.safeParse({ ...base, eventos: [] }).success).toBe(false);
  });
});

describe('visitasPorDia', () => {
  it('conta no dia de São Paulo e ignora o que está fora dos dias pedidos', () => {
    const r = visitasPorDia(
      [
        v({ inicio: '2026-11-14T02:00:00Z', novo: true }), // 13/11, 23h em São Paulo
        v({ inicio: '2026-11-14T12:00:00Z' }),
        v({ inicio: '2026-11-14T13:00:00Z', novo: true }),
        v({ inicio: '2026-11-01T12:00:00Z' }),
      ],
      ['2026-11-13', '2026-11-14'],
    );
    expect(r).toEqual([
      { dia: '2026-11-13', visitas: 1, novas: 1 },
      { dia: '2026-11-14', visitas: 2, novas: 1 },
    ]);
  });
});

describe('alvoDoClique', () => {
  it('a marca data-medir vale primeiro; marca desconhecida cai no endereço', () => {
    expect(alvoDoClique(null, 'chat')).toBe('chat');
    expect(alvoDoClique('/cadastro', 'qualquer')).toBe('cadastro');
  });

  it('classifica pelo endereço do link', () => {
    expect(alvoDoClique('/cadastro?plano=pro')).toBe('cadastro');
    expect(alvoDoClique('/planos')).toBe('planos');
    expect(alvoDoClique('#planos')).toBe('planos');
    expect(alvoDoClique('https://wa.me/5511999999999?text=oi')).toBe('whatsapp');
    expect(alvoDoClique('#video')).toBe('video');
  });

  it('o resto não entra no funil', () => {
    expect(alvoDoClique('/blog')).toBe(null);
    expect(alvoDoClique('/cadastrox')).toBe(null);
    expect(alvoDoClique(null)).toBe(null);
  });
});
