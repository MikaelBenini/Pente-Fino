// Quem faz cada serviço (P5, lote 7g): barbeiro que não faz o serviço não aparece nos horários e
// não recebe agendamento dele; sem lista, faz todos.
import type { INestApplication } from '@nestjs/common';
import { dataLocal, type UnidadePublica } from '@pente-fino/shared';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let a: Cenario;
type Cliente = Awaited<ReturnType<typeof como>>;
let dono: Cliente;
let barbeiro: Cliente;
let soCorte = '';
let todos = '';
let corte = '';
let barba = '';
const slug = `quem-${randomUUID().slice(0, 8)}`;
const http = () => request(app.getHttpServer());

function amanhaUtil(): string {
  const d = new Date(`${dataLocal(new Date())}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

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
  const profissional = async (email: string) => {
    const id = (
      await dono
        .post('/profissionais', {
          unidadeId: a.unidadeA,
          usuarioId: usuarios.find((u) => u.email === email)!.id,
          dataEntrada: `${hoje.slice(0, 7)}-01`,
          comissaoServico: { percentualBp: 4000, valorFixo: null },
          comissaoProduto: { percentualBp: 1000, valorFixo: null },
        })
        .expect(201)
    ).body.id as string;
    await dono
      .put(`/profissionais/${id}/horarios`, {
        horarios: [1, 2, 3, 4, 5, 6].map((d) => ({ diaSemana: d, inicioMin: 540, fimMin: 1080 })),
      })
      .expect(200);
    return id;
  };
  soCorte = await profissional(a.emails.barbeiro);
  todos = await profissional(a.emails.gestor);
  const servico = async (nome: string) => {
    const id = (
      await dono
        .post('/servicos', {
          nome,
          duracaoMin: 30,
          custoProduto: 0,
          ehExtra: false,
          pesoAtendimento: 1,
          unidadeIds: [a.unidadeA],
        })
        .expect(201)
    ).body.id as string;
    await dono
      .post('/precos', {
        vigenciaInicio: hoje,
        precos: [{ servicoId: id, unidadeId: a.unidadeA, valor: 4000 }],
      })
      .expect(201);
    return id;
  };
  corte = await servico('Corte');
  barba = await servico('Barba');
  await dono.patch(`/unidades/${a.unidadeA}`, { agendamentoPublico: true }).expect(200);
});

afterAll(async () => {
  await a.remover();
  await app.close();
});

const livres = async (servicoId: string) =>
  (
    await http()
      .get(`/publico/agendamento/${slug}/horarios?data=${amanhaUtil()}&servicoIds=${servicoId}`)
      .expect(200)
  ).body as { profissionalId: string; inicios: string[] }[];

describe('quem faz cada serviço', () => {
  it('sem lista, todos fazem tudo', async () => {
    expect((await livres(barba)).map((l) => l.profissionalId).sort()).toEqual(
      [soCorte, todos].sort(),
    );
  });

  it('com lista: só aparece para o que faz; não agenda o que não faz', async () => {
    const r = await dono
      .put(`/profissionais/${soCorte}/servicos`, { servicoIds: [corte] })
      .expect(200);
    expect(r.body.servicoIds).toEqual([corte]);
    expect((await livres(barba)).map((l) => l.profissionalId)).toEqual([todos]);
    expect((await livres(corte)).map((l) => l.profissionalId).sort()).toEqual(
      [soCorte, todos].sort(),
    );

    const pagina = (await http().get(`/publico/agendamento/${slug}`).expect(200))
      .body as UnidadePublica;
    expect(pagina.profissionais.find((p) => p.id === soCorte)?.servicoIds).toEqual([corte]);

    const inicio = (await livres(corte)).find((l) => l.profissionalId === soCorte)!.inicios[0]!;
    const erro = await http()
      .post(`/publico/agendamento/${slug}`)
      .send({
        nome: 'Cliente',
        telefone: '11988887777',
        servicoIds: [barba],
        profissionalId: soCorte,
        inicio,
      });
    expect(erro.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(erro.body)).toMatch(/não faz/);
  });

  it('serviço que não existe e barbeiro sem permissão', async () => {
    await dono
      .put(`/profissionais/${soCorte}/servicos`, { servicoIds: [randomUUID()] })
      .expect(404);
    await barbeiro.put(`/profissionais/${soCorte}/servicos`, { servicoIds: [] }).expect(403);
  });
});
