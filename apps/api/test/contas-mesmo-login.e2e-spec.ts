// Duas contas, um login (ADR 0015, 27/11/2026): o dono abre outro negócio com o mesmo e-mail e a
// mesma senha, troca pelo menu, cada negócio fica isolado e a senha vale nos dois.
import type { INestApplication } from '@nestjs/common';
import { criarPrisma, naConta } from '@pente-fino/db';
import type { Sessao } from '@pente-fino/shared';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { como, criarApp, criarCenario, SENHA, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let cenario: Cenario;
let novaContaId = '';
const http = () => request(app.getHttpServer());
const comToken = (token: string) => ({
  get: (url: string) =>
    http()
      .get(url)
      .set({ authorization: `Bearer ${token}` }),
  post: (url: string, corpo?: object) =>
    http()
      .post(url)
      .set({ authorization: `Bearer ${token}` })
      .send(corpo ?? {}),
});

beforeAll(async () => {
  app = await criarApp();
  cenario = await criarCenario();
});

afterAll(async () => {
  if (novaContaId) {
    const prisma = criarPrisma();
    await naConta(prisma, novaContaId, (tx) => tx.conta.delete({ where: { id: novaContaId } }));
    await prisma.$disconnect();
  }
  await cenario.remover();
  await app.close();
});

describe('duas contas, um login', () => {
  it('só o dono abre outro negócio; a conta nova nasce em teste, com 20% e a licença escolhida', async () => {
    const gestor = await como(app, cenario.emails.gestor);
    await gestor.post('/conta/outro-negocio', { nome: 'Invasão', licenca: 'estetica' }).expect(403);
    const dono = await como(app, cenario.emails.dono);
    await dono
      .post('/conta/outro-negocio', { nome: 'Fitness', licenca: 'fitness', plano: 'pro' })
      .expect(400);
    const r = (
      await dono
        .post('/conta/outro-negocio', {
          nome: 'Clínica Bela',
          licenca: 'estetica',
          plano: 'basico',
        })
        .expect(201)
    ).body as Sessao;
    novaContaId = r.usuario.contaId;
    expect(novaContaId).not.toBe(cenario.contaId);
    expect(r.usuario).toMatchObject({
      email: cenario.emails.dono,
      licenca: 'estetica',
      segmento: 'estetica',
    });
    expect(r.usuario.outrasContas).toContainEqual(
      expect.objectContaining({ contaId: cenario.contaId }),
    );
    const nova = comToken(r.accessToken);
    expect((await nova.get('/conta/assinatura').expect(200)).body).toMatchObject({
      licenca: 'estetica',
      precoPorMes: 7192, // R$ 89,90 com 20%
    });
    // Isolada: a conta nova não vê nada da outra.
    const clientes = (await nova.get('/clientes').expect(200)).body;
    expect(Array.isArray(clientes) ? clientes : clientes.itens).toEqual([]);
    // A sessão da conta de antes já lista o negócio novo.
    expect((await dono.get('/auth/eu').expect(200)).body.outrasContas).toContainEqual({
      contaId: novaContaId,
      nome: 'Clínica Bela',
      licenca: 'estetica',
    });
  });

  it('o login entra no negócio pedido (o último do aparelho); sem pedido, no mais antigo', async () => {
    const naNova = await http()
      .post('/auth/login')
      .send({ email: cenario.emails.dono, senha: SENHA, contaId: novaContaId })
      .expect(200);
    expect(naNova.body.usuario.contaId).toBe(novaContaId);
    const semPedido = await http()
      .post('/auth/login')
      .send({ email: cenario.emails.dono, senha: SENHA })
      .expect(200);
    expect(semPedido.body.usuario.contaId).toBe(cenario.contaId);
    await http()
      .post('/auth/login')
      .send({ email: cenario.emails.dono, senha: 'senha-errada-123' })
      .expect(401);
  });

  it('troca de negócio sem senha; nunca para um negócio de outro e-mail', async () => {
    const dono = await como(app, cenario.emails.dono);
    const r = (await dono.post('/auth/trocar-conta', { contaId: novaContaId }).expect(200))
      .body as Sessao;
    expect(r.usuario.contaId).toBe(novaContaId);
    await dono.post('/auth/trocar-conta', { contaId: cenario.contaId }).expect(409);
    await dono.post('/auth/trocar-conta', { contaId: randomUUID() }).expect(404);
    const gestor = await como(app, cenario.emails.gestor);
    await gestor.post('/auth/trocar-conta', { contaId: novaContaId }).expect(404);
  });

  it('o Início mostra os negócios lado a lado (só para o dono) e a sessão traz o nome do atual', async () => {
    const dono = await como(app, cenario.emails.dono);
    const eu = (await dono.get('/auth/eu').expect(200)).body;
    expect(eu.nomeConta).toBeTruthy();
    const negocios = (await dono.get('/resumo/negocios').expect(200)).body as {
      contaId: string;
      atual: boolean;
      faturamentoMes: number | null;
      agendamentosHoje: number;
    }[];
    expect(negocios.map((n) => n.contaId).sort()).toEqual([cenario.contaId, novaContaId].sort());
    expect(negocios.find((n) => n.contaId === cenario.contaId)?.atual).toBe(true);
    const nova = negocios.find((n) => n.contaId === novaContaId)!;
    expect(nova).toMatchObject({ atual: false, faturamentoMes: 0, agendamentosHoje: 0 });
    const gestor = await como(app, cenario.emails.gestor);
    await gestor.get('/resumo/negocios').expect(403);
  });

  it('trocar a senha num negócio vale no outro', async () => {
    const dono = await como(app, cenario.emails.dono);
    const nova = 'senha-nova-do-dono-9';
    await dono.post('/auth/trocar-senha', { senhaAtual: SENHA, novaSenha: nova }).expect(200);
    const r = await http()
      .post('/auth/login')
      .send({ email: cenario.emails.dono, senha: nova, contaId: novaContaId })
      .expect(200);
    expect(r.body.usuario.contaId).toBe(novaContaId);
    // Volta a senha de teste, para o resto do cenário.
    await comToken(r.body.accessToken)
      .post('/auth/trocar-senha', { senhaAtual: nova, novaSenha: SENHA })
      .expect(200);
    await http().post('/auth/login').send({ email: cenario.emails.dono, senha: SENHA }).expect(200);
  });
});
