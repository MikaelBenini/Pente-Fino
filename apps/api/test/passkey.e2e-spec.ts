import type { INestApplication } from '@nestjs/common';
import { criarPrisma, naConta, type PrismaClient } from '@pente-fino/db';
import type { OpcoesPasskey, PasskeyNaTela } from '@pente-fino/shared';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

// Passkey (pedido do dono em 15/11). A criptografia de ponta a ponta é testada no navegador, com o
// autenticador virtual do Chrome (apps/web/e2e/passkey.spec.ts); aqui, as regras da API.
let app: INestApplication<App>;
let a: Cenario;
let b: Cenario;
let prisma: PrismaClient;
const http = () => request(app.getHttpServer());

const resposta = (id: string) => ({
  id,
  rawId: id,
  type: 'public-key',
  response: { clientDataJSON: 'e30', authenticatorData: 'AA', signature: 'AA' },
  clientExtensionResults: {},
});

beforeAll(async () => {
  app = await criarApp();
  a = await criarCenario();
  b = await criarCenario();
  prisma = criarPrisma();
});

afterAll(async () => {
  await prisma.$disconnect();
  await a.remover();
  await b.remover();
  await app.close();
});

describe('passkey', () => {
  it('entrar: desafio sem o e-mail, de uso único; credencial desconhecida responde 404', async () => {
    const o = (await http().post('/auth/passkey/opcoes').send({}).expect(200))
      .body as OpcoesPasskey;
    expect(o.opcoes).toMatchObject({ rpId: expect.any(String), allowCredentials: [] });
    expect(o.opcoes.userVerification).toBe('preferred');

    const r = await http()
      .post('/auth/passkey/entrar')
      .send({ desafioId: o.desafioId, resposta: resposta('desconhecida') })
      .expect(404);
    expect(r.body.erro.codigo).toBe('passkey_desconhecida');
    // O desafio já foi usado.
    await http()
      .post('/auth/passkey/entrar')
      .send({ desafioId: o.desafioId, resposta: resposta('desconhecida') })
      .expect(400);
  });

  it('entrar acha a passkey sem saber a conta e recusa assinatura que não confere', async () => {
    const credencialId = `cred-${randomUUID()}`;
    await naConta(prisma, a.contaId, async (tx) => {
      const usuario = await tx.usuario.findFirstOrThrow({ where: { email: a.emails.barbeiro } });
      await tx.passkey.create({
        data: {
          usuarioId: usuario.id,
          credencialId,
          chavePublica: Buffer.from([1, 2, 3]),
          dispositivo: 'multiDevice',
          aaguid: '00000000-0000-0000-0000-000000000000',
          nome: 'Passkey',
        },
      });
    });
    const o = (await http().post('/auth/passkey/opcoes').send({}).expect(200))
      .body as OpcoesPasskey;
    const r = await http()
      .post('/auth/passkey/entrar')
      .send({ desafioId: o.desafioId, resposta: resposta(credencialId) })
      .expect(401);
    expect(r.body.erro.codigo).toBe('passkey_invalida');
  });

  it('minhas passkeys: cada um vê só as suas; apagar a de outro não acha', async () => {
    const barbeiro = await como(app, a.emails.barbeiro);
    const dono = await como(app, a.emails.dono);
    const outra = await como(app, b.emails.dono);
    const minhas = (await barbeiro.get('/me/passkeys').expect(200)).body as PasskeyNaTela[];
    expect(minhas).toHaveLength(1);
    expect(minhas[0]).toMatchObject({ nome: 'Passkey', sincronizada: true, usadaEm: null });
    expect((await dono.get('/me/passkeys').expect(200)).body).toEqual([]);
    expect((await outra.get('/me/passkeys').expect(200)).body).toEqual([]);
    await dono.delete(`/me/passkeys/${minhas[0]!.id}`).expect(404);
    await outra.delete(`/me/passkeys/${minhas[0]!.id}`).expect(404);

    await barbeiro.patch(`/me/passkeys/${minhas[0]!.id}`, { nome: '' }).expect(400);
    const renomeada = (
      await barbeiro.patch(`/me/passkeys/${minhas[0]!.id}`, { nome: 'Celular do Rafa' }).expect(200)
    ).body as PasskeyNaTela;
    expect(renomeada.nome).toBe('Celular do Rafa');
    await barbeiro.delete(`/me/passkeys/${minhas[0]!.id}`).expect(204);
    expect((await barbeiro.get('/me/passkeys').expect(200)).body).toEqual([]);
  });

  it('criar: desafio amarrado a quem pediu; resposta falsa não vira passkey', async () => {
    const dono = await como(app, a.emails.dono);
    const gestor = await como(app, a.emails.gestor);
    const o = (await dono.post('/me/passkeys/opcoes').expect(200)).body as OpcoesPasskey;
    expect(o.opcoes).toMatchObject({
      rp: { name: 'Pente Fino' },
      user: { name: a.emails.dono },
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
    });
    // Outro usuário não usa o desafio do dono.
    await gestor.post(`/me/passkeys/${o.desafioId}`, { resposta: resposta('x') }).expect(400);
    const o2 = (await dono.post('/me/passkeys/opcoes').expect(200)).body as OpcoesPasskey;
    await dono.post(`/me/passkeys/${o2.desafioId}`, { resposta: resposta('x') }).expect(401);
    expect((await dono.get('/me/passkeys').expect(200)).body).toEqual([]);
    await http().get('/me/passkeys').expect(401);
  });
});
