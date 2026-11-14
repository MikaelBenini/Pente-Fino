// O que o visitante faz na página de vendas (pedido do dono em 13/11): o site grava eventos
// anônimos sem login; só o admin lê o painel com o funil.
import type { INestApplication } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import { criarPrisma, type PrismaClient } from '@pente-fino/db';
import type { PainelVisitas, RespostaEntrarAdmin } from '@pente-fino/shared';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { codigoDoPasso, passoDe } from '../src/admin/totp.js';
import { criarApp } from './ajudantes.js';

let app: INestApplication<App>;
let plataforma: PrismaClient;
const sufixo = randomUUID().slice(0, 8);
const pessoas = {
  admin: { email: `visitas-admin-${sufixo}@pentefino.dev`, senha: 'senha-visitas-admin-1' },
  vendedor: { email: `visitas-vend-${sufixo}@pentefino.dev`, senha: 'senha-visitas-vend-1' },
};
const visitas = [randomUUID(), randomUUID()];
const http = () => request(app.getHttpServer());

async function entrarAdmin(quem: { email: string; senha: string }) {
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
  return r2.token;
}

beforeAll(async () => {
  app = await criarApp();
  plataforma = criarPrisma(process.env.DATABASE_PLATAFORMA_URL);
  await plataforma.usuarioPlataforma.createMany({
    data: [
      {
        email: pessoas.admin.email,
        nome: 'Ana',
        papel: 'admin',
        senhaHash: await hash(pessoas.admin.senha),
      },
      {
        email: pessoas.vendedor.email,
        nome: 'Vito',
        papel: 'vendedor',
        senhaHash: await hash(pessoas.vendedor.senha),
      },
    ],
  });
});

afterAll(async () => {
  await plataforma.eventoVisitaSite.deleteMany({ where: { visitaId: { in: visitas } } });
  await plataforma.usuarioPlataforma.updateMany({
    where: { email: { in: [pessoas.admin.email, pessoas.vendedor.email] } },
    data: { ativo: false },
  });
  await plataforma.$disconnect();
  await app.close();
});

describe('visitas da página de vendas', () => {
  it('o site grava sem login; evento fora da lista é recusado; o admin vê o funil', async () => {
    const token = await entrarAdmin(pessoas.admin);
    const tokenVendedor = await entrarAdmin(pessoas.vendedor);
    const antes = (
      await http().get('/admin/visitas').set('authorization', `Bearer ${token}`).expect(200)
    ).body as PainelVisitas;

    await http()
      .post('/visitas')
      .send({
        visitaId: visitas[0],
        novo: true,
        origem: 'instagram',
        eventos: [
          { tipo: 'entrada', pagina: '/' },
          { tipo: 'rolagem', pagina: '/', valor: 25 },
          { tipo: 'rolagem', pagina: '/', valor: 50 },
          { tipo: 'clique', pagina: '/', valor: 'planos' },
        ],
      })
      .expect(204);
    await http()
      .post('/visitas')
      .send({
        visitaId: visitas[0],
        novo: true,
        origem: 'instagram',
        eventos: [{ tipo: 'clique', pagina: '/planos', valor: 'cadastro' }],
      })
      .expect(204);
    await http()
      .post('/visitas')
      .send({
        visitaId: visitas[1],
        novo: null,
        origem: null,
        eventos: [{ tipo: 'entrada', pagina: '/blog' }],
      })
      .expect(204);
    await http()
      .post('/visitas')
      .send({
        visitaId: randomUUID(),
        novo: null,
        origem: null,
        eventos: [{ tipo: 'clique', pagina: '/', valor: 'qualquer-coisa' }],
      })
      .expect(400);

    const depois = (
      await http().get('/admin/visitas').set('authorization', `Bearer ${token}`).expect(200)
    ).body as PainelVisitas;
    expect(depois.hoje.visitas - antes.hoje.visitas).toBe(2);
    expect(depois.hoje.novas - antes.hoje.novas).toBe(1);
    expect(depois.hoje.rolagem[50] - antes.hoje.rolagem[50]).toBe(1);
    expect(depois.hoje.cliques.cadastro - antes.hoje.cliques.cadastro).toBe(1);
    expect(depois.semana.visitas).toBeGreaterThanOrEqual(depois.hoje.visitas);
    expect(depois.porDia).toHaveLength(7);
    expect(depois.porDia.at(-1)!.visitas).toBe(depois.hoje.visitas);

    // O vendedor não tem a aba Vendas; sem login, nada.
    await http().get('/admin/visitas').set('authorization', `Bearer ${tokenVendedor}`).expect(403);
    await http().get('/admin/visitas').expect(401);
  });
});
