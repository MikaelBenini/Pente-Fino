// Etapa 10.1: assinar pelo Asaas (provedor falso), conferir o pagamento e o webhook.
import type { INestApplication } from '@nestjs/common';
import { criarPrisma, naConta, type PrismaClient } from '@pente-fino/db';
import { dataLocal, type AssinaturaDetalhe, type EstadoAssinatura } from '@pente-fino/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AssinaturaGuard } from '../src/assinatura/assinatura.guard.js';
import { PROVEDOR_COBRANCA, type ProvedorCobrancaFalso } from '../src/cobranca/provedor.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let a: Cenario;
type Cliente = Awaited<ReturnType<typeof como>>;
let dono: Cliente;
let gestor: Cliente;
let prisma: PrismaClient;
let provedor: ProvedorCobrancaFalso;
const TOKEN = process.env.ASAAS_WEBHOOK_TOKEN!;
const hoje = dataLocal(new Date());

const conta = () =>
  naConta(prisma, a.contaId, (tx) => tx.conta.findUniqueOrThrow({ where: { id: a.contaId } }));
const situacao = async () =>
  (await dono.get('/conta/situacao').expect(200)).body as EstadoAssinatura;
const webhook = (corpo: object, token: string | null = TOKEN) => {
  const r = request(app.getHttpServer()).post('/webhooks/asaas');
  if (token) r.set('asaas-access-token', token);
  return r.send(corpo);
};

beforeAll(async () => {
  app = await criarApp();
  a = await criarCenario();
  dono = await como(app, a.emails.dono);
  gestor = await como(app, a.emails.gestor);
  prisma = criarPrisma();
  provedor = app.get(PROVEDOR_COBRANCA);
  // Teste grátis terminado: a conta está só para consulta, mas assinar tem que funcionar.
  await naConta(prisma, a.contaId, (tx) =>
    tx.conta.update({
      where: { id: a.contaId },
      data: { status: 'teste', testeAte: new Date(Date.now() - 86_400_000) },
    }),
  );
  app.get(AssinaturaGuard).esquecer(a.contaId);
});

afterAll(async () => {
  await prisma.$disconnect();
  await a.remover();
  await app.close();
});

describe('assinar e pagar', () => {
  it('confere CPF/CNPJ, papel e o limite do plano', async () => {
    await dono
      .post('/conta/assinatura', { plano: 'pro', ciclo: 'mensal', documento: '111.111.111-11' })
      .expect(400);
    await gestor
      .post('/conta/assinatura', { plano: 'pro', ciclo: 'mensal', documento: '52998224725' })
      .expect(403);
    // A conta tem 2 unidades: o Básico (1 unidade) não serve.
    const r = await dono
      .post('/conta/assinatura', { plano: 'basico', ciclo: 'mensal', documento: '52998224725' })
      .expect(400);
    expect(r.body.erro.mensagem).toMatch(/Escolha um plano maior/);
  });

  it('assina mesmo bloqueada: cria no Asaas e devolve a página de pagamento', async () => {
    expect((await situacao()).somenteLeitura).toBe(true);
    const r = await dono
      .post('/conta/assinatura', {
        plano: 'premium',
        ciclo: 'mensal',
        documento: '529.982.247-25',
      })
      .expect(201);
    expect(r.body.linkPagamento).toMatch(/^https:\/\/sandbox\.asaas\.com\/i\//);
    const c = await conta();
    expect(c).toMatchObject({ plano: 'premium', ciclo: 'mensal', documento: '52998224725' });
    expect(c.asaasAssinaturaId).toBeTruthy();
    const d = (await dono.get('/conta/assinatura').expect(200)).body as AssinaturaDetalhe;
    expect(d).toMatchObject({
      cobrancaAutomatica: true,
      pendente: { status: 'aberta', valor: 24990 + 9990, vencimento: hoje },
    });
    // Ainda não pagou: segue só para consulta, e não dá para assinar duas vezes.
    expect((await situacao()).somenteLeitura).toBe(true);
    await dono
      .post('/conta/assinatura', { plano: 'pro', ciclo: 'mensal', documento: '52998224725' })
      .expect(409);
  });

  it('"Já paguei, conferir": pagou no Asaas → em dia e grava na hora', async () => {
    provedor.pagar((await conta()).asaasAssinaturaId!, 'PIX');
    const d = (await dono.post('/conta/assinatura/conferir').expect(200)).body as AssinaturaDetalhe;
    expect(d.faturas[0]).toMatchObject({ status: 'paga', forma: 'pix' });
    expect(d.estado).toMatchObject({ situacao: 'ativa', somenteLeitura: false });
    expect((await conta()).status).toBe('ativa');
    await dono.post('/clientes', { nome: 'Cliente Depois de Assinar' }).expect(201);
  });
});

describe('webhook do Asaas', () => {
  const pagamento = async (extra: object) => {
    const c = await conta();
    return {
      id: 'pay_mes_2',
      customer: c.asaasClienteId,
      subscription: c.asaasAssinaturaId,
      status: 'PENDING',
      value: 349.8,
      dueDate: hoje,
      invoiceUrl: 'https://sandbox.asaas.com/i/pay_mes_2',
      billingType: 'CREDIT_CARD',
      ...extra,
    };
  };

  it('sem o token certo: 401; cliente que não é de nenhuma conta: ignorado', async () => {
    await webhook({ event: 'PAYMENT_CREATED', payment: await pagamento({}) }, null).expect(401);
    await webhook(
      { event: 'PAYMENT_CREATED', payment: await pagamento({}) },
      'x'.repeat(28),
    ).expect(401);
    const r = await webhook({
      event: 'PAYMENT_CREATED',
      payment: { ...(await pagamento({})), customer: 'cus_de_ninguem' },
    }).expect(200);
    expect(r.body.resultado).toBe('ignorado');
  });

  it('cobrança nova → recusada com o motivo → paga, sem duplicar a fatura', async () => {
    await webhook({ event: 'PAYMENT_CREATED', payment: await pagamento({}) }).expect(200);
    await webhook({
      event: 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
      payment: await pagamento({}),
    }).expect(200);
    let d = (await dono.get('/conta/assinatura').expect(200)).body as AssinaturaDetalhe;
    expect(d.pendente).toMatchObject({
      status: 'recusada',
      motivoRecusa: 'Cartão recusado pelo banco.',
    });
    // "Conferir" não apaga a recusa (no Asaas a cobrança segue pendente).
    d = (await dono.post('/conta/assinatura/conferir').expect(200)).body as AssinaturaDetalhe;

    await webhook({
      event: 'PAYMENT_RECEIVED',
      payment: await pagamento({ status: 'RECEIVED', paymentDate: hoje }),
    }).expect(200);
    d = (await dono.get('/conta/assinatura').expect(200)).body as AssinaturaDetalhe;
    expect(d.pendente).toBeNull();
    expect(d.faturas.filter((f) => f.status === 'paga')).toHaveLength(2);
    expect(d.faturas).toHaveLength(2);
  });

  it('aviso atrasado ou repetido não tira a fatura de paga; estorno tira', async () => {
    await webhook({ event: 'PAYMENT_CREATED', payment: await pagamento({}) }).expect(200);
    await webhook({
      event: 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
      payment: await pagamento({}),
    }).expect(200);
    let d = (await dono.get('/conta/assinatura').expect(200)).body as AssinaturaDetalhe;
    expect(d.faturas.find((f) => f.status !== 'paga')).toBeUndefined();

    await webhook({
      event: 'PAYMENT_REFUNDED',
      payment: await pagamento({ status: 'REFUNDED' }),
    }).expect(200);
    d = (await dono.get('/conta/assinatura').expect(200)).body as AssinaturaDetalhe;
    expect(d.faturas.map((f) => f.status).sort()).toEqual(['cancelada', 'paga']);
  });
});
