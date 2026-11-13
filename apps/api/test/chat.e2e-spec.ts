// Admin F6: chat do site. O visitante começa e escreve com o segredo da conversa; a equipe
// (admin, vendedor ou suporte) vê a fila, responde (e assume) e encerra.
import type { INestApplication } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import { criarPrisma, type PrismaClient } from '@pente-fino/db';
import type {
  ChatDoVisitante,
  ChatIniciado,
  ConversaDaEquipe,
  ConversaNaFila,
  RespostaEntrarAdmin,
} from '@pente-fino/shared';
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
  vendedor: {
    email: `chat-vend-${sufixo}@pentefino.dev`,
    senha: 'senha-do-vend-chat-1',
    papel: 'vendedor' as const,
    nome: 'Vera Vendas',
  },
  financeiro: {
    email: `chat-fin-${sufixo}@pentefino.dev`,
    senha: 'senha-do-fin-chat-1',
    papel: 'financeiro' as const,
    nome: 'Fábio Financeiro',
  },
};
const http = () => request(app.getHttpServer());
const conversas: string[] = [];

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
    data: await Promise.all(
      Object.values(pessoas).map(async (p) => ({
        email: p.email,
        nome: p.nome,
        papel: p.papel,
        senhaHash: await hash(p.senha),
      })),
    ),
  });
});

afterAll(async () => {
  await plataforma.conversaSuporte.deleteMany({ where: { id: { in: conversas } } });
  await plataforma.usuarioPlataforma.updateMany({
    where: { email: { in: Object.values(pessoas).map((p) => p.email) } },
    data: { ativo: false },
  });
  await plataforma.$disconnect();
  await app.close();
});

describe('chat do site (admin F6)', () => {
  it('visitante começa, a equipe responde e assume, o visitante vê e a conversa encerra', async () => {
    // Contato que não dá para responder é recusado.
    await http()
      .post('/chat/conversas')
      .send({ nome: 'Carlos', contato: '123', texto: 'Oi' })
      .expect(400);
    const c = (
      await http()
        .post('/chat/conversas')
        .send({
          nome: `Carlos ${sufixo}`,
          contato: '(11) 98888-7777',
          texto: 'Quanto custa para 3 barbeiros?',
          pagina: '/planos',
        })
        .expect(201)
    ).body as ChatIniciado;
    conversas.push(c.id);
    const visitante = (token: string) => ({
      ver: () => http().get(`/chat/conversas/${c.id}`).set('x-chat-token', token),
      escrever: (texto: string) =>
        http().post(`/chat/conversas/${c.id}/mensagens`).set('x-chat-token', token).send({ texto }),
    });
    // Sem o segredo certo, a conversa não existe.
    await visitante('errado').ver().expect(404);
    await http().get(`/chat/conversas/${c.id}`).expect(404);
    const v = visitante(c.token);
    const antes = (await v.ver().expect(200)).body as ChatDoVisitante;
    expect(antes.status).toBe('fila');
    expect(antes.posicao).toBeGreaterThanOrEqual(1);
    expect(antes.mensagens).toHaveLength(1);

    // Financeiro não atende o chat; vendedor vê a fila e responde.
    const tFin = await entrarAdmin(pessoas.financeiro);
    await http().get('/admin/chat').set('authorization', `Bearer ${tFin}`).expect(403);
    const tVend = await entrarAdmin(pessoas.vendedor);
    const eq = {
      get: (url: string) => http().get(url).set('authorization', `Bearer ${tVend}`),
      post: (url: string, corpo: object = {}) =>
        http().post(url).set('authorization', `Bearer ${tVend}`).send(corpo),
    };
    const fila = (await eq.get('/admin/chat').expect(200)).body as ConversaNaFila[];
    const naFila = fila.find((x) => x.id === c.id);
    expect(naFila).toMatchObject({ status: 'fila', esperandoEquipe: true, pagina: '/planos' });
    await eq
      .post(`/admin/chat/${c.id}/mensagens`, { texto: 'Oi, Carlos! No Básico, R$ 79,90.' })
      .expect(204);

    const depois = (await v.ver().expect(200)).body as ChatDoVisitante;
    expect(depois).toMatchObject({ status: 'atendendo', atendente: 'Vera', posicao: null });
    expect(depois.mensagens.at(-1)).toMatchObject({ de: 'equipe', autor: 'Vera' });
    await v.escrever('Obrigado!').expect(204);
    const aberta = (await eq.get(`/admin/chat/${c.id}`).expect(200)).body as ConversaDaEquipe;
    expect(aberta.mensagens.map((m) => m.de)).toEqual(['visitante', 'equipe', 'visitante']);
    expect(aberta.atendente).toBe('Vera Vendas');

    await eq.post(`/admin/chat/${c.id}/encerrar`).expect(204);
    expect(((await v.ver().expect(200)).body as ChatDoVisitante).status).toBe('encerrada');
    await v.escrever('Mais uma').expect(409);
    const encerradas = (await eq.get('/admin/chat?status=encerrada').expect(200))
      .body as ConversaNaFila[];
    expect(encerradas.some((x) => x.id === c.id)).toBe(true);
    await eq.get('/admin/chat?status=outro').expect(400);
  });
});
