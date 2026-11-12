// Preço livre na comanda (pedido do dono em 11/11/2026): serviço de química com o valor digitado
// na comanda, dentro da faixa; o barbeiro só digita com a liberação do dono; tudo na auditoria.
import type { INestApplication } from '@nestjs/common';
import { criarPrisma, naConta, type PrismaClient } from '@pente-fino/db';
import { dataLocal, type ComandaDetalhe, type ServicoDetalhe } from '@pente-fino/shared';
import type { App } from 'supertest/types.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let a: Cenario;
let prisma: PrismaClient;
type Cliente = Awaited<ReturnType<typeof como>>;
let dono: Cliente;
let recepcao: Cliente;
let barbeiro: Cliente;
let quimica = '';
let corte = '';
let prof = '';
const hoje = dataLocal(new Date());

beforeAll(async () => {
  app = await criarApp();
  a = await criarCenario();
  prisma = criarPrisma(process.env.DATABASE_URL);
  dono = await como(app, a.emails.dono);
  recepcao = await como(app, a.emails.recepcao);
  barbeiro = await como(app, a.emails.barbeiro);
  const base = { duracaoMin: 60, custoProduto: 0, ehExtra: false, pesoAtendimento: 1 };
  corte = (await dono.post('/servicos', { ...base, nome: 'Corte' }).expect(201)).body.id;
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
  // Faixa ao contrário: recusada no cadastro.
  await dono
    .post('/servicos', {
      ...base,
      nome: 'Química errada',
      precoLivre: true,
      precoMinimo: 30000,
      precoMaximo: 10000,
    })
    .expect(400);
  const s = (
    await dono
      .post('/servicos', {
        ...base,
        nome: 'Química',
        precoLivre: true,
        precoMinimo: 8000,
        precoMaximo: 25000,
      })
      .expect(201)
  ).body as ServicoDetalhe;
  expect(s).toMatchObject({ precoLivre: true, precoMinimo: 8000, precoMaximo: 25000 });
  quimica = s.id;
  await dono
    .post('/precos', {
      vigenciaInicio: hoje,
      precos: [
        { servicoId: quimica, unidadeId: a.unidadeA, valor: 12000 },
        { servicoId: corte, unidadeId: a.unidadeA, valor: 5000 },
      ],
    })
    .expect(201);
});

afterAll(async () => {
  await prisma.$disconnect();
  await a.remover();
  await app.close();
});

describe('preço livre', () => {
  it('entra com o preço da tabela; o balcão troca dentro da faixa; o barbeiro só com a liberação', async () => {
    const c = (
      await recepcao
        .post('/comandas', {
          unidadeId: a.unidadeA,
          profissionalId: prof,
          clienteNovo: { nome: 'Cliente da Química' },
          servicoIds: [quimica],
        })
        .expect(201)
    ).body as ComandaDetalhe;
    const item = c.itens[0]!;
    expect(item).toMatchObject({
      precoUnitario: 12000,
      precoLivre: { minimo: 8000, maximo: 25000, podeAlterar: true },
    });

    // Barbeiro, sem a liberação: vê o preço livre, mas não troca.
    const vista = (await barbeiro.get(`/comandas/${c.id}`).expect(200)).body as ComandaDetalhe;
    expect(vista.itens[0]!.precoLivre?.podeAlterar).toBe(false);
    await barbeiro
      .patch(`/comandas/${c.id}/itens/${item.id}`, { precoUnitario: 15000 })
      .expect(403);

    // O dono libera; o barbeiro troca.
    await barbeiro.put('/servicos/preco-livre', { barbeiroDigita: true }).expect(403);
    await dono.put('/servicos/preco-livre', { barbeiroDigita: true }).expect(200);
    expect((await barbeiro.get('/servicos/preco-livre').expect(200)).body).toEqual({
      barbeiroDigita: true,
    });
    const liberada = (await barbeiro.get(`/comandas/${c.id}`).expect(200)).body as ComandaDetalhe;
    expect(liberada.itens[0]!.precoLivre?.podeAlterar).toBe(true);
    const trocada = (
      await barbeiro
        .patch(`/comandas/${c.id}/itens/${item.id}`, { precoUnitario: 18000 })
        .expect(200)
    ).body as ComandaDetalhe;
    expect(trocada.itens[0]!.precoUnitario).toBe(18000);
    expect(trocada.totalLiquido).toBe(18000);

    // Fora da faixa: recusado com o limite.
    const acima = await recepcao
      .patch(`/comandas/${c.id}/itens/${item.id}`, { precoUnitario: 30000 })
      .expect(400);
    expect(acima.body.erro).toMatchObject({ codigo: 'acima_do_maximo' });

    // Serviço de preço fixo não aceita outro valor (cobrar menos é desconto).
    const fixo = await recepcao
      .post(`/comandas/${c.id}/itens`, { tipo: 'servico', servicoId: corte, valor: 3000 })
      .expect(400);
    expect(fixo.body.erro).toMatchObject({ codigo: 'preco_fixo' });

    // Lançar já com o valor digitado.
    const outra = (
      await recepcao
        .post(`/comandas/${c.id}/itens`, { tipo: 'servico', servicoId: quimica, valor: 9000 })
        .expect(201)
    ).body as ComandaDetalhe;
    expect(outra.itens.map((i) => i.precoUnitario)).toEqual([18000, 9000]);

    // Fechar: a comissão sai do valor digitado (40%).
    await barbeiro.post(`/comandas/${c.id}/confirmar`).expect(200);
    const fechada = (
      await recepcao
        .post(`/comandas/${c.id}/fechar`, { pagamentos: [{ forma: 'pix', valor: 27000 }] })
        .expect(200)
    ).body as ComandaDetalhe;
    expect(fechada.itens.map((i) => i.comissaoValor)).toEqual([7200, 3600]);

    // Cada valor fora da tabela ficou na auditoria da comanda.
    const auditoria = await naConta(prisma, a.contaId, (tx) =>
      tx.auditoria.findMany({ where: { entidadeId: c.id, acao: 'preco_livre' } }),
    );
    expect(auditoria).toHaveLength(2);
    await dono.put('/servicos/preco-livre', { barbeiroDigita: false }).expect(200);
  });
});
