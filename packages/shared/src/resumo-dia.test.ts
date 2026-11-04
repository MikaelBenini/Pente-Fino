import { describe, expect, it } from 'vitest';
import {
  contarDia,
  fazAniversario,
  proximoAtendimento,
  resumoPorDia,
  situacaoNoDia,
  type EntradaDia,
} from './resumo-dia.js';

const h = (x: string) => new Date(`2026-11-04T${x}:00-03:00`);
const e = (inicio: string, fim: string, p: Partial<EntradaDia> = {}): EntradaDia => ({
  inicio: h(inicio),
  fim: h(fim),
  situacao: 'a_atender',
  pendente: false,
  valor: 5000,
  ...p,
});

describe('situacaoNoDia', () => {
  it('traduz comanda e agendamento para a linguagem do balcão', () => {
    expect(situacaoNoDia('prevista', 'agendado')).toBe('a_atender');
    expect(situacaoNoDia('em_atendimento')).toBe('em_atendimento');
    expect(situacaoNoDia('confirmada')).toBe('aguardando_fechamento');
    expect(situacaoNoDia('pendente')).toBe('aguardando_fechamento');
    expect(situacaoNoDia('reaberta')).toBe('aguardando_fechamento');
    expect(situacaoNoDia('fechada', 'atendido')).toBe('fechada');
    expect(situacaoNoDia('cancelada', 'falta')).toBe('faltou');
    expect(situacaoNoDia('cancelada')).toBe('cancelada');
    expect(situacaoNoDia('prevista', 'cancelado')).toBe('cancelada');
  });
});

describe('contarDia', () => {
  it('conta cada situação e soma o que ainda vai entrar', () => {
    const c = contarDia([
      e('09:00', '09:30', { situacao: 'fechada', valor: 7000 }),
      e('10:00', '10:30', { situacao: 'aguardando_fechamento', pendente: true, valor: 4500 }),
      e('11:00', '11:30', { situacao: 'em_atendimento', valor: 3000 }),
      e('14:00', '14:30', { valor: 5000 }),
      e('15:00', '15:30', { situacao: 'faltou' }),
      e('16:00', '16:30', { situacao: 'cancelada' }),
    ]);
    expect(c).toEqual({
      marcados: 5,
      aAtender: 1,
      emAtendimento: 1,
      aguardandoFechamento: 1,
      pendentes: 1,
      fechadas: 1,
      faltas: 1,
      canceladas: 1,
      valorEmAberto: 4500 + 3000 + 5000,
    });
  });
});

describe('proximoAtendimento', () => {
  it('o primeiro a atender cujo horário não acabou, mesmo atrasado', () => {
    const lista = [
      e('16:00', '16:30'),
      e('10:00', '10:30', { situacao: 'fechada' }),
      e('11:00', '11:30'), // atrasado, ainda no horário
      e('09:00', '09:30'), // horário já passou
    ];
    expect(proximoAtendimento(lista, h('11:10'))?.inicio).toEqual(h('11:00'));
    expect(proximoAtendimento(lista, h('17:00'))).toBeNull();
  });
});

describe('fazAniversario', () => {
  it('compara mês e dia; 29/02 vira 28/02 em ano comum', () => {
    expect(fazAniversario('1990-11-04', '2026-11-04')).toBe(true);
    expect(fazAniversario('1990-11-05', '2026-11-04')).toBe(false);
    expect(fazAniversario('2000-02-29', '2026-02-28')).toBe(true);
    expect(fazAniversario('2000-02-29', '2028-02-29')).toBe(true);
    expect(fazAniversario('2000-02-29', '2028-02-28')).toBe(false);
    expect(fazAniversario(null, '2026-11-04')).toBe(false);
  });
});

describe('resumoPorDia', () => {
  it('uma linha por dia, com calendário, agenda e comandas fechadas', () => {
    const item = {
      tipo: 'servico' as const,
      quantidade: 1,
      precoUnitario: 5000,
      desconto: 0,
      ehExtra: false,
      pesoAtendimento: 1,
      custoUnitario: 0,
      comissaoValor: 2000,
    };
    const r = resumoPorDia(
      ['2026-11-01', '2026-11-02'],
      ['2026-11-02'],
      [
        { data: '2026-11-02', comanda: { itens: [item] } },
        {
          data: '2026-11-02',
          comanda: { itens: [item, { ...item, ehExtra: true, pesoAtendimento: 0 }] },
        },
      ],
      [
        { data: '2026-11-02', status: 'atendido' },
        { data: '2026-11-02', status: 'falta' },
        { data: '2026-11-02', status: 'cancelado' },
      ],
    );
    expect(r[0]).toMatchObject({
      data: '2026-11-01',
      trabalha: false,
      agendados: 0,
      faturamento: 0,
    });
    expect(r[1]).toEqual({
      data: '2026-11-02',
      trabalha: true,
      agendados: 2,
      faltas: 1,
      cancelados: 1,
      clientes: 2,
      atendimentos: 2,
      faturamento: 15000,
      ticketMedio: 7500,
      comissao: 6000,
    });
  });
});
