// Etapa 10.1: tela Conversas — quem pediu atendente, responder pelo painel e devolver ao bot.
import type { INestApplication } from '@nestjs/common';
import { criarPrisma, instanciaDaUnidade, naConta, type PrismaClient } from '@pente-fino/db';
import {
  FILA_WHATSAPP_ENTRADA,
  MENSAGENS_BOT_PADRAO,
  type EnvioParaCliente,
  type ListaConversas,
  type MensagemDoCliente,
  type TrabalhoWhatsappEntrada,
} from '@pente-fino/shared';
import { Queue } from 'bullmq';
import type { App } from 'supertest/types.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let a: Cenario;
let b: Cenario;
type Cliente = Awaited<ReturnType<typeof como>>;
let dono: Cliente;
let recepcao: Cliente;
let barbeiro: Cliente;
let intruso: Cliente;
let prisma: PrismaClient;
let fila: Queue<TrabalhoWhatsappEntrada>;
let sessaoId = '';
const TELEFONE = '5511944441111';

beforeAll(async () => {
  app = await criarApp();
  a = await criarCenario();
  b = await criarCenario();
  dono = await como(app, a.emails.dono);
  recepcao = await como(app, a.emails.recepcao);
  barbeiro = await como(app, a.emails.barbeiro);
  intruso = await como(app, b.emails.dono);
  prisma = criarPrisma();
  fila = new Queue(FILA_WHATSAPP_ENTRADA, { connection: { url: process.env.REDIS_URL! } });

  // Um cliente que pediu atendente, e outro só conversando com o bot.
  sessaoId = await naConta(prisma, a.contaId, async (tx) => {
    const c = await tx.cliente.create({ data: { nome: 'Lucas Zap', telefone: TELEFONE } });
    await tx.mensagem.createMany({
      data: [
        { texto: 'oi', direcao: 'entrada' as const, status: 'recebida' as const },
        { texto: '4', direcao: 'entrada' as const, status: 'recebida' as const },
      ].map((m, i) => ({
        ...m,
        unidadeId: a.unidadeA,
        clienteId: c.id,
        telefone: TELEFONE,
        criadoEm: new Date(Date.now() - 60_000 + i * 1000),
      })),
    });
    await tx.botSessao.create({
      data: {
        unidadeId: a.unidadeA,
        telefone: '5511955552222',
        sessao: { caminho: [], ultimaEm: new Date().toISOString(), comAtendente: false },
      },
    });
    const s = await tx.botSessao.create({
      data: {
        unidadeId: a.unidadeA,
        telefone: TELEFONE,
        clienteId: c.id,
        sessao: { caminho: [], ultimaEm: new Date().toISOString(), comAtendente: true },
        atendenteDesde: new Date(Date.now() - 5 * 60_000),
      },
    });
    return s.id;
  });
});

afterAll(async () => {
  const jobs = await fila.getJobs(['waiting', 'delayed', 'completed', 'failed']);
  await Promise.all(
    jobs
      .filter((j) => j.data?.tipo === 'enviar' && j.data.contaId === a.contaId)
      .map((j) => j.remove()),
  );
  await fila.close();
  await prisma.$disconnect();
  await a.remover();
  await b.remover();
  await app.close();
});

describe('lista', () => {
  it('quem espera atendente vem primeiro, com a contagem para o aviso do menu', async () => {
    const r = (await recepcao.get(`/conversas?unidadeId=${a.unidadeA}`).expect(200))
      .body as ListaConversas;
    expect(r.aguardando).toBe(1);
    expect(r.conectado).toBe(false);
    expect(r.conversas).toHaveLength(2);
    expect(r.conversas[0]).toMatchObject({
      id: sessaoId,
      cliente: 'Lucas Zap',
      situacao: 'aguardando',
      ultimaMensagem: { texto: '4', direcao: 'entrada' },
    });
    expect(r.conversas[1]?.situacao).toBe('bot');
  });

  it('dono vê todas; barbeiro não entra; outra conta não enxerga nada', async () => {
    const r = (await dono.get('/conversas').expect(200)).body as ListaConversas;
    expect(r.aguardando).toBe(1);
    await barbeiro.get('/conversas').expect(403);
    const outra = (await intruso.get('/conversas').expect(200)).body as ListaConversas;
    expect(outra.conversas).toHaveLength(0);
    await intruso.get(`/conversas/${sessaoId}/mensagens`).expect(404);
    await recepcao.get(`/conversas?unidadeId=${a.unidadeB}`).expect(403);
  });

  it('mensagens da conversa em ordem', async () => {
    const ms = (await recepcao.get(`/conversas/${sessaoId}/mensagens`).expect(200))
      .body as MensagemDoCliente[];
    expect(ms.map((m) => m.texto)).toEqual(['oi', '4']);
  });
});

describe('assumir', () => {
  it('assumir sem escrever: sai da espera, fica com a equipe; barbeiro não assume', async () => {
    await barbeiro.post(`/conversas/${sessaoId}/assumir`).expect(403);
    await recepcao.post(`/conversas/${sessaoId}/assumir`).expect(200);
    const lista = (await recepcao.get(`/conversas?unidadeId=${a.unidadeA}`).expect(200))
      .body as ListaConversas;
    expect(lista.aguardando).toBe(0);
    expect(lista.conversas.find((c) => c.id === sessaoId)?.situacao).toBe('atendimento');
    // Volta a esperar para os testes seguintes (o cliente escreveu de novo).
    await naConta(prisma, a.contaId, (tx) =>
      tx.botSessao.update({ where: { id: sessaoId }, data: { atendenteDesde: new Date() } }),
    );
  });
});

describe('responder e devolver', () => {
  it('sem WhatsApp conectado, a resposta não é aceita', async () => {
    const r = await recepcao
      .post(`/conversas/${sessaoId}/responder`, { texto: 'Olá!' })
      .expect(409);
    expect(r.body.erro.mensagem).toMatch(/desconectado/);
  });

  it('responder assume a conversa: sai da fila de espera e vai para o worker enviar', async () => {
    await naConta(prisma, a.contaId, (tx) =>
      tx.botConexao.create({
        data: {
          unidadeId: a.unidadeA,
          instancia: instanciaDaUnidade(a.unidadeA),
          status: 'conectado',
        },
      }),
    );
    await recepcao.post(`/conversas/${sessaoId}/responder`, { texto: '' }).expect(400);
    const r = await recepcao
      .post(`/conversas/${sessaoId}/responder`, { texto: 'Oi Lucas, aqui é a Ju!' })
      .expect(201);
    const lista = (await recepcao.get(`/conversas?unidadeId=${a.unidadeA}`).expect(200))
      .body as ListaConversas;
    expect(lista.aguardando).toBe(0);
    expect(lista.conversas.find((c) => c.id === sessaoId)).toMatchObject({
      situacao: 'atendimento',
      aguardandoDesde: null,
      ultimaMensagem: { texto: 'Oi Lucas, aqui é a Ju!', direcao: 'saida' },
    });
    const job = await fila.getJob(`enviar_${r.body.id}`);
    expect(job?.data).toEqual({
      tipo: 'enviar',
      contaId: a.contaId,
      instancia: instanciaDaUnidade(a.unidadeA),
      mensagemIds: [r.body.id],
    });
    const m = await naConta(prisma, a.contaId, (tx) =>
      tx.mensagem.findUnique({ where: { id: r.body.id } }),
    );
    expect(m).toMatchObject({ direcao: 'saida', status: 'pendente', telefone: TELEFONE });
  });

  it('devolver ao bot manda o encerramento e o bot volta a responder', async () => {
    await recepcao.post(`/conversas/${sessaoId}/devolver`).expect(200);
    const lista = (await recepcao.get(`/conversas?unidadeId=${a.unidadeA}`).expect(200))
      .body as ListaConversas;
    expect(lista.conversas.find((c) => c.id === sessaoId)).toMatchObject({
      situacao: 'bot',
      ultimaMensagem: { texto: MENSAGENS_BOT_PADRAO.encerramento, direcao: 'saida' },
    });
    const s = await naConta(prisma, a.contaId, (tx) =>
      tx.botSessao.findUnique({ where: { id: sessaoId } }),
    );
    expect(s?.sessao).toMatchObject({ comAtendente: false });
  });
});

describe('mandar mensagem a um cliente pelo bot', () => {
  it('só para quem já escreveu: os outros recebem o motivo e a tela oferece o link', async () => {
    const novo = await naConta(prisma, a.contaId, (tx) =>
      tx.cliente.create({ data: { nome: 'Nunca Escreveu', telefone: '5511933330000' } }),
    );
    const r = (await recepcao.get(`/conversas/cliente/${novo.id}`).expect(200))
      .body as EnvioParaCliente;
    expect(r).toMatchObject({ podeBot: false, unidadeId: null });
    expect(r.motivo).toMatch(/ainda não escreveu/);
    await recepcao.post(`/conversas/cliente/${novo.id}`, { texto: 'Oi!' }).expect(409);
  });

  it('quem já conversou recebe pela unidade em que escreveu, e a conversa fica com a equipe', async () => {
    const clienteId = (await naConta(prisma, a.contaId, (tx) =>
      tx.cliente.findFirst({ where: { telefone: TELEFONE } }),
    ))!.id;
    const pode = (await dono.get(`/conversas/cliente/${clienteId}`).expect(200))
      .body as EnvioParaCliente;
    expect(pode).toMatchObject({ podeBot: true, unidadeId: a.unidadeA, unidade: 'Unidade A' });

    const r = await dono
      .post(`/conversas/cliente/${clienteId}`, { texto: 'Lucas, faz um tempo! Bora marcar?' })
      .expect(201);
    expect(r.body.conversaId).toBe(sessaoId);
    expect((await fila.getJob(`enviar_${r.body.id}`))?.data).toMatchObject({
      tipo: 'enviar',
      mensagemIds: [r.body.id],
    });
    const lista = (await recepcao.get(`/conversas?unidadeId=${a.unidadeA}`).expect(200))
      .body as ListaConversas;
    expect(lista.conversas.find((c) => c.id === sessaoId)?.situacao).toBe('atendimento');

    await barbeiro.get(`/conversas/cliente/${clienteId}`).expect(403);
    await intruso.get(`/conversas/cliente/${clienteId}`).expect(404);
  });

  it('quem respondeu SAIR não recebe pelo bot', async () => {
    const clienteId = await naConta(prisma, a.contaId, async (tx) => {
      const c = await tx.cliente.findFirst({ where: { telefone: TELEFONE } });
      await tx.cliente.update({
        where: { id: c!.id },
        data: { consentimentoMsg: false, consentimentoEm: new Date() },
      });
      return c!.id;
    });
    const r = (await recepcao.get(`/conversas/cliente/${clienteId}`).expect(200))
      .body as EnvioParaCliente;
    expect(r.podeBot).toBe(false);
    expect(r.motivo).toMatch(/SAIR/);
  });
});
