import { describe, expect, it } from 'vitest';
import { inscricaoPushSchema, textoPushDoHorario } from './push.js';

describe('push', () => {
  it('título por tipo e o horário no texto', () => {
    expect(
      textoPushDoHorario('remarcado', {
        quando: 'Amanhã (qua, 02/12), 10:00',
        cliente: 'João',
        servicos: ['Corte', 'Barba'],
      }),
    ).toEqual({
      titulo: 'Horário remarcado',
      corpo: 'Amanhã (qua, 02/12), 10:00 · João · Corte + Barba',
    });
  });

  it('aceita a inscrição como o navegador entrega (toJSON)', () => {
    expect(
      inscricaoPushSchema.safeParse({
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
        expirationTime: null,
        keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) },
      }).success,
    ).toBe(true);
    expect(inscricaoPushSchema.safeParse({ endpoint: 'nao-e-url', keys: {} }).success).toBe(false);
  });
});
