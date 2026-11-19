import { describe, expect, it } from 'vitest';
import {
  lerNumeros,
  rotuloDoDia,
  textoConfirmar,
  textoHorarios,
  textoMaisServico,
  textoServicos,
  lerAniversario,
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

describe('somar serviços', () => {
  it('mostra o que já está anotado (total) e os outros para somar, com 0 para seguir', () => {
    const t = textoMaisServico(
      [{ id: 'c', nome: 'Corte', preco: 4500, duracaoMin: 30 }],
      [{ id: 'b', nome: 'Barba', preco: 3000, duracaoMin: 20 }],
    );
    expect(t).toContain('✅ Anotado: Corte · R$');
    expect(t).toContain('30 min');
    expect(t).toMatch(/1\. Barba · R\$\s?30,00 · 20 min/);
    expect(t).toContain('0. Não, escolher o horário');
  });
});

describe('aniversário pela conversa', () => {
  it('lê dia e mês em vários jeitos; o ano não importa', () => {
    expect(lerAniversario('15/03')).toBe('2000-03-15');
    expect(lerAniversario(' 5-3 ')).toBe('2000-03-05');
    expect(lerAniversario('29/02')).toBe('2000-02-29');
    expect(lerAniversario('15/03/1990')).toBe('2000-03-15');
    expect(lerAniversario('31/04')).toBeNull();
    expect(lerAniversario('15/13')).toBeNull();
    expect(lerAniversario('amanhã')).toBeNull();
  });
});

describe('sim e não escritos (cenários de 19/11/2026)', () => {
  it('"sim", "confirmo" e "ok" valem 1; "não" e "cancela" valem 0; o resto, nada', async () => {
    const { respostaSimNao } = await import('./agendar-bot.js');
    const { normalizar } = await import('./bot.js');
    for (const t of ['Sim', 'sim!', 'confirmo', 'OK', 'pode ser', 'Estarei lá'])
      expect(respostaSimNao(normalizar(t))).toBe(1);
    for (const t of ['Não', 'cancela', 'não vou']) expect(respostaSimNao(normalizar(t))).toBe(0);
    for (const t of ['talvez', 'que horas', '']) expect(respostaSimNao(normalizar(t))).toBeNull();
  });
});
