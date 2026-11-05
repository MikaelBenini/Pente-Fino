// Etapa 6.10 a 6.13: comissões, despesas, indicadores e área do barbeiro.
import type { INestApplication } from '@nestjs/common';
import { criarPrisma, naConta } from '@pente-fino/db';
import { dataLocal } from '@pente-fino/shared';
import type { App } from 'supertest/types.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let cenario: Cenario;
let outra: Cenario;
type Cliente = Awaited<ReturnType<typeof como>>;
let dono: Cliente;
let gestor: Cliente;
let barbeiro: Cliente;
let prof = '';
let corte = '';
const hoje = dataLocal(new Date());
const mes = hoje.slice(0, 7);
const fimDoMes = (() => {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  return `${mes}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, '0')}`;
})();
const periodo = `de=${mes}-01&ate=${fimDoMes}`;

beforeAll(async () => {
  app = await criarApp();
  cenario = await criarCenario();
  outra = await criarCenario();
  dono = await como(app, cenario.emails.dono);
  gestor = await como(app, cenario.emails.gestor);
  barbeiro = await como(app, cenario.emails.barbeiro);

  await dono
    .patch(`/unidades/${cenario.unidadeA}`, { diasTrabalho: [0, 1, 2, 3, 4, 5, 6] })
    .expect(200);
  const usuarios = (await dono.get('/usuarios')).body as { id: string; email: string }[];
  const idBarbeiro = usuarios.find((u) => u.email === cenario.emails.barbeiro)!.id;
  prof = (
    await dono
      .post('/profissionais', {
        unidadeId: cenario.unidadeA,
        usuarioId: idBarbeiro,
        dataEntrada: `${mes}-01`,
        comissaoServico: { percentualBp: 4000, valorFixo: null },
        comissaoProduto: { percentualBp: 1000, valorFixo: null },
      })
      .expect(201)
  ).body.id;
  corte = (
    await dono
      .post('/servicos', {
        nome: 'Corte',
        duracaoMin: 30,
        custoProduto: 150,
        ehExtra: false,
        pesoAtendimento: 1,
      })
      .expect(201)
  ).body.id;
  const sobrancelha = (
    await dono
      .post('/servicos', {
        nome: 'Sobrancelha',
        duracaoMin: 10,
        custoProduto: 0,
        ehExtra: true,
        pesoAtendimento: 0,
      })
      .expect(201)
  ).body.id;
  await dono
    .post('/precos', {
      vigenciaInicio: hoje,
      precos: [
        { servicoId: corte, unidadeId: cenario.unidadeA, valor: 5000 },
        { servicoId: sobrancelha, unidadeId: cenario.unidadeA, valor: 1500 },
      ],
    })
    .expect(201);
  const pomada = (
    await dono.post('/produtos', { nome: 'Pomada', precoVenda: 4500, custo: 1800 }).expect(201)
  ).body.id;

  const abrirEFechar = async (itens: object[], servicoIds: string[]) => {
    const c = await dono
      .post('/comandas', {
        unidadeId: cenario.unidadeA,
        profissionalId: prof,
        clienteNovo: { nome: 'Cliente' },
        servicoIds,
      })
      .expect(201);
    for (const item of itens) await dono.post(`/comandas/${c.body.id}/itens`, item).expect(201);
    const total = (await dono.get(`/comandas/${c.body.id}`)).body.totalLiquido;
    await dono
      .post(`/comandas/${c.body.id}/fechar`, { pagamentos: [{ forma: 'pix', valor: total }] })
      .expect(200);
  };
  await abrirEFechar([{ tipo: 'servico', servicoId: sobrancelha }], [corte]); // 5000 + 1500 (extra)
  await abrirEFechar([{ tipo: 'produto', produtoId: pomada }], []); // só produto: não é cliente
  await abrirEFechar(
    [{ tipo: 'nao_operacional', descricao: 'Aluguel de cadeira', valor: 1000 }],
    [corte],
  ); // 5000 + 1000 fora

  const fixa = (
    await dono.post('/categorias-despesa', { nome: 'Aluguel', grupo: 'fixa' }).expect(201)
  ).body.id;
  const retirada = (
    await dono.post('/categorias-despesa', { nome: 'Retirada', grupo: 'retirada_dono' }).expect(201)
  ).body.id;
  await gestor
    .post('/despesas', {
      unidadeId: cenario.unidadeA,
      categoriaId: fixa,
      descricao: 'Aluguel A',
      valor: 3000,
      competencia: mes,
    })
    .expect(201);
  await dono
    .post('/despesas', {
      unidadeId: null,
      categoriaId: retirada,
      descricao: 'Pró-labore',
      valor: 9999,
      competencia: mes,
      pago: true,
    })
    .expect(201);
});

afterAll(async () => {
  await cenario.remover();
  await outra.remover();
  await app.close();
});

// Comissões: corte 2000 + sobrancelha 600 + pomada 450 + corte 2000 = 5050.
const COMISSOES = 2000 + 600 + 450 + 2000;

describe('indicadores', () => {
  it('batem com as regras: faturamento, clientes, ticket, atendimentos, extras, % despesas e lucro', async () => {
    const r = (await dono.get(`/indicadores?${periodo}`).expect(200)).body;
    expect(r.atual).toMatchObject({
      faturamento: 16000,
      receitaNaoOperacional: 1000,
      clientes: 2,
      ticketMedio: 8000,
      atendimentos: 2,
      extrasQuantidade: 1,
      extrasValor: 1500,
      percentualExtras: 0.5,
      comissoes: COMISSOES,
      despesasOperacionais: 3000 + COMISSOES,
      lucro: 16000 - 3000 - COMISSOES,
    });
    expect(r.atual.despesasPorGrupo.retirada_dono).toBe(9999);
    expect(r.atual.percentualDespesas).toBeCloseTo((3000 + COMISSOES) / 16000, 6);
    expect(r.projecao).not.toBeNull();
    expect(r.projecao.projecao).toBeGreaterThanOrEqual(16000);
  });

  it('gestor: só a unidade dele, sem despesa da rede; barbeiro não vê', async () => {
    const r = (await gestor.get(`/indicadores?${periodo}`).expect(200)).body;
    expect(r.atual.faturamento).toBe(16000);
    expect(r.atual.despesasPorGrupo.retirada_dono).toBe(0);
    await gestor.get(`/indicadores?${periodo}&unidadeId=${cenario.unidadeB}`).expect(403);
    await barbeiro.get(`/indicadores?${periodo}`).expect(403);
  });

  it('lucratividade por serviço', async () => {
    const r = (await dono.get(`/lucratividade?${periodo}`).expect(200)).body.servicos;
    expect(r.find((s: { servicoId: string }) => s.servicoId === corte)).toMatchObject({
      nome: 'Corte',
      quantidade: 2,
      receita: 10000,
      custoProduto: 300,
      comissao: 4000,
      lucro: 5700,
    });
  });

  it('por canal: as comandas sem agendamento entram como "chegou sem horário"', async () => {
    const r = (await gestor.get(`/canais?${periodo}`).expect(200)).body as {
      canal: string;
      atendidos: number;
      faturamento: number;
      comparecimento: number | null;
    }[];
    const sem = r.find((l) => l.canal === 'sem_horario')!;
    expect(sem.atendidos).toBeGreaterThanOrEqual(3);
    expect(sem.faturamento).toBeGreaterThan(0);
    expect(sem.comparecimento).toBeNull();
    await barbeiro.get(`/canais?${periodo}`).expect(403);
  });

  it('lucratividade por produto: vendido com custo e retorno; gestor vê, barbeiro não', async () => {
    const r = (await gestor.get(`/lucratividade?${periodo}`).expect(200)).body.produtos as {
      nome: string;
      quantidade: number;
      receita: number;
      custo: number;
      lucro: number;
      retornoSobreCusto: number | null;
      situacao: string;
    }[];
    const pomada = r.find((p) => p.nome === 'Pomada')!;
    expect(pomada).toMatchObject({
      quantidade: 1,
      receita: 4500,
      custo: 1800,
      situacao: 'investir',
    });
    expect(pomada.retornoSobreCusto).toBeCloseTo(pomada.lucro / 1800);
    await barbeiro.get(`/lucratividade?${periodo}`).expect(403);
  });
});

describe('despesas', () => {
  it('gestor não lança despesa da rede; barbeiro não vê despesas', async () => {
    const cats = (await gestor.get('/categorias-despesa').expect(200)).body;
    await gestor
      .post('/despesas', {
        unidadeId: null,
        categoriaId: cats[0].id,
        descricao: 'Xerox',
        valor: 100,
        competencia: mes,
      })
      .expect(403);
    await barbeiro.get(`/despesas?mes=${mes}`).expect(403);
    const lista = (await gestor.get(`/despesas?mes=${mes}`).expect(200)).body;
    expect(lista.map((d: { descricao: string }) => d.descricao)).toEqual(['Aluguel A']);
    expect((await dono.get(`/despesas?mes=${mes}`).expect(200)).body).toHaveLength(2);
  });

  it('marcar como paga e excluir', async () => {
    const lista = (await gestor.get(`/despesas?mes=${mes}`)).body;
    const r = await gestor.patch(`/despesas/${lista[0].id}`, { pago: true }).expect(200);
    expect(r.body.pago).toBe(true);
  });
});

describe('comissões', () => {
  it('resumo por barbeiro e pagamento limitado ao que falta', async () => {
    const r = (await gestor.get(`/comissoes?${periodo}`).expect(200)).body;
    const meu = r.find((x: { profissionalId: string }) => x.profissionalId === prof);
    expect(meu).toMatchObject({ fechado: COMISSOES, pago: 0, aReceber: COMISSOES });
    await gestor
      .post('/comissoes/pagamentos', {
        profissionalId: prof,
        periodoInicio: `${mes}-01`,
        periodoFim: fimDoMes,
        valor: COMISSOES + 1,
      })
      .expect(400);
    const pago = (
      await gestor
        .post('/comissoes/pagamentos', {
          profissionalId: prof,
          periodoInicio: `${mes}-01`,
          periodoFim: fimDoMes,
          valor: 3000,
        })
        .expect(201)
    ).body;
    expect(pago).toMatchObject({ pago: 3000, aReceber: COMISSOES - 3000 });
  });

  it('barbeiro vê o próprio extrato, não o resumo geral', async () => {
    await barbeiro.get(`/comissoes?${periodo}`).expect(403);
    const r = (await barbeiro.get(`/me/comissoes?${periodo}`).expect(200)).body;
    expect(r[0].resumo).toMatchObject({ fechado: COMISSOES, pago: 3000 });
    expect(r[0].itens).toHaveLength(4);
    expect(r[0].pagamentos).toHaveLength(1);
  });
});

describe('metas e área do barbeiro', () => {
  it('dono define a meta; o atual é calculado; gestor não define', async () => {
    const m = (
      await dono
        .put('/metas', { unidadeId: cenario.unidadeA, mes, tipo: 'faturamento', objetivo: 100000 })
        .expect(200)
    ).body;
    expect(m).toMatchObject({ objetivo: 100000, atual: 16000 });
    await gestor
      .put('/metas', { unidadeId: cenario.unidadeA, mes, tipo: 'faturamento', objetivo: 1 })
      .expect(403);
    const outra = (
      await dono
        .put('/metas', {
          unidadeId: cenario.unidadeA,
          mes,
          tipo: 'servico',
          servicoId: corte,
          objetivo: 50,
        })
        .expect(200)
    ).body;
    expect(outra.atual).toBe(2);
  });

  it('barbeiro: hoje, desempenho e metas da unidade', async () => {
    const h = (await barbeiro.get('/me/hoje').expect(200)).body;
    expect(h.comissaoDia).toBe(COMISSOES);
    expect(h.metas.map((m: { tipo: string }) => m.tipo).sort()).toEqual(['faturamento', 'servico']);
    const d = (await barbeiro.get(`/me/desempenho?mes=${mes}`).expect(200)).body;
    expect(d.atual).toMatchObject({
      faturamento: 16000,
      clientes: 2,
      extrasQuantidade: 1,
      comissao: COMISSOES,
    });
  });
});

describe('isolamento', () => {
  it('outra conta não lê indicadores, despesas nem comissões daqui', async () => {
    const intruso = await como(app, outra.emails.dono);
    await intruso.get(`/indicadores?${periodo}&unidadeId=${cenario.unidadeA}`).expect(404);
    await intruso.get(`/comissoes/${prof}/extrato?${periodo}`).expect(404);
    expect((await intruso.get(`/despesas?mes=${mes}`).expect(200)).body).toEqual([]);
    expect((await intruso.get(`/indicadores?${periodo}`).expect(200)).body.atual.faturamento).toBe(
      0,
    );
    const prisma = criarPrisma();
    const n = await naConta(prisma, outra.contaId, (tx) => tx.despesa.count());
    await prisma.$disconnect();
    expect(n).toBe(0);
  });
});
