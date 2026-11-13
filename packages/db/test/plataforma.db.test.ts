// Administração do sistema: o usuário de banco da plataforma lê entre contas só pelas funções;
// não lê tabela de barbearia direto, e o da aplicação não chega nas tabelas da plataforma.
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  contasDaPlataforma,
  enviarPushEquipe,
  criarPrisma,
  faturasDaPlataforma,
  fichaDaContaPlataforma,
  funilDaConta,
  guardarAlertasNovos,
  mudarPlanoDaConta,
  naConta,
  whatsappCaidoDaPlataforma,
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
    const u = await tx.unidade.create({ data: { nome: 'Centro' } });
    // WhatsApp que caiu há 3 horas e não voltou (admin F3).
    await tx.botConexao.create({
      data: {
        unidadeId: u.id,
        instancia: `teste-${conta}`,
        status: 'desconectado',
        caiuEm: new Date(Date.now() - 3 * 3_600_000),
      },
    });
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

  it('a ficha e as ações enxergam só a conta pedida (nada das outras)', async () => {
    // O banco de teste tem outras contas com profissionais, unidades e faturas.
    const ficha = (await fichaDaContaPlataforma(plataforma, conta)) as {
      profissionais: number;
      unidades: unknown[];
      faturas: unknown[];
      donos: unknown[];
    };
    expect(ficha).toMatchObject({ profissionais: 0, donos: [] });
    expect(ficha.unidades).toHaveLength(1);
    expect(ficha.faturas).toHaveLength(1);
    const antes = await mudarPlanoDaConta(plataforma, conta, 'pro', 'mensal');
    expect(Number(antes.unidades)).toBe(1);
    expect((await fichaDaContaPlataforma(plataforma, conta))?.plano).toBe('pro');
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

  it('funil (admin F1): etapas da conta pela função, com a fatura paga', async () => {
    expect(await funilDaConta(plataforma, conta)).toMatchObject({
      servicos: false,
      barbeiros: false,
      whatsapp: false,
      pagamento: true,
    });
  });

  it('alertas (admin F3): WhatsApp caído pela função; cada alerta é guardado uma vez só', async () => {
    const caido = (await whatsappCaidoDaPlataforma(plataforma)).find((w) => w.contaId === conta);
    expect(caido?.conta).toBe('Barbearia Vista Pela Plataforma');
    const alerta = { tipo: 'whatsapp_caido', chave: `teste-${conta}` };
    try {
      expect(await guardarAlertasNovos(plataforma, [alerta])).toEqual([alerta]);
      // Segunda vez (ou outra rotina ao mesmo tempo): já saiu.
      expect(await guardarAlertasNovos(plataforma, [alerta])).toEqual([]);
      // A aplicação das barbearias não enxerga os alertas da equipe.
      await expect(app.$queryRaw`SELECT * FROM alerta_equipe_enviado`).rejects.toThrow();
    } finally {
      await plataforma.$executeRaw`
        DELETE FROM alerta_equipe_enviado WHERE tipo = ${alerta.tipo} AND chave = ${alerta.chave}`;
    }
  });

  it('etapa parada (admin F1d): a administração guarda a etapa; a aplicação não enxerga', async () => {
    await plataforma.funilEtapaConta.upsert({
      where: { contaId: conta },
      create: { contaId: conta, etapa: 'servicos' },
      update: { etapa: 'servicos', avisadoEm: null },
    });
    await plataforma.funilEtapaConta.update({
      where: { contaId: conta },
      data: { avisadoEm: new Date() },
    });
    expect(
      (await plataforma.funilEtapaConta.findUnique({ where: { contaId: conta } }))?.etapa,
    ).toBe('servicos');
    await expect(app.$queryRaw`SELECT * FROM funil_etapa_conta`).rejects.toThrow();
  });
});

describe('push do chat para a equipe (admin F6)', () => {
  it('manda aos aparelhos de quem atende o chat e tira o aparelho que não existe mais', async () => {
    const sufixo = randomUUID().slice(0, 8);
    const pessoa = await plataforma.usuarioPlataforma.create({
      data: {
        email: `push-${sufixo}@pentefino.dev`,
        nome: 'Paula Push',
        papel: 'suporte',
        senhaHash: 'x',
      },
    });
    const financeiro = await plataforma.usuarioPlataforma.create({
      data: {
        email: `push-fin-${sufixo}@pentefino.dev`,
        nome: 'Fabio Fin',
        papel: 'financeiro',
        senhaHash: 'x',
      },
    });
    try {
      await plataforma.inscricaoPushPlataforma.createMany({
        data: [
          {
            usuarioId: pessoa.id,
            endpoint: `https://push.teste/${sufixo}/ok`,
            p256dh: 'p'.repeat(20),
            auth: 'a'.repeat(12),
          },
          {
            usuarioId: pessoa.id,
            endpoint: `https://push.teste/${sufixo}/velho`,
            p256dh: 'p'.repeat(20),
            auth: 'a'.repeat(12),
          },
          {
            usuarioId: financeiro.id,
            endpoint: `https://push.teste/${sufixo}/fin`,
            p256dh: 'p'.repeat(20),
            auth: 'a'.repeat(12),
          },
        ],
      });
      const mandados: string[] = [];
      const r = await enviarPushEquipe(
        plataforma,
        { titulo: 'Ana está no chat', corpo: 'Oi', url: '/admin#chat', etiqueta: 'chat-1' },
        async (i) => {
          mandados.push(i.endpoint);
          return i.endpoint.endsWith('/velho') ? 410 : 201;
        },
      );
      const meus = mandados.filter((e) => e.includes(sufixo));
      // O financeiro não atende o chat: não recebe.
      expect(meus.sort()).toEqual([
        `https://push.teste/${sufixo}/ok`,
        `https://push.teste/${sufixo}/velho`,
      ]);
      expect(r.removidos).toBeGreaterThanOrEqual(1);
      expect(
        await plataforma.inscricaoPushPlataforma.count({ where: { usuarioId: pessoa.id } }),
      ).toBe(1);
      // A aplicação das barbearias não enxerga os aparelhos da equipe.
      await expect(app.$queryRaw`SELECT * FROM inscricao_push_plataforma`).rejects.toThrow();
    } finally {
      await plataforma.usuarioPlataforma.updateMany({
        where: { id: { in: [pessoa.id, financeiro.id] } },
        data: { ativo: false },
      });
      await plataforma.inscricaoPushPlataforma.deleteMany({
        where: { usuarioId: { in: [pessoa.id, financeiro.id] } },
      });
    }
  });
});
