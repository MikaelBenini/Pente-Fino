import { describe, expect, it } from 'vitest';
import { avisoDoChat, chatEmHorario, iniciarChatSchema } from './chat-suporte.js';

// Horários em UTC; São Paulo = UTC−3.
const sp = (iso: string) => new Date(`${iso}-03:00`);

describe('chatEmHorario (admin F6)', () => {
  it('segunda a sexta das 9h às 18h; sábado das 9h às 13h; domingo fechado', () => {
    expect(chatEmHorario(sp('2026-11-16T09:00:00'))).toBe(true); // segunda
    expect(chatEmHorario(sp('2026-11-16T17:59:00'))).toBe(true);
    expect(chatEmHorario(sp('2026-11-16T18:00:00'))).toBe(false);
    expect(chatEmHorario(sp('2026-11-16T08:59:00'))).toBe(false);
    expect(chatEmHorario(sp('2026-11-21T12:30:00'))).toBe(true); // sábado
    expect(chatEmHorario(sp('2026-11-21T13:00:00'))).toBe(false);
    expect(chatEmHorario(sp('2026-11-22T10:00:00'))).toBe(false); // domingo
  });
});

describe('iniciarChatSchema', () => {
  const base = { nome: 'Carlos', texto: 'Quanto custa para 3 barbeiros?' };
  it('aceita WhatsApp com DDD ou e-mail', () => {
    expect(iniciarChatSchema.safeParse({ ...base, contato: '(11) 98888-7777' }).success).toBe(true);
    expect(iniciarChatSchema.safeParse({ ...base, contato: 'carlos@barbearia.com' }).success).toBe(
      true,
    );
  });
  it('recusa contato que não dá para responder', () => {
    const r = iniciarChatSchema.safeParse({ ...base, contato: '98888' });
    expect(r.success).toBe(false);
  });
});

describe('avisoDoChat', () => {
  const base = { status: 'fila' as const, posicao: 1, atendente: null, emHorario: true };
  it('fila, atendimento, fora do horário e encerrada', () => {
    expect(avisoDoChat(base)).toBe('Você é o próximo da fila. Já já alguém responde.');
    expect(avisoDoChat({ ...base, posicao: 3 })).toContain('2 pessoas na sua frente');
    expect(avisoDoChat({ ...base, status: 'atendendo', atendente: 'Ana' })).toBe(
      'Ana está te atendendo.',
    );
    expect(avisoDoChat({ ...base, emHorario: false })).toContain('fora do horário');
    expect(avisoDoChat({ ...base, status: 'encerrada' })).toContain('encerrada');
  });
});
