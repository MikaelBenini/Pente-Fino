// Testes de 19/11/2026 na Unidade principal, item 1: depois de "Devolver ao bot", o bot ofereceu
// os serviços e parou de responder ao "2". Critério de aceite: ATENDENTE → assumir → devolver →
// AGENDAR → 2 → horário, com AGENDAR logo depois da devolução e depois que o encerramento chega
// ao WhatsApp (o eco). Nos dois casos o cliente conclui a reserva, e o histórico do estado mostra
// cada mudança com a origem.
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { MENSAGENS_BOT_PADRAO } from '@pente-fino/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  atenderMensagem,
  criarPrisma,
  instanciaDaUnidade,
  naConta,
  origemDaConversa,
  registrarMensagemPropria,
  type PrismaClient,
} from '../src/index.js';

const envDaRaiz = new URL('../../../.env', import.meta.url);
if (existsSync(envDaRaiz)) process.loadEnvFile(envDaRaiz);

let prisma: PrismaClient;
const conta = randomUUID();
let unidadeId = '';
let instancia = '';
let recepcaoId = '';
const agora = new Date('2026-12-01T12:00:00Z');
const naMinhaConta = <T>(fn: Parameters<typeof naConta<T>>[2]) => naConta(prisma, conta, fn);

async function fala(telefone: string, texto: string) {
  const r = await atenderMensagem(
    prisma,
    {
      tipo: 'mensagem',
      instancia,
      idExterno: randomUUID(),
      telefone,
      nome: 'Cliente Teste',
      texto,
      recebidaEm: agora.toISOString(),
    },
    { appUrl: 'http://app.teste', agora },
  );
  if (r.tipo !== 'respondida') return `(${r.tipo})`;
  const ms = await naMinhaConta((tx) =>
    tx.mensagem.findMany({ where: { id: { in: r.saidas } }, orderBy: { criadoEm: 'asc' } }),
  );
  return r.saidas.map((id) => ms.find((m) => m.id === id)!.texto).join('\n---\n');
}

/** O que a tela Conversas faz em "Assumir conversa" (ConversasService.assumir). */
async function assumir(telefone: string) {
  await naMinhaConta(async (tx) => {
    const s = await tx.botSessao.findUniqueOrThrow({
      where: { unidadeId_telefone: { unidadeId, telefone } },
    });
    await origemDaConversa(tx, 'painel_assumiu', recepcaoId);
    await tx.botSessao.update({
      where: { id: s.id },
      data: {
        sessao: { ...(s.sessao as object), comAtendente: true, erros: 0 },
        atendenteDesde: null,
      },
    });
  });
}

/** "Devolver ao bot" (ConversasService.devolver): estado gravado e o encerramento na fila. */
async function devolver(telefone: string) {
  return naMinhaConta(async (tx) => {
    const s = await tx.botSessao.findUniqueOrThrow({
      where: { unidadeId_telefone: { unidadeId, telefone } },
    });
    await origemDaConversa(tx, 'painel_devolveu', recepcaoId);
    await tx.botSessao.update({
      where: { id: s.id },
      data: {
        sessao: {
          ...(s.sessao as object),
          comAtendente: false,
          caminho: [],
          erros: 0,
          botDesde: new Date().toISOString(),
        },
        atendenteDesde: null,
      },
    });
    await tx.mensagem.create({
      data: {
        unidadeId,
        telefone,
        direcao: 'saida',
        texto: MENSAGENS_BOT_PADRAO.encerramento,
        status: 'pendente',
        autorId: recepcaoId,
      },
    });
  });
}

/** O WhatsApp devolve a mensagem que saiu do número (o eco do encerramento). */
async function ecoDoEncerramento(telefone: string, texto = MENSAGENS_BOT_PADRAO.encerramento) {
  return registrarMensagemPropria(prisma, {
    tipo: 'propria',
    instancia,
    idExterno: randomUUID(),
    telefone,
    texto,
    recebidaEm: new Date().toISOString(),
  });
}

/** AGENDAR → 2 (Corte) → horário → confirma. */
async function agendarCorte(telefone: string) {
  let r = await fala(telefone, 'AGENDAR');
  if (r.includes('Como você prefere marcar?')) r = await fala(telefone, '1');
  expect(r).toContain('2. Corte · R$ 45,00 · 30 min');
  r = await fala(telefone, '2');
  expect(r).toContain('Corte');
  if (r.includes('Quer adicionar mais algum serviço?')) r = await fala(telefone, '0');
  expect(r).toMatch(/Qual dia fica melhor\?/);
  r = await fala(telefone, '1');
  expect(r).toMatch(/Horários livres[\s\S]*1\. \d{2}:\d{2}/);
  r = await fala(telefone, '1');
  expect(r).toContain('✂️ Corte');
  r = await fala(telefone, '1');
  expect(r).toContain('Pronto, horário marcado! ✅');
}

async function estados(telefone: string) {
  return naMinhaConta(async (tx) => {
    const s = await tx.botSessao.findUniqueOrThrow({
      where: { unidadeId_telefone: { unidadeId, telefone } },
      include: { eventos: { orderBy: { criadoEm: 'asc' } } },
    });
    return s.eventos.map((e) => [e.de, e.para, e.origem, e.autorId ? 'equipe' : null]);
  });
}

beforeAll(async () => {
  prisma = criarPrisma();
  await naMinhaConta(async (tx) => {
    await tx.conta.create({ data: { id: conta, nome: 'Seu Pente Fino', plano: 'pro' } });
    const u = await tx.unidade.create({
      data: {
        nome: 'Unidade principal',
        diasTrabalho: [0, 1, 2, 3, 4, 5, 6],
        regrasAgendamento: { antecedenciaMin: 0 },
      },
    });
    unidadeId = u.id;
    instancia = instanciaDaUnidade(u.id);
    await tx.botConexao.create({ data: { unidadeId, instancia, status: 'conectado' } });
    const recepcao = await tx.usuario.create({
      data: { nome: 'Ju Recepção', email: `ju-${conta}@teste.dev` },
    });
    recepcaoId = recepcao.id;
    const barbeiro = await tx.usuario.create({
      data: { nome: 'Rafael Moura', email: `rafael-${conta}@teste.dev` },
    });
    const p = await tx.profissional.create({
      data: { usuarioId: barbeiro.id, unidadeId, dataEntrada: new Date('2026-01-01') },
    });
    await tx.horarioProfissional.createMany({
      data: [0, 1, 2, 3, 4, 5, 6].map((diaSemana) => ({
        profissionalId: p.id,
        diaSemana,
        inicioMin: 9 * 60,
        fimMin: 18 * 60,
      })),
    });
    const barba = await tx.servico.create({
      data: { nome: 'Barba', duracaoMin: 30, unidadeIds: [unidadeId] },
    });
    const corte = await tx.servico.create({
      data: { nome: 'Corte', duracaoMin: 30, unidadeIds: [unidadeId] },
    });
    await tx.precoServico.createMany({
      data: [
        { servicoId: barba.id, unidadeId, valor: 3500, vigenciaInicio: new Date('2026-01-01') },
        { servicoId: corte.id, unidadeId, valor: 4500, vigenciaInicio: new Date('2026-01-01') },
      ],
    });
  });
});

afterAll(async () => {
  await naMinhaConta((tx) => tx.conta.deleteMany({ where: { id: conta } }));
  await prisma.$disconnect();
});

describe('devolver ao bot e agendar (testes de 19/11/2026)', () => {
  it('ATENDENTE avisa que o bot pausa e como voltar ao menu', async () => {
    const tel = '5544999760001';
    await fala(tel, 'oi');
    expect(await fala(tel, 'ATENDENTE')).toContain('mande MENU');
    // Pausado: o bot não responde mais nada.
    expect(await fala(tel, '2')).toBe('');
  });

  it('AGENDAR logo depois da devolução (antes do encerramento chegar): conclui a reserva', async () => {
    const tel = '5544999760002';
    await fala(tel, 'oi');
    await fala(tel, 'ATENDENTE');
    await assumir(tel);
    await devolver(tel);
    await agendarCorte(tel);
    // O eco do encerramento chega depois: é do sistema, não pausa o bot.
    expect(await ecoDoEncerramento(tel)).toBe('eco');
    expect(await estados(tel)).toEqual([
      ['bot', 'aguardando', 'cliente_pediu', null],
      ['aguardando', 'atendimento', 'painel_assumiu', 'equipe'],
      ['atendimento', 'bot', 'painel_devolveu', 'equipe'],
    ]);
  });

  it('AGENDAR depois que o encerramento chegou ao WhatsApp: conclui a reserva', async () => {
    const tel = '5544999760003';
    await fala(tel, 'oi');
    await fala(tel, 'ATENDENTE');
    await assumir(tel);
    await devolver(tel);
    // O eco volta com outro fim de linha e espaço sobrando: continua sendo eco.
    expect(await ecoDoEncerramento(tel, `${MENSAGENS_BOT_PADRAO.encerramento}  \r\n`)).toBe('eco');
    await agendarCorte(tel);
    expect((await estados(tel)).at(-1)?.[1]).toBe('bot');
  });

  it('esperando atendente, MENU volta ao bot antes de alguém assumir', async () => {
    const tel = '5544999760004';
    await fala(tel, 'oi');
    await fala(tel, 'ATENDENTE');
    expect(await fala(tel, 'menu')).toMatch(/1\./);
    expect((await estados(tel)).at(-1)).toEqual(['aguardando', 'bot', 'cliente_voltou', null]);
  });

  it('em atendimento humano, MENU não tira a conversa da equipe', async () => {
    const tel = '5544999760005';
    await fala(tel, 'oi');
    await fala(tel, 'ATENDENTE');
    await assumir(tel);
    expect(await fala(tel, 'menu')).toBe('');
  });

  it('a equipe responde pelo celular: aí sim o bot pausa, com o motivo no histórico', async () => {
    const tel = '5544999760006';
    await fala(tel, 'oi');
    expect(await ecoDoEncerramento(tel, 'Oi! Aqui é a Ju, pelo celular.')).toBe('equipe');
    expect((await estados(tel)).at(-1)).toEqual(['bot', 'atendimento', 'celular_respondeu', null]);
  });
});
