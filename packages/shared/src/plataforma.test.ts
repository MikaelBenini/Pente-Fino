import { describe, expect, it } from 'vitest';
import { fimDoPeriodo, mudarSituacaoContaSchema, registrarPagamentoSchema } from './plataforma.js';

describe('administração: ações numa conta', () => {
  it('fim do período: um mês ou um ano, menos um dia, sem pular o fim do mês', () => {
    expect(fimDoPeriodo('2026-11-05', 'mensal')).toBe('2026-12-04');
    expect(fimDoPeriodo('2026-11-05', 'anual')).toBe('2027-11-04');
    expect(fimDoPeriodo('2026-01-31', 'mensal')).toBe('2026-02-27');
    expect(fimDoPeriodo('2026-12-01', 'mensal')).toBe('2026-12-31');
  });

  it('motivo obrigatório e pagamento em centavos', () => {
    expect(mudarSituacaoContaSchema.safeParse({ acao: 'cancelar', motivo: 'oi' }).success).toBe(
      false,
    );
    expect(
      registrarPagamentoSchema.parse({
        valor: 14990,
        forma: 'pix',
        pagoEm: '2026-11-07',
        periodoInicio: '2026-11-07',
      }),
    ).toMatchObject({ comprovante: null });
    expect(
      registrarPagamentoSchema.safeParse({
        valor: 149.9,
        forma: 'pix',
        pagoEm: '2026-11-07',
        periodoInicio: '2026-11-07',
      }).success,
    ).toBe(false);
  });
});
