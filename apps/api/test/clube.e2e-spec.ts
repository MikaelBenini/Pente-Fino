// Etapa 13: clube da barbearia — planos por unidade e adesões dos clientes.
import type { INestApplication } from '@nestjs/common';
import {
  dataLocal,
  type AdesaoDetalhe,
  type ComandaDetalhe,
  type ItemClubeDetalhe,
} from '@pente-fino/shared';
import type { App } from 'supertest/types.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let a: Cenario;
type Cliente = Awaited<ReturnType<typeof como>>;
let dono: Cliente;
let recepcao: Cliente;
let barbeiro: Cliente;
let corte = '';
let barba = '';
let planoId = '';
let clienteId = '';
const hoje = dataLocal(new Date());

beforeAll(async () => {
  app = await criarApp();
  a = await criarCenario();
  dono = await como(app, a.emails.dono);
  recepcao = await como(app, a.emails.recepcao);
  barbeiro = await como(app, a.emails.barbeiro);
  const servico = async (nome: string) =>
    (
      await dono
        .post('/servicos', {
          nome,
          duracaoMin: 30,
          custoProduto: 0,
          ehExtra: false,
          pesoAtendimento: 1,
        })
        .expect(201)
    ).body.id as string;
  corte = await servico('Corte');
  barba = await servico('Barba');
  clienteId = (
    await recepcao
      .post('/clientes', { nome: 'Assinante Teste', telefone: '11977003001' })
      .expect(201)
  ).body.id;
});

afterAll(async () => {
  await a.remover();
  await app.close();
});

describe('planos do clube', () => {
  const plano = () => ({
    unidadeId: a.unidadeA,
    tipo: 'assinatura',
    nome: 'Clube Corte',
    valor: 9990,
    limiteUsoMes: null,
    servicos: [
      { servicoId: corte, quantidade: 4, comissaoValorFixo: null },
      { servicoId: barba, quantidade: null, comissaoValorFixo: 1000 },
    ],
  });

  it('só o dono cadastra; serviço repetido e plano sem serviço são recusados', async () => {
    await recepcao.post('/clube/itens', plano()).expect(403);
    await dono
      .post('/clube/itens', { ...plano(), servicos: [plano().servicos[0], plano().servicos[0]] })
      .expect(400);
    await dono.post('/clube/itens', { ...plano(), servicos: [] }).expect(400);
    planoId = (await dono.post('/clube/itens', plano()).expect(201)).body.id;
    const itens = (await recepcao.get('/clube/itens').expect(200)).body as ItemClubeDetalhe[];
    expect(itens).toEqual([
      expect.objectContaining({
        id: planoId,
        nome: 'Clube Corte',
        valor: 9990,
        assinantes: 0,
        servicos: expect.arrayContaining([
          expect.objectContaining({ nome: 'Corte', quantidade: 4, comissaoValorFixo: null }),
          expect.objectContaining({ nome: 'Barba', quantidade: null, comissaoValorFixo: 1000 }),
        ]),
      }),
    ]);
    await barbeiro.get('/clube/itens').expect(403);
  });

  it('editar troca os serviços; o plano não muda de unidade', async () => {
    await dono.put(`/clube/itens/${planoId}`, { ...plano(), unidadeId: a.unidadeB }).expect(400);
    await dono
      .put(`/clube/itens/${planoId}`, { ...plano(), limiteUsoMes: 6, nome: 'Clube Corte e Barba' })
      .expect(204);
    const [p] = (await dono.get('/clube/itens').expect(200)).body as ItemClubeDetalhe[];
    expect(p).toMatchObject({ nome: 'Clube Corte e Barba', limiteUsoMes: 6 });
  });
});

describe('adesões', () => {
  it('a recepção coloca o cliente no plano; vence um mês depois; um plano ativo por vez', async () => {
    await recepcao
      .post('/clube/adesoes', { clienteId, itemClubeId: planoId, inicio: hoje })
      .expect(201);
    await recepcao
      .post('/clube/adesoes', { clienteId, itemClubeId: planoId, inicio: hoje })
      .expect(409);
    const ficha = (await barbeiro.get(`/clube/cliente/${clienteId}`).expect(200)).body
      .adesao as AdesaoDetalhe;
    expect(ficha).toMatchObject({
      situacao: 'ativa',
      inicio: hoje,
      usosNoCiclo: 0,
      plano: { nome: 'Clube Corte e Barba', valor: 9990 },
    });
    expect(ficha.vencimento > hoje).toBe(true);
    expect(ficha.restantes).toEqual(
      expect.arrayContaining([
        { servicoId: corte, servico: 'Corte', restam: 4 },
        { servicoId: barba, servico: 'Barba', restam: 6 },
      ]),
    );
    const lista = (await recepcao.get('/clube/adesoes').expect(200)).body as AdesaoDetalhe[];
    expect(lista.map((x) => x.cliente.id)).toContain(clienteId);
    expect(
      ((await dono.get('/clube/itens').expect(200)).body as ItemClubeDetalhe[])[0]!.assinantes,
    ).toBe(1);
  });

  it('cancelar pede motivo; cancelada some das ativas e o cliente pode entrar de novo', async () => {
    const [ad] = (await recepcao.get('/clube/adesoes').expect(200)).body as AdesaoDetalhe[];
    await recepcao.post(`/clube/adesoes/${ad!.id}/cancelar`, { motivo: 'x' }).expect(400);
    await recepcao
      .post(`/clube/adesoes/${ad!.id}/cancelar`, { motivo: 'Mudou de cidade' })
      .expect(204);
    expect((await recepcao.get(`/clube/cliente/${clienteId}`).expect(200)).body).toEqual({
      adesao: null,
    });
    const canceladas = (await recepcao.get('/clube/adesoes?situacao=cancelada').expect(200))
      .body as AdesaoDetalhe[];
    expect(canceladas[0]).toMatchObject({ situacao: 'cancelada' });
    await recepcao
      .post('/clube/adesoes', { clienteId, itemClubeId: planoId, inicio: hoje })
      .expect(201);
  });
});

describe('clube na comanda', () => {
  let prof = '';
  let assinante = '';
  const comanda = async (clienteId: string, servicoIds: string[], unidadeId = a.unidadeA) =>
    (
      await dono
        .post('/comandas', { unidadeId, profissionalId: prof, clienteId, servicoIds })
        .expect(201)
    ).body as ComandaDetalhe;

  beforeAll(async () => {
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
    await dono
      .post('/precos', {
        vigenciaInicio: hoje,
        precos: [
          { servicoId: corte, unidadeId: a.unidadeA, valor: 5000 },
          { servicoId: barba, unidadeId: a.unidadeA, valor: 3000 },
        ],
      })
      .expect(201);
    const plano = (
      await dono
        .post('/clube/itens', {
          unidadeId: a.unidadeA,
          tipo: 'assinatura',
          nome: 'Clube Comanda',
          valor: 8000,
          limiteUsoMes: null,
          servicos: [
            { servicoId: corte, quantidade: 2, comissaoValorFixo: null },
            { servicoId: barba, quantidade: null, comissaoValorFixo: 1000 },
          ],
        })
        .expect(201)
    ).body.id;
    assinante = (
      await recepcao
        .post('/clientes', { nome: 'Assinante Comanda', telefone: '11977003002' })
        .expect(201)
    ).body.id;
    await recepcao
      .post('/clube/adesoes', { clienteId: assinante, itemClubeId: plano, inicio: hoje })
      .expect(201);
  });

  it('o plano cobre até o limite; o que passa entra com preço normal; comissão do clube ao fechar', async () => {
    const c1 = await comanda(assinante, [corte, barba]);
    expect(c1.itens.map((i) => [i.descricao, i.precoUnitario, i.cobertoClube])).toEqual([
      ['Corte', 0, true],
      ['Barba', 0, true],
    ]);
    expect(c1.totalLiquido).toBe(0);
    const c2 = await comanda(assinante, [corte]);
    expect(c2.itens[0]).toMatchObject({ precoUnitario: 0, cobertoClube: true });
    // Terceiro corte no mês: acima do limite (2), preço normal.
    const c3 = await comanda(assinante, [corte]);
    expect(c3.itens[0]).toMatchObject({ precoUnitario: 5000, cobertoClube: false });
    expect(c3.totalLiquido).toBe(5000);

    // Fecha a comanda toda coberta sem pagamento; comissão: 40% da tabela (2000) e fixa (1000).
    const fechada = (await dono.post(`/comandas/${c1.id}/fechar`, { pagamentos: [] }).expect(200))
      .body as ComandaDetalhe;
    expect(fechada.itens.map((i) => [i.descricao, i.comissaoValor])).toEqual([
      ['Corte', 2000],
      ['Barba', 1000],
    ]);

    const ficha = (await recepcao.get(`/clube/cliente/${assinante}`).expect(200)).body
      .adesao as AdesaoDetalhe;
    expect(ficha.usosNoCiclo).toBe(3);
    expect(ficha.restantes.find((r) => r.servicoId === corte)?.restam).toBe(0);

    // Cancelar a segunda comanda devolve o uso.
    await dono
      .post(`/comandas/${c2.id}/cancelar`, { motivo: 'Desistiu', falta: false })
      .expect(200);
    const depois = (await recepcao.get(`/clube/cliente/${assinante}`).expect(200)).body
      .adesao as AdesaoDetalhe;
    expect(depois.restantes.find((r) => r.servicoId === corte)?.restam).toBe(1);
  });

  it('fora da unidade do plano, o plano não cobre', async () => {
    await dono
      .post('/precos', {
        vigenciaInicio: hoje,
        precos: [{ servicoId: barba, unidadeId: a.unidadeB, valor: 3000 }],
      })
      .expect(201);
    const usuarios = (await dono.get('/usuarios')).body as { id: string; email: string }[];
    const profB = (
      await dono
        .post('/profissionais', {
          unidadeId: a.unidadeB,
          usuarioId: usuarios.find((u) => u.email === a.emails.gestor)!.id,
          dataEntrada: `${hoje.slice(0, 7)}-01`,
          comissaoServico: { percentualBp: 4000, valorFixo: null },
          comissaoProduto: { percentualBp: 1000, valorFixo: null },
        })
        .expect(201)
    ).body.id;
    const c = (
      await dono
        .post('/comandas', {
          unidadeId: a.unidadeB,
          profissionalId: profB,
          clienteId: assinante,
          servicoIds: [barba],
        })
        .expect(201)
    ).body as ComandaDetalhe;
    expect(c.itens[0]).toMatchObject({ precoUnitario: 3000, cobertoClube: false });
  });
});
