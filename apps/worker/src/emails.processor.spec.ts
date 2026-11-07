import type { Job } from 'bullmq';
import type { TrabalhoEmail } from '@pente-fino/shared';
import { carregarConfiguracaoWorker } from './config.js';
import { cifrar } from '@pente-fino/db';
import type { Banco } from './banco.js';
import { EmailsProcessor, processadorDeEmail } from './emails.processor.js';

describe('processadorDeEmail', () => {
  it('entrega com o remetente configurado', async () => {
    const enviados: unknown[] = [];
    const processar = processadorDeEmail(() => ({
      remetente: 'Pente Fino <nao-responda@x.dev>',
      enviar: async (m) => {
        enviados.push(m);
      },
    }));
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
    const processar = processadorDeEmail(() => ({
      remetente: 'x@x.dev',
      enviar: async () => {
        throw new Error('SMTP fora');
      },
    }));
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

describe('EmailsProcessor: qual SMTP usar', () => {
  const chave = Buffer.alloc(32, 9);
  const config = carregarConfiguracaoWorker({
    REDIS_URL: 'redis://localhost:6379/0',
    SMTP_HOST: 'localhost',
    SMTP_PORT: '1025',
    EMAIL_FROM: 'Reserva <reserva@x.dev>',
    DATABASE_URL: 'postgresql://x:y@localhost:5432/z',
    APP_URL: 'http://localhost:3000',
    PLATAFORMA_CHAVE: chave.toString('base64'),
  });
  const comBanco = (valor: unknown) =>
    new EmailsProcessor(config, {
      prisma: { $queryRaw: async () => [{ c: valor }] },
    } as unknown as Banco);

  it('com o SMTP da administração: o remetente dele', async () => {
    const p = comBanco({
      host: 'smtp.exemplo.com',
      porta: 587,
      seguro: false,
      usuario: 'apikey',
      remetente: 'Pente Fino <oi@pentefino.com.br>',
      senhaCifrada: cifrar('segredo', chave),
    });
    expect((await p.envio()).remetente).toBe('Pente Fino <oi@pentefino.com.br>');
    await p.onApplicationShutdown();
  });

  it('sem configuração, ou com a senha que não decifra: o do .env', async () => {
    expect((await comBanco(null).envio()).remetente).toBe('Reserva <reserva@x.dev>');
    const quebrado = comBanco({
      host: 'smtp.exemplo.com',
      porta: 587,
      seguro: false,
      usuario: 'apikey',
      remetente: 'Outro <o@x.dev>',
      senhaCifrada: cifrar('segredo', Buffer.alloc(32, 1)),
    });
    expect((await quebrado.envio()).remetente).toBe('Reserva <reserva@x.dev>');
  });
});
