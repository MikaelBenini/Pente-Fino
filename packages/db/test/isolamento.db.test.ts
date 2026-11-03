// Pronto quando da Etapa 3: conectado como conta A, não se enxerga nenhuma linha da conta B.
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarPrisma, naConta, type PrismaClient, type Transacao } from '../src/index.js';

const envDaRaiz = new URL('../../../.env', import.meta.url);
if (existsSync(envDaRaiz)) process.loadEnvFile(envDaRaiz);

let prisma: PrismaClient;
const contaA = randomUUID();
const contaB = randomUUID();
const ids = { A: {} as Record<string, string>, B: {} as Record<string, string> };

async function criarConta(contaId: string, rotulo: 'A' | 'B') {
  await naConta(prisma, contaId, async (tx) => {
    await tx.conta.create({ data: { id: contaId, nome: `Teste ${rotulo}` } });
    const unidade = await tx.unidade.create({ data: { nome: `Unidade ${rotulo}` } });
    const servico = await tx.servico.create({ data: { nome: 'Corte', duracaoMin: 30 } });
    const cliente = await tx.cliente.create({
      data: { nome: `Cliente ${rotulo}`, telefone: '5511999990000' },
    });
    const usuario = await tx.usuario.create({
      data: { nome: `Barbeiro ${rotulo}`, email: `${randomUUID()}@teste.dev` },
    });
    const profissional = await tx.profissional.create({
      data: { usuarioId: usuario.id, unidadeId: unidade.id, dataEntrada: new Date('2026-01-01') },
    });
    const comanda = await tx.comanda.create({
      data: {
        unidadeId: unidade.id,
        profissionalId: profissional.id,
        clienteId: cliente.id,
        status: 'fechada',
      },
    });
    ids[rotulo] = {
      unidade: unidade.id,
      servico: servico.id,
      cliente: cliente.id,
      comanda: comanda.id,
      profissional: profissional.id,
    };
  });
}

beforeAll(async () => {
  prisma = criarPrisma();
  await criarConta(contaA, 'A');
  await criarConta(contaB, 'B');
});

afterAll(async () => {
  for (const conta of [contaA, contaB]) {
    await naConta(prisma, conta, (tx) => tx.conta.deleteMany({ where: { id: conta } }));
  }
  await prisma.$disconnect();
});

describe('isolamento por conta (RLS)', () => {
  it('conta A não enxerga nenhuma linha da conta B', async () => {
    await naConta(prisma, contaA, async (tx) => {
      expect(await tx.conta.findMany()).toEqual([expect.objectContaining({ id: contaA })]);
      expect((await tx.unidade.findMany()).map((u) => u.id)).toEqual([ids.A.unidade]);
      expect((await tx.cliente.findMany()).map((c) => c.id)).toEqual([ids.A.cliente]);
      expect((await tx.comanda.findMany()).map((c) => c.id)).toEqual([ids.A.comanda]);
      expect(await tx.cliente.findUnique({ where: { id: ids.B.cliente! } })).toBeNull();
    });
  });

  it('o mesmo telefone pode existir em contas diferentes', async () => {
    // Os dois clientes do beforeAll usam 5511999990000: a unicidade é por conta.
    expect(ids.A.cliente).not.toBe(ids.B.cliente);
  });

  it('conta A não altera nem apaga linhas da conta B', async () => {
    await naConta(prisma, contaA, async (tx) => {
      const alterados = await tx.cliente.updateMany({
        where: { id: ids.B.cliente! },
        data: { nome: 'invadido' },
      });
      const apagados = await tx.comanda.deleteMany({ where: { id: ids.B.comanda! } });
      expect(alterados.count).toBe(0);
      expect(apagados.count).toBe(0);
    });
    await naConta(prisma, contaB, async (tx) => {
      expect((await tx.cliente.findUniqueOrThrow({ where: { id: ids.B.cliente! } })).nome).toBe(
        'Cliente B',
      );
    });
  });

  it('conta A não grava linha com conta_id da conta B', async () => {
    await expect(
      naConta(prisma, contaA, (tx) =>
        tx.servico.create({ data: { contaId: contaB, nome: 'Intruso', duracaoMin: 10 } }),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('o conta_id é preenchido pelo banco a partir da sessão', async () => {
    const servico = await naConta(prisma, contaA, (tx) =>
      tx.servico.create({ data: { nome: 'Barba', duracaoMin: 30 } }),
    );
    expect(servico.contaId).toBe(contaA);
  });

  it('sem conta na sessão não se enxerga nada e não se grava nada', async () => {
    expect(await prisma.cliente.count()).toBe(0);
    expect(await prisma.conta.count()).toBe(0);
    await expect(
      prisma.servico.create({ data: { nome: 'Sem conta', duracaoMin: 10 } }),
    ).rejects.toThrow();
  });

  it('a conta da sessão não vaza para a próxima transação da mesma conexão', async () => {
    await naConta(prisma, contaA, (tx) => tx.cliente.count());
    expect(await prisma.cliente.count()).toBe(0);
  });

  it('recusa contaId que não é UUID', async () => {
    await expect(naConta(prisma, "x' OR 1=1 --", (tx) => tx.cliente.count())).rejects.toThrow(
      TypeError,
    );
  });
});

describe('leituras antes de saber a conta (login e tokens)', () => {
  const comChave = <T>(nome: string, valor: string, fn: (tx: Transacao) => Promise<T>) =>
    prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config(${nome}, ${valor}, true)`;
      return fn(tx);
    });

  it('o e-mail declarado libera só aquele usuário, e só para leitura', async () => {
    const email = await naConta(
      prisma,
      contaB,
      async (tx) => (await tx.usuario.findFirstOrThrow()).email,
    );
    const vistos = await comChave('app.login_email', email, (tx) => tx.usuario.findMany());
    expect(vistos.map((u) => u.email)).toEqual([email]);
    const alterados = await comChave('app.login_email', email, (tx) =>
      tx.usuario.updateMany({ where: { email }, data: { nome: 'invadido' } }),
    );
    expect(alterados.count).toBe(0);
    // Nada além do usuário: nem a conta dele.
    expect(await comChave('app.login_email', email, (tx) => tx.cliente.count())).toBe(0);
  });

  it('o hash declarado libera só aquele token', async () => {
    const hash = randomUUID().replaceAll('-', '');
    await naConta(prisma, contaB, async (tx) => {
      const usuario = await tx.usuario.findFirstOrThrow();
      await tx.tokenAcesso.create({
        data: {
          usuarioId: usuario.id,
          tipo: 'convite',
          hash,
          expiraEm: new Date(Date.now() + 60_000),
        },
      });
    });
    expect(await comChave('app.token_hash', hash, (tx) => tx.tokenAcesso.count())).toBe(1);
    expect(await comChave('app.token_hash', 'outro', (tx) => tx.tokenAcesso.count())).toBe(0);
    const revogados = await comChave('app.token_hash', hash, (tx) =>
      tx.tokenAcesso.updateMany({ where: { hash }, data: { revogadoEm: new Date() } }),
    );
    expect(revogados.count).toBe(0);
  });
});

describe('proteções do banco', () => {
  it('o usuário da aplicação não é superusuário nem ignora RLS', async () => {
    const [papel] = await prisma.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean }[]>`
      SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
    expect(papel).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  it('o usuário da aplicação não é dono de nenhuma tabela', async () => {
    const [{ total }] = (await prisma.$queryRaw<{ total: bigint }[]>`
      SELECT count(*) AS total FROM pg_tables WHERE schemaname = 'public' AND tableowner = current_user`) as [
      { total: bigint },
    ];
    expect(total).toBe(0n);
  });

  it('toda tabela com conta_id tem RLS ligado e forçado, com política', async () => {
    const semRls = await prisma.$queryRaw<{ tabela: string }[]>`
      SELECT c.relname AS tabela
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r'
         AND (EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'conta_id' AND NOT a.attisdropped)
              OR c.relname = 'conta')
         AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity
              OR NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid))`;
    expect(semRls).toEqual([]);
  });

  it('a aplicação não lê o controle de migrações', async () => {
    await expect(prisma.$queryRaw`SELECT 1 FROM _prisma_migrations LIMIT 1`).rejects.toThrow(
      /permission denied/,
    );
  });
});
