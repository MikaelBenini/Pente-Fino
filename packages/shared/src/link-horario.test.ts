import { describe, expect, it } from 'vitest';
import { decidirLink } from './link-horario.js';

const agora = new Date('2026-12-01T12:00:00Z');
const base = {
  status: 'agendado' as const,
  comandaPrevista: true,
  inicio: new Date('2026-12-02T13:00:00Z'),
  agora,
  prazoMudarMin: 120,
};

describe('decidirLink', () => {
  it('marcado com folga: pode remarcar e cancelar', () => {
    expect(decidirLink(base)).toEqual({ situacao: 'marcado', podeMudar: true, motivo: null });
    expect(decidirLink({ ...base, status: 'confirmado' }).situacao).toBe('confirmado');
  });

  it('dentro do prazo da unidade: mostra, mas manda falar com a barbearia', () => {
    const r = decidirLink({ ...base, inicio: new Date('2026-12-01T13:30:00Z') });
    expect(r).toMatchObject({ situacao: 'marcado', podeMudar: false });
    expect(r.motivo).toContain('até 2 horas antes');
    expect(
      decidirLink({ ...base, inicio: new Date('2026-12-01T12:30:00Z'), prazoMudarMin: 90 }).motivo,
    ).toContain('até 90 minutos antes');
  });

  it('cancelado, já atendido (comanda aberta) e passado não mudam', () => {
    expect(decidirLink({ ...base, status: 'cancelado' }).situacao).toBe('cancelado');
    expect(decidirLink({ ...base, comandaPrevista: false }).situacao).toBe('atendido');
    expect(decidirLink({ ...base, status: 'falta' }).situacao).toBe('passou');
    expect(decidirLink({ ...base, inicio: new Date('2026-12-01T11:00:00Z') })).toMatchObject({
      situacao: 'passou',
      podeMudar: false,
    });
  });
});
