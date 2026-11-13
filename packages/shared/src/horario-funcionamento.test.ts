import { describe, expect, it } from 'vitest';
import {
  diasQueAbre,
  fechamentoDoDia,
  horarioFuncionamentoSchema,
  lerFuncionamento,
  limitarAoFuncionamento,
  linhasDoFuncionamento,
} from './horario-funcionamento.js';

const turno = (diaSemana: number, inicioMin: number, fimMin: number) => ({
  diaSemana,
  inicioMin,
  fimMin,
});
// Terça a sexta, 9h às 12h e 13h às 20h; sábado, 8h às 18h.
const semana = [
  ...[2, 3, 4, 5].flatMap((d) => [turno(d, 540, 720), turno(d, 780, 1200)]),
  turno(6, 480, 1080),
];

describe('horário de funcionamento da unidade', () => {
  it('valida turnos: fecha depois de abrir, até dois por dia, sem sobrepor', () => {
    expect(horarioFuncionamentoSchema.safeParse({ turnos: semana }).success).toBe(true);
    expect(horarioFuncionamentoSchema.safeParse({ turnos: [turno(1, 600, 540)] }).success).toBe(
      false,
    );
    expect(
      horarioFuncionamentoSchema.safeParse({
        turnos: [turno(1, 540, 720), turno(1, 700, 900)],
      }).success,
    ).toBe(false);
    expect(
      horarioFuncionamentoSchema.safeParse({
        turnos: [turno(1, 400, 500), turno(1, 540, 600), turno(1, 700, 800)],
      }).success,
    ).toBe(false);
    expect(lerFuncionamento('lixo')).toEqual([]);
    expect(diasQueAbre(semana)).toEqual([2, 3, 4, 5, 6]);
  });

  it('o expediente do barbeiro fica dentro do horário da unidade', () => {
    // Barbeiro das 8h às 21h na terça: só vale das 9h às 12h e das 13h às 20h.
    expect(limitarAoFuncionamento([{ inicioMin: 480, fimMin: 1260 }], semana, 2)).toEqual([
      { inicioMin: 540, fimMin: 720 },
      { inicioMin: 780, fimMin: 1200 },
    ]);
    // Segunda a unidade não abre.
    expect(limitarAoFuncionamento([{ inicioMin: 480, fimMin: 1260 }], semana, 1)).toEqual([]);
    // Sem turnos cadastrados, não limita.
    expect(limitarAoFuncionamento([{ inicioMin: 480, fimMin: 1260 }], [], 1)).toEqual([
      { inicioMin: 480, fimMin: 1260 },
    ]);
  });

  it('texto do horário e hora de fechar', () => {
    expect(linhasDoFuncionamento(semana)).toEqual([
      { dias: 'Terça a sexta', horario: '9h às 12h e 13h às 20h' },
      { dias: 'Sábado', horario: '8h às 18h' },
      { dias: 'Segunda e domingo', horario: null },
    ]);
    expect(fechamentoDoDia(semana, 2)).toBe(1200);
    expect(fechamentoDoDia(semana, 0)).toBeNull();
  });
});
