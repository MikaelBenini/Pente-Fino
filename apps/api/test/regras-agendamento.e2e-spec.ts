// Etapa 11: regras de agendamento por unidade (bot e site).
import type { INestApplication } from '@nestjs/common';
import { REGRAS_AGENDAMENTO_PADRAO, type RegrasAgendamento } from '@pente-fino/shared';
import type { App } from 'supertest/types.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let a: Cenario;
let b: Cenario;
type Cliente = Awaited<ReturnType<typeof como>>;
let dono: Cliente;
let gestor: Cliente;
let barbeiro: Cliente;
let intruso: Cliente;

beforeAll(async () => {
  app = await criarApp();
  a = await criarCenario();
  b = await criarCenario();
  dono = await como(app, a.emails.dono);
  gestor = await como(app, a.emails.gestor);
  barbeiro = await como(app, a.emails.barbeiro);
  intruso = await como(app, b.emails.dono);
});

afterAll(async () => {
  await a.remover();
  await b.remover();
  await app.close();
});

describe('regras de agendamento', () => {
  const url = (u: string) => `/unidades/${u}/regras-agendamento`;

  it('unidade nova usa o padrão', async () => {
    expect((await dono.get(url(a.unidadeA)).expect(200)).body).toEqual(REGRAS_AGENDAMENTO_PADRAO);
  });

  it('gestor grava na unidade dele; lembretes ficam do maior para o menor', async () => {
    const novas: RegrasAgendamento = {
      ...REGRAS_AGENDAMENTO_PADRAO,
      antecedenciaMin: 60,
      janelaDias: 30,
      intervaloMin: 10,
      lembretesHoras: [3, 48],
      pelaConversa: false,
    };
    const r = await gestor.put(url(a.unidadeA), novas).expect(200);
    expect(r.body.lembretesHoras).toEqual([48, 3]);
    expect((await dono.get(url(a.unidadeA)).expect(200)).body).toMatchObject({
      antecedenciaMin: 60,
      janelaDias: 30,
      pelaConversa: false,
    });
  });

  it('valida e confere quem pode', async () => {
    await dono
      .put(url(a.unidadeA), { ...REGRAS_AGENDAMENTO_PADRAO, lembretesHoras: [2, 2] })
      .expect(400);
    await dono.put(url(a.unidadeA), { ...REGRAS_AGENDAMENTO_PADRAO, janelaDias: 0 }).expect(400);
    await gestor.put(url(a.unidadeB), REGRAS_AGENDAMENTO_PADRAO).expect(403);
    await barbeiro.get(url(a.unidadeA)).expect(403);
    const r = await intruso.get(url(a.unidadeA));
    expect([403, 404]).toContain(r.status);
  });
});
