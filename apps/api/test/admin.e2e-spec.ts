// Etapa 15.1: login da administração com segundo fator, sessão própria e leitura entre contas
// sem dado de cliente. O login de uma barbearia não abre a administração, nem o contrário.
import type { INestApplication } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import { criarPrisma, naConta, type PrismaClient } from '@pente-fino/db';
import type {
  ContaNaPlataforma,
  FichaContaPlataforma,
  MetricasDaPlataforma,
  RespostaEntrarAdmin,
  VendaCriada,
  VendasDoVendedor,
} from '@pente-fino/shared';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { codigoDoPasso, passoDe } from '../src/admin/totp.js';
import {
  como,
  criarApp,
  criarCenario,
  tokenDoLink,
  ultimoEmail,
  type Cenario,
} from './ajudantes.js';

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

  it('vendedor não vê as contas dos outros nem os números do negócio', async () => {
    const { token } = await entrarComSegundoFator(vendedor);
    await http().get('/admin/eu').set('authorization', `Bearer ${token}`).expect(200);
    // Vendedor vê só as contas que vendeu (este ainda não vendeu nenhuma).
    expect(
      (await http().get('/admin/contas').set('authorization', `Bearer ${token}`).expect(200)).body,
    ).toEqual([]);
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

describe('venda presencial', () => {
  const vend = { email: `vend3-${sufixo}@pentefino.dev`, senha: 'senha-do-vendedor-3' };
  const chefe = { email: `chefe-${sufixo}@pentefino.dev`, senha: 'senha-do-chefe-123' };
  const donoEmail = `dono-venda-${sufixo}@e2e.pentefino.dev`;
  let tVend = '';
  let tChefe = '';
  let contaVendida = '';
  const com = (t: string) => ({
    get: (url: string) => http().get(url).set('authorization', `Bearer ${t}`),
    post: (url: string, corpo: object) =>
      http().post(url).set('authorization', `Bearer ${t}`).send(corpo),
  });

  beforeAll(async () => {
    await plataforma.usuarioPlataforma.createMany({
      data: [
        {
          email: vend.email,
          nome: 'Vera Vendas',
          papel: 'vendedor',
          senhaHash: await hash(vend.senha),
        },
        {
          email: chefe.email,
          nome: 'Chico Chefe',
          papel: 'admin',
          senhaHash: await hash(chefe.senha),
        },
      ],
    });
    tVend = (await entrarComSegundoFator(vend)).token;
    tChefe = (await entrarComSegundoFator(chefe)).token;
  });
  afterAll(async () => {
    await plataforma.usuarioPlataforma.updateMany({
      where: { email: { in: [vend.email, chefe.email] } },
      data: { ativo: false },
    });
    if (contaVendida) {
      const app2 = criarPrisma();
      await naConta(app2, contaVendida, (tx) =>
        tx.conta.deleteMany({ where: { id: contaVendida } }),
      );
      await app2.$disconnect();
    }
  });

  it('o vendedor cria a conta na rua, registra o Pix, o dono entra pelo convite e aparece nas vendas', async () => {
    const v = com(tVend);
    const venda = {
      barbearia: `Barbearia da Rua ${sufixo}`,
      dono: { nome: 'Rui Rua', email: donoEmail, telefone: '(11) 97777-6666' },
      plano: 'pro',
      ciclo: 'mensal',
      diasTeste: 0,
    };
    const r = (await v.post('/admin/contas', venda).expect(201)).body as VendaCriada;
    contaVendida = r.contaId;
    expect(r.linkWhatsapp).toMatch(/^https:\/\/wa\.me\/5511977776666\?text=/);
    expect(r.linkConvite).toMatch(/\/convite\?token=/);
    const email = await ultimoEmail(donoEmail);
    expect(email?.assunto).toContain('está pronta');
    await v.post('/admin/contas', venda).expect(409);

    // O vendedor vê só a conta dele e não abre as outras.
    const minhas = (await v.get('/admin/contas').expect(200)).body as ContaNaPlataforma[];
    expect(minhas.map((c) => c.id)).toEqual([r.contaId]);
    expect(minhas[0]).toMatchObject({ plano: 'pro', donoAtivou: false });
    await v.get(`/admin/contas/${a.contaId}`).expect(404);
    await v
      .post(`/admin/contas/${a.contaId}/pagamentos`, {
        valor: 100,
        forma: 'pix',
        pagoEm: '2026-11-07',
        periodoInicio: '2026-11-07',
      })
      .expect(404);

    // Registra o Pix na hora: a conta fica ativa.
    const hoje = new Date().toISOString().slice(0, 10);
    await v
      .post(`/admin/contas/${r.contaId}/pagamentos`, {
        valor: 14990,
        forma: 'pix',
        pagoEm: hoje,
        periodoInicio: hoje,
      })
      .expect(201);
    expect(
      ((await v.get(`/admin/contas/${r.contaId}`).expect(200)).body as FichaContaPlataforma).status,
    ).toBe('ativa');

    // O dono cria a senha pelo convite e entra.
    await http()
      .post('/auth/convite')
      .send({ token: tokenDoLink(r.linkConvite), senha: 'senha-do-dono-da-rua' })
      .expect(200);
    const dono = await como(app, donoEmail, 'senha-do-dono-da-rua');
    expect((await dono.get('/conta/situacao').expect(200)).body).toMatchObject({
      plano: 'pro',
      somenteLeitura: false,
    });

    // Admin: vendas por vendedor.
    const vendas = (await com(tChefe).get('/admin/vendas').expect(200)).body as VendasDoVendedor[];
    expect(vendas.find((x) => x.nome === 'Vera Vendas')).toMatchObject({
      criadas: 1,
      ativadas: 1,
      pagas: 1,
    });
    await v.get('/admin/vendas').expect(403);
  });
});
