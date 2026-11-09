import { describe, expect, it } from 'vitest';
import {
  ARTIGOS_AJUDA,
  artigosPara,
  buscarAjuda,
  DEFINICAO_PASSOS,
  PASSOS_INICIAIS,
  PERGUNTAS_AJUDA,
  progressoPrimeirosPassos,
} from './ajuda.js';
import { ITENS_MENU } from './menu.js';

describe('central de ajuda', () => {
  it('ids únicos; perguntas e passos apontam para artigos que existem', () => {
    const ids = ARTIGOS_AJUDA.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PERGUNTAS_AJUDA) if (p.artigo) expect(ids).toContain(p.artigo);
    for (const p of PASSOS_INICIAIS) expect(ids).toContain(DEFINICAO_PASSOS[p].artigo);
  });

  it('as telas citadas existem no menu (ou são telas conhecidas fora dele)', () => {
    const rotas = new Set([...ITENS_MENU.map((i) => i.rota), '/avisos']);
    const usadas = [
      ...ARTIGOS_AJUDA.map((a) => a.rota).filter((r) => r !== null),
      ...PASSOS_INICIAIS.map((p) => DEFINICAO_PASSOS[p].rota),
    ];
    for (const r of usadas) expect(rotas).toContain(r!.split('?')[0]);
  });

  it('o barbeiro não vê como montar o bot nem a assinatura', () => {
    const doBarbeiro = artigosPara(['barbeiro']).map((a) => a.id);
    expect(doBarbeiro).toContain('comanda');
    expect(doBarbeiro).not.toContain('menu-do-bot');
    expect(doBarbeiro).not.toContain('assinatura-e-fundador');
  });

  it('busca sem acento e com várias palavras; título vem primeiro', () => {
    expect(buscarAjuda('whatsapp', ['dono'])[0]!.id).toBe('conectar-whatsapp');
    expect(buscarAjuda('COMISSAO', ['dono']).map((a) => a.id)).toContain('comissoes');
    expect(buscarAjuda('caixa gaveta', ['dono']).map((a) => a.id)).toEqual(['caixa-do-dia']);
    expect(buscarAjuda('xyzinexistente', ['dono'])).toEqual([]);
    expect(buscarAjuda('', ['barbeiro'])).toEqual(artigosPara(['barbeiro']));
  });

  it('progresso dos primeiros passos', () => {
    const nada = Object.fromEntries(PASSOS_INICIAIS.map((p) => [p, false])) as Record<
      (typeof PASSOS_INICIAIS)[number],
      boolean
    >;
    expect(progressoPrimeirosPassos(nada)).toEqual({ feitos: 0, total: 8, proximo: 'servicos' });
    expect(
      progressoPrimeirosPassos({ ...nada, servicos: true, equipe: true, whatsapp: true }),
    ).toEqual({ feitos: 3, total: 8, proximo: 'convite' });
    const tudo = Object.fromEntries(PASSOS_INICIAIS.map((p) => [p, true])) as typeof nada;
    expect(progressoPrimeirosPassos(tudo).proximo).toBeNull();
  });
});
