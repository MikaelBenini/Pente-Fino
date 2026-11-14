// Horário de funcionamento da unidade (pedido do dono em 13/11): o agendamento só oferece horário
// dentro dele, mesmo com o barbeiro trabalhando mais; o site mostra o horário da unidade.
import type { INestApplication } from '@nestjs/common';
import { dataLocal, type HorarioFuncionamento, type SitePublico } from '@pente-fino/shared';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let a: Cenario;
type Cliente = Awaited<ReturnType<typeof como>>;
let dono: Cliente;
let barbeiro: Cliente;
let corte = '';
const slug = `func-${randomUUID().slice(0, 8)}`;
const http = () => request(app.getHttpServer());

/** Próxima terça (dia 2), no calendário de São Paulo, depois de amanhã pelo menos. */
function proximaTerca(): string {
  const d = new Date(`${dataLocal(new Date())}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 2);
  while (d.getUTCDay() !== 2) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
const hora = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

beforeAll(async () => {
  app = await criarApp();
  a = await criarCenario();
  dono = await como(app, a.emails.dono);
  barbeiro = await como(app, a.emails.barbeiro);
  const hoje = dataLocal(new Date());
  await dono
    .patch(`/unidades/${a.unidadeA}`, { diasTrabalho: [1, 2, 3, 4, 5, 6], slug })
    .expect(200);
  const usuarios = (await dono.get('/usuarios')).body as { id: string; email: string }[];
  const prof = (
    await dono
      .post('/profissionais', {
        unidadeId: a.unidadeA,
        usuarioId: usuarios.find((u) => u.email === a.emails.barbeiro)!.id,
        dataEntrada: `${hoje.slice(0, 7)}-01`,
        comissaoServico: { percentualBp: 4000, valorFixo: null },
        comissaoProduto: { percentualBp: 1000, valorFixo: null },
      })
      .expect(201)
  ).body.id;
  // O barbeiro trabalha das 8h às 21h, de segunda a sábado.
  await dono
    .put(`/profissionais/${prof}/horarios`, {
      horarios: [1, 2, 3, 4, 5, 6].map((d) => ({ diaSemana: d, inicioMin: 480, fimMin: 1260 })),
    })
    .expect(200);
  corte = (
    await dono
      .post('/servicos', {
        nome: 'Corte',
        duracaoMin: 30,
        custoProduto: 0,
        ehExtra: false,
        pesoAtendimento: 1,
        unidadeIds: [a.unidadeA],
      })
      .expect(201)
  ).body.id;
  await dono
    .post('/precos', {
      vigenciaInicio: hoje,
      precos: [{ servicoId: corte, unidadeId: a.unidadeA, valor: 5000 }],
    })
    .expect(201);
  await dono.patch(`/unidades/${a.unidadeA}`, { agendamentoPublico: true }).expect(200);
});

afterAll(async () => {
  await a.remover();
  await app.close();
});

const livres = async (data: string) =>
  (
    (
      await http()
        .get(`/publico/agendamento/${slug}/horarios?data=${data}&servicoIds=${corte}`)
        .expect(200)
    ).body[0].inicios as string[]
  ).map(hora);

describe('horário de funcionamento da unidade', () => {
  it('sem horário cadastrado, vale o expediente do barbeiro', async () => {
    const r = (await dono.get(`/unidades/${a.unidadeA}/funcionamento`).expect(200))
      .body as HorarioFuncionamento;
    expect(r.turnos).toEqual([]);
    const h = await livres(proximaTerca());
    expect(h[0]).toBe('08:00');
    expect(h).toContain('20:30');
  });

  it('com horário, o link só oferece dentro dele; os dias de trabalho acompanham', async () => {
    // Terça a sexta, 9h às 12h e 13h às 20h; sábado, 8h às 18h; segunda fechada.
    const turnos = [
      ...[2, 3, 4, 5].flatMap((d) => [
        { diaSemana: d, inicioMin: 540, fimMin: 720 },
        { diaSemana: d, inicioMin: 780, fimMin: 1200 },
      ]),
      { diaSemana: 6, inicioMin: 480, fimMin: 1080 },
    ];
    await dono.put(`/unidades/${a.unidadeA}/funcionamento`, { turnos }).expect(200);
    const h = await livres(proximaTerca());
    expect(h[0]).toBe('09:00');
    expect(h).not.toContain('08:00');
    expect(h).toContain('11:30');
    expect(h).not.toContain('12:00');
    expect(h).toContain('13:00');
    expect(h).toContain('19:30');
    expect(h).not.toContain('20:00');

    const unidade = (
      (await dono.get('/unidades')).body as { id: string; diasTrabalho: number[] }[]
    ).find((u) => u.id === a.unidadeA)!;
    expect(unidade.diasTrabalho).toEqual([2, 3, 4, 5, 6]);

    // O site mostra o horário da unidade.
    const previa = (await dono.get(`/unidades/${a.unidadeA}/site/previa`).expect(200))
      .body as SitePublico;
    expect(previa.horario).toEqual([
      { dias: 'Terça a sexta', horario: '9h às 12h e 13h às 20h' },
      { dias: 'Sábado', horario: '8h às 18h' },
      { dias: 'Segunda e domingo', horario: null },
    ]);
  });

  it('recusa turno inválido e o barbeiro não muda o horário', async () => {
    await dono
      .put(`/unidades/${a.unidadeA}/funcionamento`, {
        turnos: [{ diaSemana: 1, inicioMin: 600, fimMin: 540 }],
      })
      .expect(400);
    await barbeiro.put(`/unidades/${a.unidadeA}/funcionamento`, { turnos: [] }).expect(403);
  });

  it('apagar o horário volta ao expediente do barbeiro', async () => {
    await dono.put(`/unidades/${a.unidadeA}/funcionamento`, { turnos: [] }).expect(200);
    expect((await livres(proximaTerca()))[0]).toBe('08:00');
  });
});
