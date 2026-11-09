// LGPD (Etapa 21): o dono exporta tudo o que o sistema guarda de um cliente e, a pedido dele,
// apaga os dados pessoais. Comandas e caixa ficam, sem nome; a auditoria guarda só o motivo.
import type { INestApplication } from '@nestjs/common';
import { criarPrisma, naConta, type PrismaClient } from '@pente-fino/db';
import {
  dataLocal,
  NOME_CLIENTE_REMOVIDO,
  type DadosDoCliente,
  type ResultadoAnonimizar,
} from '@pente-fino/shared';
import type { App } from 'supertest/types.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let a: Cenario;
let prisma: PrismaClient;
type Cliente = Awaited<ReturnType<typeof como>>;
let dono: Cliente;
let gestor: Cliente;
let clienteId = '';
let comandaId = '';

const amanha = () => {
  const d = new Date(`${dataLocal(new Date())}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

beforeAll(async () => {
  app = await criarApp();
  a = await criarCenario();
  prisma = criarPrisma();
  dono = await como(app, a.emails.dono);
  gestor = await como(app, a.emails.gestor);
  await dono.patch(`/unidades/${a.unidadeA}`, { diasTrabalho: [0, 1, 2, 3, 4, 5, 6] }).expect(200);
  const prof = (
    await dono
      .post('/profissionais', {
        unidadeId: a.unidadeA,
        nome: 'Barbeiro LGPD',
        email: `barbeiro-lgpd-${Date.now()}@e2e.pentefino.dev`,
        dataEntrada: dataLocal(new Date(Date.now() - 30 * 86_400_000)),
        comissaoServico: { percentualBp: 4000, valorFixo: null },
        comissaoProduto: { percentualBp: 1000, valorFixo: null },
      })
      .expect(201)
  ).body.id;
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
  await naConta(prisma, a.contaId, (tx) =>
    tx.precoServico.create({
      data: {
        servicoId: corte,
        unidadeId: a.unidadeA,
        valor: 5000,
        vigenciaInicio: new Date(Date.now() - 30 * 86_400_000),
      },
    }),
  );
  const r = await dono
    .post('/agendamentos', {
      unidadeId: a.unidadeA,
      profissionalId: prof,
      clienteNovo: { nome: 'Joana Titular', telefone: '11966665555' },
      inicio: `${amanha()}T10:00:00-03:00`,
      servicoIds: [corte],
      observacao: 'Prefere máquina 2',
    })
    .expect(201);
  comandaId = r.body.id;
  clienteId = r.body.clienteId;
  await dono.post(`/clientes/${clienteId}/notas`, { texto: 'Alérgica a pomada' }).expect(201);
  await naConta(prisma, a.contaId, (tx) =>
    tx.mensagem.create({
      data: {
        unidadeId: a.unidadeA,
        clienteId,
        telefone: '5511966665555',
        direcao: 'entrada',
        texto: 'Oi, quero marcar',
        status: 'recebida',
      },
    }),
  );
});

afterAll(async () => {
  await prisma.$disconnect();
  await a.remover();
  await app.close();
});

describe('dados do cliente (LGPD)', () => {
  it('só o dono exporta; o arquivo traz cadastro, anotações, horários, atendimentos e conversas', async () => {
    await gestor.get(`/clientes/${clienteId}/dados`).expect(403);
    const d = (await dono.get(`/clientes/${clienteId}/dados`).expect(200)).body as DadosDoCliente;
    expect(d.cliente).toMatchObject({ nome: 'Joana Titular', telefone: '5511966665555' });
    expect(d.anotacoes).toEqual([expect.objectContaining({ texto: 'Alérgica a pomada' })]);
    expect(d.horarios).toEqual([expect.objectContaining({ observacao: 'Prefere máquina 2' })]);
    expect(d.atendimentos).toEqual([
      expect.objectContaining({
        total: 5000,
        itens: [expect.objectContaining({ descricao: 'Corte' })],
      }),
    ]);
    expect(d.mensagens).toEqual([expect.objectContaining({ texto: 'Oi, quero marcar' })]);
  });

  it('apagar exige o dono, o nome digitado e nada correndo (horário futuro)', async () => {
    const corpo = { motivo: 'Pedido do cliente pelo WhatsApp', confirmacao: 'joana titular' };
    await gestor.post(`/clientes/${clienteId}/anonimizar`, corpo).expect(403);
    await dono
      .post(`/clientes/${clienteId}/anonimizar`, { ...corpo, confirmacao: 'Outra pessoa' })
      .expect(400);
    const futuro = await dono.post(`/clientes/${clienteId}/anonimizar`, corpo).expect(409);
    expect(futuro.body.erro.mensagem).toContain('horário marcado');
  });

  it('apaga os dados pessoais; a comanda fica sem nome e a auditoria guarda só o motivo', async () => {
    await dono
      .post(`/comandas/${comandaId}/cancelar`, { motivo: 'Cliente pediu para sair' })
      .expect((r) => expect([200, 201, 204]).toContain(r.status));
    const r = (
      await dono
        .post(`/clientes/${clienteId}/anonimizar`, {
          motivo: 'Pedido do cliente pelo WhatsApp',
          confirmacao: 'Joana  Titular',
        })
        .expect(200)
    ).body as ResultadoAnonimizar;
    expect(r).toMatchObject({ mensagens: 1, anotacoes: 1 });

    const depois = await naConta(prisma, a.contaId, async (tx) => ({
      cliente: await tx.cliente.findUniqueOrThrow({ where: { id: clienteId } }),
      mensagens: await tx.mensagem.count({ where: { telefone: '5511966665555' } }),
      notas: await tx.notaCliente.count({ where: { clienteId } }),
      agendamento: await tx.agendamento.findFirstOrThrow({ where: { clienteId } }),
      comanda: await tx.comanda.findUniqueOrThrow({ where: { id: comandaId } }),
      auditoria: await tx.auditoria.findFirstOrThrow({
        where: { entidadeId: clienteId, acao: 'anonimizar_lgpd' },
      }),
    }));
    expect(depois.cliente).toMatchObject({
      nome: NOME_CLIENTE_REMOVIDO,
      telefone: null,
      email: null,
      consentimentoMsg: false,
    });
    expect(depois).toMatchObject({ mensagens: 0, notas: 0 });
    expect(depois.agendamento.observacao).toBeNull();
    expect(depois.comanda.clienteId).toBe(clienteId);
    expect(depois.auditoria.motivo).toBe('Pedido do cliente pelo WhatsApp');
    expect(JSON.stringify(depois.auditoria)).not.toContain('Joana');

    // Não dá para exportar nem apagar de novo.
    await dono.get(`/clientes/${clienteId}/dados`).expect(409);
  });
});
