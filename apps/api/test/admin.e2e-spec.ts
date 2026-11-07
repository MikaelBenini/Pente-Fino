// Etapa 15.1: login da administração com segundo fator, sessão própria e leitura entre contas
// sem dado de cliente. O login de uma barbearia não abre a administração, nem o contrário.
import type { INestApplication } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import { criarPrisma, type PrismaClient } from '@pente-fino/db';
import type {
  ContaNaPlataforma,
  FichaContaPlataforma,
  MetricasDaPlataforma,
  RespostaEntrarAdmin,
} from '@pente-fino/shared';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { codigoDoPasso, passoDe } from '../src/admin/totp.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let a: Cenario;
let plataforma: PrismaClient;
const sufixo = randomUUID().slice(0, 8);
const admin = { email: `admin-${sufixo}@pentefino.dev`, senha: 'senha-do-admin-123' };
const vendedor = { email: `vendedor-${sufixo}@pentefino.dev`, senha: 'senha-do-vendedor-1' };
const outro = { email: `outro-${sufixo}@pentefino.dev`, senha: 'senha-do-outro-1' };
const http = () => request(app.getHttpServer());
const entrar = (corpo: object) => http().post('/admin/auth/entrar').send(corpo);

/** Configura o autenticador e entra; devolve o token da sessão. */
async function entrarComSegundoFator(quem: { email: string; senha: string }) {
  const r1 = (await entrar(quem).expect(200)).body as RespostaEntrarAdmin;
  if (r1.etapa !== 'configurar') throw new Error('esperava configurar');
  const codigo = codigoDoPasso(r1.segredo, passoDe(new Date()));
  const r2 = (await entrar({ ...quem, codigo }).expect(200)).body as RespostaEntrarAdmin;
  if (r2.etapa !== 'pronto') throw new Error('esperava pronto');
  return { token: r2.token, segredo: r1.segredo, codigo };
}

beforeAll(async () => {
  app = await criarApp();
  a = await criarCenario();
  plataforma = criarPrisma(process.env.DATABASE_PLATAFORMA_URL);
  await plataforma.usuarioPlataforma.createMany({
    data: [
      { email: admin.email, nome: 'Ana Admin', papel: 'admin', senhaHash: await hash(admin.senha) },
      {
        email: vendedor.email,
        nome: 'Vitor Vendedor',
        papel: 'vendedor',
        senhaHash: await hash(vendedor.senha),
      },
      {
        email: outro.email,
        nome: 'Otto Outro',
        papel: 'admin',
        senhaHash: await hash(outro.senha),
      },
    ],
  });
});

afterAll(async () => {
  await plataforma.usuarioPlataforma.updateMany({
    where: { email: { in: [admin.email, vendedor.email, outro.email] } },
    data: { ativo: false },
  });
  await plataforma.$disconnect();
  await a.remover();
  await app.close();
});

describe('administração do sistema', () => {
  it('senha errada: 401 sem dizer o que errou; fica na auditoria da plataforma', async () => {
    const r = await entrar({ ...admin, senha: 'errada' }).expect(401);
    expect(r.body.erro.mensagem).toBe('E-mail, senha ou código inválidos.');
    await entrar({ email: `ninguem-${sufixo}@pentefino.dev`, senha: 'x' }).expect(401);
    const recusas = await plataforma.auditoriaPlataforma.count({
      where: { acao: 'entrar_recusado', depois: { path: ['email'], equals: admin.email } },
    });
    expect(recusas).toBe(1);
  });

  it('1º acesso configura o autenticador; depois, só entra com o código, uma vez cada', async () => {
    const { token, segredo, codigo } = await entrarComSegundoFator(admin);
    const eu = await http().get('/admin/eu').set('authorization', `Bearer ${token}`).expect(200);
    expect(eu.body).toMatchObject({ email: admin.email, papel: 'admin' });

    // Agora a senha sozinha pede o código, e o mesmo código não entra de novo.
    expect((await entrar(admin).expect(200)).body).toEqual({ etapa: 'codigo' });
    await entrar({ ...admin, codigo }).expect(401);
    await entrar({ ...admin, codigo: '000000' }).expect(401);
    // O segredo fica cifrado no banco.
    const u = await plataforma.usuarioPlataforma.findUniqueOrThrow({
      where: { email: admin.email },
    });
    expect(u.totpSegredo).not.toContain(segredo);
    expect(u.totpConfirmadoEm).not.toBeNull();
    const sessao = await plataforma.sessaoPlataforma.findFirstOrThrow({
      where: { usuarioId: u.id },
    });
    expect(sessao.ip).toBeTruthy();
    expect(sessao.tokenHash).not.toBe(token);

    // Contas: dados da assinatura e uso, sem cliente.
    const contas = (
      await http().get('/admin/contas').set('authorization', `Bearer ${token}`).expect(200)
    ).body as ContaNaPlataforma[];
    const minha = contas.find((c) => c.id === a.contaId);
    expect(minha).toMatchObject({ plano: 'premium', status: 'ativa', unidades: 2 });
    expect(Object.keys(minha!).some((k) => /cliente|telefone/i.test(k))).toBe(false);

    // Sair encerra a sessão.
    await http().post('/admin/auth/sair').set('authorization', `Bearer ${token}`).expect(204);
    await http().get('/admin/eu').set('authorization', `Bearer ${token}`).expect(401);
    expect(
      await plataforma.auditoriaPlataforma.count({
        where: { usuarioId: u.id, acao: { in: ['configurar_segundo_fator', 'sair'] } },
      }),
    ).toBe(2);
  });

  it('vendedor não vê a lista de todas as contas', async () => {
    const { token } = await entrarComSegundoFator(vendedor);
    await http().get('/admin/eu').set('authorization', `Bearer ${token}`).expect(200);
    await http().get('/admin/contas').set('authorization', `Bearer ${token}`).expect(403);
    await http().get('/admin/metricas').set('authorization', `Bearer ${token}`).expect(403);
  });

  it('login de barbearia não abre a administração, e o token da administração não abre o painel', async () => {
    const dono = await como(app, a.emails.dono);
    await dono.get('/admin/eu').expect(401);
    const { token } = await entrarComSegundoFator(outro);
    // Números do negócio: o cenário (Premium, ativa, sem fatura paga) conta como em dia.
    const m = (
      await http().get('/admin/metricas').set('authorization', `Bearer ${token}`).expect(200)
    ).body as MetricasDaPlataforma;
    expect(m.contas.total).toBeGreaterThan(0);
    expect(m.novas.porDia).toHaveLength(30);
    expect(m.receita.mrr).toBeGreaterThanOrEqual(0);
    await http().get('/clientes').set('authorization', `Bearer ${token}`).expect(401);
  });
});

describe('ações da administração numa conta', () => {
  const acoes = { email: `acoes-${sufixo}@pentefino.dev`, senha: 'senha-das-acoes-1' };
  let token = '';
  const comoAdmin = () => ({
    get: (url: string) => http().get(url).set('authorization', `Bearer ${token}`),
    put: (url: string, corpo: object) =>
      http().put(url).set('authorization', `Bearer ${token}`).send(corpo),
    post: (url: string, corpo: object) =>
      http().post(url).set('authorization', `Bearer ${token}`).send(corpo),
  });

  beforeAll(async () => {
    await plataforma.usuarioPlataforma.create({
      data: {
        email: acoes.email,
        nome: 'Ana Ações',
        papel: 'admin',
        senhaHash: await hash(acoes.senha),
      },
    });
    token = (await entrarComSegundoFator(acoes)).token;
  });
  afterAll(async () => {
    await plataforma.usuarioPlataforma.update({
      where: { email: acoes.email },
      data: { ativo: false },
    });
  });

  it('ficha, plano, bloqueio, teste, pagamento manual e cancelamento: valem na hora e ficam na auditoria', async () => {
    const adm = comoAdmin();
    const dono = await como(app, a.emails.dono);
    const url = `/admin/contas/${a.contaId}`;
    const ficha = (await adm.get(url).expect(200)).body as FichaContaPlataforma;
    expect(ficha).toMatchObject({ plano: 'premium', status: 'ativa', profissionais: 0 });
    expect(ficha.donos.map((d) => d.email)).toEqual([a.emails.dono]);
    expect(ficha.unidades).toHaveLength(2);

    // Motivo é obrigatório.
    await adm.put(`${url}/plano`, { plano: 'pro', ciclo: 'anual', motivo: 'ok' }).expect(400);
    await adm
      .put(`${url}/plano`, { plano: 'pro', ciclo: 'anual', motivo: 'Negociado na visita' })
      .expect(200);
    expect((await dono.get('/conta/situacao').expect(200)).body.plano).toBe('pro');

    // Bloquear: a barbearia fica só para consulta; desbloquear volta.
    await adm
      .put(`${url}/situacao`, { acao: 'bloquear', motivo: 'Pix devolvido pelo banco' })
      .expect(204);
    await dono.post('/clientes', { nome: 'Não Grava' }).expect(402);
    await dono.get('/clientes').expect(200);
    await adm
      .put(`${url}/situacao`, { acao: 'desbloquear', motivo: 'Pagou em dinheiro' })
      .expect(204);
    await dono.post('/clientes', { nome: 'Grava De Novo' }).expect(201);

    // Cortesia: teste até uma data.
    const ate = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    await adm.put(`${url}/teste`, { ate, motivo: 'Cortesia da feira' }).expect(204);
    expect(((await adm.get(url).expect(200)).body as FichaContaPlataforma).status).toBe('teste');

    // Pagamento manual: fatura paga do período e a conta ativa.
    const hoje = new Date().toISOString().slice(0, 10);
    const pago = await adm
      .post(`${url}/pagamentos`, {
        valor: 12490 * 12,
        forma: 'pix',
        pagoEm: hoje,
        periodoInicio: hoje,
        comprovante: 'E123456',
      })
      .expect(201);
    expect(pago.body.periodoFim > hoje).toBe(true);
    const depois = (await adm.get(url).expect(200)).body as FichaContaPlataforma;
    expect(depois.status).toBe('ativa');
    expect(depois.faturas[0]).toMatchObject({
      origem: 'manual',
      status: 'paga',
      valor: 12490 * 12,
      forma: 'pix',
      comprovante: 'E123456',
    });

    // Cancelar: nada se apaga, e não aceita mais pagamento.
    await adm
      .put(`${url}/situacao`, { acao: 'cancelar', motivo: 'Fechou a barbearia' })
      .expect(204);
    const cancelada = (await adm.get(url).expect(200)).body as FichaContaPlataforma;
    expect(cancelada).toMatchObject({
      status: 'cancelada',
      motivoCancelamento: 'Fechou a barbearia',
    });
    await adm
      .post(`${url}/pagamentos`, { valor: 100, forma: 'pix', pagoEm: hoje, periodoInicio: hoje })
      .expect(409);
    await dono.get('/clientes').expect(200);

    expect(cancelada.historico.map((h) => h.acao)).toEqual([
      'cancelar',
      'registrar_pagamento',
      'mudar_teste',
      'desbloquear',
      'bloquear',
      'mudar_plano',
    ]);
    expect(cancelada.historico[0]).toMatchObject({
      quem: 'Ana Ações',
      motivo: 'Fechou a barbearia',
    });

    // Volta como estava para o resto do arquivo.
    await adm
      .put(`${url}/situacao`, { acao: 'desbloquear', motivo: 'Fim do teste e2e' })
      .expect(204);
    await adm
      .put(`${url}/plano`, { plano: 'premium', ciclo: 'mensal', motivo: 'Fim do teste e2e' })
      .expect(200);
  });

  it('conta que não existe: 404; sem sessão: 401', async () => {
    await comoAdmin().get(`/admin/contas/${randomUUID()}`).expect(404);
    await http().put(`/admin/contas/${a.contaId}/plano`).send({}).expect(401);
  });
});
