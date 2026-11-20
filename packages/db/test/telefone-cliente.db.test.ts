// Pedido do dono em 20/11/2026: "se o número vai com um 9 ou dois, gera dois cadastros". O banco
// guarda o celular sempre com o nono dígito (gatilho cliente_telefone_canonico) e a restrição
// única (conta, telefone) impede o segundo cadastro.
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarPrisma, naConta, type PrismaClient } from '../src/index.js';

const envDaRaiz = new URL('../../../.env', import.meta.url);
if (existsSync(envDaRaiz)) process.loadEnvFile(envDaRaiz);

let prisma: PrismaClient;
const conta = randomUUID();
const naMinhaConta = <T>(fn: Parameters<typeof naConta<T>>[2]) => naConta(prisma, conta, fn);

beforeAll(async () => {
  prisma = criarPrisma();
  await naMinhaConta((tx) => tx.conta.create({ data: { id: conta, nome: 'Telefones' } }));
});

afterAll(async () => {
  await naMinhaConta((tx) => tx.conta.deleteMany({ where: { id: conta } }));
  await prisma.$disconnect();
});

describe('um telefone, um cliente', () => {
  it('celular sem o 9 é gravado com o 9', async () => {
    const c = await naMinhaConta((tx) =>
      tx.cliente.create({ data: { nome: 'Sem Nove', telefone: '554499764653' } }),
    );
    expect(c.telefone).toBe('5544999764653');
  });

  it('o mesmo número com o 9 não vira outro cadastro', async () => {
    await expect(
      naMinhaConta((tx) =>
        tx.cliente.create({ data: { nome: 'Com Nove', telefone: '5544999764653' } }),
      ),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('trocar o telefone também passa pela regra; fixo fica igual', async () => {
    const c = await naMinhaConta(async (tx) => {
      const novo = await tx.cliente.create({ data: { nome: 'Fixo', telefone: '554432221111' } });
      expect(novo.telefone).toBe('554432221111');
      return tx.cliente.update({ where: { id: novo.id }, data: { telefone: '554498887777' } });
    });
    expect(c.telefone).toBe('5544998887777');
  });
});
