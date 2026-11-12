import { describe, expect, it } from 'vitest';
import { ETAPAS_FUNIL, etapaAtualDoFunil, resumirFunil, type ContaNoFunil } from './funil.js';

const conta = (p: Partial<ContaNoFunil> = {}): ContaNoFunil => ({
  id: 'x',
  criadoEm: '2026-11-01T12:00:00Z',
  interna: false,
  servicos: false,
  barbeiros: false,
  agendamento: false,
  comanda: false,
  whatsapp: false,
  pagamento: false,
  ...p,
});

describe('etapaAtualDoFunil (admin F1)', () => {
  it('a primeira etapa que falta, na ordem do funil', () => {
    expect(etapaAtualDoFunil(conta())).toBe('servicos');
    expect(etapaAtualDoFunil(conta({ servicos: true, barbeiros: true }))).toBe('agendamento');
  });

  it('pular uma etapa não esconde a que falta antes', () => {
    expect(etapaAtualDoFunil(conta({ servicos: true, agendamento: true }))).toBe('barbeiros');
  });

  it('tudo feito: concluída (null)', () => {
    expect(
      etapaAtualDoFunil(
        conta({
          servicos: true,
          barbeiros: true,
          agendamento: true,
          comanda: true,
          whatsapp: true,
          pagamento: true,
        }),
      ),
    ).toBeNull();
  });
});

describe('resumirFunil', () => {
  const contas = [
    conta({ id: 'a', servicos: true, barbeiros: true, agendamento: true, comanda: true }),
    conta({ id: 'b', servicos: true, barbeiros: true }),
    conta({ id: 'c' }),
    conta({ id: 'interna', interna: true, servicos: true }),
    conta({ id: 'antiga', criadoEm: '2026-01-01T12:00:00Z', servicos: true }),
  ];

  it('conta as contas que fizeram cada etapa, sem as internas', () => {
    const r = resumirFunil(contas);
    expect(r.total).toBe(4);
    expect(r.etapas.map((e) => [e.etapa, e.contas])).toEqual([
      ['cadastro', 4],
      ['servicos', 3],
      ['barbeiros', 2],
      ['agendamento', 1],
      ['comanda', 1],
      ['whatsapp', 0],
      ['pagamento', 0],
    ]);
    expect(r.etapas[1]!.pct).toBe(75);
  });

  it('só os cadastros desde a data pedida', () => {
    const r = resumirFunil(contas, '2026-10-01T00:00:00Z');
    expect(r.total).toBe(3);
    expect(r.etapas.find((e) => e.etapa === 'servicos')!.contas).toBe(2);
  });

  it('sem contas: zero, sem dividir por zero', () => {
    const r = resumirFunil([]);
    expect(r.total).toBe(0);
    expect(r.etapas.every((e) => e.pct === 0)).toBe(true);
  });

  it('as etapas seguem a ordem do plano: cadastro até pagamento', () => {
    expect(ETAPAS_FUNIL.map((e) => e.etapa)).toEqual([
      'cadastro',
      'servicos',
      'barbeiros',
      'agendamento',
      'comanda',
      'whatsapp',
      'pagamento',
    ]);
  });
});
