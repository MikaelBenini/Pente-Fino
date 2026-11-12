// Despesas fixas no mês seguinte (pedido do dono em 11/11/2026): prévia das fixas do mês
// anterior, cópia com o valor editado, sem duplicar; o gestor só copia as da unidade dele.
import type { INestApplication } from '@nestjs/common';
import type { DespesaDetalhe, FixaParaCopiar } from '@pente-fino/shared';
import type { App } from 'supertest/types.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let a: Cenario;
type Cliente = Awaited<ReturnType<typeof como>>;
let dono: Cliente;
let gestor: Cliente;
let aluguel = '';
let internetB = '';
let fixa = '';

beforeAll(async () => {
  app = await criarApp();
  a = await criarCenario();
  dono = await como(app, a.emails.dono);
  gestor = await como(app, a.emails.gestor);
  fixa = (await dono.post('/categorias-despesa', { nome: 'Aluguel', grupo: 'fixa' }).expect(201))
    .body.id as string;
  const variavel = (
    await dono.post('/categorias-despesa', { nome: 'Material', grupo: 'variavel' }).expect(201)
  ).body.id as string;
  const lancar = async (corpo: object) =>
    ((await dono.post('/despesas', corpo).expect(201)).body as DespesaDetalhe).id;
  aluguel = await lancar({
    unidadeId: a.unidadeA,
    categoriaId: fixa,
    descricao: 'Aluguel da loja',
    valor: 250000,
    competencia: '2025-01',
    vencimento: '2025-01-31',
    pago: true,
    repetir: true,
  });
  internetB = await lancar({
    unidadeId: a.unidadeB,
    categoriaId: fixa,
    descricao: 'Internet da unidade B',
    valor: 15000,
    competencia: '2025-01',
  });
  // Variável não entra na cópia das fixas.
  await lancar({
    unidadeId: a.unidadeA,
    categoriaId: variavel,
    descricao: 'Lâminas',
    valor: 8000,
    competencia: '2025-01',
  });
});

afterAll(async () => {
  await a.remover();
  await app.close();
});

describe('copiar fixas do mês anterior', () => {
  it('prévia com as fixas e o vencimento no mês seguinte; copia com o valor editado, uma vez só', async () => {
    const previa = (await dono.get('/despesas/fixas-para-copiar?mes=2025-02').expect(200))
      .body as FixaParaCopiar[];
    expect(previa.map((f) => [f.descricao, f.vencimento, f.repetir, f.jaLancada])).toEqual([
      ['Aluguel da loja', '2025-02-28', true, false],
      ['Internet da unidade B', null, false, false],
    ]);

    // O gestor da unidade A não copia a despesa da unidade B.
    await gestor
      .post('/despesas/copiar-fixas', {
        mes: '2025-02',
        itens: [{ origemId: internetB, valor: 15000, vencimento: null }],
      })
      .expect(403);
    expect(
      (
        (await gestor.get('/despesas/fixas-para-copiar?mes=2025-02').expect(200))
          .body as FixaParaCopiar[]
      ).map((f) => f.descricao),
    ).toEqual(['Aluguel da loja']);

    const copiadas = (
      await dono
        .post('/despesas/copiar-fixas', {
          mes: '2025-02',
          itens: [{ origemId: aluguel, valor: 260000, vencimento: '2025-02-28' }],
        })
        .expect(201)
    ).body as DespesaDetalhe[];
    expect(copiadas).toEqual([
      expect.objectContaining({
        descricao: 'Aluguel da loja',
        valor: 260000,
        competencia: '2025-02',
        vencimento: '2025-02-28',
        pago: false,
        repetir: true,
      }),
    ]);

    // Já veio: sai da prévia, e copiar de novo não duplica (409).
    expect(
      (
        (await dono.get('/despesas/fixas-para-copiar?mes=2025-02').expect(200))
          .body as FixaParaCopiar[]
      ).map((f) => f.descricao),
    ).toEqual(['Internet da unidade B']);
    await dono
      .post('/despesas/copiar-fixas', {
        mes: '2025-02',
        itens: [{ origemId: aluguel, valor: 260000, vencimento: null }],
      })
      .expect(409);
    const fevereiro = (await dono.get('/despesas?mes=2025-02').expect(200))
      .body as DespesaDetalhe[];
    expect(fevereiro.filter((d) => d.descricao === 'Aluguel da loja')).toHaveLength(1);

    // Lançada à mão neste mês (sem a ligação da cópia): a prévia avisa, para não duplicar.
    await dono
      .post('/despesas', {
        unidadeId: a.unidadeB,
        categoriaId: fixa,
        descricao: 'Internet da unidade B',
        valor: 15000,
        competencia: '2025-02',
      })
      .expect(201);
    expect(
      (
        (await dono.get('/despesas/fixas-para-copiar?mes=2025-02').expect(200))
          .body as FixaParaCopiar[]
      ).map((f) => [f.descricao, f.jaLancada]),
    ).toEqual([['Internet da unidade B', true]]);

    // Só do mês anterior: a de janeiro não vai para março.
    await dono
      .post('/despesas/copiar-fixas', {
        mes: '2025-03',
        itens: [{ origemId: internetB, valor: 15000, vencimento: null }],
      })
      .expect(404);
  });
});
