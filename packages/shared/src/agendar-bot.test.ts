import { describe, expect, it } from 'vitest';
import {
  lerNumeros,
  rotuloDoDia,
  textoConfirmar,
  textoHorarios,
  textoServicos,
} from './agendar-bot.js';

describe('lerNumeros', () => {
  it.each([
    ['2', [2]],
    ['1 e 3', [1, 3]],
    ['1, 3', [1, 3]],
    ['1,3', [1, 3]],
    ['opção 2', [2]],
    ['dois', [2]],
    ['0', [0]],
    ['3 3', [3]],
  ])('"%s" → %j', (entrada, numeros) => expect(lerNumeros(entrada)).toEqual(numeros));

  it.each(['quero o 2 amanhã', 'corte', '', '🙂'])('"%s" não é escolha', (e) =>
    expect(lerNumeros(e)).toEqual([]),
  );
});

describe('textos', () => {
  it('rótulo do dia: hoje, amanhã e por extenso', () => {
    expect(rotuloDoDia('2026-11-05', '2026-11-05')).toBe('Hoje (qui, 05/11)');
    expect(rotuloDoDia('2026-11-06', '2026-11-05')).toBe('Amanhã (sex, 06/11)');
    expect(rotuloDoDia('2026-11-09', '2026-11-05')).toBe('Segunda, 09/11');
  });

  it('serviços com preço e duração, uma linha cada, e o link do site', () => {
    const t = textoServicos(
      [
        { id: 'a', nome: 'Corte', preco: 4500, duracaoMin: 30 },
        { id: 'b', nome: 'Barba', preco: 3500, duracaoMin: 20 },
      ],
      'https://app/agendar?u=centro',
    );
    expect(t).toContain('1. Corte · R$ 45,00 · 30 min\n2. Barba · R$ 35,00 · 20 min\n0. Voltar');
    expect(t).toContain('pelo site? https://app/agendar?u=centro');
  });

  it('horários com "ver mais" e o resumo para confirmar', () => {
    const t = textoHorarios(
      'Segunda, 09/11',
      ['2026-11-09T12:00:00.000Z', '2026-11-09T12:30:00.000Z'],
      true,
    );
    expect(t).toBe(
      'Horários livres na segunda, 09/11:\n\n1. 09:00\n2. 09:30\n3. Ver mais horários\n0. Outro dia',
    );
    expect(
      textoConfirmar({
        servicos: ['Corte', 'Barba'],
        profissional: 'Rafael',
        diaRotulo: 'Segunda, 09/11',
        inicio: '2026-11-09T12:00:00.000Z',
        total: 8000,
      }),
    ).toContain('✂️ Corte + Barba\n💈 Com Rafael\n📅 Segunda, 09/11, às 09:00\n💰 R$ 80,00');
  });
});
