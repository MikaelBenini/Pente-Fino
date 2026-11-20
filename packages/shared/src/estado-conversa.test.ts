import { describe, expect, it } from 'vitest';
import {
  antecipadoParaForaDoSilencio,
  emHorarioDeSilencio,
  inicioDaJanelaDoLoop,
  pareceLoop,
  proximoHorarioDeEnvio,
  rotuloOrigem,
  situacaoDaConversa,
} from './estado-conversa.js';

// Horários em São Paulo (UTC−3).
const sp = (iso: string) => new Date(`${iso}-03:00`);

describe('situação da conversa', () => {
  it('aguardando vem antes de atendimento; sem nada, é o bot', () => {
    expect(situacaoDaConversa('2026-11-19T16:56:00Z', true)).toBe('aguardando');
    expect(situacaoDaConversa(null, true)).toBe('atendimento');
    expect(situacaoDaConversa(null, false)).toBe('bot');
  });
  it('origem conhecida vira texto; desconhecida aparece como veio', () => {
    expect(rotuloOrigem('painel_devolveu')).toBe('Devolveu ao bot pelo painel');
    expect(rotuloOrigem('outra')).toBe('outra');
  });
});

describe('trava contra loop (testes de 19/11)', () => {
  it('conta só depois que o bot voltou', () => {
    const agora = sp('2026-11-19T13:56:30');
    expect(inicioDaJanelaDoLoop(agora, sp('2026-11-19T13:56:00').toISOString())).toEqual(
      sp('2026-11-19T13:56:00'),
    );
    expect(inicioDaJanelaDoLoop(agora, null)).toEqual(sp('2026-11-19T13:54:30'));
    expect(inicioDaJanelaDoLoop(agora, sp('2026-11-19T10:00:00').toISOString())).toEqual(
      sp('2026-11-19T13:54:30'),
    );
  });
  it('teste longo de uma pessoa não trava; dois robôs travam', () => {
    // Cliente que manda AGENDAR e 2: poucas entradas, mesmo com várias respostas.
    expect(pareceLoop(30, 6)).toBe(false);
    expect(pareceLoop(10, 10)).toBe(false);
    expect(pareceLoop(15, 12)).toBe(true);
  });
});

describe('horário de silêncio (madrugada)', () => {
  it('das 22h às 7h é silêncio', () => {
    expect(emHorarioDeSilencio(sp('2026-11-20T21:59:00'))).toBe(false);
    expect(emHorarioDeSilencio(sp('2026-11-20T22:00:00'))).toBe(true);
    expect(emHorarioDeSilencio(sp('2026-11-21T03:10:00'))).toBe(true);
    expect(emHorarioDeSilencio(sp('2026-11-21T07:00:00'))).toBe(false);
  });
  it('segurada sai às 7h (ou na hora pedida) do dia certo', () => {
    expect(proximoHorarioDeEnvio(sp('2026-11-20T23:30:00'))).toEqual(sp('2026-11-21T07:00:00'));
    expect(proximoHorarioDeEnvio(sp('2026-11-21T02:00:00'))).toEqual(sp('2026-11-21T07:00:00'));
    expect(proximoHorarioDeEnvio(sp('2026-11-21T02:00:00'), 9)).toEqual(sp('2026-11-21T09:00:00'));
    const dia = sp('2026-11-21T15:00:00');
    expect(proximoHorarioDeEnvio(dia)).toBe(dia);
  });
  it('lembrete da madrugada sai na véspera às 21h59; sem tempo, não sai', () => {
    // Horário às 8h, lembrete de 2 h às 6h.
    expect(
      antecipadoParaForaDoSilencio(sp('2026-11-21T06:00:00'), sp('2026-11-19T10:00:00')),
    ).toEqual(sp('2026-11-20T21:59:00'));
    // Lembrete às 23h: também 21h59 do mesmo dia.
    expect(
      antecipadoParaForaDoSilencio(sp('2026-11-20T23:00:00'), sp('2026-11-19T10:00:00')),
    ).toEqual(sp('2026-11-20T21:59:00'));
    // Marcou às 22h30 para as 8h: não há antes possível.
    expect(
      antecipadoParaForaDoSilencio(sp('2026-11-21T06:00:00'), sp('2026-11-20T22:30:00')),
    ).toBeNull();
    const tarde = sp('2026-11-21T15:00:00');
    expect(antecipadoParaForaDoSilencio(tarde, sp('2026-11-19T10:00:00'))).toBe(tarde);
  });
});
