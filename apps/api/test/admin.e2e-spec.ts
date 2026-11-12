// Etapa 15.1: login da administração com segundo fator, sessão própria e leitura entre contas
// sem dado de cliente. O login de uma barbearia não abre a administração, nem o contrário.
import type { INestApplication } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import { criarPrisma, naConta, type PrismaClient } from '@pente-fino/db';
import {
  dataLocal,
  DIAS_TESTE,
  ETAPAS_FUNIL,
  SEM_ORIGEM,
  TOTAL_PASSOS_ATIVACAO,
  VERSAO_TERMOS,
} from '@pente-fino/shared';
import type {
  ContaNaPlataforma,
  SaudeDoSistema,
  FichaContaPlataforma,
  MetricasDaPlataforma,
  RespostaEntrarAdmin,
  NotaInterna,
  ResumoFunil,
  VendaCriada,
  VendasDoVendedor,
  VendasPorOrigem,
} from '@pente-fino/shared';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { codigoDoPasso, passoDe } from '../src/admin/totp.js';
import { PROVEDOR_COBRANCA, type ProvedorCobrancaFalso } from '../src/cobranca/provedor.js';
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
    // Padrão: mês atual (um ponto por dia até hoje); "30dias" mostra 30.
    expect(m.periodo.tipo).toBe('mes');
    expect(m.novas.porDia).toHaveLength(Number(m.periodo.ate.slice(8, 10)));
    const trinta = (
      await http()
        .get('/admin/metricas?periodo=30dias')
        .set('authorization', `Bearer ${token}`)
        .expect(200)
    ).body as MetricasDaPlataforma;
    expect(trinta.novas.porDia).toHaveLength(30);
    await http()
      .get('/admin/metricas?periodo=ano')
      .set('authorization', `Bearer ${token}`)
      .expect(400);
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

    // Estender o teste: até 60 dias (admin R6; a auditoria achou um teste até 2028).
    const dia = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
    const longe = await adm
      .put(`${url}/teste`, { ate: '2028-04-29', motivo: 'Implantação demorada' })
      .expect(400);
    expect(longe.body.erro.campos[0].mensagem).toMatch(/cortesia/);
    await adm.put(`${url}/teste`, { ate: dia(10), motivo: 'Teste da feira' }).expect(204);
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

    // Admin R3 (auditoria de 10/11): cancelada não "desbloqueia" para ativa sem cobrança.
    const errado = await adm
      .put(`${url}/situacao`, { acao: 'desbloquear', motivo: 'Fim do teste e2e' })
      .expect(400);
    expect(errado.body.erro.campos[0].mensagem).toMatch(/Reativar/);
    await adm.put(`${url}/situacao`, { acao: 'reativar', motivo: 'Voltou a abrir' }).expect(400); // sem o próximo passo
    // Reativar com cortesia: ativa sem cobrança até a data; a cobrança começa no dia seguinte.
    await adm
      .put(`${url}/situacao`, {
        acao: 'reativar',
        proximo: 'cortesia',
        data: dia(30),
        motivo: 'Parceria de divulgação',
      })
      .expect(204);
    const reativada = (await adm.get(url).expect(200)).body as FichaContaPlataforma;
    expect(reativada).toMatchObject({
      status: 'ativa',
      cortesiaAte: dia(30),
      cobrarAPartirDe: dia(31),
      motivoCancelamento: null,
      canceladaEm: null,
    });
    expect((await dono.get('/conta/situacao').expect(200)).body.mensagem).toMatch(
      /^Cortesia do Pente Fino até /,
    );
    await dono.post('/clientes', { nome: 'Grava Na Cortesia' }).expect(201);

    // Bloquear guarda o que era; desbloquear volta exatamente a isso.
    await adm
      .put(`${url}/situacao`, { acao: 'bloquear', motivo: 'Conferir pagamento' })
      .expect(204);
    expect(((await adm.get(url).expect(200)).body as FichaContaPlataforma).statusAnterior).toBe(
      'ativa',
    );
    await adm.put(`${url}/situacao`, { acao: 'desbloquear', motivo: 'Conferido' }).expect(204);

    // Volta como estava para o resto do arquivo: ativa, cobrando a partir de hoje.
    await adm
      .put(`${url}/situacao`, { acao: 'cobrar', data: hoje, motivo: 'Fim do teste e2e' })
      .expect(204);
    await adm
      .put(`${url}/plano`, { plano: 'premium', ciclo: 'mensal', motivo: 'Fim do teste e2e' })
      .expect(200);
  });

  // Admin R3: cancelar só mudava a situação, e o Asaas seguia cobrando a barbearia cancelada.
  it('cancelar para a cobrança automática no Asaas; cortesia não vale enquanto ela existe', async () => {
    const c = await criarCenario();
    try {
      const provedor = app.get<ProvedorCobrancaFalso>(PROVEDOR_COBRANCA);
      const dono = await como(app, c.emails.dono);
      const assinou = await dono.post('/conta/assinatura', {
        plano: 'premium',
        ciclo: 'mensal',
        documento: '529.982.247-25',
      });
      expect(assinou.status, JSON.stringify(assinou.body)).toBe(201);
      const adm = comoAdmin();
      const url = `/admin/contas/${c.contaId}`;
      const antes = (await adm.get(url).expect(200)).body as FichaContaPlataforma;
      expect(antes.cobrancaAutomatica).toBe(true);
      const ate = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
      const r = await adm
        .put(`${url}/situacao`, { acao: 'cortesia', data: ate, motivo: 'Parceria da feira' })
        .expect(400);
      expect(r.body.erro.campos[0].mensagem).toMatch(/cobrança automática/);

      const assinatura = await naConta(criarPrisma(), c.contaId, (tx) =>
        tx.conta.findUniqueOrThrow({
          where: { id: c.contaId },
          select: { asaasAssinaturaId: true },
        }),
      );
      await adm.put(`${url}/situacao`, { acao: 'cancelar', motivo: 'Pediu para sair' }).expect(204);
      expect(provedor.canceladas.has(assinatura.asaasAssinaturaId!)).toBe(true);
      const depois = (await adm.get(url).expect(200)).body as FichaContaPlataforma;
      expect(depois).toMatchObject({ status: 'cancelada', cobrancaAutomatica: false });
      // A auditoria guarda que a cobrança automática foi parada.
      expect(depois.historico[0]).toMatchObject({
        acao: 'cancelar',
        depois: expect.objectContaining({ pararCobrancaAutomatica: true }),
      });
    } finally {
      await c.remover();
    }
  });

  // Admin R5: a conta "Teste" ativa sem cobrança aparecia "Em dia" e não pedia atenção.
  it('ativa sem cobrança pede atenção; marcada como interna, sai dos números e da atenção', async () => {
    const c = await criarCenario();
    try {
      const adm = comoAdmin();
      const url = `/admin/contas/${c.contaId}`;
      const pendencias = async () =>
        (
          (await adm.get('/admin/pendencias').expect(200)).body as {
            contaId: string;
            tipo: string;
          }[]
        )
          .filter((p) => p.contaId === c.contaId)
          .map((p) => p.tipo);
      const metricas = async () =>
        (await adm.get('/admin/metricas').expect(200)).body as MetricasDaPlataforma;
      expect(await pendencias()).toContain('ativa_sem_cobranca');
      const antes = await metricas();

      await adm.put(`${url}/interna`, { interna: true, motivo: 'ok' }).expect(400);
      await adm
        .put(`${url}/interna`, { interna: true, motivo: 'Conta de teste da equipe' })
        .expect(204);
      expect(await pendencias()).toEqual([]);
      const depois = await metricas();
      expect(depois.contas.internas).toBe(antes.contas.internas + 1);
      expect(depois.contas.total).toBe(antes.contas.total - 1);
      expect(depois.contas.porSituacao.ativa_sem_cobranca).toBe(
        antes.contas.porSituacao.ativa_sem_cobranca - 1,
      );
      // Admin F2: a ficha diz de onde veio o cadastro.
      await naConta(criarPrisma(), c.contaId, (tx) =>
        tx.conta.update({
          where: { id: c.contaId },
          data: { origem: { gclid: 'x', utm_campaign: 'lancamento' } },
        }),
      );
      const ficha = (await adm.get(url).expect(200)).body as FichaContaPlataforma;
      expect(ficha.interna).toBe(true);
      expect(ficha.origem).toBe('Google Ads · lancamento');
      expect(ficha.historico[0]).toMatchObject({
        acao: 'marcar_interna',
        motivo: 'Conta de teste da equipe',
      });
      const lista = (await adm.get('/admin/contas').expect(200)).body as {
        id: string;
        interna: boolean;
      }[];
      expect(lista.find((x) => x.id === c.contaId)?.interna).toBe(true);
      // A barbearia não vê diferença nenhuma.
      const dono = await como(app, c.emails.dono);
      expect((await dono.get('/conta/situacao').expect(200)).body.somenteLeitura).toBe(false);
    } finally {
      await c.remover();
    }
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
    expect(email?.assunto).toContain('já está no Pente Fino');
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

describe('administração mais prática (admin U2 a U5)', () => {
  const chefe = { email: `chefe-u-${sufixo}@pentefino.dev`, senha: 'senha-do-chefe-u-1' };
  const vend = { email: `vend-u-${sufixo}@pentefino.dev`, senha: 'senha-do-vend-u-12' };
  let tChefe = '';
  let tVend = '';
  let contaU = '';
  const com = (t: string) => ({
    get: (url: string) => http().get(url).set('authorization', `Bearer ${t}`),
    post: (url: string, corpo: object) =>
      http().post(url).set('authorization', `Bearer ${t}`).send(corpo),
  });

  beforeAll(async () => {
    await plataforma.usuarioPlataforma.createMany({
      data: [
        {
          email: chefe.email,
          nome: 'Clara Chefe',
          papel: 'admin',
          senhaHash: await hash(chefe.senha),
        },
        {
          email: vend.email,
          nome: 'Vado Vendas',
          papel: 'vendedor',
          senhaHash: await hash(vend.senha),
        },
      ],
    });
    tChefe = (await entrarComSegundoFator(chefe)).token;
    tVend = (await entrarComSegundoFator(vend)).token;
  });
  afterAll(async () => {
    await plataforma.usuarioPlataforma.updateMany({
      where: { email: { in: [chefe.email, vend.email] } },
      data: { ativo: false },
    });
    if (contaU) {
      const app2 = criarPrisma();
      await naConta(app2, contaU, (tx) => tx.conta.deleteMany({ where: { id: contaU } }));
      await app2.$disconnect();
    }
  });

  it('alertas da equipe (F3): cada pessoa escolhe os seus; tipo que não existe é recusado', async () => {
    const v = com(tVend);
    const put = (corpo: object) =>
      http().put('/admin/eu/alertas').set('authorization', `Bearer ${tVend}`).send(corpo);
    expect((await v.get('/admin/eu/alertas').expect(200)).body).toEqual({ alertas: [] });
    await put({ alertas: ['cobranca_vencida', 'falha_email', 'falha_email'] }).expect(204);
    expect((await v.get('/admin/eu/alertas').expect(200)).body).toEqual({
      alertas: ['cobranca_vencida', 'falha_email'],
    });
    await put({ alertas: ['nao_existe'] }).expect(400);
    // A escolha de um não muda a do outro.
    expect((await com(tChefe).get('/admin/eu/alertas').expect(200)).body).toEqual({ alertas: [] });
  });

  it('funil de ativação (F1): só o admin, etapas do cadastro ao pagamento e a etapa na ficha', async () => {
    const v = com(tVend);
    const adm = com(tChefe);
    if (!contaU) {
      const r = (
        await v
          .post('/admin/contas', {
            barbearia: `Barbearia do Funil ${sufixo}`,
            dono: {
              nome: 'Fausto Funil',
              email: `funil-${sufixo}@e2e.pentefino.dev`,
              telefone: null,
            },
            plano: 'basico',
            ciclo: 'mensal',
            diasTeste: 10,
          })
          .expect(201)
      ).body as VendaCriada;
      contaU = r.contaId;
    }
    await v.get('/admin/funil').expect(403);
    await adm.get('/admin/funil?periodo=ano').expect(400);
    const f = (await adm.get('/admin/funil?periodo=30dias').expect(200)).body as ResumoFunil;
    expect(f.etapas.map((e) => e.etapa)).toEqual(ETAPAS_FUNIL.map((e) => e.etapa));
    expect(f.total).toBeGreaterThanOrEqual(1);
    // Todo cadastro está na primeira etapa; nenhuma etapa passa do total.
    expect(f.etapas[0]).toMatchObject({ etapa: 'cadastro', contas: f.total, pct: 100 });
    expect(f.etapas.every((e) => e.contas <= f.total)).toBe(true);
    const todos = (await adm.get('/admin/funil').expect(200)).body as ResumoFunil;
    expect(todos.total).toBeGreaterThanOrEqual(f.total);
    // Conta recém-vendida ainda não pagou: a ficha mostra a etapa que falta.
    const ficha = (await adm.get(`/admin/contas/${contaU}`).expect(200))
      .body as FichaContaPlataforma;
    expect(ETAPAS_FUNIL.map((e) => e.etapa)).toContain(ficha.etapaFunil);
    expect(ficha.etapaFunil).not.toBe('cadastro');
  });

  it('venda com CPF, ficha com ativação e notas da equipe, lista com origem e vendas por origem', async () => {
    const v = com(tVend);
    const adm = com(tChefe);
    const venda = {
      barbearia: `Barbearia das Notas ${sufixo}`,
      dono: { nome: 'Nina Notas', email: `notas-${sufixo}@e2e.pentefino.dev`, telefone: null },
      plano: 'basico',
      ciclo: 'mensal',
      diasTeste: 10,
    };
    // CPF/CNPJ é opcional, mas conferido quando vem (admin U4).
    await v.post('/admin/contas', { ...venda, documento: '111.111.111-11' }).expect(400);
    const r = (await v.post('/admin/contas', { ...venda, documento: '529.982.247-25' }).expect(201))
      .body as VendaCriada;
    contaU = r.contaId;

    // Ficha (U3): documento, ativação e notas.
    const ficha = (await adm.get(`/admin/contas/${contaU}`).expect(200))
      .body as FichaContaPlataforma;
    expect(ficha.documento).toBe('52998224725');
    expect(ficha.status).toBe('teste');
    expect(ficha.ativacao).toBeGreaterThanOrEqual(0);
    expect(ficha.ativacao).toBeLessThanOrEqual(TOTAL_PASSOS_ATIVACAO);
    expect(ficha.notas).toEqual([]);

    // Notas: só o admin escreve; texto curto não vale; o vendedor da conta lê.
    await adm.post(`/admin/contas/${contaU}/notas`, { texto: 'ok' }).expect(400);
    await v.post(`/admin/contas/${contaU}/notas`, { texto: 'Vendedor não escreve' }).expect(403);
    await adm
      .post(`/admin/contas/${randomUUID()}/notas`, { texto: 'Conta que não existe' })
      .expect(404);
    const nota = (
      await adm
        .post(`/admin/contas/${contaU}/notas`, {
          texto: 'Ligar na sexta para ajudar com a agenda.',
        })
        .expect(201)
    ).body as NotaInterna;
    expect(nota).toMatchObject({
      autor: 'Clara Chefe',
      texto: 'Ligar na sexta para ajudar com a agenda.',
    });
    const vista = (await v.get(`/admin/contas/${contaU}`).expect(200)).body as FichaContaPlataforma;
    expect(vista.notas.map((n) => n.texto)).toEqual(['Ligar na sexta para ajudar com a agenda.']);
    expect(vista.historico[0]).toMatchObject({ acao: 'nota_interna', quem: 'Clara Chefe' });
    // Na auditoria fica só que houve nota, sem o texto.
    expect(JSON.stringify(vista.historico)).not.toContain('Ligar na sexta');

    // A aplicação das barbearias não lê as notas.
    const app2 = criarPrisma();
    await expect(app2.$queryRaw`SELECT texto FROM nota_interna_conta LIMIT 1`).rejects.toThrow();
    await app2.$disconnect();

    // Lista (U2): origem e ativação.
    const lista = (await v.get('/admin/contas').expect(200)).body as ContaNaPlataforma[];
    expect(lista.find((c) => c.id === contaU)).toMatchObject({ origem: null });
    expect(typeof lista.find((c) => c.id === contaU)!.ativacao).toBe('number');

    // Vendas por origem (U5): só o admin.
    await v.get('/admin/vendas/origens').expect(403);
    const origens = (await adm.get('/admin/vendas/origens').expect(200)).body as VendasPorOrigem[];
    const direto = origens.find((o) => o.origem === SEM_ORIGEM)!;
    expect(direto.cadastros).toBeGreaterThanOrEqual(1);
    expect(direto.emTeste).toBeGreaterThanOrEqual(1);
  });
});

describe('configurações e saúde do sistema', () => {
  const quem = { email: `config-${sufixo}@pentefino.dev`, senha: 'senha-do-config-123' };
  let token = '';
  const contasCriadas: string[] = [];
  const adm = () => ({
    get: (url: string) => http().get(url).set('authorization', `Bearer ${token}`),
    put: (url: string, corpo: object) =>
      http().put(url).set('authorization', `Bearer ${token}`).send(corpo),
  });

  beforeAll(async () => {
    await plataforma.usuarioPlataforma.create({
      data: {
        email: quem.email,
        nome: 'Cora Config',
        papel: 'admin',
        senhaHash: await hash(quem.senha),
      },
    });
    token = (await entrarComSegundoFator(quem)).token;
  });
  afterAll(async () => {
    // Volta ao padrão para não mexer no resto da suíte.
    await adm().put('/admin/configuracoes/teste', {
      dias: DIAS_TESTE,
      versaoTermos: VERSAO_TERMOS,
    });
    await adm().put('/admin/configuracoes/aviso-geral', { aviso: null });
    await plataforma.usuarioPlataforma.update({
      where: { email: quem.email },
      data: { ativo: false },
    });
    const app2 = criarPrisma();
    for (const id of contasCriadas)
      await naConta(app2, id, (tx) => tx.conta.deleteMany({ where: { id } }));
    await app2.$disconnect();
  });

  it('dias de teste e versão dos termos valem no cadastro pelo site', async () => {
    expect((await adm().get('/admin/configuracoes').expect(200)).body).toMatchObject({
      teste: { dias: DIAS_TESTE },
    });
    await adm()
      .put('/admin/configuracoes/teste', { dias: 0, versaoTermos: '2026-11-10' })
      .expect(400);
    await adm()
      .put('/admin/configuracoes/teste', { dias: 7, versaoTermos: '2026-11-10' })
      .expect(204);
    const email = `site-${sufixo}@e2e.pentefino.dev`;
    await http()
      .post('/publico/contas')
      .send({
        barbearia: 'Barbearia do Site',
        nome: 'Sara Site',
        email,
        senha: 'senha-do-site-123',
        aceite: true,
        abertoEm: Date.now() - 10_000,
      })
      .expect(201);
    const dono = await como(app, email, 'senha-do-site-123');
    const situacao = (await dono.get('/conta/situacao').expect(200)).body;
    contasCriadas.push((await dono.get('/auth/eu').expect(200)).body.contaId);
    expect(situacao).toMatchObject({ situacao: 'teste', diasRestantesTeste: 7 });
    const boasVindas = await ultimoEmail(email);
    expect(boasVindas?.assunto).toBe('Bem-vindo ao Pente Fino, Sara! Seu teste grátis começou');
    expect(boasVindas?.texto).toContain('são 7 dias com tudo liberado');
  });

  it('aviso geral aparece para as barbearias só enquanto vale', async () => {
    const dono = await como(app, a.emails.dono);
    expect((await dono.get('/sistema/aviso').expect(200)).body).toEqual({ aviso: null });
    const agora = Date.now();
    await adm()
      .put('/admin/configuracoes/aviso-geral', {
        aviso: {
          texto: 'Manutenção programada hoje à noite.',
          tom: 'manutencao',
          inicio: new Date(agora - 3_600_000).toISOString(),
          fim: new Date(agora + 3_600_000).toISOString(),
        },
      })
      .expect(204);
    expect((await dono.get('/sistema/aviso').expect(200)).body.aviso).toMatchObject({
      texto: 'Manutenção programada hoje à noite.',
      tom: 'manutencao',
    });
    await adm().put('/admin/configuracoes/aviso-geral', { aviso: null }).expect(204);
    expect((await dono.get('/sistema/aviso').expect(200)).body).toEqual({ aviso: null });
  });

  it('saúde: banco, filas, conexões caídas e erros recentes', async () => {
    const s = (await adm().get('/admin/saude').expect(200)).body as SaudeDoSistema;
    expect(s.banco).toBe('ok');
    expect(s.filas.map((f) => f.fila)).toEqual([
      'E-mails',
      'WhatsApp (entrada e rotinas)',
      'WhatsApp (envio)',
      'Notificações no celular',
      'Eventos',
    ]);
    expect(Array.isArray(s.conexoesCaidas)).toBe(true);
    expect(Array.isArray(s.errosRecentes)).toBe(true);
  });
});

describe('SMTP configurável', () => {
  const quem = { email: `smtp-${sufixo}@pentefino.dev`, senha: 'senha-do-smtp-1234' };
  let token = '';
  const req = (metodo: 'get' | 'put' | 'post' | 'delete', url: string, corpo?: object) => {
    const r = http()[metodo](url).set('authorization', `Bearer ${token}`);
    return corpo ? r.send(corpo) : r;
  };
  const smtp = {
    host: 'smtp.exemplo.com',
    porta: 587,
    seguro: false,
    usuario: 'apikey',
    remetente: 'Pente Fino <nao-responda@pentefino.com.br>',
  };

  beforeAll(async () => {
    await plataforma.usuarioPlataforma.create({
      data: {
        email: quem.email,
        nome: 'Sílvio SMTP',
        papel: 'admin',
        senhaHash: await hash(quem.senha),
      },
    });
    token = (await entrarComSegundoFator(quem)).token;
  });
  afterAll(async () => {
    await req('delete', '/admin/configuracoes/smtp');
    await plataforma.usuarioPlataforma.update({
      where: { email: quem.email },
      data: { ativo: false },
    });
  });

  it('senha só cifrada, nunca na tela nem na auditoria; teste vai para quem pediu; volta ao .env', async () => {
    await req('delete', '/admin/configuracoes/smtp').expect(204);
    expect((await req('get', '/admin/configuracoes/smtp').expect(200)).body).toEqual({
      smtp: null,
    });
    await req('put', '/admin/configuracoes/smtp', { ...smtp, porta: 0, senha: 'x' }).expect(400);
    await req('put', '/admin/configuracoes/smtp', { ...smtp, senha: 'senha-super-secreta' }).expect(
      204,
    );
    const tela = (await req('get', '/admin/configuracoes/smtp').expect(200)).body;
    expect(tela).toEqual({ smtp: { ...smtp, temSenha: true } });
    const guardado = await plataforma.configuracaoPlataforma.findUniqueOrThrow({
      where: { chave: 'smtp' },
    });
    expect(JSON.stringify(guardado.valor)).not.toContain('senha-super-secreta');
    // Senha em branco na tela (null) mantém a guardada.
    await req('put', '/admin/configuracoes/smtp', {
      ...smtp,
      host: 'smtp2.exemplo.com',
      senha: null,
    }).expect(204);
    expect((await req('get', '/admin/configuracoes/smtp').expect(200)).body.smtp).toMatchObject({
      host: 'smtp2.exemplo.com',
      temSenha: true,
    });
    const auditoria = await plataforma.auditoriaPlataforma.findMany({
      where: { acao: 'configurar_smtp', usuario: { email: quem.email } },
    });
    expect(JSON.stringify(auditoria)).not.toContain('senha-super-secreta');
    expect(JSON.stringify(auditoria)).not.toContain(
      (guardado.valor as { senhaCifrada: string }).senhaCifrada,
    );

    // Testar conexão usa o que está na tela (antes de salvar), com o Mailpit do ambiente.
    const mailpit = {
      ...smtp,
      host: process.env.SMTP_HOST ?? 'localhost',
      porta: Number(process.env.SMTP_PORT ?? 1025),
      usuario: '',
      senha: '',
    };
    const conexao = await req('post', '/admin/configuracoes/smtp/conexao', mailpit).expect(200);
    expect(conexao.body).toMatchObject({ ok: true });
    const fechada = await req('post', '/admin/configuracoes/smtp/conexao', {
      ...mailpit,
      porta: 1,
    }).expect(200);
    expect(fechada.body.ok).toBe(false);
    expect(fechada.body.mensagem).toMatch(/porta 1|Sem resposta/);

    await req('delete', '/admin/configuracoes/smtp').expect(204);
    expect((await req('get', '/admin/configuracoes/smtp').expect(200)).body).toEqual({
      smtp: null,
    });
    // E-mail de teste sai na hora (SMTP do .env) e mostra a resposta do servidor.
    const teste = await req('post', '/admin/configuracoes/smtp/teste').expect(200);
    expect(teste.body).toMatchObject({ ok: true });
    expect(teste.body.resposta).toMatch(/^250/);
  });
});

describe('modelos de e-mail', () => {
  const quem = { email: `modelos-${sufixo}@pentefino.dev`, senha: 'senha-dos-modelos-1' };
  let token = '';
  const req = (metodo: 'get' | 'put' | 'delete' | 'post', url: string, corpo?: object) => {
    const r = http()[metodo](url).set('authorization', `Bearer ${token}`);
    return corpo ? r.send(corpo) : r;
  };

  beforeAll(async () => {
    await plataforma.usuarioPlataforma.create({
      data: {
        email: quem.email,
        nome: 'Mel Modelos',
        papel: 'admin',
        senhaHash: await hash(quem.senha),
      },
    });
    token = (await entrarComSegundoFator(quem)).token;
  });
  afterAll(async () => {
    await req('delete', '/admin/configuracoes/modelos-email/redefinir_senha');
    await plataforma.usuarioPlataforma.update({
      where: { email: quem.email },
      data: { ativo: false },
    });
  });

  it('admin U8: manda o modelo com valores de exemplo para quem está logado', async () => {
    const r = await req('post', '/admin/configuracoes/modelos-email/boas_vindas/teste').expect(200);
    expect(r.body).toMatchObject({ ok: true });
    expect(r.body.resposta).toMatch(/^250/);
    expect(r.body.mensagem).toContain(quem.email);
    await req('post', '/admin/configuracoes/modelos-email/nao_existe/teste').expect(400);
  });

  it('personaliza com as variáveis do modelo, vale no próximo e-mail e volta ao padrão', async () => {
    const lista = (await req('get', '/admin/configuracoes/modelos-email').expect(200)).body as {
      chave: string;
      personalizado: unknown;
    }[];
    expect(lista).toHaveLength(13);
    await req('put', '/admin/configuracoes/modelos-email/inventado', {}).expect(400);
    const recusa = await req('put', '/admin/configuracoes/modelos-email/redefinir_senha', {
      assunto: 'Senha nova, {{nome}}',
      corpo: 'Seu plano {{plano}} pede senha nova.',
      botao: 'Trocar senha',
    }).expect(400);
    expect(recusa.body.erro.campos[0].mensagem).toBe(
      'Variável que este e-mail não tem: {{plano}}.',
    );
    await req('put', '/admin/configuracoes/modelos-email/redefinir_senha', {
      assunto: 'Senha nova, {{nome}}',
      corpo: 'Oi {{nome}}, crie uma senha nova pelo botão.',
      botao: 'Trocar senha',
    }).expect(204);
    await http().post('/auth/esqueci-senha').send({ email: a.emails.gestor }).expect(202);
    const e = await ultimoEmail(a.emails.gestor);
    expect(e?.assunto).toBe('Senha nova, Gestor Teste');
    expect(e?.texto).toContain('Trocar senha: ');

    await req('delete', '/admin/configuracoes/modelos-email/redefinir_senha').expect(204);
    await http().post('/auth/esqueci-senha').send({ email: a.emails.gestor }).expect(202);
    expect((await ultimoEmail(a.emails.gestor))?.assunto).toBe('Redefina sua senha do Pente Fino');
  });
});

describe('tabelas de preço com vigência', () => {
  const quem = { email: `precos-${sufixo}@pentefino.dev`, senha: 'senha-dos-precos-1' };
  let token = '';
  let precosAntes: unknown = undefined;
  const contasCriadas: string[] = [];
  const req = (metodo: 'get' | 'put' | 'delete', url: string, corpo?: object) => {
    const r = http()[metodo](url).set('authorization', `Bearer ${token}`);
    return corpo ? r.send(corpo) : r;
  };
  const hoje = dataLocal(new Date());
  const tabela = (desde: string) => ({
    desde,
    planos: {
      basico: { mensal: 9990, anualPorMes: 8290 },
      pro: { mensal: 19990, anualPorMes: 16590 },
      premium: { mensal: 29990, anualPorMes: 24890 },
    },
    unidadeExtra: { mensal: 11990, anualPorMes: 9990 },
  });

  beforeAll(async () => {
    await plataforma.usuarioPlataforma.create({
      data: {
        email: quem.email,
        nome: 'Paulo Preços',
        papel: 'admin',
        senhaHash: await hash(quem.senha),
      },
    });
    token = (await entrarComSegundoFator(quem)).token;
    precosAntes = (
      await plataforma.configuracaoPlataforma.findUnique({ where: { chave: 'precos' } })
    )?.valor;
  });
  afterAll(async () => {
    // A tabela de hoje já vale (a API não deixa desistir): volta como estava, direto no banco.
    await plataforma.configuracaoPlataforma.upsert({
      where: { chave: 'precos' },
      create: { chave: 'precos', valor: (precosAntes ?? []) as object },
      update: { valor: (precosAntes ?? []) as object },
    });
    await plataforma.usuarioPlataforma.update({
      where: { email: quem.email },
      data: { ativo: false },
    });
    const app2 = criarPrisma();
    for (const id of contasCriadas)
      await naConta(app2, id, (tx) => tx.conta.deleteMany({ where: { id } }));
    await app2.$disconnect();
  });

  it('a tabela nova vale para o site e para quem contrata agora; quem já assinou não muda', async () => {
    await req('put', '/admin/configuracoes/precos', tabela('2020-01-01')).expect(400);
    await req('put', '/admin/configuracoes/precos', tabela(hoje)).expect(204);
    expect((await http().get('/publico/precos').expect(200)).body.planos.pro.mensal).toBe(19990);

    // A conta do cenário contratou antes (sem data): segue na tabela do lançamento.
    // (outro teste trocou o plano dela, o que é contrato novo; aqui ela volta a ser antiga)
    const app2 = criarPrisma();
    await naConta(app2, a.contaId, (tx) =>
      tx.conta.update({ where: { id: a.contaId }, data: { precosDesde: null } }),
    );
    await app2.$disconnect();
    const dono = await como(app, a.emails.dono);
    expect((await dono.get('/conta/assinatura').expect(200)).body).toMatchObject({
      precoPorMes: 24990 + 9990,
      tabelaPrecos: { desde: hoje },
    });

    // Quem se cadastra hoje paga a tabela nova.
    const email = `preco-novo-${sufixo}@e2e.pentefino.dev`;
    await http()
      .post('/publico/contas')
      .send({
        barbearia: 'Barbearia Nova',
        nome: 'Nina Nova',
        email,
        senha: 'senha-da-nina-123',
        plano: 'pro',
        aceite: true,
        abertoEm: Date.now() - 10_000,
      })
      .expect(201);
    const nina = await como(app, email, 'senha-da-nina-123');
    contasCriadas.push((await nina.get('/auth/eu').expect(200)).body.contaId);
    expect((await nina.get('/conta/assinatura').expect(200)).body.precoPorMes).toBe(19990);
    // Trocar de plano é contrato novo: o valor novo vem da tabela de hoje.
    const previa = (await nina.get('/conta/plano/previa?plano=premium').expect(200)).body;
    expect(previa).toMatchObject({ valorAtual: 19990, valorNovo: 29990 });

    // Tabela futura dá para desistir; a que já vale, não.
    const amanha = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    await req('put', '/admin/configuracoes/precos', tabela(amanha)).expect(204);
    expect(
      (await req('get', '/admin/configuracoes/precos').expect(200)).body.tabelas.map(
        (t: { desde: string }) => t.desde,
      ),
    ).toContain(amanha);
    await req('delete', `/admin/configuracoes/precos/${amanha}`).expect(204);
    await req('delete', `/admin/configuracoes/precos/${hoje}`).expect(409);
  });
});

describe('cupons', () => {
  const quem = { email: `cupons-${sufixo}@pentefino.dev`, senha: 'senha-dos-cupons-1' };
  const codigo = `TESTE${sufixo.replace(/-/g, '').toUpperCase()}`.slice(0, 20);
  let token = '';
  const contasCriadas: string[] = [];
  const req = (metodo: 'get' | 'put', url: string, corpo?: object) => {
    const r = http()[metodo](url).set('authorization', `Bearer ${token}`);
    return corpo ? r.send(corpo) : r;
  };
  const cadastro = (email: string, cupom?: string) =>
    http()
      .post('/publico/contas')
      .send({
        barbearia: 'Barbearia do Cupom',
        nome: 'Caio Cupom',
        email,
        senha: 'senha-do-cupom-123',
        aceite: true,
        abertoEm: Date.now() - 10_000,
        ...(cupom ? { cupom } : {}),
      });

  beforeAll(async () => {
    await plataforma.usuarioPlataforma.create({
      data: {
        email: quem.email,
        nome: 'Cida Cupons',
        papel: 'admin',
        senhaHash: await hash(quem.senha),
      },
    });
    token = (await entrarComSegundoFator(quem)).token;
  });
  afterAll(async () => {
    await req('put', '/admin/configuracoes/cupons', {
      codigo,
      descontoBp: 3000,
      vagas: 1,
      ativo: false,
    });
    await plataforma.usuarioPlataforma.update({
      where: { email: quem.email },
      data: { ativo: false },
    });
    const app2 = criarPrisma();
    for (const id of contasCriadas)
      await naConta(app2, id, (tx) => tx.conta.deleteMany({ where: { id } }));
    await app2.$disconnect();
  });

  it('cupom com 1 vaga: confere no site e dá o desconto; a vaga só conta quando a conta paga', async () => {
    await req('put', '/admin/configuracoes/cupons', { codigo: 'x', descontoBp: 100 }).expect(400);
    await req('put', '/admin/configuracoes/cupons', {
      codigo: codigo.toLowerCase(),
      descricao: 'Teste',
      descontoBp: 3000,
      vagas: 1,
    }).expect(204);
    expect((await http().get(`/publico/cupom/${codigo.toLowerCase()}`).expect(200)).body).toEqual({
      codigo,
      descontoBp: 3000,
      restantes: 1,
    });
    const nao = await http().get('/publico/cupom/NAOEXISTE').expect(400);
    expect(nao.body.erro.campos[0]).toEqual({ campo: 'cupom', mensagem: 'Cupom não encontrado.' });

    const email = `cupom-${sufixo}@e2e.pentefino.dev`;
    await cadastro(email, codigo).expect(201);
    const dono = await como(app, email, 'senha-do-cupom-123');
    contasCriadas.push((await dono.get('/auth/eu').expect(200)).body.contaId);
    expect((await dono.get('/conta/assinatura').expect(200)).body).toMatchObject({
      cupom: codigo,
      descontoBp: 3000,
      precoPorMes: Math.round(7990 * 0.7),
    });

    // Em teste não ocupa vaga: outro cadastro com o mesmo cupom passa (quem pagar primeiro
    // leva; ver oferta-lancamento.e2e-spec.ts).
    await cadastro(`cupom2-${sufixo}@e2e.pentefino.dev`, codigo).expect(201);
    const outro = await como(app, `cupom2-${sufixo}@e2e.pentefino.dev`, 'senha-do-cupom-123');
    contasCriadas.push((await outro.get('/auth/eu').expect(200)).body.contaId);
    const lista = (await req('get', '/admin/configuracoes/cupons').expect(200)).body as {
      codigo: string;
      usados: number;
    }[];
    expect(lista.find((c) => c.codigo === codigo)?.usados).toBe(0);
  });
});

describe('pronto quando (etapa 15.1)', () => {
  const vendedor = { email: `rua-${sufixo}@pentefino.dev`, senha: 'senha-do-vendedor-rua' };
  const chefe = { email: `chefe-rua-${sufixo}@pentefino.dev`, senha: 'senha-do-chefe-rua-1' };
  const donoEmail = `dono-rua-${sufixo}@e2e.pentefino.dev`;
  const clienteSecreto = `Cliente Secreto ${sufixo}`;
  let contaId = '';
  const com = (t: string) => ({
    get: (url: string) => http().get(url).set('authorization', `Bearer ${t}`),
    post: (url: string, corpo: object) =>
      http().post(url).set('authorization', `Bearer ${t}`).send(corpo),
    put: (url: string, corpo: object) =>
      http().put(url).set('authorization', `Bearer ${t}`).send(corpo),
  });

  beforeAll(async () => {
    await plataforma.usuarioPlataforma.createMany({
      data: [
        {
          email: vendedor.email,
          nome: 'Rui da Rua',
          papel: 'vendedor',
          senhaHash: await hash(vendedor.senha),
        },
        {
          email: chefe.email,
          nome: 'Clara Chefe',
          papel: 'admin',
          senhaHash: await hash(chefe.senha),
        },
      ],
    });
  });
  afterAll(async () => {
    await plataforma.usuarioPlataforma.updateMany({
      where: { email: { in: [vendedor.email, chefe.email] } },
      data: { ativo: false },
    });
    if (contaId) {
      const app2 = criarPrisma();
      await naConta(app2, contaId, (tx) => tx.conta.deleteMany({ where: { id: contaId } }));
      await app2.$disconnect();
    }
  });

  it('vende na rua, registra o Pix, o dono entra; o admin vê, muda o plano com motivo e tudo fica na auditoria, sem dado de cliente', async () => {
    // 1. O vendedor cria a conta na rua e registra o Pix na hora.
    const v = com((await entrarComSegundoFator(vendedor)).token);
    const venda = (
      await v
        .post('/admin/contas', {
          barbearia: `Barbearia da Esquina ${sufixo}`,
          dono: { nome: 'Edu Esquina', email: donoEmail, telefone: '11955554444' },
          plano: 'basico',
          ciclo: 'mensal',
          diasTeste: 0,
        })
        .expect(201)
    ).body as VendaCriada;
    contaId = venda.contaId;
    expect((await ultimoEmail(donoEmail))?.assunto).toContain('já está no Pente Fino');
    const hoje = dataLocal(new Date());
    await v
      .post(`/admin/contas/${contaId}/pagamentos`, {
        valor: 7990,
        forma: 'pix',
        pagoEm: hoje,
        periodoInicio: hoje,
      })
      .expect(201);

    // 2. O dono recebe o convite, entra e usa (cadastra um cliente).
    expect((await ultimoEmail(donoEmail))?.assunto).toContain('Pagamento confirmado');
    await http()
      .post('/auth/convite')
      .send({ token: tokenDoLink(venda.linkConvite), senha: 'senha-do-edu-123' })
      .expect(200);
    const dono = await como(app, donoEmail, 'senha-do-edu-123');
    expect((await dono.get('/conta/situacao').expect(200)).body).toMatchObject({
      situacao: 'ativa',
      somenteLeitura: false,
    });
    await dono.post('/clientes', { nome: clienteSecreto, telefone: '11944443333' }).expect(201);

    // 3. O admin vê a conta nova nas métricas e na lista, e muda o plano com motivo.
    const adm = com((await entrarComSegundoFator(chefe)).token);
    const metricas = (await adm.get('/admin/metricas').expect(200)).body as MetricasDaPlataforma;
    expect(metricas.novas.hoje).toBeGreaterThan(0);
    expect(metricas.receita.pagantes).toBeGreaterThan(0);
    const lista = (await adm.get('/admin/contas').expect(200)).body as ContaNaPlataforma[];
    expect(lista.find((c) => c.id === contaId)).toMatchObject({
      plano: 'basico',
      status: 'ativa',
      donoAtivou: true,
    });
    await adm
      .put(`/admin/contas/${contaId}/plano`, {
        plano: 'pro',
        ciclo: 'mensal',
        motivo: 'Pediu mais barbeiros',
      })
      .expect(200);
    expect((await dono.get('/conta/situacao').expect(200)).body.plano).toBe('pro');

    // 4. Tudo na auditoria da plataforma, com quem fez e o motivo.
    const ficha = (await adm.get(`/admin/contas/${contaId}`).expect(200))
      .body as FichaContaPlataforma;
    expect(ficha.historico.map((h) => [h.acao, h.quem])).toEqual([
      ['mudar_plano', 'Clara Chefe'],
      ['registrar_pagamento', 'Rui da Rua'],
      ['vender', 'Rui da Rua'],
    ]);
    expect(ficha.historico[0]?.motivo).toBe('Pediu mais barbeiros');

    // 5. Nenhuma resposta da administração traz dado de cliente da barbearia.
    const respostas = JSON.stringify([metricas, lista, ficha]);
    expect(respostas).not.toContain(clienteSecreto);
    expect(respostas).not.toContain('11944443333');
  });
});

describe('administração prática (etapa 15.2)', () => {
  const chefe = { email: `pratica-chefe-${sufixo}@pentefino.dev`, senha: 'senha-do-chefe-123' };
  const vende = { email: `pratica-vende-${sufixo}@pentefino.dev`, senha: 'senha-do-vende-123' };
  let tChefe = '';
  let tVende = '';
  const como = (t: string) => ({
    get: (url: string) => http().get(url).set('authorization', `Bearer ${t}`),
    post: (url: string, corpo: object = {}) =>
      http().post(url).set('authorization', `Bearer ${t}`).send(corpo),
    put: (url: string, corpo: object) =>
      http().put(url).set('authorization', `Bearer ${t}`).send(corpo),
  });
  const novos: string[] = [];

  beforeAll(async () => {
    await plataforma.usuarioPlataforma.createMany({
      data: [
        {
          email: chefe.email,
          nome: 'Célia Chefe',
          papel: 'admin',
          senhaHash: await hash(chefe.senha),
        },
        {
          email: vende.email,
          nome: 'Vera Vende',
          papel: 'vendedor',
          senhaHash: await hash(vende.senha),
        },
      ],
    });
    tChefe = (await entrarComSegundoFator(chefe)).token;
    tVende = (await entrarComSegundoFator(vende)).token;
  });
  afterAll(async () => {
    await plataforma.usuarioPlataforma.updateMany({
      where: { email: { in: [chefe.email, vende.email, ...novos] } },
      data: { ativo: false },
    });
  });

  it('equipe: cria com senha temporária, muda papel, desativa (encerra a sessão) e redefine', async () => {
    const email = `novo-${sufixo}@pentefino.dev`;
    novos.push(email);
    await como(tVende).get('/admin/equipe').expect(403);
    await como(tChefe).post('/admin/equipe', { nome: 'N', email, papel: 'vendedor' }).expect(400);
    const criado = (
      await como(tChefe)
        .post('/admin/equipe', { nome: 'Nina Nova', email, papel: 'vendedor' })
        .expect(201)
    ).body as { id: string; senha: string };
    expect(criado.senha.length).toBeGreaterThanOrEqual(16);
    await como(tChefe).post('/admin/equipe', { nome: 'Nina', email, papel: 'admin' }).expect(409);
    const lista = (await como(tChefe).get('/admin/equipe').expect(200)).body as {
      email: string;
      segundoFatorConfigurado: boolean;
    }[];
    expect(lista.find((m) => m.email === email)).toMatchObject({ segundoFatorConfigurado: false });

    // A pessoa nova entra (configura o autenticador) e é desativada: a sessão cai na hora.
    const { token } = await entrarComSegundoFator({ email, senha: criado.senha });
    await como(token).get('/admin/eu').expect(200);
    // Admin U6: desativar pede o motivo.
    await como(tChefe).put(`/admin/equipe/${criado.id}`, { ativo: false }).expect(400);
    await como(tChefe)
      .put(`/admin/equipe/${criado.id}`, { ativo: false, motivo: 'Saiu da empresa' })
      .expect(204);
    await como(token).get('/admin/eu').expect(401);
    const eu = (await como(tChefe).get('/admin/eu').expect(200)).body as { id: string };
    await como(tChefe)
      .put(`/admin/equipe/${eu.id}`, { ativo: false, motivo: 'Teste do próprio acesso' })
      .expect(409);

    // Redefinir: senha nova, autenticador do zero e reativa.
    const novo = (await como(tChefe).post(`/admin/equipe/${criado.id}/redefinir`).expect(200))
      .body as { senha: string };
    expect(novo.senha).not.toBe(criado.senha);
    await entrar({ email, senha: criado.senha }).expect(401);
    expect((await entrar({ email, senha: novo.senha }).expect(200)).body.etapa).toBe('configurar');

    const eventos = (await como(tChefe).get(`/admin/auditoria?usuario=${eu.id}`).expect(200))
      .body as { acao: string; detalhe: string | null }[];
    expect(eventos.map((e) => e.acao)).toEqual(
      expect.arrayContaining(['criar_membro', 'mudar_membro', 'redefinir_membro']),
    );
    expect(JSON.stringify(eventos)).not.toContain(novo.senha);
    // Admin U7: legível, sem nomes técnicos.
    expect(eventos.find((e) => e.acao === 'mudar_membro')?.detalhe).toContain('Ativo: sim → não');
    await como(tChefe).get('/admin/auditoria?de=ontem').expect(400);
    // "Carregar mais": um por vez, e o seguinte é mais antigo que o anterior.
    const [primeiro] = (
      await como(tChefe).get(`/admin/auditoria?usuario=${eu.id}&limite=1`).expect(200)
    ).body as { id: string; quando: string }[];
    const seguintes = (
      await como(tChefe)
        .get(
          `/admin/auditoria?usuario=${eu.id}&antesDe=${encodeURIComponent(primeiro!.quando)}&antesDeId=${primeiro!.id}`,
        )
        .expect(200)
    ).body as { id: string; quando: string }[];
    expect(seguintes.length).toBe(eventos.length - 1);
    expect(seguintes.every((e) => e.quando <= primeiro!.quando && e.id !== primeiro!.id)).toBe(
      true,
    );
    await como(tChefe).get('/admin/auditoria?limite=5000').expect(400);
  });

  it('papéis suporte e financeiro: cada um só entra onde é listado (admin U6)', async () => {
    const sup = { email: `suporte-${sufixo}@pentefino.dev`, senha: 'senha-do-suporte-1' };
    const fin = { email: `financeiro-${sufixo}@pentefino.dev`, senha: 'senha-do-financeiro-1' };
    novos.push(sup.email, fin.email);
    await plataforma.usuarioPlataforma.createMany({
      data: [
        {
          email: sup.email,
          nome: 'Sofia Suporte',
          papel: 'suporte',
          senhaHash: await hash(sup.senha),
        },
        {
          email: fin.email,
          nome: 'Fábio Financeiro',
          papel: 'financeiro',
          senhaHash: await hash(fin.senha),
        },
      ],
    });
    const tSup = (await entrarComSegundoFator(sup)).token;
    const tFin = (await entrarComSegundoFator(fin)).token;
    const conta = a.contaId;

    // Suporte: lê contas (todas), pendências e a saúde; nada de cobrança, configurações ou equipe.
    expect((await como(tSup).get('/admin/eu').expect(200)).body.papel).toBe('suporte');
    const contas = (await como(tSup).get('/admin/contas').expect(200)).body as { id: string }[];
    expect(contas.some((c) => c.id === conta)).toBe(true);
    await como(tSup).get(`/admin/contas/${conta}`).expect(200);
    await como(tSup).get('/admin/pendencias').expect(200);
    await como(tSup).get('/admin/saude').expect(200);
    for (const rota of [
      '/admin/cobrancas',
      '/admin/equipe',
      '/admin/configuracoes',
      '/admin/auditoria',
      '/admin/metricas',
      '/admin/vendas',
      '/admin/configuracoes/nota-fiscal',
    ])
      await como(tSup).get(rota).expect(403);
    await como(tSup).post(`/admin/contas/${conta}/pagamentos`, {}).expect(403);
    await como(tSup).put(`/admin/contas/${conta}/plano`, {}).expect(403);
    await como(tSup).post('/admin/contas', {}).expect(403);

    // Financeiro: cobranças, pagamento e nota fiscal; sem saúde, equipe nem configurações gerais.
    await como(tFin).get('/admin/cobrancas').expect(200);
    await como(tFin).get('/admin/configuracoes/nota-fiscal').expect(200);
    // Passou da guarda (o corpo vazio é que é recusado).
    await como(tFin).post(`/admin/contas/${conta}/pagamentos`, {}).expect(400);
    for (const rota of ['/admin/saude', '/admin/equipe', '/admin/configuracoes', '/admin/metricas'])
      await como(tFin).get(rota).expect(403);
    await como(tFin).put(`/admin/contas/${conta}/plano`, {}).expect(403);
    await como(tFin).post('/admin/contas', {}).expect(403);

    // Equipe mostra a última troca de senha.
    const equipe = (await como(tChefe).get('/admin/equipe').expect(200)).body as {
      email: string;
      senhaTrocadaEm: string | null;
    }[];
    const novoMembro = (
      await como(tChefe)
        .post('/admin/equipe', {
          nome: 'Sara Suporte',
          email: `sara-${sufixo}@pentefino.dev`,
          papel: 'suporte',
        })
        .expect(201)
    ).body as { id: string };
    novos.push(`sara-${sufixo}@pentefino.dev`);
    const depois = (await como(tChefe).get('/admin/equipe').expect(200)).body as {
      id: string;
      papel: string;
      senhaTrocadaEm: string | null;
    }[];
    expect(depois.find((m) => m.id === novoMembro.id)).toMatchObject({ papel: 'suporte' });
    expect(depois.find((m) => m.id === novoMembro.id)?.senhaTrocadaEm).not.toBeNull();
    expect(equipe.length).toBeGreaterThan(0);
  });

  it('pendências e cobranças: admin vê todas; vendedor só as contas dele', async () => {
    const pend = await como(tChefe).get('/admin/pendencias').expect(200);
    expect(Array.isArray(pend.body)).toBe(true);
    const cob = (await como(tChefe).get('/admin/cobrancas').expect(200)).body as {
      pendentes: { contaId: string }[];
      totais: { vencido: number };
    };
    expect(typeof cob.totais.vencido).toBe('number');
    const doVendedor = (await como(tVende).get('/admin/cobrancas').expect(200)).body as {
      pendentes: unknown[];
      recebidas: unknown[];
    };
    expect(doVendedor.pendentes).toEqual([]);
    expect(doVendedor.recebidas).toEqual([]);
    expect((await como(tVende).get('/admin/pendencias').expect(200)).body).toEqual([]);
    await como(tVende).get('/admin/auditoria').expect(403);
  });
});
