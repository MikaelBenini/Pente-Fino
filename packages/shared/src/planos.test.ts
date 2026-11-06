import { describe, expect, it } from 'vitest';
import {
  diasRestantesTeste,
  incluiRecurso,
  precoPorMes,
  conferirTrocaDePlano,
  RECURSOS,
  RECURSOS_PLANO,
  temRecurso,
  textoRecursoBloqueado,
  resumoAnual,
  verificarLimite,
} from './planos.js';

describe('limites do plano', () => {
  it('básico: 1 unidade e 3 profissionais', () => {
    expect(verificarLimite('basico', 'unidades', 0)).toBeNull();
    expect(verificarLimite('basico', 'unidades', 1)).toMatch(/permite 1 unidade/);
    expect(verificarLimite('basico', 'profissionais', 2)).toBeNull();
    expect(verificarLimite('basico', 'profissionais', 3)).toMatch(/3 profissionais ativos/);
  });

  it('pro: até 10 profissionais', () => {
    expect(verificarLimite('pro', 'profissionais', 9)).toBeNull();
    expect(verificarLimite('pro', 'profissionais', 10)).not.toBeNull();
  });

  it('premium: sem limite', () => {
    expect(verificarLimite('premium', 'unidades', 40)).toBeNull();
    expect(verificarLimite('premium', 'profissionais', 500)).toBeNull();
  });
});

describe('preços de venda (seção 7 da documentação)', () => {
  it('mensal e anual por mês', () => {
    expect(precoPorMes('basico', 'mensal')).toBe(7990);
    expect(precoPorMes('pro', 'anual')).toBe(12490);
  });

  it('anual total e economia batem com a tabela', () => {
    expect(resumoAnual('basico')).toEqual({ total: 80280, economia: 15600 });
    expect(resumoAnual('pro')).toEqual({ total: 149880, economia: 30000 });
    expect(resumoAnual('premium')).toEqual({ total: 249480, economia: 50400 });
  });

  it('rede de 4 unidades no Premium: R$ 549,60 no mensal e R$ 456,60 no anual', () => {
    expect(precoPorMes('premium', 'mensal', 4)).toBe(54960);
    expect(precoPorMes('premium', 'anual', 4)).toBe(45660);
  });

  it('unidade extra só conta no Premium', () => {
    expect(precoPorMes('pro', 'mensal', 3)).toBe(14990);
  });

  it('cada plano inclui o que o anterior tem', () => {
    const basico = RECURSOS_PLANO.filter((r) => incluiRecurso('basico', r));
    const pro = RECURSOS_PLANO.filter((r) => incluiRecurso('pro', r));
    expect(pro.length).toBeGreaterThan(basico.length);
    expect(basico.every((r) => incluiRecurso('premium', r))).toBe(true);
  });
});

describe('diasRestantesTeste', () => {
  it('conta dias pelo calendário de São Paulo', () => {
    const agora = new Date('2026-11-04T15:00:00Z'); // 12h em SP
    expect(diasRestantesTeste(new Date('2026-11-18T15:00:00Z'), agora)).toBe(14);
    // 01h UTC do dia 19 ainda é dia 18 em SP.
    expect(diasRestantesTeste(new Date('2026-11-19T01:00:00Z'), agora)).toBe(14);
    expect(diasRestantesTeste(new Date('2026-11-04T23:00:00Z'), agora)).toBe(0);
    expect(diasRestantesTeste(new Date('2026-11-02T12:00:00Z'), agora)).toBe(-2);
  });
});

describe('recursos por plano', () => {
  it('Básico não tem os do Pro; Pro não tem os do Premium', () => {
    expect(temRecurso('basico', 'comissoes')).toBe(false);
    expect(temRecurso('pro', 'comissoes')).toBe(true);
    expect(temRecurso('pro', 'rede')).toBe(false);
    expect(temRecurso('premium', 'rede')).toBe(true);
    expect(temRecurso('premium', 'listaEspera')).toBe(true);
  });

  it('a frase diz em que plano está e qual é o da conta', () => {
    expect(textoRecursoBloqueado('rede', 'pro')).toBe(
      'Várias unidades e painel da rede: faz parte do plano Premium. Seu plano é o Pro; mude de plano para usar.',
    );
  });

  it('o comparativo traz cada recurso conferido pela API, no plano certo', () => {
    for (const r of Object.keys(RECURSOS) as (keyof typeof RECURSOS)[]) {
      const item = RECURSOS_PLANO.find((x) => x.recurso === r);
      expect(item?.desde).toBe(RECURSOS[r].desde);
    }
  });
});

describe('troca de plano', () => {
  const uso = {
    unidades: 1,
    profissionais: 4,
    whatsappConectado: true,
    adesoesAtivas: 12,
    esperaAguardando: 0,
  };

  it('subir: sem bloqueio nem perda, com o valor novo', () => {
    const p = conferirTrocaDePlano({
      de: 'basico',
      para: 'pro',
      ciclo: 'mensal',
      uso: { ...uso, whatsappConectado: false },
    });
    expect(p).toMatchObject({
      sobe: true,
      valorAtual: 7990,
      valorNovo: 14990,
      bloqueios: [],
      perdas: [],
    });
  });

  it('descer para o Básico: limites e WhatsApp bloqueiam; o que se perde aparece', () => {
    const p = conferirTrocaDePlano({ de: 'pro', para: 'basico', ciclo: 'anual', uso });
    expect(p.sobe).toBe(false);
    expect(p.valorNovo).toBe(6690);
    expect(p.bloqueios).toEqual([
      'O plano Básico vai até 3 profissionais ativos; a conta tem 4. Registre a saída de quem não atende mais em Equipe.',
      'O bot do WhatsApp não faz parte do plano Básico. Desconecte o WhatsApp em Bot → Conexão antes de mudar.',
    ]);
    expect(p.perdas).toContain(
      'Clube da barbearia: assinatura, combos e convênios (12 assinantes continuam cadastrados, sem novas adesões nem baixas)',
    );
    expect(p.perdas).toHaveLength(8);
  });

  it('descer do Premium para o Pro com duas unidades: bloqueia', () => {
    const p = conferirTrocaDePlano({
      de: 'premium',
      para: 'pro',
      ciclo: 'mensal',
      uso: { ...uso, unidades: 2 },
    });
    expect(p.bloqueios[0]).toMatch(/^O plano Pro vai até 1 unidade; a conta tem 2 ativas/);
    expect(p.perdas).toEqual([
      'Várias unidades e painel da rede',
      'Lucro real e margem por serviço e produto',
      'Automações do bot: retorno, aniversário e aviso do clube',
    ]);
  });
});
