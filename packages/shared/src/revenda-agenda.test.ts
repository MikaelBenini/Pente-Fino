import { describe, expect, it } from 'vitest';
import { conviteDoLimite, verificarLimite } from './planos.js';
import {
  conviteDoInicio,
  muitasFaltas,
  planoDosRecursos,
  podeExperimentar,
  recursoDaConta,
  resumoDaAgenda,
  type HorarioDoMes,
} from './revenda-agenda.js';

const agora = new Date('2026-11-14T15:00:00Z');
const h = (p: Partial<HorarioDoMes>): HorarioDoMes => ({
  status: 'agendado',
  inicio: '2026-11-10T13:00:00Z',
  origem: 'balcao',
  clienteNovo: false,
  ...p,
});

describe('resumoDaAgenda', () => {
  it('separa atendidos, faltas, cancelados e o que ainda vem; conta novos e marcados pelo cliente', () => {
    const r = resumoDaAgenda(
      [
        h({ status: 'atendido', clienteNovo: true, origem: 'link' }),
        h({ status: 'agendado' }),
        h({ status: 'falta' }),
        h({ status: 'cancelado', origem: 'bot' }),
        h({ inicio: '2026-11-20T13:00:00Z', origem: 'link' }),
      ],
      agora,
    );
    expect(r).toEqual({
      marcados: 5,
      atendidos: 2,
      faltas: 1,
      cancelados: 1,
      aVir: 1,
      clientesNovos: 1,
      peloCliente: 3,
    });
  });
});

describe('convites', () => {
  const base = resumoDaAgenda([h({}), h({}), h({})], agora);

  it('muitas faltas: pelo menos 3 e 10% do que já passou', () => {
    expect(muitasFaltas({ ...base, faltas: 2 })).toBe(false);
    expect(muitasFaltas({ ...base, atendidos: 20, faltas: 3 })).toBe(true);
    expect(muitasFaltas({ ...base, atendidos: 40, faltas: 3 })).toBe(false);
  });

  it('a ordem: faltas sem Automações, depois o Básico aos 30 dias, depois a conta', () => {
    const faltas = { ...base, atendidos: 10, faltas: 4 };
    expect(
      conviteDoInicio({ plano: 'agenda', automacoes: false, diasDeConta: 40, resumo: faltas })
        ?.tipo,
    ).toBe('automacoes');
    const c = conviteDoInicio({
      plano: 'agenda',
      automacoes: true,
      diasDeConta: 40,
      resumo: faltas,
    });
    expect(c).toMatchObject({ tipo: 'basico', titulo: 'Você atendeu 10 horários este mês' });
    expect(
      conviteDoInicio({ plano: 'agenda', automacoes: true, diasDeConta: 5, resumo: base })?.tipo,
    ).toBe('conta');
    expect(
      conviteDoInicio({ plano: 'agenda', automacoes: false, diasDeConta: 5, resumo: base }),
    ).toBeNull();
    expect(
      conviteDoInicio({ plano: 'basico', automacoes: false, diasDeConta: 90, resumo: faltas }),
    ).toBeNull();
  });

  it('o limite aponta o plano que resolve', () => {
    expect(conviteDoLimite('agenda', 'profissionais')).toBe(
      'No Básico cabem até 3 profissionais, e você passa a ver quanto sobra: comanda, caixa e comissões.',
    );
    expect(conviteDoLimite('pro', 'profissionais')).toMatch(
      /^No Premium os profissionais são ilimitados/,
    );
    expect(verificarLimite('agenda', 'unidades', 1)).toMatch(
      /segunda unidade, o plano é o Premium/,
    );
  });
});

describe('experimentar o Básico por 7 dias', () => {
  it('no Agenda, durante a experiência, os recursos são os do Básico', () => {
    expect(planoDosRecursos('agenda', '2026-11-20T00:00:00Z', agora)).toBe('basico');
    expect(planoDosRecursos('agenda', '2026-11-10T00:00:00Z', agora)).toBe('agenda');
    expect(planoDosRecursos('agenda', null, agora)).toBe('agenda');
    expect(planoDosRecursos('pro', '2026-11-20T00:00:00Z', agora)).toBe('pro');
  });

  it('recursoDaConta junta plano, Automações e a experiência', () => {
    const conta = { plano: 'agenda' as const, automacoes: false, experimentaAte: null };
    expect(recursoDaConta(conta, 'operacao', agora)).toBe(false);
    expect(
      recursoDaConta({ ...conta, experimentaAte: '2026-11-20T00:00:00Z' }, 'operacao', agora),
    ).toBe(true);
    expect(recursoDaConta({ ...conta, automacoes: true }, 'bot', agora)).toBe(true);
  });

  it('uma vez por conta, só no Agenda', () => {
    expect(podeExperimentar('agenda', null)).toBe(true);
    expect(podeExperimentar('agenda', '2026-11-01T00:00:00Z')).toBe(false);
    expect(podeExperimentar('basico', null)).toBe(false);
  });
});
