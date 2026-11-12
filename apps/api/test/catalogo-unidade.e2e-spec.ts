// Catálogo por unidade (pedido do dono em 12/11/2026): cada serviço e produto diz em quais
// unidades está. Unidade nova começa vazia e copia o catálogo de outra; o que não está na unidade
// não entra na comanda nem no plano do clube.
import type { INestApplication } from '@nestjs/common';
import {
  dataLocal,
  type ComandaDetalhe,
  type ProdutoDetalhe,
  type ServicoDetalhe,
  type TabelaPrecos,
} from '@pente-fino/shared';
import type { App } from 'supertest/types.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let a: Cenario;
type Cliente = Awaited<ReturnType<typeof como>>;
let dono: Cliente;
let prof = '';
const hoje = dataLocal(new Date());
const base = { duracaoMin: 30, custoProduto: 0, ehExtra: false, pesoAtendimento: 1 };

beforeAll(async () => {
  app = await criarApp();
  a = await criarCenario();
  dono = await como(app, a.emails.dono);
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

describe('catálogo por unidade', () => {
  it('serviço e produto só da unidade B não entram na comanda nem no plano da unidade A', async () => {
    // Sem a lista, vale para todas as unidades de hoje (A e B).
    const geral = (await dono.post('/servicos', { ...base, nome: 'Corte' }).expect(201))
      .body as ServicoDetalhe;
    expect(geral.unidadeIds.sort()).toEqual([a.unidadeA, a.unidadeB].sort());
    const soB = (
      await dono
        .post('/servicos', { ...base, nome: 'Só na B', unidadeIds: [a.unidadeB] })
        .expect(201)
    ).body as ServicoDetalhe;
    expect(soB.unidadeIds).toEqual([a.unidadeB]);
    const produtoB = (
      await dono
        .post('/produtos', {
          nome: 'Pomada da B',
          precoVenda: 3000,
          custo: 1000,
          unidadeIds: [a.unidadeB],
        })
        .expect(201)
    ).body as ProdutoDetalhe;
    await dono
      .post('/precos', {
        vigenciaInicio: hoje,
        precos: [
          { servicoId: geral.id, unidadeId: a.unidadeA, valor: 5000 },
          { servicoId: soB.id, unidadeId: a.unidadeB, valor: 7000 },
        ],
      })
      .expect(201);

    const c = (
      await dono
        .post('/comandas', {
          unidadeId: a.unidadeA,
          profissionalId: prof,
          clienteNovo: { nome: 'Cliente da A' },
          servicoIds: [geral.id],
        })
        .expect(201)
    ).body as ComandaDetalhe;
    const servico = await dono
      .post(`/comandas/${c.id}/itens`, { tipo: 'servico', servicoId: soB.id })
      .expect(400);
    expect(servico.body.erro).toMatchObject({ codigo: 'fora_da_unidade' });
    const produto = await dono
      .post(`/comandas/${c.id}/itens`, { tipo: 'produto', produtoId: produtoB.id })
      .expect(400);
    expect(produto.body.erro).toMatchObject({ codigo: 'fora_da_unidade' });

    await dono
      .post('/clube/itens', {
        unidadeId: a.unidadeA,
        tipo: 'assinatura',
        nome: 'Plano com serviço da B',
        valor: 8000,
        limiteUsoMes: null,
        servicos: [{ servicoId: soB.id, quantidade: 1, comissaoValorFixo: null }],
      })
      .expect(400);

    // Preço gravado na unidade A põe o serviço nela; aí entra na comanda.
    await dono
      .post('/precos', {
        vigenciaInicio: hoje,
        precos: [{ servicoId: soB.id, unidadeId: a.unidadeA, valor: 7500 }],
      })
      .expect(201);
    const lista = (await dono.get('/servicos').expect(200)).body as ServicoDetalhe[];
    expect(lista.find((s) => s.id === soB.id)?.unidadeIds.sort()).toEqual(
      [a.unidadeA, a.unidadeB].sort(),
    );
    await dono.post(`/comandas/${c.id}/itens`, { tipo: 'servico', servicoId: soB.id }).expect(201);
  });

  it('unidade nova começa vazia e copia o catálogo de outra, com os preços de hoje', async () => {
    const nova = (
      await dono
        .post('/unidades', {
          nome: 'Unidade Nova',
          diasTrabalho: [1, 2, 3, 4, 5, 6],
          capacidade: 2,
        })
        .expect(201)
    ).body as { id: string };
    const servicos = (await dono.get('/servicos').expect(200)).body as ServicoDetalhe[];
    expect(servicos.some((s) => s.unidadeIds.includes(nova.id))).toBe(false);

    await dono.post(`/unidades/${nova.id}/copiar-catalogo`, { deUnidadeId: nova.id }).expect(400);
    const r = (
      await dono
        .post(`/unidades/${nova.id}/copiar-catalogo`, { deUnidadeId: a.unidadeB })
        .expect(200)
    ).body as { servicos: number; produtos: number; precos: number };
    // Da B: Corte (sem preço na B), "Só na B" (R$ 70,00) e a pomada.
    expect(r).toEqual({ servicos: 2, produtos: 1, precos: 1 });
    const depois = (await dono.get('/servicos').expect(200)).body as ServicoDetalhe[];
    expect(
      depois
        .filter((s) => s.unidadeIds.includes(nova.id))
        .map((s) => s.nome)
        .sort(),
    ).toEqual(['Corte', 'Só na B']);
    const tabela = (await dono.get('/precos').expect(200)).body as TabelaPrecos;
    expect(tabela.vigentes.find((p) => p.unidadeId === nova.id)?.valor).toBe(7000);
    const produtos = (await dono.get('/produtos').expect(200)).body as ProdutoDetalhe[];
    expect(produtos.find((p) => p.nome === 'Pomada da B')?.unidadeIds).toContain(nova.id);
  });
});
