// Receber adiantado, o sinal (painel A2, aprovado pelo dono em 11/11/2026): entra no caixa do dia
// em que foi recebido, abate do total ao fechar, fica na reabertura e, ao cancelar, é devolvido
// (sai do caixa no dia) ou retido (pode ser devolvido depois).
import type { INestApplication } from '@nestjs/common';
import { dataLocal, type CaixaDia, type ComandaDetalhe } from '@pente-fino/shared';
import type { App } from 'supertest/types.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let a: Cenario;
type Cliente = Awaited<ReturnType<typeof como>>;
let dono: Cliente;
let recepcao: Cliente;
let barbeiro: Cliente;
let corte = '';
let prof = '';
const hoje = dataLocal(new Date());

beforeAll(async () => {
  app = await criarApp();
  a = await criarCenario();
  dono = await como(app, a.emails.dono);
  recepcao = await como(app, a.emails.recepcao);
  barbeiro = await como(app, a.emails.barbeiro);
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
  const usuarios = (await dono.get('/usuarios')).body as { id: string; email: string }[];
  prof = (
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
});

afterAll(async () => {
  await a.remover();
  await app.close();
});

const abrir = async () =>
  (
    await recepcao
      .post('/comandas', {
        unidadeId: a.unidadeA,
        profissionalId: prof,
        clienteNovo: { nome: 'Cliente do sinal' },
        servicoIds: [corte],
      })
      .expect(201)
  ).body as ComandaDetalhe;
const caixa = async () =>
  (await recepcao.get(`/caixa?unidadeId=${a.unidadeA}&data=${hoje}`).expect(200)).body as CaixaDia;

describe('sinal', () => {
  it('entra no caixa do dia, abate do total ao fechar e fica na reabertura', async () => {
    const c = await abrir();
    // O cenário já abre o caixa do dia (a trava do caixa é a mesma do fechamento).
    await barbeiro.post(`/comandas/${c.id}/sinal`, { forma: 'pix', valor: 2000 }).expect(403);
    await recepcao.post(`/comandas/${c.id}/sinal`, { forma: 'pix', valor: 6000 }).expect(400);
    const comSinal = (
      await recepcao.post(`/comandas/${c.id}/sinal`, { forma: 'pix', valor: 2000 }).expect(201)
    ).body as ComandaDetalhe;
    expect(comSinal.sinais).toEqual([
      expect.objectContaining({ forma: 'pix', valor: 2000, devolvidoEm: null }),
    ]);
    expect(comSinal.aReceber).toBe(3000);
    let cx = await caixa();
    expect(cx.sinais).toEqual({ recebidos: 2000, devolvidos: 0 });
    expect(cx.totalRecebido).toBe(2000);
    expect(cx.aReceber.total).toBe(3000);

    // Fechar: os pagamentos cobrem só o resto; o caixa não conta o sinal duas vezes.
    await barbeiro.post(`/comandas/${c.id}/confirmar`).expect(200);
    const errado = await recepcao
      .post(`/comandas/${c.id}/fechar`, { pagamentos: [{ forma: 'pix', valor: 5000 }] })
      .expect(400);
    expect(JSON.stringify(errado.body)).toMatch(/já descontado o sinal/);
    await recepcao
      .post(`/comandas/${c.id}/fechar`, { pagamentos: [{ forma: 'dinheiro', valor: 3000 }] })
      .expect(200);
    cx = await caixa();
    expect(cx.totalRecebido).toBe(5000);
    expect(cx.porForma).toEqual([
      { forma: 'dinheiro', total: 3000, quantidade: 1 },
      { forma: 'pix', total: 2000, quantidade: 1 },
    ]);

    // Reabrir: o sinal continua abatendo do total.
    const reaberta = (
      await dono.post(`/comandas/${c.id}/reabrir`, { motivo: 'Lançou errado' }).expect(200)
    ).body as ComandaDetalhe;
    expect(reaberta.sinais).toHaveLength(1);
    expect(reaberta.aReceber).toBe(3000);
    expect(reaberta.pagamentos).toEqual([]);
  });

  it('cancelar devolvendo sai do caixa hoje; retido pode ser devolvido depois, uma vez', async () => {
    const devolver = await abrir();
    await recepcao
      .post(`/comandas/${devolver.id}/sinal`, { forma: 'dinheiro', valor: 1000 })
      .expect(201);
    const antes = await caixa();
    await recepcao
      .post(`/comandas/${devolver.id}/cancelar`, {
        motivo: 'Desistiu',
        falta: false,
        devolverSinal: true,
      })
      .expect(200);
    const depois = await caixa();
    expect(depois.sinais.devolvidos - antes.sinais.devolvidos).toBe(1000);
    expect(depois.dinheiroEsperado - antes.dinheiroEsperado).toBe(-1000);

    const reter = await abrir();
    const s = (
      await recepcao.post(`/comandas/${reter.id}/sinal`, { forma: 'pix', valor: 1500 }).expect(201)
    ).body as ComandaDetalhe;
    const cancelada = (
      await recepcao
        .post(`/comandas/${reter.id}/cancelar`, { motivo: 'Não veio', falta: true })
        .expect(200)
    ).body as ComandaDetalhe;
    expect(cancelada.sinais[0]!.devolvidoEm).toBeNull(); // retido
    const pid = s.sinais[0]!.id;
    await recepcao
      .post(`/comandas/${reter.id}/sinal/${pid}/devolver`, { motivo: 'Combinado com o cliente' })
      .expect(200);
    const outra = await recepcao
      .post(`/comandas/${reter.id}/sinal/${pid}/devolver`, { motivo: 'De novo' })
      .expect(400);
    expect(outra.body.erro).toMatchObject({ codigo: 'ja_devolvido' });
  });
});
