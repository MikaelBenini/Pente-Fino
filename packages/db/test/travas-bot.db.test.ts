// Pedido do dono em 18/11/2026: o bot não responde número conectado ao sistema (duas unidades
// conversando, os bots se respondiam) e para quando vira loop (outro robô do outro lado).
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import type { SessaoBot } from '@pente-fino/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  atenderMensagem,
  criarPrisma,
  instanciaDaUnidade,
  naConta,
  prepararEnvio,
  type PrismaClient,
} from '../src/index.js';

const envDaRaiz = new URL('../../../.env', import.meta.url);
if (existsSync(envDaRaiz)) process.loadEnvFile(envDaRaiz);

let prisma: PrismaClient;
const conta = randomUUID();
const outraConta = randomUUID();
let unidadeB = '';
let instanciaB = '';
const NUMERO_DA_A = '5511912340001';
const NUMERO_DE_OUTRA_BARBEARIA = '5511912340002';
let seq = 0;
const evento = (telefone: string, texto = 'oi') => ({
  tipo: 'mensagem' as const,
  instancia: instanciaB,
  idExterno: `TRAVA-${conta.slice(0, 8)}-${++seq}`,
  telefone,
  nome: null,
  texto,
  recebidaEm: new Date().toISOString(),
});
const saidas = (telefone: string) =>
  naConta(prisma, conta, (tx) =>
    tx.mensagem.count({ where: { unidadeId: unidadeB, telefone, direcao: 'saida' } }),
  );

beforeAll(async () => {
  prisma = criarPrisma();
  await naConta(prisma, conta, async (tx) => {
    await tx.conta.create({ data: { id: conta, nome: 'Barbearia Travas', plano: 'pro' } });
    const a = await tx.unidade.create({ data: { nome: 'Unidade A' } });
    const b = await tx.unidade.create({ data: { nome: 'Unidade B' } });
    unidadeB = b.id;
    instanciaB = instanciaDaUnidade(b.id);
    await tx.botConexao.create({
      data: {
        unidadeId: a.id,
        instancia: instanciaDaUnidade(a.id),
        status: 'conectado',
        numero: NUMERO_DA_A,
      },
    });
    await tx.botConexao.create({
      data: { unidadeId: b.id, instancia: instanciaB, status: 'conectado' },
    });
  });
  await naConta(prisma, outraConta, async (tx) => {
    await tx.conta.create({ data: { id: outraConta, nome: 'Outra barbearia' } });
    const u = await tx.unidade.create({ data: { nome: 'Outra' } });
    await tx.botConexao.create({
      data: {
        unidadeId: u.id,
        instancia: instanciaDaUnidade(u.id),
        status: 'conectado',
        numero: NUMERO_DE_OUTRA_BARBEARIA,
      },
    });
  });
});

afterAll(async () => {
  for (const id of [conta, outraConta])
    await naConta(prisma, id, (tx) => tx.conta.deleteMany({ where: { id } }));
  await prisma.$disconnect();
});

describe('travas do bot', () => {
  it('número de outra unidade da mesma barbearia: a mensagem fica, o bot não responde', async () => {
    const r = await atenderMensagem(prisma, evento(NUMERO_DA_A), { appUrl: '' });
    expect(r.tipo).toBe('numero_do_sistema');
    expect(await saidas(NUMERO_DA_A)).toBe(0);
  });

  it('número conectado de outra barbearia do sistema: também não responde', async () => {
    const r = await atenderMensagem(prisma, evento(NUMERO_DE_OUTRA_BARBEARIA), { appUrl: '' });
    expect(r.tipo).toBe('numero_do_sistema');
    expect(await saidas(NUMERO_DE_OUTRA_BARBEARIA)).toBe(0);
  });

  it('cliente comum: responde normalmente', async () => {
    const r = await atenderMensagem(prisma, evento('5511912340003'), { appUrl: '' });
    expect(r.tipo).toBe('respondida');
    expect(await saidas('5511912340003')).toBeGreaterThan(0);
  });

  it('respostas demais em poucos minutos (outro robô do outro lado): para e vai para a equipe', async () => {
    const tel = '5511912340004';
    await naConta(prisma, conta, (tx) =>
      tx.mensagem.createMany({
        data: Array.from({ length: 30 }, () => ({
          unidadeId: unidadeB,
          telefone: tel,
          direcao: 'saida' as const,
          texto: 'Como posso ajudar?',
          status: 'enviada' as const,
        })),
      }),
    );
    const r = await atenderMensagem(prisma, evento(tel, 'Olá! Sou o atendimento automático.'), {
      appUrl: '',
    });
    expect(r.tipo).toBe('loop');
    expect(await saidas(tel)).toBe(30);
    const s = await naConta(prisma, conta, (tx) =>
      tx.botSessao.findFirstOrThrow({ where: { unidadeId: unidadeB, telefone: tel } }),
    );
    expect((s.sessao as unknown as SessaoBot).comAtendente).toBe(true);
    expect(s.atendenteDesde).not.toBeNull();
  });

  it('nada automático sai para número do sistema (mesmo que ele já tenha escrito)', async () => {
    // A Unidade A já escreveu para a B no primeiro teste; um lembrete da B para ela é descartado.
    const m = await naConta(prisma, conta, (tx) =>
      tx.mensagem.create({
        data: {
          unidadeId: unidadeB,
          telefone: NUMERO_DA_A,
          direcao: 'saida',
          texto: 'Lembrete do seu horário amanhã',
          status: 'pendente',
        },
      }),
    );
    expect(await prepararEnvio(prisma, conta, m.id)).toEqual({ tipo: 'pular' });
    const depois = await naConta(prisma, conta, (tx) =>
      tx.mensagem.findUniqueOrThrow({ where: { id: m.id } }),
    );
    expect(depois.status).toBe('descartada');
  });
});
