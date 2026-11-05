// Etapa 11: agendar pela conversa do WhatsApp, do "oi" ao horário marcado.
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  atenderMensagem,
  criarAgendamentoNoBanco,
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
let profissionalId = '';
let corte = '';
// Terça, 01/12/2026, 09:00 em São Paulo: o dia inteiro pela frente.
const agora = new Date('2026-12-01T12:00:00Z');
const naMinhaConta = <T>(fn: Parameters<typeof naConta<T>>[2]) => naConta(prisma, conta, fn);

/** Uma mensagem do cliente → os textos que o bot respondeu. */
async function fala(telefone: string, texto: string, quando = agora) {
  const r = await atenderMensagem(
    prisma,
    {
      tipo: 'mensagem',
      instancia,
      idExterno: randomUUID(),
      telefone,
      nome: 'Cliente Zap',
      texto,
      recebidaEm: quando.toISOString(),
    },
    { appUrl: 'http://app.teste', agora: quando },
  );
  if (r.tipo !== 'respondida') throw new Error(r.tipo);
  const ms = await naMinhaConta((tx) =>
    tx.mensagem.findMany({ where: { id: { in: r.saidas } }, orderBy: { criadoEm: 'asc' } }),
  );
  return r.saidas.map((id) => ms.find((m) => m.id === id)!.texto).join('\n---\n');
}

beforeAll(async () => {
  prisma = criarPrisma();
  await naMinhaConta(async (tx) => {
    await tx.conta.create({ data: { id: conta, nome: 'Barbearia Navalha' } });
    const u = await tx.unidade.create({
      data: {
        nome: 'Centro',
        diasTrabalho: [0, 1, 2, 3, 4, 5, 6],
        agendamentoPublico: true,
        slug: `navalha-${conta.slice(0, 8)}`,
      },
    });
    unidadeId = u.id;
    instancia = instanciaDaUnidade(u.id);
    await tx.botConexao.create({ data: { unidadeId, instancia, status: 'conectado' } });
    const usuario = await tx.usuario.create({
      data: { nome: 'Rafael Moura', email: `rafael-${conta}@teste.dev` },
    });
    const p = await tx.profissional.create({
      data: { usuarioId: usuario.id, unidadeId, dataEntrada: new Date('2026-01-01') },
    });
    profissionalId = p.id;
    await tx.horarioProfissional.createMany({
      data: [0, 1, 2, 3, 4, 5, 6].map((diaSemana) => ({
        profissionalId,
        diaSemana,
        inicioMin: 9 * 60,
        fimMin: 12 * 60,
      })),
    });
    const s1 = await tx.servico.create({ data: { nome: 'Corte', duracaoMin: 30 } });
    const s2 = await tx.servico.create({ data: { nome: 'Barba', duracaoMin: 30 } });
    corte = s1.id;
    await tx.precoServico.createMany({
      data: [
        { servicoId: s1.id, unidadeId, valor: 4500, vigenciaInicio: new Date('2026-01-01') },
        { servicoId: s2.id, unidadeId, valor: 3500, vigenciaInicio: new Date('2026-01-01') },
      ],
    });
  });
});

afterAll(async () => {
  await naMinhaConta((tx) => tx.conta.deleteMany({ where: { id: conta } }));
  await prisma.$disconnect();
});

describe('agendar pela conversa', () => {
  const tel = '5511977771111';

  it('do menu ao horário marcado, com dois serviços', async () => {
    await fala(tel, 'oi');
    const servicos = await fala(tel, '1');
    expect(servicos).toContain('1. Barba · R$ 35,00 · 30 min\n2. Corte · R$ 45,00 · 30 min');
    expect(servicos).toContain('pelo site? http://app.teste/agendar?u=navalha-');
    // Um profissional só: pula a escolha e vai direto aos dias.
    const dias = await fala(tel, '1 e 2');
    expect(dias).toMatch(/Qual dia fica melhor\?\n\n1\. Hoje \(ter, 01\/12\)/);
    const horarios = await fala(tel, '1');
    expect(horarios).toContain('Horários livres hoje (ter, 01/12):\n\n1. 09:00\n2. 09:15');
    expect(horarios).toContain('7. Ver mais horários\n0. Outro dia');
    const mais = await fala(tel, '7');
    expect(mais).toMatch(/1\. 10:30/);
    const resumo = await fala(tel, '1');
    expect(resumo).toContain(
      '✂️ Barba + Corte\n💈 Com Rafael\n📅 Hoje (ter, 01/12), às 10:30\n💰 R$ 80,00',
    );
    const pronto = await fala(tel, '1');
    expect(pronto).toContain('Pronto, horário marcado! ✅');

    const ag = await naMinhaConta((tx) =>
      tx.agendamento.findFirst({
        where: { cliente: { telefone: tel } },
        include: { comanda: true },
      }),
    );
    expect(ag).toMatchObject({ origem: 'bot', profissionalId, status: 'agendado' });
    expect(ag!.fim.getTime() - ag!.inicio.getTime()).toBe(60 * 60_000);
    expect(ag!.comanda).toMatchObject({ status: 'prevista', totalLiquido: 8000 });
  });

  it('horário ocupado por outra pessoa no meio: avisa e mostra os que sobraram', async () => {
    const t2 = '5511977772222';
    await fala(t2, 'oi');
    await fala(t2, '1');
    await fala(t2, '2'); // Corte
    await fala(t2, '1'); // hoje
    await fala(t2, '1'); // 09:00 → resumo
    // Outra pessoa pega as 09:00 antes da confirmação.
    await naMinhaConta(async (tx) => {
      const c = await tx.cliente.create({ data: { nome: 'Balcão', telefone: '5511900009999' } });
      await criarAgendamentoNoBanco(tx, {
        unidadeId,
        profissionalId,
        clienteId: c.id,
        inicio: new Date('2026-12-01T12:00:00Z'),
        servicoIds: [corte],
        origem: 'balcao',
        criadoPorId: null,
      });
    });
    const r = await fala(t2, '1');
    expect(r).toContain('Esse horário acabou de ser ocupado.');
    expect(r).toMatch(/1\. 09:30/);
  });

  it('"atendente" no meio larga o agendamento; "0" volta ao menu', async () => {
    const t3 = '5511977773333';
    await fala(t3, 'oi');
    await fala(t3, '1');
    expect(await fala(t3, '0')).toMatch(/Como posso ajudar\?/);
    await fala(t3, '1');
    expect(await fala(t3, 'atendente')).toContain('Um atendente vai responder');
  });

  it('quem já tem 2 horários futuros é mandado para a recepção', async () => {
    const t4 = '5511977774444';
    await fala(t4, 'oi');
    const c = await naMinhaConta((tx) => tx.cliente.findFirstOrThrow({ where: { telefone: t4 } }));
    await naMinhaConta(async (tx) => {
      for (const iso of ['2026-12-02T12:00:00Z', '2026-12-03T12:00:00Z'])
        await criarAgendamentoNoBanco(tx, {
          unidadeId,
          profissionalId,
          clienteId: c.id,
          inicio: new Date(iso),
          servicoIds: [corte],
          origem: 'balcao',
          criadoPorId: null,
        });
    });
    expect(await fala(t4, '1')).toContain('Você já tem horários marcados com a gente');
  });
});
