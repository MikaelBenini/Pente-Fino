// Pronto quando da Etapa 4: login, convite e troca de senha de ponta a ponta.
import type { INestApplication } from '@nestjs/common';
import { criarPrisma, naConta } from '@pente-fino/db';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  criarApp,
  criarCenario,
  entrar,
  SENHA,
  tokenDoLink,
  ultimoEmail,
  type Cenario,
} from './ajudantes.js';

let app: INestApplication<App>;
let cenario: Cenario;
const http = () => request(app.getHttpServer());

beforeAll(async () => {
  app = await criarApp();
  cenario = await criarCenario();
});

afterAll(async () => {
  await cenario.remover();
  await app.close();
});

describe('saúde e formato', () => {
  it('GET /health confere banco e Redis', async () => {
    const r = await http().get('/health').expect(200);
    expect(r.body).toEqual({ status: 'ok', banco: 'ok', redis: 'ok' });
  });

  it('toda resposta traz x-request-id; o do Caddy é respeitado', async () => {
    const r = await http().get('/health').set('x-request-id', 'caddy-12345678');
    expect(r.headers['x-request-id']).toBe('caddy-12345678');
  });

  it('a raiz leva à documentação fora de produção', async () => {
    const r = await http().get('/').expect(302);
    expect(r.headers.location).toBe('docs');
    await http().get('/docs').expect(200);
  });

  it('rota inexistente responde 404 em português', async () => {
    const r = await http().get('/nao-existe').expect(404);
    expect(r.body.erro).toEqual({ codigo: 'nao_encontrado', mensagem: 'Não encontrado.' });
  });
});

describe('login', () => {
  it('entra com e-mail em qualquer caixa e devolve sessão', async () => {
    const r = await http()
      .post('/auth/login')
      .send({ email: ` ${cenario.emails.dono.toUpperCase()} `, senha: SENHA })
      .expect(200);
    expect(r.body).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      expiraEm: 900,
    });
    expect(r.body.usuario).toMatchObject({
      email: cenario.emails.dono,
      contaId: cenario.contaId,
      papeis: [{ papel: 'dono', unidadeId: null }],
    });
  });

  it('senha errada e e-mail desconhecido dão a mesma resposta', async () => {
    const errada = await http()
      .post('/auth/login')
      .send({ email: cenario.emails.dono, senha: 'outra-senha' })
      .expect(401);
    const desconhecido = await http()
      .post('/auth/login')
      .send({ email: `ninguem-${randomUUID()}@x.dev`, senha: SENHA })
      .expect(401);
    expect(errada.body.erro).toEqual(desconhecido.body.erro);
    expect(errada.body.erro.mensagem).toBe('E-mail ou senha incorretos.');
  });

  it('valida a entrada com mensagens por campo', async () => {
    const r = await http().post('/auth/login').send({ email: 'sem-arroba' }).expect(400);
    expect(r.body.erro.codigo).toBe('validacao');
    expect(r.body.erro.campos).toEqual(
      expect.arrayContaining([
        { campo: 'email', mensagem: 'E-mail inválido.' },
        { campo: 'senha', mensagem: 'Informe a senha.' },
      ]),
    );
  });

  it('/auth/eu exige token válido', async () => {
    await http().get('/auth/eu').expect(401);
    const r = await http().get('/auth/eu').set('authorization', 'Bearer lixo').expect(401);
    expect(r.body.erro.mensagem).toBe('Sua sessão expirou. Entre de novo.');
    const { accessToken } = await entrar(app, cenario.emails.gestor);
    const eu = await http()
      .get('/auth/eu')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(eu.body.papeis).toEqual([{ papel: 'gestor', unidadeId: cenario.unidadeA }]);
  });

  it('5 senhas erradas seguidas bloqueiam o e-mail por 15 minutos; outro e-mail segue', async () => {
    const email = `alvo-${randomUUID()}@x.dev`;
    for (let i = 0; i < 5; i++)
      await http().post('/auth/login').send({ email, senha: 'x' }).expect(401);
    const r = await http().post('/auth/login').send({ email, senha: 'x' }).expect(429);
    expect(r.body.erro.codigo).toBe('login_bloqueado');
    expect(r.body.erro.mensagem).toMatch(/Tente de novo em 15 minutos/);
    // Outro e-mail do mesmo IP continua liberado (a recepção não fica travada).
    await entrar(app, cenario.emails.barbeiro);
  });

  it('acertar a senha zera a contagem', async () => {
    for (let i = 0; i < 4; i++)
      await http()
        .post('/auth/login')
        .send({ email: cenario.emails.recepcao, senha: 'x' })
        .expect(401);
    await entrar(app, cenario.emails.recepcao);
    for (let i = 0; i < 4; i++)
      await http()
        .post('/auth/login')
        .send({ email: cenario.emails.recepcao, senha: 'x' })
        .expect(401);
    await entrar(app, cenario.emails.recepcao);
  });
});

describe('sessão', () => {
  it('renovar troca o refreshToken; reusar o antigo encerra a sessão inteira', async () => {
    const primeira = await entrar(app, cenario.emails.barbeiro);
    const segunda = (
      await http().post('/auth/renovar').send({ refreshToken: primeira.refreshToken }).expect(200)
    ).body;
    expect(segunda.refreshToken).not.toBe(primeira.refreshToken);

    await http().post('/auth/renovar').send({ refreshToken: primeira.refreshToken }).expect(401);
    // O ladrão usou o antigo: o legítimo (segunda) também perde a sessão.
    await http().post('/auth/renovar').send({ refreshToken: segunda.refreshToken }).expect(401);
  });

  it('sair encerra a sessão', async () => {
    const s = await entrar(app, cenario.emails.barbeiro);
    await http().post('/auth/sair').send({ refreshToken: s.refreshToken }).expect(204);
    await http().post('/auth/renovar').send({ refreshToken: s.refreshToken }).expect(401);
  });
});

describe('convite', () => {
  it('dono convida, o convidado recebe o link, cria a senha e entra', async () => {
    const { accessToken } = await entrar(app, cenario.emails.dono);
    const email = `novo-${randomUUID().slice(0, 8)}@e2e.pentefino.dev`;
    const r = await http()
      .post('/usuarios/convites')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        nome: 'Novo Barbeiro',
        email,
        telefone: '(11) 98888-7777',
        papel: 'barbeiro',
        unidadeId: cenario.unidadeA,
      })
      .expect(201);
    expect(r.body.linkWhatsapp).toMatch(/^https:\/\/wa\.me\/5511988887777\?text=/);

    const email1 = await ultimoEmail(email);
    expect(email1?.assunto).toContain('convidou você para a equipe');
    const token = tokenDoLink(email1!.texto);
    expect(r.body.linkConvite).toContain(token);

    const sessao = await http()
      .post('/auth/convite')
      .send({ token, senha: 'minha-senha-nova' })
      .expect(200);
    expect(sessao.body.usuario.papeis).toEqual([
      { papel: 'barbeiro', unidadeId: cenario.unidadeA },
    ]);
    await entrar(app, email, 'minha-senha-nova');

    // Link de convite é de uso único.
    const reuso = await http()
      .post('/auth/convite')
      .send({ token, senha: 'outra-senha-qualquer' })
      .expect(400);
    expect(reuso.body.erro.codigo).toBe('link_invalido');
  });

  it('gestor convida barbeiro na própria unidade, mas não em outra nem como dono', async () => {
    const { accessToken } = await entrar(app, cenario.emails.gestor);
    const convidar = (corpo: object) =>
      http().post('/usuarios/convites').set('authorization', `Bearer ${accessToken}`).send(corpo);
    const base = { nome: 'Fulano', email: `f-${randomUUID().slice(0, 8)}@e2e.pentefino.dev` };

    await convidar({ ...base, papel: 'barbeiro', unidadeId: cenario.unidadeA }).expect(201);
    await convidar({ ...base, papel: 'barbeiro', unidadeId: cenario.unidadeB }).expect(403);
    const dono = await convidar({ ...base, papel: 'dono' }).expect(403);
    expect(dono.body.erro.codigo).toBe('sem_permissao');
    await convidar({ ...base, papel: 'gestor', unidadeId: cenario.unidadeA }).expect(403);
  });

  it('barbeiro não convida', async () => {
    const { accessToken } = await entrar(app, cenario.emails.barbeiro);
    await http()
      .post('/usuarios/convites')
      .set('authorization', `Bearer ${accessToken}`)
      .send({ nome: 'Xavier', email: 'x@x.dev', papel: 'barbeiro', unidadeId: cenario.unidadeA })
      .expect(403);
  });

  it('não convida para unidade de outra conta nem e-mail que já tem acesso', async () => {
    const { accessToken } = await entrar(app, cenario.emails.dono);
    const convidar = (corpo: object) =>
      http().post('/usuarios/convites').set('authorization', `Bearer ${accessToken}`).send(corpo);
    const naoEncontrada = await convidar({
      nome: 'Xavier',
      email: `x-${randomUUID()}@x.dev`,
      papel: 'barbeiro',
      unidadeId: randomUUID(),
    }).expect(404);
    expect(naoEncontrada.body.erro.mensagem).toBe('Unidade não encontrada.');
    const jaTem = await convidar({
      nome: 'Xavier',
      email: cenario.emails.gestor,
      papel: 'barbeiro',
      unidadeId: cenario.unidadeA,
    }).expect(409);
    expect(jaTem.body.erro.codigo).toBe('conflito');
    // E-mail de outra barbearia (demonstração ou outro teste): único no sistema.
    await convidar({
      nome: 'Xavier',
      email: 'dono@demo.pentefino.dev',
      papel: 'barbeiro',
      unidadeId: cenario.unidadeA,
    }).expect(409);
  });
});

describe('unidades', () => {
  it('dono vê todas; gestor só a dele', async () => {
    const dono = await entrar(app, cenario.emails.dono);
    const todas = await http()
      .get('/unidades')
      .set('authorization', `Bearer ${dono.accessToken}`)
      .expect(200);
    expect(todas.body.map((u: { nome: string }) => u.nome)).toEqual(['Unidade A', 'Unidade B']);

    const gestor = await entrar(app, cenario.emails.gestor);
    const dele = await http()
      .get('/unidades')
      .set('authorization', `Bearer ${gestor.accessToken}`)
      .expect(200);
    expect(dele.body).toMatchObject([{ id: cenario.unidadeA, nome: 'Unidade A', ativa: true }]);
  });
});

describe('senha', () => {
  it('esqueci a senha → link por e-mail → nova senha; sessões antigas caem', async () => {
    const antiga = await entrar(app, cenario.emails.gestor);
    const r = await http()
      .post('/auth/esqueci-senha')
      .send({ email: cenario.emails.gestor })
      .expect(202);
    expect(r.body.mensagem).toContain('Se o e-mail estiver cadastrado');

    const email = await ultimoEmail(cenario.emails.gestor);
    expect(email?.assunto).toBe('Redefina sua senha do Pente Fino');
    await http()
      .post('/auth/redefinir-senha')
      .send({ token: tokenDoLink(email!.texto), senha: 'senha-redefinida' })
      .expect(204);

    await http()
      .post('/auth/login')
      .send({ email: cenario.emails.gestor, senha: SENHA })
      .expect(401);
    await entrar(app, cenario.emails.gestor, 'senha-redefinida');
    await http().post('/auth/renovar').send({ refreshToken: antiga.refreshToken }).expect(401);
    expect((await ultimoEmail(cenario.emails.gestor))?.assunto).toBe(
      'Sua senha do Pente Fino foi alterada',
    );
  });

  it('esqueci a senha com e-mail desconhecido responde igual e não envia nada', async () => {
    const email = `ninguem-${randomUUID()}@x.dev`;
    await http().post('/auth/esqueci-senha').send({ email }).expect(202);
    expect(await ultimoEmail(email)).toBeUndefined();
  });

  it('trocar senha exige a atual e devolve sessão nova', async () => {
    const s = await entrar(app, cenario.emails.dono);
    const auth = { authorization: `Bearer ${s.accessToken}` };
    const errada = await http()
      .post('/auth/trocar-senha')
      .set(auth)
      .send({ senhaAtual: 'nao-e-essa', novaSenha: 'senha-trocada-1' })
      .expect(400);
    expect(errada.body.erro.campos).toEqual([
      { campo: 'senhaAtual', mensagem: 'A senha atual não confere.' },
    ]);

    const nova = await http()
      .post('/auth/trocar-senha')
      .set(auth)
      .send({ senhaAtual: SENHA, novaSenha: 'senha-trocada-1' })
      .expect(200);
    expect(nova.body.accessToken).toEqual(expect.any(String));
    await http().post('/auth/renovar').send({ refreshToken: s.refreshToken }).expect(401);
    await entrar(app, cenario.emails.dono, 'senha-trocada-1');
  });

  it('alterações de senha e convites ficam na auditoria, sem dados sensíveis', async () => {
    const prisma = criarPrisma();
    const registros = await naConta(prisma, cenario.contaId, (tx) =>
      tx.auditoria.findMany({ orderBy: { criadoEm: 'asc' } }),
    );
    await prisma.$disconnect();
    const acoes = registros.map((r) => r.acao);
    expect(acoes).toEqual(
      expect.arrayContaining(['convidar', 'aceitar_convite', 'redefinir_senha', 'trocar_senha']),
    );
    expect(JSON.stringify(registros)).not.toMatch(/argon2|senha-/);
  });
});
