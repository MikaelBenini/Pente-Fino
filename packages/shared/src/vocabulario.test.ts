import { describe, expect, it } from 'vitest';
import {
  comArtigo,
  FUNCOES_DO_SEGMENTO,
  funcoesDaConta,
  maiuscula,
  SEGMENTOS,
  vocabulario,
} from './vocabulario.js';

describe('vocabulário por segmento (Fase 1a, 27/11/2026)', () => {
  it('barbearia continua dizendo barbeiro e barbearia (nada muda para quem já usa)', () => {
    const v = vocabulario('barbearia');
    expect(v.profissional.um).toBe('barbeiro');
    expect(v.estabelecimento.um).toBe('barbearia');
    expect(comArtigo(v.estabelecimento)).toBe('a barbearia');
    expect(maiuscula(v.profissional.muitos)).toBe('Barbeiros');
  });

  it('cada segmento tem os quatro termos, com singular e plural', () => {
    for (const s of SEGMENTOS) {
      const v = vocabulario(s);
      for (const termo of [v.estabelecimento, v.profissional, v.cliente, v.atendimento]) {
        expect(termo.um, s).not.toBe('');
        expect(termo.muitos, s).not.toBe('');
      }
      expect(v.nomeSegmento, s).not.toBe('');
    }
  });

  it('estética, academia e personal falam a língua do negócio', () => {
    expect(comArtigo(vocabulario('estetica').profissional)).toBe('a esteticista');
    expect(vocabulario('estetica').atendimento.um).toBe('sessão');
    expect(vocabulario('academia').cliente.muitos).toBe('alunos');
    expect(comArtigo(vocabulario('tatuagem').profissional, true)).toBe('os tatuadores');
  });

  it('segmento desconhecido ou ausente cai em barbearia', () => {
    expect(vocabulario(null).segmento).toBe('barbearia');
    expect(vocabulario('padaria').segmento).toBe('barbearia');
  });

  it('funções: o padrão do segmento ou a escolha do dono', () => {
    expect(funcoesDaConta('estetica', null)).toEqual([...FUNCOES_DO_SEGMENTO.estetica]);
    expect(funcoesDaConta('barbearia', null)).toEqual([]);
    // Barbearia que vende pacotes liga a função sem trocar de segmento (ADR 0014).
    expect(funcoesDaConta('barbearia', ['pacotes', 'inexistente'])).toEqual(['pacotes']);
    expect(funcoesDaConta('academia', [])).toEqual([]);
  });
});
