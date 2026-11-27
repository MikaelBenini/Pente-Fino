import { describe, expect, it } from 'vitest';
import { valorDaCobranca } from './assinatura.js';
import {
  LICENCAS,
  LICENCAS_A_VENDA,
  licencaDaContaNova,
  licencaDoSegmento,
  PLANOS_DA_LICENCA,
  segmentoNaLicenca,
  segmentoPadraoDaLicenca,
} from './licencas.js';
import { limitesDaConta, precoPorMes, verificarLimite } from './planos.js';
import { SEGMENTOS } from './vocabulario.js';

describe('licenças (ADR 0015, 27/11/2026)', () => {
  it('barbearia continua com os preços de sempre', () => {
    expect(precoPorMes('basico', 'mensal')).toBe(7990);
    expect(precoPorMes('basico', 'mensal', 1, undefined, false, 'barbearia')).toBe(7990);
    expect(precoPorMes('pro', 'mensal', 1, undefined, false, 'beleza')).toBe(14990);
    expect(precoPorMes('agenda', 'mensal', 1, undefined, true, 'barbearia')).toBe(2000);
  });

  it('estética e tatuagem têm a tabela própria', () => {
    expect(precoPorMes('basico', 'mensal', 1, undefined, false, 'estetica')).toBe(8990);
    expect(precoPorMes('pro', 'mensal', 1, undefined, false, 'estetica')).toBe(16990);
    expect(precoPorMes('premium', 'mensal', 1, undefined, false, 'estetica')).toBe(27990);
    expect(precoPorMes('basico', 'mensal', 1, undefined, false, 'tatuagem')).toBe(6990);
    // Premium cobra a unidade extra como na barbearia.
    expect(precoPorMes('premium', 'mensal', 2, undefined, false, 'tatuagem')).toBe(21990 + 9990);
  });

  it('Atendimento: R$ 49,90 com as Automações dentro; número extra R$ 29,90', () => {
    expect(precoPorMes('agenda', 'mensal', 1, undefined, true, 'atendimento')).toBe(4990);
    expect(precoPorMes('agenda', 'anual', 1, undefined, false, 'atendimento')).toBe(4190);
    expect(precoPorMes('agenda', 'mensal', 3, undefined, false, 'atendimento')).toBe(
      4990 + 2 * 2990,
    );
    // O cupom vale (as Automações já vêm), e o anual cobra os 12 meses.
    expect(valorDaCobranca('agenda', 'mensal', 1, undefined, 1000, false, 'atendimento')).toBe(
      4491,
    );
    expect(valorDaCobranca('agenda', 'anual', 1, undefined, 0, false, 'atendimento')).toBe(
      4190 * 12,
    );
  });

  it('Atendimento: 3 profissionais por número, unidades sem limite', () => {
    expect(limitesDaConta('agenda', 'atendimento', 2)).toEqual({
      unidades: Number.POSITIVE_INFINITY,
      profissionais: 6,
    });
    expect(verificarLimite('agenda', 'profissionais', 2, 'atendimento', 1)).toBeNull();
    expect(verificarLimite('agenda', 'profissionais', 3, 'atendimento', 1)).toContain(
      '3 profissionais por número de WhatsApp',
    );
    expect(verificarLimite('agenda', 'profissionais', 2)).toContain('O plano Agenda permite 2');
  });

  it('cada segmento cai numa licença e combina com ela', () => {
    for (const s of SEGMENTOS) {
      const l = licencaDoSegmento(s);
      expect(segmentoNaLicenca(l, s), s).toBe(true);
      expect(segmentoNaLicenca('atendimento', s), s).toBe(true);
    }
    expect(licencaDoSegmento('unhas')).toBe('beleza');
    expect(licencaDoSegmento('personal')).toBe('fitness');
    expect(segmentoNaLicenca('estetica', 'barbearia')).toBe(false);
    for (const l of LICENCAS) expect(segmentoNaLicenca(l, segmentoPadraoDaLicenca(l))).toBe(true);
  });

  it('Fitness fica fora da venda até a Fase 1c; Atendimento vende só um plano', () => {
    expect(LICENCAS_A_VENDA).not.toContain('fitness');
    expect(PLANOS_DA_LICENCA.atendimento).toEqual(['agenda']);
  });
});

describe('conta nova com licença', () => {
  it('usa o segmento pedido quando combina; senão, o de partida', () => {
    expect(licencaDaContaNova({ licenca: 'beleza', segmento: 'unhas', plano: 'pro' })).toEqual({
      licenca: 'beleza',
      segmento: 'unhas',
    });
    expect(
      licencaDaContaNova({ licenca: 'estetica', segmento: 'barbearia', plano: 'basico' }),
    ).toEqual({ licenca: 'estetica', segmento: 'estetica' });
  });
  it('recusa licença fora da venda e plano que a licença não tem', () => {
    expect(licencaDaContaNova({ licenca: 'fitness', plano: 'pro' })).toHaveProperty('erro');
    expect(licencaDaContaNova({ licenca: 'atendimento', plano: 'pro' })).toHaveProperty('erro');
    expect(licencaDaContaNova({ licenca: 'atendimento', plano: 'agenda' })).toEqual({
      licenca: 'atendimento',
      segmento: 'barbearia',
    });
  });
});
