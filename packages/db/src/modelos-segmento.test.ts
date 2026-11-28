import { SEGMENTOS } from '@pente-fino/shared';
import { describe, expect, it } from 'vitest';
import { MODELO_SERVICOS } from './modelos.js';
import { MODELOS_SERVICOS_POR_SEGMENTO, modelosDeServico } from './modelos-segmento.js';

describe('serviços prontos por segmento (Fase 1b)', () => {
  it('cada segmento tem serviços válidos, sem nome repetido', () => {
    for (const s of SEGMENTOS) {
      const lista = MODELOS_SERVICOS_POR_SEGMENTO[s];
      expect(lista.length, s).toBeGreaterThanOrEqual(3);
      expect(new Set(lista.map((m) => m.nome.toLowerCase())).size, s).toBe(lista.length);
      for (const m of lista) {
        expect(m.duracaoMin, `${s}: ${m.nome}`).toBeGreaterThan(0);
        expect(Number.isInteger(m.precoSugerido) && m.precoSugerido > 0, m.nome).toBe(true);
        expect(Number.isInteger(m.custoProduto) && m.custoProduto >= 0, m.nome).toBe(true);
        // Peso: extra 0, principal pelo menos 1.
        expect(m.pesoAtendimento, m.nome).toBe(m.ehExtra ? 0 : Math.max(1, m.pesoAtendimento));
      }
    }
  });

  it('barbearia continua com os serviços de sempre; segmento desconhecido também', () => {
    expect(modelosDeServico('barbearia')).toBe(MODELO_SERVICOS);
    expect(modelosDeServico(null)).toBe(MODELO_SERVICOS);
    expect(modelosDeServico('estetica').map((m) => m.nome)).toContain('Limpeza de pele');
    expect(modelosDeServico('unhas').map((m) => m.nome)).toContain('Manicure');
  });
});
