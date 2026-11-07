// Administração do sistema: o usuário de banco da plataforma lê entre contas só pelas funções;
// não lê tabela de barbearia direto, e o da aplicação não chega nas tabelas da plataforma.
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  contasDaPlataforma,
  criarPrisma,
  faturasDaPlataforma,
  naConta,
  type PrismaClient,
} from '../src/index.js';

const envDaRaiz = new URL('../../../.env', import.meta.url);
if (existsSync(envDaRaiz)) process.loadEnvFile(envDaRaiz);

let app: PrismaClient;
let plataforma: PrismaClient;
const conta = randomUUID();

beforeAll(async () => {
  app = criarPrisma();
  plataforma = criarPrisma(process.env.DATABASE_PLATAFORMA_URL);
  await naConta(app, conta, async (tx) => {
    await tx.conta.create({ data: { id: conta, nome: 'Barbearia Vista Pela Plataforma' } });
    await tx.unidade.create({ data: { nome: 'Centro' } });
    await tx.cliente.create({ data: { nome: 'Cliente Secreto', telefone: '5511999990000' } });
    await tx.faturaAssinatura.create({
      data: {
        plano: 'pro',
        ciclo: 'mensal',
        valor: 14990,
        vencimento: new Date('2026-11-05T00:00:00Z'),
        periodoInicio: new Date('2026-11-05T00:00:00Z'),
        periodoFim: new Date('2026-12-04T00:00:00Z'),
        status: 'paga',
        pagaEm: new Date('2026-11-05T15:00:00Z'),
        forma: 'pix',
      },
    });
  });
});

afterAll(async () => {
  await naConta(app, conta, (tx) => tx.conta.deleteMany({ where: { id: conta } }));
  await app.$disconnect();
  await plataforma.$disconnect();
});

describe('acesso da plataforma', () => {
  it('a função lista a conta com contagens, sem entrar nela', async () => {
    const linha = (await contasDaPlataforma(plataforma)).find((c) => c.id === conta);
    expect(linha).toMatchObject({
      nome: 'Barbearia Vista Pela Plataforma',
      plano: 'basico',
      status: 'teste',
      unidades: 1,
      profissionais: 0,
      whatsapp_conectado: false,
      fechadas_7_dias: 0,
    });
  });

  it('faturas da assinatura de todas as contas, sem dado de cliente', async () => {
    const minhas = (await faturasDaPlataforma(plataforma)).filter((f) => f.conta_id === conta);
    expect(minhas).toEqual([
      expect.objectContaining({ plano: 'pro', valor: 14990, status: 'paga', origem: 'asaas' }),
    ]);
    const linha = (await contasDaPlataforma(plataforma)).find((c) => c.id === conta);
    expect(linha).toMatchObject({ cancelada_em: null, ultimo_acesso_em: null });
  });

  it('o usuário da plataforma não lê tabela de barbearia direto', async () => {
    await expect(plataforma.$queryRaw`SELECT count(*) FROM cliente`).rejects.toThrow(
      /permission denied/,
    );
    await expect(plataforma.$queryRaw`SELECT count(*) FROM conta`).rejects.toThrow(
      /permission denied/,
    );
  });

  it('o usuário da aplicação não chama a função nem lê as tabelas da plataforma', async () => {
    await expect(app.$queryRaw`SELECT * FROM plataforma_contas()`).rejects.toThrow(
      /permission denied/,
    );
    await expect(app.$queryRaw`SELECT * FROM plataforma_faturas()`).rejects.toThrow(
      /permission denied/,
    );
    await expect(app.$queryRaw`SELECT count(*) FROM usuario_plataforma`).rejects.toThrow(
      /permission denied/,
    );
    await expect(app.$queryRaw`SELECT count(*) FROM auditoria_plataforma`).rejects.toThrow(
      /permission denied/,
    );
  });

  it('a auditoria da plataforma não muda nem some', async () => {
    const [a] = await plataforma.$queryRaw<{ id: string }[]>`
      INSERT INTO auditoria_plataforma (acao) VALUES ('teste') RETURNING id`;
    await expect(
      plataforma.$executeRaw`UPDATE auditoria_plataforma SET acao = 'x' WHERE id = ${a!.id}::uuid`,
    ).rejects.toThrow();
    await expect(
      plataforma.$executeRaw`DELETE FROM auditoria_plataforma WHERE id = ${a!.id}::uuid`,
    ).rejects.toThrow();
  });
});
