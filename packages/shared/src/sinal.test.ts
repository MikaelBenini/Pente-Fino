import { describe, expect, it } from 'vitest';
import { entradasDoCaixa, restanteAposSinal } from './sinal.js';

describe('sinal', () => {
  it('abate do total no fechamento; negativo quando passa do total', () => {
    expect(restanteAposSinal(8000, [{ valor: 3000 }])).toBe(5000);
    expect(restanteAposSinal(8000, [])).toBe(8000);
    expect(restanteAposSinal(2000, [{ valor: 3000 }])).toBe(-1000);
  });

  it('o caixa soma as fechadas (sem sinal), os sinais do dia e tira os devolvidos', () => {
    const r = entradasDoCaixa({
      fechadas: [
        { forma: 'pix', valor: 5000 },
        { forma: 'dinheiro', valor: 2000 },
      ],
      sinaisRecebidos: [{ forma: 'pix', valor: 3000 }],
      sinaisDevolvidos: [{ forma: 'dinheiro', valor: 1000 }],
    });
    expect(r.porForma).toEqual([
      { forma: 'dinheiro', total: 1000, quantidade: 1 },
      { forma: 'pix', total: 8000, quantidade: 2 },
    ]);
    expect(r.total).toBe(9000);
    expect(r.sinais).toEqual({ recebidos: 3000, devolvidos: 1000 });
  });

  it('dia sem nada: vazio', () => {
    expect(entradasDoCaixa({ fechadas: [], sinaisRecebidos: [], sinaisDevolvidos: [] })).toEqual({
      porForma: [],
      total: 0,
      sinais: { recebidos: 0, devolvidos: 0 },
    });
  });
});
