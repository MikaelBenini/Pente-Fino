// Plano fundador (Etapa 23): o cupom FUNDADOR já existe (migração), a vaga só conta quando a
// conta paga e o desconto é conferido de novo na hora de assinar. Provedor falso do Asaas.
import type { INestApplication } from '@nestjs/common';
import { criarPrisma, naConta, type PrismaClient } from '@pente-fino/db';
import { lerCupons, type AssinaturaDetalhe } from '@pente-fino/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AssinaturaGuard } from '../src/assinatura/assinatura.guard.js';
import { PROVEDOR_COBRANCA, type ProvedorCobrancaFalso } from '../src/cobranca/provedor.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let prisma: PrismaClient;
let plataforma: PrismaClient;
let provedor: ProvedorCobrancaFalso;
const cenarios: Cenario[] = [];
const http = () => request(app.getHttpServer());
const CUPOM_UMA_VAGA = `UMAVAGA${Date.now().toString(36).toUpperCase()}`;

/** Conta em teste vencido (só consulta), com ou sem cupom guardado do cadastro. */
async function contaEmTeste(cupom: string | null, descontoBp = 0) {
  const c = await criarCenario();
  cenarios.push(c);
  await naConta(prisma, c.contaId, (tx) =>
    tx.conta.update({
      where: { id: c.contaId },
      data: {
        status: 'teste',
        testeAte: new Date(Date.now() - 86_400_000),
        cupom,
        descontoBp,
        // Uma unidade só: o valor do Pro fica fácil de conferir.
      },
    }),
  );
  await naConta(prisma, c.contaId, (tx) =>
    tx.unidade.update({ where: { id: c.unidadeB }, data: { ativa: false } }),
  );
  app.get(AssinaturaGuard).esquecer(c.contaId);
  return { c, dono: await como(app, c.emails.dono) };
}

const contaDe = (c: Cenario) =>
  naConta(prisma, c.contaId, (tx) => tx.conta.findUniqueOrThrow({ where: { id: c.contaId } }));

beforeAll(async () => {
  app = await criarApp();
  prisma = criarPrisma();
  plataforma = criarPrisma(process.env.DATABASE_PLATAFORMA_URL);
  provedor = app.get(PROVEDOR_COBRANCA);
  // Um cupom de 1 vaga só para o teste das vagas esgotadas.
  const atual = await plataforma.configuracaoPlataforma.findUniqueOrThrow({
    where: { chave: 'cupons' },
  });
  await plataforma.configuracaoPlataforma.update({
    where: { chave: 'cupons' },
    data: {
      valor: [
        ...(atual.valor as object[]),
        {
          codigo: CUPOM_UMA_VAGA,
          descricao: '',
          descontoBp: 5000,
          validoAte: null,
          vagas: 1,
          ativo: true,
        },
      ],
    },
  });
});

afterAll(async () => {
  const atual = await plataforma.configuracaoPlataforma.findUniqueOrThrow({
    where: { chave: 'cupons' },
  });
  await plataforma.configuracaoPlataforma.update({
    where: { chave: 'cupons' },
    data: { valor: lerCupons(atual.valor).filter((c) => c.codigo !== CUPOM_UMA_VAGA) },
  });
  for (const c of cenarios) await c.remover();
  await plataforma.$disconnect();
  await prisma.$disconnect();
  await app.close();
});

describe('plano fundador', () => {
  it('o cupom FUNDADOR já existe: 30%, com as vagas que restam', async () => {
    const r = (await http().get('/publico/cupom/fundador').expect(200)).body;
    expect(r).toMatchObject({ codigo: 'FUNDADOR', descontoBp: 3000 });
    expect(r.restantes).toBeGreaterThan(0);
    expect(r.restantes).toBeLessThanOrEqual(20);
  });

  it('quem se cadastrou com o cupom assina com 30%; a vaga só conta depois de pagar', async () => {
    const antes = (await http().get('/publico/cupom/FUNDADOR').expect(200)).body.restantes;
    const { c, dono } = await contaEmTeste('FUNDADOR', 3000);
    await dono
      .post('/conta/assinatura', { plano: 'pro', ciclo: 'mensal', documento: '529.982.247-25' })
      .expect(201);
    const d = (await dono.get('/conta/assinatura').expect(200)).body as AssinaturaDetalhe;
    expect(d.pendente?.valor).toBe(10493); // R$ 149,90 com 30%
    // Ainda não pagou: a vaga não foi ocupada.
    expect((await http().get('/publico/cupom/FUNDADOR').expect(200)).body.restantes).toBe(antes);

    provedor.pagar((await contaDe(c)).asaasAssinaturaId!, 'PIX');
    await dono.post('/conta/assinatura/conferir').expect(200);
    expect(await contaDe(c)).toMatchObject({
      status: 'ativa',
      cupom: 'FUNDADOR',
      descontoBp: 3000,
    });
    expect((await http().get('/publico/cupom/FUNDADOR').expect(200)).body.restantes).toBe(
      antes - 1,
    );
  });

  it('quem se cadastrou sem cupom digita na hora de assinar; código errado é recusado', async () => {
    const { c, dono } = await contaEmTeste(null);
    const errado = await dono
      .post('/conta/assinatura', {
        plano: 'pro',
        ciclo: 'mensal',
        documento: '52998224725',
        cupom: 'NAOEXISTE',
      })
      .expect(400);
    expect(errado.body.erro.campos[0]).toMatchObject({ campo: 'cupom' });
    await dono
      .post('/conta/assinatura', {
        plano: 'pro',
        ciclo: 'mensal',
        documento: '52998224725',
        cupom: 'fundador',
      })
      .expect(201);
    expect(await contaDe(c)).toMatchObject({ cupom: 'FUNDADOR', descontoBp: 3000 });
  });

  it('vagas esgotadas enquanto a conta estava em teste: assina sem o desconto', async () => {
    // Primeira conta usa a única vaga e paga.
    const um = await contaEmTeste(CUPOM_UMA_VAGA, 5000);
    await um.dono
      .post('/conta/assinatura', { plano: 'pro', ciclo: 'mensal', documento: '52998224725' })
      .expect(201);
    provedor.pagar((await contaDe(um.c)).asaasAssinaturaId!, 'PIX');
    await um.dono.post('/conta/assinatura/conferir').expect(200);
    await http().get(`/publico/cupom/${CUPOM_UMA_VAGA}`).expect(400);

    // A segunda tinha o cupom do cadastro, mas a vaga acabou: assina pelo preço cheio.
    const dois = await contaEmTeste(CUPOM_UMA_VAGA, 5000);
    await dois.dono
      .post('/conta/assinatura', { plano: 'pro', ciclo: 'mensal', documento: '52998224725' })
      .expect(201);
    expect(await contaDe(dois.c)).toMatchObject({ cupom: null, descontoBp: 0 });
    const d = (await dois.dono.get('/conta/assinatura').expect(200)).body as AssinaturaDetalhe;
    expect(d.pendente?.valor).toBe(14990);
  });
});
