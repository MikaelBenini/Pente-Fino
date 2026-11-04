// Bot do WhatsApp no banco: mensagem recebida → cliente, sessão, consentimento e respostas.
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { MENSAGENS_BOT_PADRAO, type EventoWhatsapp } from '@pente-fino/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  atenderMensagem,
  conexaoDaInstancia,
  criarPrisma,
  instanciaDaUnidade,
  naConta,
  prepararEnvio,
  registrarEnvio,
  registrarEstadoConexao,
  type PrismaClient,
} from '../src/index.js';

const envDaRaiz = new URL('../../../.env', import.meta.url);
if (existsSync(envDaRaiz)) process.loadEnvFile(envDaRaiz);

let prisma: PrismaClient;
const conta = randomUUID();
const outraConta = randomUUID();
let unidadeId = '';
let instancia = '';
const APP = 'http://app.teste';
const agora = new Date('2026-11-04T17:00:00Z');

const naMinhaConta = <T>(fn: Parameters<typeof naConta<T>>[2]) => naConta(prisma, conta, fn);

let seq = 0;
const evento = (
  texto: string,
  telefone = '5511988880001',
  extra: Partial<Extract<EventoWhatsapp, { tipo: 'mensagem' }>> = {},
): Extract<EventoWhatsapp, { tipo: 'mensagem' }> => ({
  tipo: 'mensagem',
  instancia,
  idExterno: `id-${++seq}-${randomUUID()}`,
  telefone,
  nome: 'Pedro Zap',
  texto,
  recebidaEm: agora.toISOString(),
  ...extra,
});

const textos = async (ids: string[]) =>
  naMinhaConta(async (tx) => {
    const ms = await tx.mensagem.findMany({ where: { id: { in: ids } } });
    return ids.map((id) => ms.find((m) => m.id === id)!.texto);
  });

beforeAll(async () => {
  prisma = criarPrisma();
  await naMinhaConta(async (tx) => {
    await tx.conta.create({ data: { id: conta, nome: 'Teste bot' } });
    const u = await tx.unidade.create({ data: { nome: 'Barbearia Centro', endereco: 'Rua A, 1' } });
    unidadeId = u.id;
    instancia = instanciaDaUnidade(u.id);
    await tx.botConexao.create({
      data: { unidadeId, instancia, status: 'conectado', numero: '5511900000000' },
    });
    await tx.cliente.create({
      data: { nome: 'Maria Souza', telefone: '5511977770002', consentimentoMsg: false },
    });
  });
  await naConta(prisma, outraConta, async (tx) => {
    await tx.conta.create({ data: { id: outraConta, nome: 'Outra' } });
    const u = await tx.unidade.create({ data: { nome: 'Outra unidade' } });
    await tx.botConexao.create({ data: { unidadeId: u.id, instancia: instanciaDaUnidade(u.id) } });
  });
});

afterAll(async () => {
  await prisma.$transaction(async (tx) => {
    for (const id of [conta, outraConta]) {
      await tx.$queryRaw`SELECT set_config('app.conta_id', ${id}, true)`;
      await tx.conta.deleteMany({ where: { id } });
    }
  });
  await prisma.$disconnect();
});

describe('conexaoDaInstancia', () => {
  it('acha a conta e a unidade só pela instância', async () => {
    expect(await conexaoDaInstancia(prisma, instancia)).toEqual({
      contaId: conta,
      unidadeId,
      instancia,
    });
  });

  it('instância desconhecida não acha nada, e sem declarar nada nenhuma linha aparece', async () => {
    expect(await conexaoDaInstancia(prisma, 'pf-nao-existe')).toBeNull();
    expect(await prisma.botConexao.count()).toBe(0);
  });
});

describe('atenderMensagem', () => {
  it('número novo vira cliente com origem "bot", recebe o menu e o convite para avisos', async () => {
    const r = await atenderMensagem(prisma, evento('oi'), { appUrl: APP, agora });
    expect(r.tipo).toBe('respondida');
    if (r.tipo !== 'respondida') return;
    expect(r.clienteNovo).toBe(true);
    const cliente = await naMinhaConta((tx) =>
      tx.cliente.findUnique({ where: { id: r.clienteId } }),
    );
    expect(cliente).toMatchObject({
      nome: 'Pedro Zap',
      telefone: '5511988880001',
      origemLead: 'bot',
      unidadeOrigemId: unidadeId,
      consentimentoEm: null,
    });
    const t = await textos(r.saidas);
    expect(t[0]).toContain('Barbearia Centro');
    expect(t[0]).not.toContain('Pedro'); // número novo não é cumprimentado pelo nome
    expect(t.some((x) => x.includes('1. '))).toBe(true);
    expect(t.at(-1)).toBe(MENSAGENS_BOT_PADRAO.convite_avisos);
  });

  it('a sessão continua: responder com número segue o menu, sem repetir o convite', async () => {
    const r = await atenderMensagem(prisma, evento('3'), { appUrl: APP, agora });
    if (r.tipo !== 'respondida') throw new Error(r.tipo);
    const t = await textos(r.saidas);
    expect(t.join('\n')).toContain('Rua A, 1');
    expect(t).not.toContain(MENSAGENS_BOT_PADRAO.convite_avisos);
  });

  it('a mesma mensagem entregue de novo é descartada', async () => {
    const e = evento('preço');
    expect((await atenderMensagem(prisma, e, { appUrl: APP, agora })).tipo).toBe('respondida');
    expect(await atenderMensagem(prisma, e, { appUrl: APP, agora })).toEqual({ tipo: 'repetida' });
    const recebidas = await naMinhaConta((tx) =>
      tx.mensagem.count({ where: { idExterno: e.idExterno } }),
    );
    expect(recebidas).toBe(1);
  });

  it('RECEBER grava o aceite com data; SAIR desliga', async () => {
    const r1 = await atenderMensagem(prisma, evento('RECEBER'), { appUrl: APP, agora });
    if (r1.tipo !== 'respondida') throw new Error(r1.tipo);
    expect(r1.consentimento).toBe(true);
    let c = await naMinhaConta((tx) => tx.cliente.findUnique({ where: { id: r1.clienteId } }));
    expect(c).toMatchObject({ consentimentoMsg: true, consentimentoEm: agora });

    const depois = new Date(agora.getTime() + 60_000);
    await atenderMensagem(prisma, evento('sair'), { appUrl: APP, agora: depois });
    c = await naMinhaConta((tx) => tx.cliente.findUnique({ where: { id: r1.clienteId } }));
    expect(c).toMatchObject({ consentimentoMsg: false, consentimentoEm: depois });
  });

  it('cliente cadastrado é reconhecido (mesmo sem o nono dígito) e cumprimentado pelo nome', async () => {
    const r = await atenderMensagem(prisma, evento('olá', '551177770002'), { appUrl: APP, agora });
    if (r.tipo !== 'respondida') throw new Error(r.tipo);
    expect(r.clienteNovo).toBe(false);
    const t = await textos(r.saidas);
    expect(t[0]).toContain('Maria');
    // Ainda não escolheu e é a primeira conversa: recebe o convite.
    expect(t.at(-1)).toBe(MENSAGENS_BOT_PADRAO.convite_avisos);
    const clientes = await naMinhaConta((tx) =>
      tx.cliente.count({ where: { telefone: { contains: '77770002' } } }),
    );
    expect(clientes).toBe(1);
  });

  it('instância sem conexão cadastrada não responde', async () => {
    const r = await atenderMensagem(
      prisma,
      { ...evento('oi'), instancia: 'pf-desconhecida' },
      { appUrl: APP, agora },
    );
    expect(r).toEqual({ tipo: 'sem_conexao' });
  });
});

describe('envio', () => {
  it('prepara a resposta pendente e marca enviada', async () => {
    const r = await atenderMensagem(prisma, evento('oi', '5511988880009'), { appUrl: APP, agora });
    if (r.tipo !== 'respondida') throw new Error(r.tipo);
    const id = r.saidas[0]!;
    expect(await prepararEnvio(prisma, conta, id)).toMatchObject({
      tipo: 'enviar',
      instancia,
      telefone: '5511988880009',
    });
    await registrarEnvio(prisma, conta, id, { ok: true, idExterno: 'W1' });
    expect(await prepararEnvio(prisma, conta, id)).toEqual({ tipo: 'pular' });
    const m = await naMinhaConta((tx) => tx.mensagem.findUnique({ where: { id } }));
    expect(m).toMatchObject({ status: 'enviada', idExterno: 'W1' });
    expect(m?.enviadaEm).toBeInstanceOf(Date);
  });

  it('nunca envia para quem não falou com a barbearia', async () => {
    const id = await naMinhaConta(async (tx) => {
      const m = await tx.mensagem.create({
        data: {
          unidadeId,
          telefone: '5511966660000',
          direcao: 'saida',
          texto: 'promoção!',
          status: 'pendente',
        },
      });
      return m.id;
    });
    expect(await prepararEnvio(prisma, conta, id)).toEqual({ tipo: 'pular' });
    const m = await naMinhaConta((tx) => tx.mensagem.findUnique({ where: { id } }));
    expect(m).toMatchObject({ status: 'descartada' });
    expect(m?.erro).toMatch(/nunca falou/);
  });

  it('outra conta não prepara a mensagem desta', async () => {
    const r = await atenderMensagem(prisma, evento('oi'), { appUrl: APP, agora });
    if (r.tipo !== 'respondida') throw new Error(r.tipo);
    expect(await prepararEnvio(prisma, outraConta, r.saidas[0]!)).toEqual({ tipo: 'pular' });
  });
});

describe('registrarEstadoConexao', () => {
  it('cair sozinha marca a hora; reconectar limpa; "conectando" no meio não derruba', async () => {
    await naMinhaConta(async (tx) => {
      let c = await registrarEstadoConexao(
        tx,
        unidadeId,
        { status: 'aguardando_qr', numero: null },
        agora,
      );
      expect(c).toMatchObject({ status: 'conectado', caiuEm: null });
      c = await registrarEstadoConexao(
        tx,
        unidadeId,
        { status: 'desconectado', numero: null },
        agora,
      );
      expect(c).toMatchObject({ status: 'desconectado', caiuEm: agora, numero: '5511900000000' });
      c = await registrarEstadoConexao(tx, unidadeId, {
        status: 'conectado',
        numero: '5511900000001',
      });
      expect(c).toMatchObject({ status: 'conectado', caiuEm: null, numero: '5511900000001' });
    });
  });

  it('com a conexão caída, as respostas não saem', async () => {
    const r = await atenderMensagem(prisma, evento('oi', '5511988880010'), { appUrl: APP, agora });
    if (r.tipo !== 'respondida') throw new Error(r.tipo);
    await naMinhaConta((tx) =>
      registrarEstadoConexao(tx, unidadeId, { status: 'desconectado', numero: null }),
    );
    expect(await prepararEnvio(prisma, conta, r.saidas[0]!)).toEqual({ tipo: 'pular' });
    await naMinhaConta((tx) =>
      registrarEstadoConexao(tx, unidadeId, { status: 'conectado', numero: null }),
    );
  });
});
