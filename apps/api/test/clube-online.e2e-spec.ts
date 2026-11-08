// Clube online (Etapa 24): conta para receber, link de assinatura com split, webhook que cria a
// adesão e o repasse, cancelamento que para a cobrança no Asaas. Provedor falso do Asaas.
import type { INestApplication } from '@nestjs/common';
import { criarPrisma, naConta, type PrismaClient } from '@pente-fino/db';
import type { RecebimentoClube, RecebimentoNaTela } from '@pente-fino/shared';
import { dataLocal } from '@pente-fino/shared';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PROVEDOR_COBRANCA, type ProvedorCobrancaFalso } from '../src/cobranca/provedor.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let a: Cenario;
let prisma: PrismaClient;
let plataforma: PrismaClient;
let provedor: ProvedorCobrancaFalso;
type Cliente = Awaited<ReturnType<typeof como>>;
let dono: Cliente;
let recepcao: Cliente;
let planoId = '';
const slug = `clube-${randomUUID().slice(0, 8)}`;
const http = () => request(app.getHttpServer());
const webhook = (corpo: object) =>
  http()
    .post('/webhooks/asaas')
    .set('asaas-access-token', process.env.ASAAS_WEBHOOK_TOKEN!)
    .send(corpo)
    .expect(200);

const dados = {
  tipo: 'pj',
  nome: 'Barbearia Clube LTDA',
  documento: '12.345.678/0001-90',
  email: 'financeiro@clube.dev',
  telefone: '(11) 98888-7777',
  tipoEmpresa: 'MEI',
  faturamentoMensal: 3_000_000,
  cep: '01310-100',
  endereco: 'Av. Paulista',
  numero: '1000',
  bairro: 'Bela Vista',
};

beforeAll(async () => {
  app = await criarApp();
  a = await criarCenario();
  prisma = criarPrisma(process.env.DATABASE_URL);
  plataforma = criarPrisma(process.env.DATABASE_PLATAFORMA_URL);
  provedor = app.get(PROVEDOR_COBRANCA);
  dono = await como(app, a.emails.dono);
  recepcao = await como(app, a.emails.recepcao);
  await naConta(prisma, a.contaId, (tx) =>
    tx.unidade.update({ where: { id: a.unidadeA }, data: { slug } }),
  );
  const corte = (
    await dono
      .post('/servicos', {
        nome: 'Corte',
        duracaoMin: 30,
        custoProduto: 0,
        ehExtra: false,
        pesoAtendimento: 1,
      })
      .expect(201)
  ).body.id as string;
  planoId = (
    await dono
      .post('/clube/itens', {
        unidadeId: a.unidadeA,
        tipo: 'assinatura',
        nome: 'Clube Corte',
        valor: 10_000,
        limiteUsoMes: null,
        servicos: [{ servicoId: corte, quantidade: 4, comissaoValorFixo: null }],
      })
      .expect(201)
  ).body.id;
});

afterAll(async () => {
  // A administração não apaga configuração: volta a taxa ao padrão.
  await plataforma.configuracaoPlataforma.update({
    where: { chave: 'clube_online' },
    data: { valor: { taxaBp: 100 } },
  });
  await plataforma.$disconnect();
  await prisma.$disconnect();
  await a.remover();
  await app.close();
});

describe('clube online', () => {
  it('sem conta para receber: não há link; o dono cria a conta e vê os documentos', async () => {
    const antes = (await dono.get('/clube/recebimento').expect(200)).body as RecebimentoNaTela;
    expect(antes).toMatchObject({ situacao: null, taxaBp: 100 });
    await recepcao.get('/clube/recebimento').expect(403);
    const semConta = await recepcao.get(`/clube/itens/${planoId}/link`).expect(409);
    expect(semConta.body.erro.mensagem).toContain('Receber online');
    await http().get(`/publico/clube/${slug}`).expect(404);

    await dono.post('/clube/recebimento', { ...dados, documento: '123' }).expect(400);
    const criada = (await dono.post('/clube/recebimento', dados).expect(201))
      .body as RecebimentoNaTela;
    expect(criada).toMatchObject({
      situacao: 'documentos',
      nome: 'Barbearia Clube LTDA',
      documento: '12345678000190',
    });
    await dono.post('/clube/recebimento', dados).expect(409);
    const docs = (await dono.get('/clube/recebimento/documentos').expect(200)).body;
    expect(docs.link).toContain('onboarding');
    // A chave da subconta fica cifrada.
    const r = await naConta(prisma, a.contaId, (tx) => tx.recebimentoOnline.findFirstOrThrow());
    expect(r.apiKeyCifrada).not.toContain('aact');
  });

  it('link do plano com a mensagem do WhatsApp; o cliente vê os planos e assina com o split da taxa', async () => {
    await plataforma.configuracaoPlataforma.upsert({
      where: { chave: 'clube_online' },
      create: { chave: 'clube_online', valor: { taxaBp: 150 } },
      update: { valor: { taxaBp: 150 } },
    });
    const l = (await recepcao.get(`/clube/itens/${planoId}/link`).expect(200)).body;
    expect(l.link).toMatch(new RegExp(`/assinar\\?u=${slug}&p=${planoId}$`));
    expect(l.mensagem).toContain('*Clube Corte*');
    expect(l.mensagem).toContain(l.link);

    const clube = (await http().get(`/publico/clube/${slug}`).expect(200)).body;
    expect(clube.planos).toEqual([
      expect.objectContaining({
        id: planoId,
        nome: 'Clube Corte',
        valor: 10_000,
        inclui: ['4× Corte por mês'],
      }),
    ]);
    const corpo = {
      itemClubeId: planoId,
      nome: 'Paulo Pagante',
      telefone: '(11) 97700-4001',
      cpf: '529.982.247-25',
    };
    await http()
      .post(`/publico/clube/${slug}/assinar`)
      .send({ ...corpo, cpf: '1' })
      .expect(400);
    const r = (await http().post(`/publico/clube/${slug}/assinar`).send(corpo).expect(201)).body;
    expect(r.link).toContain('sandbox.asaas.com');
    // De novo antes de pagar: a mesma página de pagamento.
    expect(
      (await http().post(`/publico/clube/${slug}/assinar`).send(corpo).expect(201)).body.link,
    ).toBe(r.link);
    const ass = await naConta(prisma, a.contaId, (tx) =>
      tx.assinaturaClubeOnline.findFirstOrThrow(),
    );
    expect(ass).toMatchObject({ status: 'aguardando', taxaBp: 150 });
    expect(provedor.splits.get(ass.asaasAssinaturaId)).toEqual({
      walletId: expect.stringContaining('wal_falso'),
      percentual: 98.5,
    });
  });

  it('pagou: vira assinante, registra o repasse e avisa a barbearia; repetido não conta duas vezes', async () => {
    const ass = await naConta(prisma, a.contaId, (tx) =>
      tx.assinaturaClubeOnline.findFirstOrThrow(),
    );
    const pagamento = {
      id: `pay_${randomUUID().slice(0, 8)}`,
      customer: ass.asaasClienteId,
      subscription: ass.asaasAssinaturaId,
      status: 'RECEIVED',
      value: 100,
      netValue: 98.01,
      billingType: 'PIX',
      dueDate: dataLocal(new Date()),
      estimatedCreditDate: dataLocal(new Date()),
    };
    expect((await webhook({ event: 'PAYMENT_CREATED', payment: pagamento })).body.resultado).toBe(
      'ignorado',
    );
    expect((await webhook({ event: 'PAYMENT_RECEIVED', payment: pagamento })).body.resultado).toBe(
      'aplicado',
    );
    expect((await webhook({ event: 'PAYMENT_CONFIRMED', payment: pagamento })).body.resultado).toBe(
      'repetido',
    );

    const adesao = await naConta(prisma, a.contaId, (tx) =>
      tx.adesaoClube.findFirstOrThrow({
        where: { clienteId: ass.clienteId },
        include: { pagamentos: true },
      }),
    );
    expect(adesao.status).toBe('ativa');
    expect(adesao.pagamentos).toHaveLength(1);
    const mes = dataLocal(new Date()).slice(0, 7);
    const lista = (await dono.get(`/clube/recebimentos?mes=${mes}`).expect(200))
      .body as RecebimentoClube[];
    // R$ 100,00 pagos; R$ 1,99 de taxa do Asaas; 98,5% de R$ 98,01 = R$ 96,53 para a barbearia.
    expect(lista).toEqual([
      expect.objectContaining({
        cliente: 'Paulo Pagante',
        plano: 'Clube Corte',
        forma: 'pix',
        valor: 10_000,
        taxaAsaas: 199,
        taxaPlataforma: 148,
        repasse: 9_653,
      }),
    ]);
    const avisos = (await dono.get('/avisos').expect(200)).body;
    expect(JSON.stringify(avisos)).toContain('Novo assinante pelo link');
    // Já assinante: não assina de novo pelo link.
    const de_novo = await http()
      .post(`/publico/clube/${slug}/assinar`)
      .send({
        itemClubeId: planoId,
        nome: 'Paulo Pagante',
        telefone: '11977004001',
        cpf: '52998224725',
      })
      .expect(409);
    expect(de_novo.body.erro.mensagem).toContain('plano ativo');
  });

  it('cancelar a adesão no balcão para a cobrança recorrente no Asaas', async () => {
    const ass = await naConta(prisma, a.contaId, (tx) =>
      tx.assinaturaClubeOnline.findFirstOrThrow(),
    );
    await recepcao
      .post(`/clube/adesoes/${ass.adesaoId}/cancelar`, { motivo: 'Mudou de cidade' })
      .expect(204);
    expect(provedor.canceladas.has(ass.asaasAssinaturaId)).toBe(true);
    const depois = await naConta(prisma, a.contaId, (tx) =>
      tx.assinaturaClubeOnline.findFirstOrThrow(),
    );
    expect(depois.status).toBe('cancelada');
  });
});
