// 18/11/2026: "a mensagem de anúncio está indo sozinha para os clientes". O fluxo do anúncio só
// vai para quem veio de anúncio: a marca do WhatsApp, ou a frase pronta de um número que nunca
// escreveu; e cada número recebe no máximo uma vez a cada 30 dias.
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  atenderMensagem,
  criarPrisma,
  instanciaDaUnidade,
  naConta,
  type PrismaClient,
} from '../src/index.js';

const envDaRaiz = new URL('../../../.env', import.meta.url);
if (existsSync(envDaRaiz)) process.loadEnvFile(envDaRaiz);

let prisma: PrismaClient;
const conta = randomUUID();
let unidadeId = '';
let instancia = '';
const ETAPA = 'Que bom que veio pelo anúncio! Qual serviço?';
const FRASE = 'Vi o anúncio de vocês';
let seq = 0;
const evento = (telefone: string, texto: string, anuncio = false) => ({
  tipo: 'mensagem' as const,
  instancia,
  idExterno: `ANUNCIO-${conta.slice(0, 8)}-${++seq}`,
  telefone,
  nome: 'Cliente',
  texto,
  recebidaEm: new Date().toISOString(),
  ...(anuncio ? { anuncio: { titulo: 'Corte R$ 50', origemId: '1' } } : {}),
});
const respostas = async (telefone: string) =>
  naConta(prisma, conta, async (tx) =>
    (
      await tx.mensagem.findMany({
        where: { unidadeId, telefone, direcao: 'saida' },
        orderBy: { criadoEm: 'asc' },
      })
    ).map((m) => m.texto),
  );

beforeAll(async () => {
  prisma = criarPrisma();
  await naConta(prisma, conta, async (tx) => {
    await tx.conta.create({
      data: {
        id: conta,
        nome: 'Barbearia Anúncio',
        plano: 'pro',
        fluxoAnuncio: { ativo: true, frases: [FRASE], etapas: [ETAPA], final: 'Já passei.' },
      },
    });
    const u = await tx.unidade.create({ data: { nome: 'Centro' } });
    unidadeId = u.id;
    instancia = instanciaDaUnidade(u.id);
    await tx.botConexao.create({ data: { unidadeId, instancia, status: 'conectado' } });
    // Cliente da casa: já escreveu antes.
    await tx.mensagem.create({
      data: {
        unidadeId,
        telefone: '5511900001111',
        direcao: 'entrada',
        texto: 'oi, quero marcar',
        status: 'recebida',
        criadoEm: new Date(Date.now() - 10 * 86_400_000),
      },
    });
  });
});

afterAll(async () => {
  await naConta(prisma, conta, (tx) => tx.conta.deleteMany({ where: { id: conta } }));
  await prisma.$disconnect();
});

describe('fluxo do anúncio só para quem veio de anúncio', () => {
  it('cliente da casa que manda a frase do anúncio recebe o bot normal, não o anúncio', async () => {
    await atenderMensagem(prisma, evento('5511900001111', FRASE), { appUrl: '' });
    expect(await respostas('5511900001111')).not.toContain(ETAPA);
  });

  it('número novo com a frase entra no fluxo; e não recebe de novo depois', async () => {
    await atenderMensagem(prisma, evento('5511900002222', FRASE), { appUrl: '' });
    expect(await respostas('5511900002222')).toContain(ETAPA);
  });

  it('com a marca do WhatsApp, entra; quem já passou pelo fluxo não recebe outra vez', async () => {
    await atenderMensagem(prisma, evento('5511900003333', 'oi', true), { appUrl: '' });
    expect((await respostas('5511900003333')).filter((t) => t === ETAPA)).toHaveLength(1);
    // Responde, o fluxo termina e passa para a equipe; a equipe devolve ao bot.
    await atenderMensagem(prisma, evento('5511900003333', 'corte'), { appUrl: '' });
    await naConta(prisma, conta, (tx) =>
      tx.botSessao.updateMany({
        where: { unidadeId, telefone: '5511900003333' },
        data: {
          atendenteDesde: null,
          sessao: {
            caminho: [],
            comAtendente: false,
            ultimaEm: new Date(Date.now() - 3 * 3_600_000).toISOString(),
          },
        },
      }),
    );
    // Novo clique no anúncio dias depois (aqui, horas): não repete o fluxo.
    await atenderMensagem(prisma, evento('5511900003333', 'oi de novo', true), { appUrl: '' });
    expect((await respostas('5511900003333')).filter((t) => t === ETAPA)).toHaveLength(1);
  });
});
