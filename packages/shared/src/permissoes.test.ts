import { describe, expect, it } from 'vitest';
import { papeisNaUnidade, podeNaUnidade, temAlgumPapel, unidadesPermitidas } from './permissoes.js';

const centro = 'u-centro';
const jardins = 'u-jardins';

describe('permissões por unidade', () => {
  const gestorCentro = [{ papel: 'gestor' as const, unidadeId: centro }];
  const dono = [{ papel: 'dono' as const, unidadeId: null }];
  const misto = [
    { papel: 'gestor' as const, unidadeId: centro },
    { papel: 'barbeiro' as const, unidadeId: jardins },
  ];

  it('papel sem unidade vale em todas', () => {
    expect(podeNaUnidade(dono, jardins, ['dono'])).toBe(true);
    expect(unidadesPermitidas(dono, ['dono', 'gestor'])).toBe('todas');
  });

  it('gestor só na própria unidade', () => {
    expect(podeNaUnidade(gestorCentro, centro, ['gestor'])).toBe(true);
    expect(podeNaUnidade(gestorCentro, jardins, ['gestor'])).toBe(false);
  });

  it('papéis diferentes em unidades diferentes não se misturam', () => {
    expect(papeisNaUnidade(misto, jardins)).toEqual(['barbeiro']);
    expect(podeNaUnidade(misto, jardins, ['gestor'])).toBe(false);
    expect(unidadesPermitidas(misto, ['gestor'])).toEqual([centro]);
  });

  it('temAlgumPapel ignora a unidade', () => {
    expect(temAlgumPapel(misto, ['barbeiro'])).toBe(true);
    expect(temAlgumPapel(misto, ['dono'])).toBe(false);
  });
});
