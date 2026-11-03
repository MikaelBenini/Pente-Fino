import type { Job } from 'bullmq';
import type { TrabalhoEmail } from '@pente-fino/shared';
import { carregarConfiguracaoWorker } from './config.js';
import { processadorDeEmail } from './emails.processor.js';

describe('processadorDeEmail', () => {
  it('entrega com o remetente configurado', async () => {
    const enviados: unknown[] = [];
    const processar = processadorDeEmail('Pente Fino <nao-responda@x.dev>', async (m) => {
      enviados.push(m);
    });
    await processar({
      data: { para: 'ana@x.dev', assunto: 'Oi', texto: 'texto', html: '<p>oi</p>' },
    } as Job<TrabalhoEmail>);
    expect(enviados).toEqual([
      {
        from: 'Pente Fino <nao-responda@x.dev>',
        to: 'ana@x.dev',
        subject: 'Oi',
        text: 'texto',
        html: '<p>oi</p>',
      },
    ]);
  });

  it('falha de envio vira falha do job (o BullMQ tenta de novo)', async () => {
    const processar = processadorDeEmail('x@x.dev', async () => {
      throw new Error('SMTP fora');
    });
    await expect(
      processar({ data: { para: 'a@x.dev', assunto: 'a', texto: 'b' } } as Job<TrabalhoEmail>),
    ).rejects.toThrow('SMTP fora');
  });
});

describe('carregarConfiguracaoWorker', () => {
  it('lista o que falta', () => {
    expect(() => carregarConfiguracaoWorker({})).toThrow(/REDIS_URL/);
  });
});
