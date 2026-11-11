import { describe, expect, it } from 'vitest';
import { acaoContaSchema } from './situacao-conta.js';
import {
  fimDoPeriodo,
  registrarPagamentoSchema,
  venderContaSchema,
  vendasPorVendedor,
} from './plataforma.js';

describe('administração: ações numa conta', () => {
  it('fim do período: um mês ou um ano, menos um dia, sem pular o fim do mês', () => {
    expect(fimDoPeriodo('2026-11-05', 'mensal')).toBe('2026-12-04');
    expect(fimDoPeriodo('2026-11-05', 'anual')).toBe('2027-11-04');
    expect(fimDoPeriodo('2026-01-31', 'mensal')).toBe('2026-02-27');
    expect(fimDoPeriodo('2026-12-01', 'mensal')).toBe('2026-12-31');
  });

  it('motivo obrigatório e pagamento em centavos', () => {
    expect(acaoContaSchema.safeParse({ acao: 'cancelar', motivo: 'oi' }).success).toBe(false);
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

describe('venda presencial', () => {
  it('telefone vira 55 + número; teste de 14 dias por padrão', () => {
    const v = venderContaSchema.parse({
      barbearia: 'Barbearia do Zé',
      dono: { nome: 'Zé Silva', email: ' ZE@Exemplo.com ', telefone: '(11) 98888-7777' },
      plano: 'pro',
      ciclo: 'mensal',
    });
    expect(v.dono).toEqual({
      nome: 'Zé Silva',
      email: 'ze@exemplo.com',
      telefone: '5511988887777',
    });
    expect(v.diasTeste).toBe(14);
  });

  it('vendas por vendedor: criadas, ativadas e pagas', () => {
    expect(
      vendasPorVendedor({
        vendedores: [
          { id: 'v1', nome: 'Vitor' },
          { id: 'v2', nome: 'Bruna' },
        ],
        contas: [
          { id: 'a', vendedorId: 'v1', donoAtivou: true },
          { id: 'b', vendedorId: 'v1', donoAtivou: false },
          { id: 'c', vendedorId: 'v2', donoAtivou: true },
          { id: 'd', vendedorId: null, donoAtivou: true },
        ],
        contasPagas: new Set(['c', 'd']),
      }),
    ).toEqual([
      { vendedorId: 'v2', nome: 'Bruna', criadas: 1, ativadas: 1, pagas: 1 },
      { vendedorId: 'v1', nome: 'Vitor', criadas: 2, ativadas: 1, pagas: 0 },
    ]);
  });
});
