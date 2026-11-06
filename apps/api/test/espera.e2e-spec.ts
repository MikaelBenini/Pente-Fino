// Etapa 14: lista de espera no balcão e a vaga indo para a fila quando um horário cai.
import type { INestApplication } from '@nestjs/common';
import {
  dataLocal,
  FILA_WHATSAPP_ENTRADA,
  type ComandaDetalhe,
  type EsperaDetalhe,
  type TrabalhoWhatsappEntrada,
} from '@pente-fino/shared';
import { Queue } from 'bullmq';
import { criarPrisma, naConta, type PrismaClient } from '@pente-fino/db';
import type { App } from 'supertest/types.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let a: Cenario;
type Cliente = Awaited<ReturnType<typeof como>>;
let dono: Cliente;
let recepcao: Cliente;
let barbeiro: Cliente;
let fila: Queue<TrabalhoWhatsappEntrada>;
let prisma: PrismaClient;
let prof = '';
let corte = '';
const dia = (n: number) => {
  const d = new Date(`${dataLocal(new Date())}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

beforeAll(async () => {
  app = await criarApp();
  a = await criarCenario();
  dono = await como(app, a.emails.dono);
  recepcao = await como(app, a.emails.recepcao);
  barbeiro = await como(app, a.emails.barbeiro);
  fila = new Queue(FILA_WHATSAPP_ENTRADA, { connection: { url: process.env.REDIS_URL! } });
  prisma = criarPrisma();
  await dono.patch(`/unidades/${a.unidadeA}`, { diasTrabalho: [0, 1, 2, 3, 4, 5, 6] }).expect(200);
  const usuarios = (await dono.get('/usuarios')).body as { id: string; email: string }[];
  prof = (
    await dono
      .post('/profissionais', {
        unidadeId: a.unidadeA,
        usuarioId: usuarios.find((u) => u.email === a.emails.barbeiro)!.id,
        dataEntrada: dia(-10),
        comissaoServico: { percentualBp: 4000, valorFixo: null },
        comissaoProduto: { percentualBp: 1000, valorFixo: null },
      })
      .expect(201)
  ).body.id;
  corte = (
    await dono
      .post('/servicos', {
        nome: 'Corte',
        duracaoMin: 30,
        custoProduto: 0,
        ehExtra: false,
        pesoAtendimento: 1,
      })
      .expect(201)
  ).body.id;
  await dono
    .post('/precos', {
      vigenciaInicio: dataLocal(new Date()),
      precos: [{ servicoId: corte, unidadeId: a.unidadeA, valor: 5000 }],
    })
    .expect(201);
});

afterAll(async () => {
  const jobs = await fila.getJobs(['waiting', 'delayed', 'completed', 'failed']);
  await Promise.all(
    jobs
      .filter((j) => (j.data as { contaId?: string }).contaId === a.contaId)
      .map((j) => j.remove()),
  );
  await fila.close();
  await prisma.$disconnect();
  await a.remover();
  await app.close();
});

describe('lista de espera no balcão', () => {
  it('a recepção põe na lista e tira; o barbeiro não mexe', async () => {
    const corpo = {
      unidadeId: a.unidadeA,
      clienteNovo: { nome: 'Quer Horário', telefone: '11977005001' },
      profissionalId: prof,
      servicoIds: [corte],
      dia: dia(3),
      deMin: 9 * 60,
      ateMin: 12 * 60,
    };
    await barbeiro.post('/espera', corpo).expect(403);
    await recepcao.post('/espera', { ...corpo, ateMin: 8 * 60 }).expect(400);
    const { id } = (await recepcao.post('/espera', corpo).expect(201)).body as { id: string };
    const lista = (await recepcao.get(`/espera?unidadeId=${a.unidadeA}&dia=${dia(3)}`).expect(200))
      .body as EsperaDetalhe[];
    expect(lista).toEqual([
      expect.objectContaining({
        id,
        cliente: expect.objectContaining({ nome: 'Quer Horário' }),
        servicos: ['Corte'],
        deMin: 540,
        ateMin: 720,
        origem: 'balcao',
        status: 'aguardando',
        oferta: null,
      }),
    ]);
    await recepcao.post(`/espera/${id}/cancelar`, {}).expect(204);
    expect(
      (await recepcao.get(`/espera?unidadeId=${a.unidadeA}&dia=${dia(3)}`).expect(200)).body,
    ).toEqual([]);
  });

  it('cancelar a comanda de um horário põe a vaga na fila do worker', async () => {
    const livres = (
      await dono
        .get(
          `/agenda/horarios-livres?unidadeId=${a.unidadeA}&data=${dia(4)}&duracaoMin=30&profissionalId=${prof}`,
        )
        .expect(200)
    ).body as { inicios: string[] }[];
    const inicio = livres[0]!.inicios[0]!;
    const c = (
      await recepcao
        .post('/agendamentos', {
          unidadeId: a.unidadeA,
          profissionalId: prof,
          clienteNovo: { nome: 'Vai Cancelar' },
          inicio,
          servicoIds: [corte],
        })
        .expect(201)
    ).body as { id: string };
    await recepcao
      .post(`/comandas/${c.id}/cancelar`, { motivo: 'Desmarcou', falta: false })
      .expect(200);
    const jobs = await fila.getJobs(['waiting', 'delayed', 'active', 'completed']);
    const vaga = jobs.find(
      (j) => j.data.tipo === 'vaga' && j.data.contaId === a.contaId && j.data.inicio === inicio,
    );
    expect(vaga?.data).toMatchObject({ unidadeId: a.unidadeA, profissionalId: prof });
  });
});

describe('tolerância de atraso: "Não veio" e desfazer', () => {
  /** Horário marcado e depois deslocado para começar `minAtras` minutos atrás. */
  async function horarioQueComecou(minAtras: number, nome: string) {
    const livres = (
      await dono
        .get(
          `/agenda/horarios-livres?unidadeId=${a.unidadeA}&data=${dia(5)}&duracaoMin=30&profissionalId=${prof}`,
        )
        .expect(200)
    ).body as { inicios: string[] }[];
    const c = (
      await recepcao
        .post('/agendamentos', {
          unidadeId: a.unidadeA,
          profissionalId: prof,
          clienteNovo: { nome },
          inicio: livres[0]!.inicios[0]!,
          servicoIds: [corte],
        })
        .expect(201)
    ).body as { id: string; agendamentoId: string };
    const inicio = new Date(Date.now() - minAtras * 60_000);
    await naConta(prisma, a.contaId, (tx) =>
      tx.agendamento.update({
        where: { id: c.agendamentoId },
        data: { inicio, fim: new Date(inicio.getTime() + 30 * 60_000) },
      }),
    );
    return c;
  }

  it('dentro da tolerância recusa; passou dela, cancela como atraso e põe os avisos na fila em 5 min', async () => {
    const cedo = await horarioQueComecou(3, 'Ainda Vem');
    expect(
      ((await barbeiro.get(`/comandas/${cedo.id}`).expect(200)).body as ComandaDetalhe).atrasado,
    ).toBe(false);
    await barbeiro.post(`/comandas/${cedo.id}/nao-veio`, {}).expect(409);

    const c = await horarioQueComecou(45, 'Atrasou Muito');
    expect(
      ((await barbeiro.get(`/comandas/${c.id}`).expect(200)).body as ComandaDetalhe).atrasado,
    ).toBe(true);
    const depois = (await barbeiro.post(`/comandas/${c.id}/nao-veio`, {}).expect(200))
      .body as ComandaDetalhe;
    expect(depois).toMatchObject({
      status: 'cancelada',
      podeDesfazerNaoVeio: true,
      atrasado: false,
    });
    const ag = await naConta(prisma, a.contaId, (tx) =>
      tx.agendamento.findUniqueOrThrow({ where: { id: c.agendamentoId } }),
    );
    expect(ag).toMatchObject({ status: 'falta', atrasou: true });
    const jobs = await fila.getJobs(['delayed']);
    const meus = jobs.filter((j) => (j.data as { contaId?: string }).contaId === a.contaId);
    expect(meus.some((j) => j.data.tipo === 'atraso')).toBe(true);
    expect(meus.some((j) => j.data.tipo === 'vaga')).toBe(true);
  });

  it('desfazer em até 5 min volta o horário e a comanda prevista', async () => {
    const c = await horarioQueComecou(80, 'Chegou Depois');
    await barbeiro.post(`/comandas/${c.id}/nao-veio`, {}).expect(200);
    const volta = (await barbeiro.post(`/comandas/${c.id}/desfazer-nao-veio`, {}).expect(200))
      .body as ComandaDetalhe;
    // O horário já passou: volta como prevista (ou pendente, se terminou faz tempo).
    expect(['prevista', 'pendente']).toContain(volta.status);
    expect(volta.podeDesfazerNaoVeio).toBe(false);
    const ag = await naConta(prisma, a.contaId, (tx) =>
      tx.agendamento.findUniqueOrThrow({ where: { id: c.agendamentoId } }),
    );
    expect(ag).toMatchObject({ status: 'agendado', atrasou: false });
    await barbeiro.post(`/comandas/${c.id}/desfazer-nao-veio`, {}).expect(409);
  });
});
