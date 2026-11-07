// Cobrança manual: a rotina cria a próxima cobrança em aberto e avisa o dono; o pagamento
// registrado pela administração quita essa cobrança em vez de criar outra.
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  contasComCobrancaManual,
  criarPrisma,
  naConta,
  registrarPagamentoManual,
  rotinaCobrancaManual,
  type PrismaClient,
} from '../src/index.js';

const envDaRaiz = new URL('../../../.env', import.meta.url);
if (existsSync(envDaRaiz)) process.loadEnvFile(envDaRaiz);

let app: PrismaClient;
let plataforma: PrismaClient;
const conta = randomUUID();
const contaAsaas = randomUUID();
const agora = new Date('2026-11-28T12:00:00Z');
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

beforeAll(async () => {
  app = criarPrisma();
  plataforma = criarPrisma(process.env.DATABASE_PLATAFORMA_URL);
  await naConta(app, conta, async (tx) => {
    await tx.conta.create({
      data: { id: conta, nome: 'Barbearia Manual', status: 'ativa', plano: 'pro', ciclo: 'mensal' },
    });
    await tx.unidade.create({ data: { nome: 'Centro' } });
    const dono = await tx.usuario.create({
      data: { nome: 'Dora Dona', email: `dora-${conta.slice(0, 8)}@teste.dev` },
    });
    await tx.papelUsuario.create({ data: { usuarioId: dono.id, papel: 'dono' } });
    await tx.faturaAssinatura.create({
      data: {
        plano: 'pro',
        ciclo: 'mensal',
        valor: 14990,
        vencimento: d('2026-11-05'),
        periodoInicio: d('2026-11-05'),
        periodoFim: d('2026-12-04'),
        status: 'paga',
        origem: 'manual',
        forma: 'pix',
        pagaEm: d('2026-11-05'),
      },
    });
  });
  await naConta(app, contaAsaas, (tx) =>
    tx.conta.create({
      data: {
        id: contaAsaas,
        nome: 'Barbearia Asaas',
        status: 'ativa',
        asaasAssinaturaId: `sub_${contaAsaas}`,
      },
    }),
  );
});

afterAll(async () => {
  for (const id of [conta, contaAsaas])
    await naConta(app, id, (tx) => tx.conta.deleteMany({ where: { id } }));
  await app.$disconnect();
  await plataforma.$disconnect();
});

describe('cobrança manual', () => {
  it('a rotina enxerga só as contas manuais ativas', async () => {
    const contas = await contasComCobrancaManual(app);
    expect(contas).toContain(conta);
    expect(contas).not.toContain(contaAsaas);
  });

  it('7 dias antes cria a cobrança e avisa o dono; não repete', async () => {
    const avisos = await rotinaCobrancaManual(app, conta, agora);
    expect(avisos).toEqual([
      expect.objectContaining({
        para: `dora-${conta.slice(0, 8)}@teste.dev`,
        assunto: 'Mensalidade do Pente Fino vence em 05/12',
      }),
    ]);
    expect(await rotinaCobrancaManual(app, conta, agora)).toEqual([]);
    const abertas = await naConta(app, conta, (tx) =>
      tx.faturaAssinatura.findMany({ where: { status: 'aberta' } }),
    );
    expect(abertas).toHaveLength(1);
    expect(abertas[0]).toMatchObject({ valor: 14990, origem: 'manual' });
    expect(abertas[0]!.vencimento.toISOString().slice(0, 10)).toBe('2026-12-05');
  });

  it('o pagamento manual quita a cobrança em aberto (não cria outra)', async () => {
    await registrarPagamentoManual(plataforma, {
      contaId: conta,
      valor: 14990,
      forma: 'dinheiro',
      pagaEm: new Date('2026-12-03T15:00:00Z'),
      inicio: '2026-12-05',
      fim: '2027-01-04',
      recebidoPorId: randomUUID(),
      comprovante: 'Recibo 12',
    });
    const faturas = await naConta(app, conta, (tx) =>
      tx.faturaAssinatura.findMany({ orderBy: { vencimento: 'asc' } }),
    );
    expect(faturas.map((f) => f.status)).toEqual(['paga', 'paga']);
    expect(faturas[1]).toMatchObject({ forma: 'dinheiro', comprovante: 'Recibo 12' });
  });
});
