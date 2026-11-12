// Preço por barbeiro (detalhe do dono em 12/11/2026): o barbeiro muda o próprio preço no perfil;
// vale na comanda dele e quando marcam com ele; vazio volta para o da unidade.
import type { INestApplication } from '@nestjs/common';
import { dataLocal, type ComandaDetalhe, type MeuPreco } from '@pente-fino/shared';
import type { App } from 'supertest/types.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let a: Cenario;
type Cliente = Awaited<ReturnType<typeof como>>;
let dono: Cliente;
let recepcao: Cliente;
let barbeiro: Cliente;
let gestor: Cliente;
let corte = '';
let prof = '';
let profGestor = '';
const hoje = dataLocal(new Date());

beforeAll(async () => {
  app = await criarApp();
  a = await criarCenario();
  dono = await como(app, a.emails.dono);
  recepcao = await como(app, a.emails.recepcao);
  barbeiro = await como(app, a.emails.barbeiro);
  gestor = await como(app, a.emails.gestor);
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
  const profissional = async (email: string) =>
    (
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
  prof = await profissional(a.emails.barbeiro);
  // O gestor também atende: é outro barbeiro, com o preço da unidade.
  profGestor = await profissional(a.emails.gestor);
});

afterAll(async () => {
  await a.remover();
  await app.close();
});

const abrir = async (profissionalId: string) =>
  (
    await recepcao
      .post('/comandas', {
        unidadeId: a.unidadeA,
        profissionalId,
        clienteNovo: { nome: 'Cliente' },
        servicoIds: [corte],
      })
      .expect(201)
  ).body as ComandaDetalhe;

describe('preço por barbeiro', () => {
  it('o barbeiro muda o próprio preço; vale na comanda dele; o outro segue a unidade', async () => {
    const antes = (await barbeiro.get('/me/precos').expect(200)).body as MeuPreco[];
    expect(antes).toEqual([
      expect.objectContaining({
        profissionalId: prof,
        servico: 'Corte',
        precoUnidade: 5000,
        meuPreco: null,
      }),
    ]);
    // Quem não atende como profissional não tem preço para mudar.
    expect((await recepcao.get('/me/precos').expect(200)).body).toEqual([]);

    const depois = (
      await barbeiro
        .put('/me/precos', { precos: [{ profissionalId: prof, servicoId: corte, valor: 6000 }] })
        .expect(200)
    ).body as MeuPreco[];
    expect(depois[0]).toMatchObject({ meuPreco: 6000, precoUnidade: 5000 });

    // Ninguém muda o preço de outro barbeiro.
    await gestor
      .put('/me/precos', { precos: [{ profissionalId: prof, servicoId: corte, valor: 1000 }] })
      .expect(403);

    expect((await abrir(prof)).itens[0]!.precoUnitario).toBe(6000);
    expect((await abrir(profGestor)).itens[0]!.precoUnitario).toBe(5000);

    // Vazio: volta para o preço da unidade (de hoje em diante).
    await barbeiro
      .put('/me/precos', { precos: [{ profissionalId: prof, servicoId: corte, valor: null }] })
      .expect(200);
    expect((await abrir(prof)).itens[0]!.precoUnitario).toBe(5000);
  });
});
