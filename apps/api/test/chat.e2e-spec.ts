// Admin F6: chat do site. O visitante começa e escreve com o segredo da conversa; a equipe
// (admin, vendedor ou suporte) vê a fila, responde (e assume) e encerra.
import type { INestApplication } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import { criarPrisma, type PrismaClient } from '@pente-fino/db';
import type {
  ChatDoVisitante,
  ChatIniciado,
  ConversaDaEquipe,
  ResumoDoChat,
  ConversaNaFila,
  RespostaEntrarAdmin,
} from '@pente-fino/shared';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { codigoDoPasso, passoDe } from '../src/admin/totp.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';
import { criarPrisma as criarPrismaApp, naConta } from '@pente-fino/db';

let app: INestApplication<App>;
let plataforma: PrismaClient;
let a: Cenario;
const contasCriadas: string[] = [];
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

const sessoes = new Map<string, string>();
async function entrarAdmin(quem: { email: string; senha: string; jaConfigurado?: boolean }) {
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
});

afterAll(async () => {
  await plataforma.conversaSuporte.deleteMany({ where: { id: { in: conversas } } });
  await plataforma.usuarioPlataforma.updateMany({
    where: { email: { in: Object.values(pessoas).map((p) => p.email) } },
    data: { ativo: false },
  });
  await plataforma.conversaSuporte.deleteMany({ where: { contaAfetadaId: a.contaId } });
  await plataforma.$disconnect();
  const app2 = criarPrismaApp();
  for (const id of contasCriadas)
    await naConta(app2, id, (tx) => tx.conta.deleteMany({ where: { id } }));
  await app2.$disconnect();
  await a.remover();
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

  it('cliente logado conversa pela Ajuda: ligado à conta, sem nome nem contato', async () => {
    const dono = await como(app, a.emails.dono);
    expect((await dono.get('/chat/minha').expect(200)).body).toEqual({ conversa: null });
    await dono.post('/chat/minha/mensagens', { texto: 'Como fecho o caixa?' }).expect(204);
    await dono.post('/chat/minha/mensagens', { texto: 'É no fim do dia?' }).expect(204);
    const minha = (
      (await dono.get('/chat/minha').expect(200)).body as { conversa: ChatDoVisitante }
    ).conversa;
    // As duas mensagens na mesma conversa aberta.
    expect(minha.mensagens.map((m) => m.texto)).toEqual([
      'Como fecho o caixa?',
      'É no fim do dia?',
    ]);
    const tVend = await entrarAdmin({ ...pessoas.vendedor, jaConfigurado: true });
    const fila = (
      await http().get('/admin/chat').set('authorization', `Bearer ${tVend}`).expect(200)
    ).body as ConversaNaFila[];
    const doCliente = fila.find((c) => c.origem === 'painel' && c.contato === a.emails.dono);
    expect(doCliente?.pagina).toBe('/ajuda');
    // Outro usuário da mesma conta tem a conversa dele.
    const gestor = await como(app, a.emails.gestor);
    expect((await gestor.get('/chat/minha').expect(200)).body).toEqual({ conversa: null });
  });

  it('cadastro pelo site depois de conversar vira "virou cadastro", e o resumo conta', async () => {
    const c = (
      await http()
        .post('/chat/conversas')
        .send({
          nome: 'Lia Lead',
          contato: `lead-${sufixo}@e2e.pentefino.dev`,
          texto: 'Tem teste grátis?',
        })
        .expect(201)
    ).body as ChatIniciado;
    conversas.push(c.id);
    const email = `lead-${sufixo}@e2e.pentefino.dev`;
    await http()
      .post('/publico/contas')
      .send({
        barbearia: `Barbearia Lead ${sufixo}`,
        nome: 'Lia Lead',
        email,
        senha: 'senha-da-lia-1234',
        aceite: true,
        abertoEm: Date.now() - 10_000,
        chat: { id: c.id, token: c.token },
      })
      .expect(201);
    const lia = await como(app, email, 'senha-da-lia-1234');
    contasCriadas.push((await lia.get('/auth/eu').expect(200)).body.contaId);
    const tVend = await entrarAdmin({ ...pessoas.vendedor, jaConfigurado: true });
    const aberta = (
      await http().get(`/admin/chat/${c.id}`).set('authorization', `Bearer ${tVend}`).expect(200)
    ).body as ConversaDaEquipe;
    expect(aberta.virouConta?.nome).toBe(`Barbearia Lead ${sufixo}`);
    const r = (
      await http().get('/admin/chat/resumo').set('authorization', `Bearer ${tVend}`).expect(200)
    ).body as ResumoDoChat;
    expect(r.conversas).toBeGreaterThanOrEqual(2);
    expect(r.viraramCadastro).toBeGreaterThanOrEqual(1);
  });
});
