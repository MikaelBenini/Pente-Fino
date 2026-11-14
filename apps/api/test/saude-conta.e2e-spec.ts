// Saúde da conta no Início (seção 7): caixa de dia anterior que ficou aberto e comandas paradas.
import type { INestApplication } from '@nestjs/common';
import { criarPrisma, naConta, type PrismaClient } from '@pente-fino/db';
import { dataLocal, type SaudeDaConta } from '@pente-fino/shared';
import type { App } from 'supertest/types.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let a: Cenario;
let prisma: PrismaClient;
type Cliente = Awaited<ReturnType<typeof como>>;
let dono: Cliente;
let barbeiro: Cliente;

const diasAtras = (n: number) => {
  const d = new Date(`${dataLocal(new Date())}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
};

beforeAll(async () => {
  app = await criarApp();
  a = await criarCenario();
  prisma = criarPrisma();
  dono = await como(app, a.emails.dono);
  barbeiro = await como(app, a.emails.barbeiro);
});

afterAll(async () => {
  await prisma.$disconnect();
  await a.remover();
  await app.close();
});

describe('saúde da conta', () => {
  it('conta nova: nada para trás', async () => {
    const r = (await dono.get('/resumo/saude').expect(200)).body as SaudeDaConta;
    expect(r).toEqual({ caixaAnterior: null, comandasParadas: 0 });
  });

  it('caixa de anteontem aberto e comanda de ontem parada aparecem; barbeiro não vê', async () => {
    await naConta(prisma, a.contaId, async (tx) => {
      await tx.caixaDia.create({ data: { unidadeId: a.unidadeA, data: diasAtras(2) } });
      const usuario = await tx.usuario.findFirstOrThrow({ where: { email: a.emails.barbeiro } });
      const prof = await tx.profissional.create({
        data: { usuarioId: usuario.id, unidadeId: a.unidadeA, dataEntrada: diasAtras(30) },
      });
      await tx.comanda.create({
        data: {
          unidadeId: a.unidadeA,
          profissionalId: prof.id,
          status: 'em_atendimento',
          criadoEm: diasAtras(1),
        },
      });
      // Comanda de hoje não conta como parada.
      await tx.comanda.create({
        data: { unidadeId: a.unidadeA, profissionalId: prof.id, status: 'em_atendimento' },
      });
    });
    const r = (await dono.get('/resumo/saude').expect(200)).body as SaudeDaConta;
    expect(r.caixaAnterior).toEqual({
      data: diasAtras(2).toISOString().slice(0, 10),
      unidade: 'Unidade A',
    });
    expect(r.comandasParadas).toBe(1);

    const daB = (await dono.get(`/resumo/saude?unidadeId=${a.unidadeB}`).expect(200))
      .body as SaudeDaConta;
    expect(daB).toEqual({ caixaAnterior: null, comandasParadas: 0 });
    await barbeiro.get('/resumo/saude').expect(403);
  });
});
