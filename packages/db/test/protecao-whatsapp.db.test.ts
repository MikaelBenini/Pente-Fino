// Proteção dos números de WhatsApp (27/11/2026): as verificações do prepararEnvio para a mensagem
// automática (proativa, repetida, pausa por risco, limite do dia com aquecimento).
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  criarPrisma,
  instanciaDaUnidade,
  naConta,
  prepararEnvio,
  registrarEstadoConexao,
  type PrismaClient,
} from '../src/index.js';

const envDaRaiz = new URL('../../../.env', import.meta.url);
if (existsSync(envDaRaiz)) process.loadEnvFile(envDaRaiz);

let prisma: PrismaClient;
const conta = randomUUID();
// Meio-dia em São Paulo: fora do horário de silêncio.
const agora = new Date('2026-11-27T15:00:00Z');
const antes = (min: number) => new Date(agora.getTime() - min * 60_000);
const naMinha = <T>(fn: Parameters<typeof naConta<T>>[2]) => naConta(prisma, conta, fn);

async function novaUnidade(conectadoEm: Date | null = antes(60 * 24 * 30)) {
  return naMinha(async (tx) => {
    const u = await tx.unidade.create({ data: { nome: `Unidade ${randomUUID().slice(0, 6)}` } });
    await tx.botConexao.create({
      data: {
        unidadeId: u.id,
        instancia: instanciaDaUnidade(u.id),
        status: 'conectado',
        numero: '5511900000000',
        conectadoEm,
      },
    });
    return u.id;
  });
}

const entrada = (unidadeId: string, telefone: string, texto: string, criadoEm: Date) =>
  naMinha((tx) =>
    tx.mensagem.create({
      data: { unidadeId, telefone, direcao: 'entrada', texto, status: 'recebida', criadoEm },
    }),
  );

const automatica = (unidadeId: string, telefone: string, texto: string) =>
  naMinha((tx) =>
    tx.mensagem.create({
      data: { unidadeId, telefone, direcao: 'saida', texto, status: 'pendente', criadoEm: agora },
    }),
  );

const situacao = (id: string) =>
  naMinha((tx) =>
    tx.mensagem.findUniqueOrThrow({ where: { id }, select: { status: true, erro: true } }),
  );

beforeAll(async () => {
  prisma = criarPrisma();
  await naMinha((tx) => tx.conta.create({ data: { id: conta, nome: 'Proteção', plano: 'pro' } }));
});

afterAll(async () => {
  await naMinha((tx) => tx.conta.delete({ where: { id: conta } }));
  await prisma.$disconnect();
});

describe('proteção dos números de WhatsApp', () => {
  it('proativa: automática para quem não escreveu em 24 h; vem com "digitando..."', async () => {
    const u = await novaUnidade();
    await entrada(u, '5511970000001', 'oi', antes(60 * 48));
    await entrada(u, '5511970000002', 'oi', antes(30));
    const lembrete = await automatica(u, '5511970000001', 'Lembrete do seu horário amanhã');
    const resposta = await automatica(u, '5511970000002', 'Já te mostro os horários');
    expect(await prepararEnvio(prisma, conta, lembrete.id, agora)).toMatchObject({
      tipo: 'enviar',
      proativa: true,
      digitandoMs: expect.any(Number),
    });
    expect(await prepararEnvio(prisma, conta, resposta.id, agora)).toMatchObject({
      tipo: 'enviar',
      proativa: false,
    });
  });

  it('o mesmo texto para o mesmo número em menos de 10 minutos é descartado', async () => {
    const u = await novaUnidade();
    await entrada(u, '5511970000003', 'oi', antes(5));
    await naMinha((tx) =>
      tx.mensagem.create({
        data: {
          unidadeId: u,
          telefone: '5511970000003',
          direcao: 'saida',
          texto: 'Seu horário foi confirmado',
          status: 'enviada',
          enviadaEm: antes(3),
        },
      }),
    );
    const repetida = await automatica(u, '5511970000003', 'Seu horário foi confirmado');
    expect(await prepararEnvio(prisma, conta, repetida.id, agora)).toEqual({ tipo: 'pular' });
    expect((await situacao(repetida.id)).erro).toContain('menos de 10 minutos');
  });

  it('número pausado segura a proativa até o fim da pausa; a resposta sai', async () => {
    const u = await novaUnidade();
    const ate = new Date(agora.getTime() + 2 * 3_600_000);
    await naMinha((tx) =>
      tx.botConexao.update({
        where: { unidadeId: u },
        data: { pausadoAte: ate, pausaMotivo: 'falhas' },
      }),
    );
    await entrada(u, '5511970000004', 'oi', antes(60 * 72));
    await entrada(u, '5511970000005', 'oi', antes(2));
    const lembrete = await automatica(u, '5511970000004', 'Lembrete do seu horário');
    const resposta = await automatica(u, '5511970000005', 'Escolha o serviço');
    expect(await prepararEnvio(prisma, conta, lembrete.id, agora)).toEqual({
      tipo: 'adiar',
      ate: ate.toISOString(),
    });
    expect(await prepararEnvio(prisma, conta, resposta.id, agora)).toMatchObject({
      tipo: 'enviar',
    });
  });

  it('aquecimento: número conectado hoje para nas 20 proativas do dia', async () => {
    const u = await novaUnidade(antes(60));
    await naMinha((tx) =>
      tx.mensagem.createMany({
        data: Array.from({ length: 20 }, (_, i) => ({
          unidadeId: u,
          telefone: `55119710000${String(i).padStart(2, '0')}`,
          direcao: 'saida' as const,
          texto: `Aviso ${i}`,
          status: 'enviada' as const,
          enviadaEm: antes(30),
          proativa: true,
        })),
      }),
    );
    await entrada(u, '5511970000006', 'oi', antes(60 * 50));
    const mais = await automatica(u, '5511970000006', 'Feliz aniversário!');
    // O dia seguinte às 9 h fica a mais de 12 h: a mensagem perde o sentido e é descartada.
    expect(await prepararEnvio(prisma, conta, mais.id, agora)).toEqual({ tipo: 'pular' });
    expect((await situacao(mais.id)).erro).toContain('Limite diário');
  });

  it('muitos SAIR no dia pausam as proativas por 24 h', async () => {
    const u = await novaUnidade();
    for (let i = 0; i < 5; i++) await entrada(u, `551197200000${i}`, 'SAIR', antes(60 + i));
    await entrada(u, '5511970000007', 'oi', antes(60 * 50));
    const lembrete = await automatica(u, '5511970000007', 'Faz tempo que você não vem');
    expect(await prepararEnvio(prisma, conta, lembrete.id, agora)).toEqual({ tipo: 'pular' });
    const conexao = await naMinha((tx) =>
      tx.botConexao.findUniqueOrThrow({ where: { unidadeId: u } }),
    );
    expect(conexao.pausaMotivo).toBe('saidas');
    expect(conexao.pausadoAte?.toISOString()).toBe(
      new Date(agora.getTime() + 24 * 3_600_000).toISOString(),
    );
  });

  it('número novo conectado recomeça o aquecimento e sai da pausa do anterior', async () => {
    const u = await novaUnidade(antes(60 * 24 * 30));
    await naMinha(async (tx) => {
      await tx.botConexao.update({
        where: { unidadeId: u },
        data: { status: 'desconectado', pausadoAte: antes(-60), pausaMotivo: 'falhas' },
      });
      await registrarEstadoConexao(tx, u, { status: 'conectado', numero: '5511911112222' }, agora);
    });
    const c = await naMinha((tx) => tx.botConexao.findUniqueOrThrow({ where: { unidadeId: u } }));
    expect(c.conectadoEm?.toISOString()).toBe(agora.toISOString());
    expect(c.pausadoAte).toBeNull();
  });
});
