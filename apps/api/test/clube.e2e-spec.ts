// Etapa 13: clube da barbearia — planos por unidade e adesões dos clientes.
import type { INestApplication } from '@nestjs/common';
import { dataLocal, type AdesaoDetalhe, type ItemClubeDetalhe } from '@pente-fino/shared';
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
