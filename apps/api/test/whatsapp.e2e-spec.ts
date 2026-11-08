// Etapa 10B: conexão do WhatsApp pelo painel, webhook com assinatura e histórico de mensagens.
import type { INestApplication } from '@nestjs/common';
import { criarPrisma, instanciaDaUnidade, naConta, type PrismaClient } from '@pente-fino/db';
import { FILA_WHATSAPP_ENTRADA, type ConexaoBot, type EstadoBot } from '@pente-fino/shared';
import { assinarInstancia, CABECALHO_ASSINATURA, type ProvedorFalso } from '@pente-fino/whatsapp';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PROVEDOR_WHATSAPP } from '../src/whatsapp/provedor.js';
import { como, criarApp, criarCenario, ultimoEmail, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let a: Cenario;
let b: Cenario;
type Cliente = Awaited<ReturnType<typeof como>>;
let dono: Cliente;
let gestor: Cliente;
let barbeiro: Cliente;
let intruso: Cliente;
let provedor: ProvedorFalso;
let fila: Queue;
let prisma: PrismaClient;
let instancia = '';

const webhook = (
  corpo: object,
  assinatura: string | null = assinarInstancia(segredo(), instancia),
) => {
  const r = request(app.getHttpServer()).post('/webhooks/whatsapp');
  if (assinatura) r.set(CABECALHO_ASSINATURA, assinatura);
  return r.send(corpo);
};
const segredo = () => process.env.WHATSAPP_WEBHOOK_SEGREDO!;
const mensagem = (id: string, texto = 'oi') => ({
  event: 'messages.upsert',
  instance: instancia,
  data: {
    key: { remoteJid: '5511988887777@s.whatsapp.net', fromMe: false, id },
    pushName: 'Cliente Zap',
    message: { conversation: texto },
    messageTimestamp: Math.floor(Date.now() / 1000),
  },
});
const conexaoEvento = (state: string, wuid?: string) => ({
  event: 'connection.update',
  instance: instancia,
  data: { state, ...(wuid ? { wuid } : {}) },
});

beforeAll(async () => {
  app = await criarApp();
  a = await criarCenario();
  b = await criarCenario();
  dono = await como(app, a.emails.dono);
  gestor = await como(app, a.emails.gestor);
  barbeiro = await como(app, a.emails.barbeiro);
  intruso = await como(app, b.emails.dono);
  provedor = app.get(PROVEDOR_WHATSAPP);
  fila = new Queue(FILA_WHATSAPP_ENTRADA, { connection: { url: process.env.REDIS_URL! } });
  prisma = criarPrisma();
  instancia = instanciaDaUnidade(a.unidadeA);
});

afterAll(async () => {
  const jobs = await fila.getJobs(['waiting', 'delayed', 'completed', 'failed']);
  await Promise.all(jobs.filter((j) => j.data?.instancia === instancia).map((j) => j.remove()));
  await fila.close();
  await prisma.$disconnect();
  await a.remover();
  await b.remover();
  await app.close();
});

describe('conexão pelo painel', () => {
  it('unidade que nunca conectou aparece desconectada', async () => {
    const r = await dono.get(`/bot/conexao/${a.unidadeA}`).expect(200);
    expect(r.body).toMatchObject({ status: 'desconectado', numero: null, qr: null, teste: true });
  });

  it('conectar cria a instância da unidade e devolve o QR', async () => {
    const r = await dono.post(`/bot/conexao/${a.unidadeA}`).expect(200);
    const c = r.body as ConexaoBot;
    expect(c.status).toBe('aguardando_qr');
    expect(c.qr).toMatch(/^data:image\//);
    const linha = await naConta(prisma, a.contaId, (tx) =>
      tx.botConexao.findUnique({ where: { unidadeId: a.unidadeA } }),
    );
    expect(linha).toMatchObject({ instancia, status: 'aguardando_qr', provedor: 'falso' });
  });

  it('gestor da unidade também conecta; barbeiro e outra conta não', async () => {
    await gestor.get(`/bot/conexao/${a.unidadeA}`).expect(200);
    await gestor.post(`/bot/conexao/${a.unidadeB}`).expect(403);
    await barbeiro.get(`/bot/conexao/${a.unidadeA}`).expect(403);
    const r = await intruso.post(`/bot/conexao/${a.unidadeA}`);
    expect([403, 404]).toContain(r.status);
  });

  it('depois de ler o QR, o estado fica conectado com o número', async () => {
    provedor.simularLeitura(instancia, '5511900002222');
    const r = await dono.get(`/bot/conexao/${a.unidadeA}`).expect(200);
    expect(r.body).toMatchObject({ status: 'conectado', numero: '5511900002222', qr: null });
  });
});

describe('webhook', () => {
  it('sem assinatura ou com a assinatura de outra instância: 401', async () => {
    await webhook(mensagem('W0'), null).expect(401);
    await webhook(mensagem('W0'), assinarInstancia(segredo(), 'pf-outra')).expect(401);
    await webhook(mensagem('W0'), assinarInstancia('outro-segredo-qualquer-123', instancia)).expect(
      401,
    );
    expect(await fila.getJob(`${instancia}_W0`)).toBeUndefined();
  });

  it('mensagem vai para a fila do worker; a mesma mensagem duas vezes vira um trabalho só', async () => {
    const id = `W-${randomUUID().slice(0, 8)}`;
    await webhook(mensagem(id, 'quero agendar')).expect(200);
    await webhook(mensagem(id, 'quero agendar')).expect(200);
    const job = await fila.getJob(`${instancia}_${id}`);
    expect(job?.data).toMatchObject({
      tipo: 'mensagem',
      instancia,
      idExterno: id,
      telefone: '5511988887777',
      texto: 'quero agendar',
    });
    const iguais = (await fila.getJobs(['waiting', 'delayed', 'active', 'completed'])).filter(
      (j) => j.data?.idExterno === id,
    );
    expect(iguais).toHaveLength(1);
  });

  it('o que o bot não trata (mensagem do próprio número, grupo, outros eventos) é aceito e ignorado', async () => {
    const proprio = mensagem('W-proprio');
    proprio.data.key.fromMe = true;
    await webhook(proprio).expect(200);
    await webhook({ event: 'qrcode.updated', instance: instancia, data: {} }).expect(200);
    expect(await fila.getJob(`${instancia}_W-proprio`)).toBeUndefined();
  });

  it('conexão que cai sozinha marca o aviso; reconectar limpa', async () => {
    await webhook(conexaoEvento('open', '5511900002222@s.whatsapp.net')).expect(200);
    await webhook(conexaoEvento('close')).expect(200);
    let estado = (await dono.get('/bot').expect(200)).body as EstadoBot;
    let u = estado.unidades.find((x) => x.id === a.unidadeA)!;
    expect(u.conexao).toMatchObject({ status: 'desconectado', numero: '5511900002222' });
    expect(u.conexao?.caiuEm).toBeTruthy();
    // Dono e gestor ficam sabendo na central; o dono recebe e-mail com o link da tela Bot.
    const avisos = (await gestor.get('/avisos').expect(200)).body;
    expect(JSON.stringify(avisos)).toContain('desconectado');
    const email = await ultimoEmail(a.emails.dono);
    expect(email?.assunto).toContain('desconectou');
    expect(email?.html).toContain('/bot');
    // O mesmo "close" repetido não avisa de novo.
    await webhook(conexaoEvento('close')).expect(200);
    const depois = (await gestor.get('/avisos').expect(200)).body;
    expect(JSON.stringify(depois).match(/desconectado/g)?.length).toBe(
      JSON.stringify(avisos).match(/desconectado/g)?.length,
    );

    await webhook(conexaoEvento('open', '5511900002222@s.whatsapp.net')).expect(200);
    estado = (await dono.get('/bot').expect(200)).body as EstadoBot;
    u = estado.unidades.find((x) => x.id === a.unidadeA)!;
    expect(u.conexao).toMatchObject({ status: 'conectado', caiuEm: null });
  });

  it('desconectar pelo painel não vira aviso de queda, e fica na auditoria', async () => {
    const r = await dono.delete(`/bot/conexao/${a.unidadeA}`).expect(200);
    expect(r.body).toMatchObject({ status: 'desconectado', caiuEm: null, numero: null });
    await webhook(conexaoEvento('close')).expect(200);
    const estado = (await dono.get('/bot').expect(200)).body as EstadoBot;
    expect(estado.unidades.find((x) => x.id === a.unidadeA)!.conexao?.caiuEm).toBeNull();
    const auditoria = await naConta(prisma, a.contaId, (tx) =>
      tx.auditoria.count({ where: { entidade: 'bot_conexao', acao: 'desconectar' } }),
    );
    expect(auditoria).toBe(1);
  });

  it('desconectar unidade que nunca conectou: 404', async () => {
    await dono.delete(`/bot/conexao/${a.unidadeB}`).expect(404);
  });
});

describe('histórico de mensagens do cliente', () => {
  it('dono e gestor veem a conversa em ordem; barbeiro não', async () => {
    const clienteId = await naConta(prisma, a.contaId, async (tx) => {
      const c = await tx.cliente.create({ data: { nome: 'Zé Zap', telefone: '5511955554444' } });
      const base = Date.now() - 60_000;
      await tx.mensagem.createMany({
        data: [
          ['entrada', 'oi', 'recebida'],
          ['saida', 'Olá! Escolha uma opção', 'enviada'],
          ['entrada', '2', 'recebida'],
        ].map(([direcao, texto, status], i) => ({
          unidadeId: a.unidadeA,
          clienteId: c.id,
          telefone: '5511955554444',
          direcao: direcao as 'entrada' | 'saida',
          texto: texto!,
          status: status as 'recebida' | 'enviada',
          criadoEm: new Date(base + i * 1000),
        })),
      });
      return c.id;
    });
    const r = await dono.get(`/clientes/${clienteId}/mensagens`).expect(200);
    expect(r.body.map((m: { texto: string }) => m.texto)).toEqual([
      'oi',
      'Olá! Escolha uma opção',
      '2',
    ]);
    expect(r.body[1]).toMatchObject({ direcao: 'saida', status: 'enviada', unidade: 'Unidade A' });
    await gestor.get(`/clientes/${clienteId}/mensagens`).expect(200);
    await barbeiro.get(`/clientes/${clienteId}/mensagens`).expect(403);
  });

  it('a escolha de avisos marcada no cadastro fica com data', async () => {
    const r = await dono
      .post('/clientes', { nome: 'Ana Avisos', telefone: '11944443333', consentimentoMsg: true })
      .expect(201);
    const c = await dono.get(`/clientes/${r.body.id}`).expect(200);
    expect(c.body.consentimentoMsg).toBe(true);
    expect(c.body.consentimentoEm).toBeTruthy();
  });
});
