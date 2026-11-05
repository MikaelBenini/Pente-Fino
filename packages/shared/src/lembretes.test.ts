import { describe, expect, it } from 'vitest';
import { momentosDosLembretes, textoLembrete } from './lembretes.js';

const inicio = new Date('2026-11-10T17:00:00Z');
const horas = (h: number) => new Date(inicio.getTime() - h * 3_600_000);

describe('momentosDosLembretes', () => {
  it('marcado com dias de antecedência: 24 h e 2 h antes', () => {
    expect(momentosDosLembretes(inicio, horas(72), horas(72))).toEqual([
      { tipo: '24h', quando: horas(24) },
      { tipo: '2h', quando: horas(2) },
    ]);
  });

  it('marcado para hoje à tarde: só o de 2 h; para daqui a pouco: nenhum', () => {
    expect(momentosDosLembretes(inicio, horas(5), horas(5)).map((m) => m.tipo)).toEqual(['2h']);
    expect(momentosDosLembretes(inicio, horas(1), horas(1))).toEqual([]);
  });

  it('remarcado já dentro das 24 h: o de 24 h que já passou fica de fora', () => {
    expect(momentosDosLembretes(inicio, horas(72), horas(10)).map((m) => m.tipo)).toEqual(['2h']);
  });
});

describe('horas da unidade', () => {
  it('48 h e 3 h; só um lembrete; nenhum', () => {
    expect(momentosDosLembretes(inicio, horas(96), horas(96), [3, 48])).toEqual([
      { tipo: '24h', quando: horas(48) },
      { tipo: '2h', quando: horas(3) },
    ]);
    expect(momentosDosLembretes(inicio, horas(96), horas(96), [12]).map((m) => m.tipo)).toEqual([
      '24h',
    ]);
    expect(momentosDosLembretes(inicio, horas(96), horas(96), [])).toEqual([]);
  });
});

describe('textoLembrete', () => {
  const d = {
    cliente: 'João Pedro',
    barbearia: 'Barbearia Navalha',
    diaRotulo: 'Amanhã (ter, 10/11)',
    inicio: inicio.toISOString(),
    servicos: ['Corte', 'Barba'],
    profissional: 'Rafael',
  };

  it('24 h: confirma, remarca ou cancela', () => {
    expect(textoLembrete('24h', d)).toBe(
      'Oi, João! Lembrete do seu horário na Barbearia Navalha:\n\n📅 Amanhã (ter, 10/11), às 14:00\n✂️ Corte + Barba com Rafael\n\n1. Confirmo\n2. Remarcar\n3. Cancelar',
    );
  });

  it('2 h: só confirma; mudar é com a recepção', () => {
    expect(textoLembrete('2h', { ...d, cliente: null })).toMatch(
      /^Oi! Lembrete[\s\S]*1\. Confirmo\n\nPrecisa mudar\? Responda ATENDENTE\.$/,
    );
  });
});
