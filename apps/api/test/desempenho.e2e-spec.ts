// Etapa 9: ficha do profissional e ranking da equipe, com as permissões de cada papel.
import type { INestApplication } from '@nestjs/common';
import { criarPrisma, naConta } from '@pente-fino/db';
import { dataLocal, type FichaProfissional, type LinhaRankingEquipe } from '@pente-fino/shared';
import { randomUUID } from 'node:crypto';
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
const hoje = dataLocal(new Date());
const ids = { prof: '', profB: '', corte: '', barba: '', fiel: '', novo: '', reaberta: '' };
const periodo = `de=${hoje}&ate=${hoje}`;

function diasAtras(n: number) {
  const d = new Date(`${hoje}T15:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

beforeAll(async () => {
  app = await criarApp();
  a = await criarCenario();
  b = await criarCenario();
  dono = await como(app, a.emails.dono);
  gestor = await como(app, a.emails.gestor);
  barbeiro = await como(app, a.emails.barbeiro);
  intruso = await como(app, b.emails.dono);

  const usuarios = (await dono.get('/usuarios')).body as { id: string; email: string }[];
  const regra = { percentualBp: 4000, valorFixo: null };
  ids.prof = (
    await dono
      .post('/profissionais', {
        unidadeId: a.unidadeA,
        usuarioId: usuarios.find((u) => u.email === a.emails.barbeiro)!.id,
        dataEntrada: '2025-01-01',
        comissaoServico: regra,
        comissaoProduto: regra,
      })
      .expect(201)
  ).body.id;
  ids.profB = (
    await dono
      .post('/profissionais', {
        unidadeId: a.unidadeB,
        nome: 'Barbeiro da B',
        email: `b-${randomUUID().slice(0, 8)}@e2e.pentefino.dev`,
        dataEntrada: '2025-01-01',
        comissaoServico: regra,
        comissaoProduto: regra,
      })
      .expect(201)
  ).body.id;
  const servico = async (nome: string, ehExtra: boolean) =>
    (
      await dono
        .post('/servicos', {
          nome,
          duracaoMin: 30,
          custoProduto: 300,
          ehExtra,
          pesoAtendimento: ehExtra ? 0 : 1,
        })
        .expect(201)
    ).body.id as string;
  ids.corte = await servico('Corte', false);
  ids.barba = await servico('Barba', true);
  await dono
    .post('/precos', {
      vigenciaInicio: hoje,
      precos: [
        { servicoId: ids.corte, unidadeId: a.unidadeA, valor: 5000 },
        { servicoId: ids.barba, unidadeId: a.unidadeA, valor: 3000 },
      ],
    })
    .expect(201);
  ids.fiel = (await dono.post('/clientes', { nome: 'Cliente Fiel' }).expect(201)).body.id;
  ids.novo = (await dono.post('/clientes', { nome: 'Cliente Novo' }).expect(201)).body.id;

  const comanda = async (clienteId: string, servicoIds: string[]) =>
    (
      await dono
        .post('/comandas', {
          unidadeId: a.unidadeA,
          profissionalId: ids.prof,
          clienteId,
          servicoIds,
        })
        .expect(201)
    ).body as { id: string; totalLiquido: number };
  const fechar = (c: { id: string; totalLiquido: number }) =>
    dono
      .post(`/comandas/${c.id}/fechar`, { pagamentos: [{ forma: 'pix', valor: c.totalLiquido }] })
      .expect(200);

  // Fiel: veio há 20 dias e hoje (corte + barba, confirmada pelo barbeiro).
  const antiga = await comanda(ids.fiel, [ids.corte]);
  await fechar(antiga);
  const hojeFiel = await comanda(ids.fiel, [ids.corte, ids.barba]);
  await barbeiro.post(`/comandas/${hojeFiel.id}/confirmar`).expect(200);
  await fechar(hojeFiel);
  // Novo: primeira vez, fechada pela recepção sem confirmação.
  await fechar(await comanda(ids.novo, [ids.corte]));
  // Uma reaberta: sai do faturamento, mas aparece na lista marcada.
  const reaberta = await comanda(ids.novo, [ids.corte]);
  await fechar(reaberta);
  ids.reaberta = reaberta.id;
  await dono
    .post(`/comandas/${reaberta.id}/reabrir`, { motivo: 'Valor lançado errado' })
    .expect(200);

  const prisma = criarPrisma();
  await naConta(prisma, a.contaId, (tx) =>
    tx.comanda.update({ where: { id: antiga.id }, data: { fechadaEm: diasAtras(20) } }),
  );
  await prisma.$disconnect();
});

afterAll(async () => {
  await a.remover();
  await b.remover();
  await app.close();
});

describe('ficha do profissional', () => {
  it('dono vê números, serviços, clientes, rotina, comandas e margem', async () => {
    const f = (await dono.get(`/profissionais/${ids.prof}/desempenho?${periodo}`).expect(200))
      .body as FichaProfissional;
    expect(f.profissional).toMatchObject({ id: ids.prof, nome: 'Barbeiro Teste', ativo: true });
    expect(f.verMargem).toBe(true);
    expect(f.resumo).toMatchObject({
      faturamento: 13000,
      clientes: 2,
      atendimentos: 2,
      extrasQuantidade: 1,
      ticketMedio: 6500,
      comissao: 5200,
    });
    expect(f.comissao.fechado).toBe(5200);
    const corte = f.servicos.find((s) => s.nome === 'Corte')!;
    expect(corte).toMatchObject({
      quantidade: 2,
      receita: 10000,
      custo: 600,
      lucro: 10000 - 600 - 4000,
    });
    expect(f.servicos.find((s) => s.nome === 'Barba')).toMatchObject({ comoExtra: 1 });
    expect(f.clientes.resumo).toMatchObject({
      atendidos: 2,
      novos: 1,
      voltaramNoPrazo: 1,
      taxaRetorno: 0.5,
      intervaloMedioDias: 20,
    });
    expect(f.clientes.lista.map((c) => c.nome).sort()).toEqual(['Cliente Fiel', 'Cliente Novo']);
    expect(f.rotina).toMatchObject({ comandas: 2, confirmadasPeloBarbeiro: 1 });
    const linha = f.comandas.find((c) => c.id === ids.reaberta)!;
    expect(linha).toMatchObject({ status: 'reaberta', reaberta: true, cliente: 'Cliente Novo' });
    expect(f.comandas.length).toBe(3); // a de 20 dias atrás fica fora do período
    expect(f.evolucao).toHaveLength(6);
    expect(f.evolucao[5]!.mes).toBe(hoje.slice(0, 7));
    expect(f.media).not.toBeNull();
    expect(f.ocupacao.fracao).toBeGreaterThanOrEqual(0);
    expect(f.avaliacoes).toBeNull();
  });

  it('o próprio barbeiro vê a ficha dele, sem custo, margem nem média dos colegas', async () => {
    const f = (await barbeiro.get(`/profissionais/${ids.prof}/desempenho?${periodo}`).expect(200))
      .body as FichaProfissional;
    expect(f.verMargem).toBe(false);
    expect(f.media).toBeNull();
    expect(f.clientes.sumidos.every((c) => c.telefone === null)).toBe(true);
    expect(f.servicos.every((s) => s.custo === null && s.lucro === null)).toBe(true);
    expect(f.resumo.faturamento).toBe(13000);
  });

  it('barbeiro não abre a ficha de outro; gestor não abre a de outra unidade', async () => {
    await barbeiro.get(`/profissionais/${ids.profB}/desempenho?${periodo}`).expect(403);
    await gestor.get(`/profissionais/${ids.profB}/desempenho?${periodo}`).expect(403);
    const f = (await gestor.get(`/profissionais/${ids.prof}/desempenho?${periodo}`).expect(200))
      .body as FichaProfissional;
    expect(f.verMargem).toBe(false);
    expect(f.media).not.toBeNull();
  });

  it('outra conta recebe 404 e o período é conferido', async () => {
    await intruso.get(`/profissionais/${ids.prof}/desempenho?${periodo}`).expect(404);
    await dono.get(`/profissionais/${ids.prof}/desempenho?de=${hoje}&ate=2020-01-01`).expect(400);
    await dono
      .get(`/profissionais/${ids.prof}/desempenho?de=2024-01-01&ate=2026-12-31`)
      .expect(400);
  });
});

describe('ranking da equipe', () => {
  it('dono vê a rede ordenada por faturamento; gestor só a unidade dele', async () => {
    const rede = (await dono.get(`/profissionais/desempenho?${periodo}`).expect(200))
      .body as LinhaRankingEquipe[];
    expect(rede[0]).toMatchObject({
      profissionalId: ids.prof,
      faturamento: 13000,
      taxaRetorno: 0.5,
    });
    expect(rede.map((l) => l.profissionalId)).toContain(ids.profB);
    const daUnidade = (await gestor.get(`/profissionais/desempenho?${periodo}`).expect(200))
      .body as LinhaRankingEquipe[];
    expect(daUnidade.map((l) => l.profissionalId)).toEqual([ids.prof]);
    await gestor.get(`/profissionais/desempenho?${periodo}&unidadeId=${a.unidadeB}`).expect(403);
  });
});
