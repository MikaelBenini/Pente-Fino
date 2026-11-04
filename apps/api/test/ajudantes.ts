import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import { criarPrisma, naConta, type PrismaClient } from '@pente-fino/db';
import { FILA_EMAILS, type TrabalhoEmail } from '@pente-fino/shared';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/configurar-app.js';

export const SENHA = 'senha-de-teste-1';

export async function criarApp(): Promise<INestApplication<App>> {
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = modulo.createNestApplication<INestApplication<App>>({ bufferLogs: true });
  configurarApp(app);
  await app.init();
  return app;
}

export interface Cenario {
  contaId: string;
  unidadeA: string;
  unidadeB: string;
  emails: { dono: string; gestor: string; barbeiro: string };
  remover: () => Promise<void>;
}

/** Conta nova com duas unidades, dono (todas), gestor e barbeiro (unidade A). */
export async function criarCenario(): Promise<Cenario> {
  const prisma: PrismaClient = criarPrisma();
  const contaId = randomUUID();
  const sufixo = randomUUID().slice(0, 8);
  const emails = {
    dono: `dono-${sufixo}@e2e.pentefino.dev`,
    gestor: `gestor-${sufixo}@e2e.pentefino.dev`,
    barbeiro: `barbeiro-${sufixo}@e2e.pentefino.dev`,
  };
  const senhaHash = await hash(SENHA);

  const { unidadeA, unidadeB } = await naConta(prisma, contaId, async (tx) => {
    await tx.conta.create({
      data: { id: contaId, nome: `Barbearia E2E ${sufixo}`, status: 'ativa', plano: 'premium' },
    });
    const a = await tx.unidade.create({ data: { nome: 'Unidade A' } });
    const b = await tx.unidade.create({ data: { nome: 'Unidade B' } });
    const criar = async (
      nome: string,
      email: string,
      papel: 'dono' | 'gestor' | 'barbeiro',
      unidadeId: string | null,
    ) => {
      const u = await tx.usuario.create({ data: { nome, email, senhaHash } });
      await tx.papelUsuario.create({ data: { usuarioId: u.id, papel, unidadeId } });
    };
    await criar('Dona Teste', emails.dono, 'dono', null);
    await criar('Gestor Teste', emails.gestor, 'gestor', a.id);
    await criar('Barbeiro Teste', emails.barbeiro, 'barbeiro', a.id);
    return { unidadeA: a.id, unidadeB: b.id };
  });

  return {
    contaId,
    unidadeA,
    unidadeB,
    emails,
    remover: async () => {
      await naConta(prisma, contaId, (tx) => tx.conta.deleteMany({ where: { id: contaId } }));
      await prisma.$disconnect();
    },
  };
}

/** Cliente HTTP já autenticado como o e-mail informado. */
export async function como(app: INestApplication<App>, email: string, senha = SENHA) {
  const { accessToken } = await entrar(app, email, senha);
  const auth = { authorization: `Bearer ${accessToken}` };
  const http = () => request(app.getHttpServer());
  return {
    get: (url: string) => http().get(url).set(auth),
    post: (url: string, corpo?: object) =>
      http()
        .post(url)
        .set(auth)
        .send(corpo ?? {}),
    put: (url: string, corpo?: object) =>
      http()
        .put(url)
        .set(auth)
        .send(corpo ?? {}),
    patch: (url: string, corpo?: object) =>
      http()
        .patch(url)
        .set(auth)
        .send(corpo ?? {}),
    delete: (url: string) => http().delete(url).set(auth),
  };
}

export async function entrar(app: INestApplication<App>, email: string, senha = SENHA) {
  const r = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, senha })
    .expect(200);
  return r.body as { accessToken: string; refreshToken: string };
}

/** Último e-mail enfileirado para o destinatário (o worker pode já ter entregado). */
export async function ultimoEmail(para: string): Promise<TrabalhoEmail | undefined> {
  const fila = new Queue<TrabalhoEmail>(FILA_EMAILS, {
    connection: { url: process.env.REDIS_URL! },
  });
  try {
    const jobs = await fila.getJobs([
      'waiting',
      'active',
      'completed',
      'delayed',
      'failed',
      'prioritized',
    ]);
    return jobs.filter((j) => j?.data?.para === para).sort((a, b) => b.timestamp - a.timestamp)[0]
      ?.data;
  } finally {
    await fila.close();
  }
}

export function tokenDoLink(texto: string): string {
  const achado = /token=([\w-]+)/.exec(texto);
  if (!achado?.[1]) throw new Error(`link com token não encontrado em: ${texto}`);
  return achado[1];
}
