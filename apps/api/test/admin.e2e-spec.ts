// Etapa 15.1: login da administração com segundo fator, sessão própria e leitura entre contas
// sem dado de cliente. O login de uma barbearia não abre a administração, nem o contrário.
import type { INestApplication } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import { criarPrisma, type PrismaClient } from '@pente-fino/db';
import type {
  ContaNaPlataforma,
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
