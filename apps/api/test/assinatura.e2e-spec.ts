// Etapa 10.1: assinatura do dono — situação, aba Assinatura e bloqueio só para consulta.
import type { INestApplication } from '@nestjs/common';
import { criarPrisma, naConta, type PrismaClient } from '@pente-fino/db';
import { dataLocal, type AssinaturaDetalhe, type EstadoAssinatura } from '@pente-fino/shared';
import type { App } from 'supertest/types.js';
import { AssinaturaGuard } from '../src/assinatura/assinatura.guard.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let a: Cenario;
type Cliente = Awaited<ReturnType<typeof como>>;
let dono: Cliente;
let gestor: Cliente;
let prisma: PrismaClient;

const hoje = dataLocal(new Date());
const diasAtras = (n: number) => {
  const d = new Date(`${hoje}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
};

/** Muda a conta direto no banco e faz a trava ver na hora (sem esperar o cache). */
async function mudarConta(fn: Parameters<typeof naConta>[2]) {
  await naConta(prisma, a.contaId, fn);
  app.get(AssinaturaGuard).esquecer(a.contaId);
}
const fatura = (status: 'aberta' | 'recusada' | 'paga', vencidaHa: number) => ({
  plano: 'pro' as const,
  ciclo: 'mensal' as const,
  valor: 14990,
  vencimento: diasAtras(vencidaHa),
  periodoInicio: diasAtras(vencidaHa),
  periodoFim: diasAtras(vencidaHa - 29),
  status,
  ...(status === 'recusada' ? { motivoRecusa: 'Cartão recusado: saldo insuficiente.' } : {}),
  ...(status === 'paga' ? { forma: 'cartao' as const, pagaEm: diasAtras(vencidaHa) } : {}),
});

beforeAll(async () => {
  app = await criarApp();
  a = await criarCenario();
  dono = await como(app, a.emails.dono);
  gestor = await como(app, a.emails.gestor);
  prisma = criarPrisma();
});

afterAll(async () => {
  await prisma.$disconnect();
  await a.remover();
  await app.close();
});

const situacao = async () =>
  (await gestor.get('/conta/situacao').expect(200)).body as EstadoAssinatura;
const novoCliente = (nome: string) => dono.post('/clientes', { nome });

describe('assinatura', () => {
  it('conta em dia grava normalmente', async () => {
    expect(await situacao()).toMatchObject({ situacao: 'ativa', somenteLeitura: false });
    await novoCliente('Cliente Em Dia').expect(201);
  });

  it('teste grátis terminado: só consulta — lê tudo, não grava, e ainda dá para sair', async () => {
    await mudarConta((tx) =>
      tx.conta.update({
        where: { id: a.contaId },
        data: { status: 'teste', testeAte: diasAtras(1) },
      }),
    );
    expect(await situacao()).toMatchObject({ situacao: 'teste_vencido', somenteLeitura: true });
    const r = await novoCliente('Cliente Bloqueado').expect(402);
    expect(r.body.erro).toMatchObject({ codigo: 'somente_leitura' });
    expect(r.body.erro.mensagem).toMatch(/teste grátis terminou/);
    await dono.get('/clientes').expect(200);
    await dono.post('/auth/sair', {}).expect((res) => expect(res.status).not.toBe(402));
  });

  it('fatura recusada há 3 dias: aviso, mas grava; há 8 dias: só consulta', async () => {
    await mudarConta(async (tx) => {
      await tx.conta.update({
        where: { id: a.contaId },
        data: { status: 'ativa', testeAte: null },
      });
      await tx.faturaAssinatura.create({ data: fatura('paga', 33) });
      await tx.faturaAssinatura.create({ data: fatura('recusada', 3) });
    });
    expect(await situacao()).toMatchObject({ situacao: 'em_atraso', diasEmAtraso: 3 });
    dono = await como(app, a.emails.dono);
    await novoCliente('Cliente Em Atraso').expect(201);

    await mudarConta((tx) =>
      tx.faturaAssinatura.updateMany({
        where: { status: 'recusada' },
        data: { vencimento: diasAtras(8) },
      }),
    );
    expect(await situacao()).toMatchObject({ situacao: 'bloqueada', somenteLeitura: true });
    await novoCliente('Cliente Atrasado Demais').expect(402);
  });

  it('aba Assinatura: só o dono vê plano, a fatura recusada com o motivo e o histórico', async () => {
    const d = (await dono.get('/conta/assinatura').expect(200)).body as AssinaturaDetalhe;
    expect(d).toMatchObject({
      plano: 'premium',
      estado: { situacao: 'bloqueada' },
      pendente: { status: 'recusada', motivoRecusa: 'Cartão recusado: saldo insuficiente.' },
    });
    expect(d.faturas.map((f) => f.status)).toEqual(['recusada', 'paga']);
    await gestor.get('/conta/assinatura').expect(403);
  });

  it('pagou: volta a gravar na hora', async () => {
    await mudarConta((tx) =>
      tx.faturaAssinatura.updateMany({
        where: { status: 'recusada' },
        data: { status: 'paga', forma: 'pix', pagaEm: new Date(), motivoRecusa: null },
      }),
    );
    expect(await situacao()).toMatchObject({ situacao: 'ativa' });
    await novoCliente('Cliente Depois do Pix').expect(201);
  });
});
