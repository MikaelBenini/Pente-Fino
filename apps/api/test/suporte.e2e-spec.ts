// Admin F5: acesso de suporte com consentimento. O dono libera por 24 h; o admin ou o suporte
// abre o painel só para ler (sem telefones nem conversas), e tudo fica nas duas auditorias.
import type { INestApplication } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import { criarPrisma, naConta, type PrismaClient } from '@pente-fino/db';
import type {
  AcessoSuporteDaConta,
  RespostaEntrarAdmin,
  SessaoSuporteAberta,
  UsuarioSessao,
} from '@pente-fino/shared';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { codigoDoPasso, passoDe } from '../src/admin/totp.js';
import { CONTATO_OCULTO } from '../src/suporte/ocultar-contato.interceptor.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let a: Cenario;
let plataforma: PrismaClient;
const sufixo = randomUUID().slice(0, 8);
const pessoas = {
  admin: {
    email: `sup-admin-${sufixo}@pentefino.dev`,
    senha: 'senha-do-admin-sup-1',
    papel: 'admin' as const,
    nome: 'Ana Admin',
  },
  suporte: {
    email: `sup-suporte-${sufixo}@pentefino.dev`,
    senha: 'senha-do-suporte-1',
    papel: 'suporte' as const,
    nome: 'Sara Suporte',
  },
  vendedor: {
    email: `sup-vend-${sufixo}@pentefino.dev`,
    senha: 'senha-do-vend-sup-1',
    papel: 'vendedor' as const,
    nome: 'Vado Vendas',
  },
};
const http = () => request(app.getHttpServer());

const sessoes = new Map<string, string>();
/** Entra uma vez por pessoa (configura o autenticador) e reaproveita a sessão. */
async function entrarAdmin(quem: { email: string; senha: string }) {
  const guardada = sessoes.get(quem.email);
  if (guardada) return guardada;
  const r1 = (await http().post('/admin/auth/entrar').send(quem).expect(200))
    .body as RespostaEntrarAdmin;
  if (r1.etapa !== 'configurar') throw new Error('esperava configurar');
  const codigo = codigoDoPasso(r1.segredo, passoDe(new Date()));
  const r2 = (
    await http()
      .post('/admin/auth/entrar')
      .send({ ...quem, codigo })
      .expect(200)
  ).body as RespostaEntrarAdmin;
  if (r2.etapa !== 'pronto') throw new Error('esperava pronto');
  sessoes.set(quem.email, r2.token);
  return r2.token;
}
const abrir = (token: string) =>
  http().post(`/admin/contas/${a.contaId}/suporte`).set('authorization', `Bearer ${token}`);

beforeAll(async () => {
  app = await criarApp();
  a = await criarCenario();
  plataforma = criarPrisma(process.env.DATABASE_PLATAFORMA_URL);
  await plataforma.usuarioPlataforma.createMany({
    data: await Promise.all(
      Object.values(pessoas).map(async (p) => ({
        email: p.email,
        nome: p.nome,
        papel: p.papel,
        senhaHash: await hash(p.senha),
      })),
    ),
  });
  const app2 = criarPrisma();
  await naConta(app2, a.contaId, (tx) =>
    tx.cliente.create({ data: { nome: 'Cliente Reservado', telefone: '5511977776666' } }),
  );
  await app2.$disconnect();
});

afterAll(async () => {
  await plataforma.usuarioPlataforma.updateMany({
    where: { email: { in: Object.values(pessoas).map((p) => p.email) } },
    data: { ativo: false },
  });
  await plataforma.$disconnect();
  await a.remover();
  await app.close();
});

describe('acesso de suporte com consentimento (admin F5)', () => {
  it('sem a liberação do dono não abre; só o dono libera; vendedor nunca abre', async () => {
    const tAdmin = await entrarAdmin(pessoas.admin);
    const tVend = await entrarAdmin(pessoas.vendedor);
    await abrir(tVend).expect(403);
    await abrir(tAdmin).expect(409);
    const barbeiro = await como(app, a.emails.barbeiro);
    await barbeiro.put('/conta/suporte', { liberar: true }).expect(403);
    const dono = await como(app, a.emails.dono);
    expect((await dono.get('/conta/suporte').expect(200)).body).toEqual({ liberadoAte: null });
  });

  it('dono libera por 24 h; a sessão de suporte lê, não grava, sem telefone nem conversas', async () => {
    const dono = await como(app, a.emails.dono);
    const lib = (await dono.put('/conta/suporte', { liberar: true }).expect(200))
      .body as AcessoSuporteDaConta;
    const horas = (Date.parse(lib.liberadoAte!) - Date.now()) / 3_600_000;
    expect(horas).toBeGreaterThan(23.9);
    expect(horas).toBeLessThanOrEqual(24);

    const s = (await abrir(await entrarAdmin(pessoas.admin)).expect(201))
      .body as SessaoSuporteAberta;
    // No máximo 1 hora.
    expect(Date.parse(s.ate) - Date.now()).toBeLessThanOrEqual(3_600_000 + 1000);
    const sup = {
      get: (url: string) => http().get(url).set('authorization', `Bearer ${s.token}`),
      post: (url: string, corpo: object) =>
        http().post(url).set('authorization', `Bearer ${s.token}`).send(corpo),
    };
    const eu = (await sup.get('/auth/eu').expect(200)).body as UsuarioSessao;
    expect(eu.modoSuporte?.nome).toBe('Ana Admin');
    expect(eu.nome).toContain('Suporte Pente Fino');
    const lista = (await sup.get('/clientes?busca=Reservado').expect(200)).body as {
      nome: string;
      telefone: string | null;
    }[];
    const reservado = lista.find((c) => c.nome === 'Cliente Reservado');
    expect(reservado?.telefone).toBe(CONTATO_OCULTO);
    await sup.post('/clientes', { nome: 'Não grava', telefone: '5511900000000' }).expect(403);
    await sup.get('/conversas').expect(403);

    // As duas auditorias registram: a da barbearia (o dono vê) e a da plataforma.
    const app2 = criarPrisma();
    const acoes = await naConta(app2, a.contaId, (tx) =>
      tx.auditoria.findMany({ where: { entidade: 'conta' }, select: { acao: true } }),
    );
    await app2.$disconnect();
    expect(acoes.map((x) => x.acao)).toEqual(
      expect.arrayContaining(['liberar_suporte', 'acesso_suporte']),
    );
    const naPlataforma = await plataforma.auditoriaPlataforma.findFirst({
      where: { contaAfetadaId: a.contaId, acao: 'abrir_modo_suporte' },
    });
    expect(naPlataforma).not.toBeNull();
  });

  it('o papel Suporte também abre; depois que o dono cancela, ninguém abre', async () => {
    const tSup = await entrarAdmin(pessoas.suporte);
    await abrir(tSup).expect(201);
    const dono = await como(app, a.emails.dono);
    expect((await dono.put('/conta/suporte', { liberar: false }).expect(200)).body).toEqual({
      liberadoAte: null,
    });
    await abrir(tSup).expect(409);
  });
});
