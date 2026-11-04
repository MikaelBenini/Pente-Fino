// Resumo do dia e do mês para dono e gestor: o que tem para o dia, o que foi feito e por quem.
import type { INestApplication } from '@nestjs/common';
import { criarPrisma, naConta } from '@pente-fino/db';
import { dataLocal, type ResumoDoDia, type ResumoDoMes } from '@pente-fino/shared';
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
const amanha = (() => {
  const d = new Date(`${hoje}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
})();
const ids = { prof: '', profB: '', corte: '', aniversariante: '', falta: '' };

beforeAll(async () => {
  app = await criarApp();
  a = await criarCenario();
  b = await criarCenario();
  dono = await como(app, a.emails.dono);
  gestor = await como(app, a.emails.gestor);
  barbeiro = await como(app, a.emails.barbeiro);
  intruso = await como(app, b.emails.dono);

  await dono.patch(`/unidades/${a.unidadeA}`, { diasTrabalho: [0, 1, 2, 3, 4, 5, 6] }).expect(200);
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
  ids.corte = (
    await dono
      .post('/servicos', {
        nome: 'Corte',
        duracaoMin: 30,
        custoProduto: 0,
        ehExtra: false,
        pesoAtendimento: 1,
      })
      .expect(201)
  ).body.id;
  await dono
    .post('/precos', {
      vigenciaInicio: hoje,
      precos: [{ servicoId: ids.corte, unidadeId: a.unidadeA, valor: 5000 }],
    })
    .expect(201);

  // Hoje: um cliente sem horário, atendido e fechado.
  const avulso = (await dono.post('/clientes', { nome: 'Cliente da Casa' }).expect(201)).body.id;
  const c = (
    await dono
      .post('/comandas', {
        unidadeId: a.unidadeA,
        profissionalId: ids.prof,
        clienteId: avulso,
        servicoIds: [ids.corte],
      })
      .expect(201)
  ).body;
  await dono
    .post(`/comandas/${c.id}/fechar`, { pagamentos: [{ forma: 'pix', valor: 5000 }] })
    .expect(200);

  // Amanhã: um aniversariante na primeira vez às 10h e uma falta às 11h.
  ids.aniversariante = (
    await dono
      .post('/clientes', { nome: 'Aniversariante', aniversario: `1990-${amanha.slice(5)}` })
      .expect(201)
  ).body.id;
  const agendar = (inicio: string) =>
    dono
      .post('/agendamentos', {
        unidadeId: a.unidadeA,
        profissionalId: ids.prof,
        clienteId: ids.aniversariante,
        inicio: `${amanha}T${inicio}:00-03:00`,
        servicoIds: [ids.corte],
      })
      .expect(201);
  await agendar('10:00');
  // Falta só pode ser marcada depois do horário: grava direto, como se o dia já tivesse passado.
  const falta = (await agendar('11:00')).body as { agendamentoId: string; id: string };
  const prisma = criarPrisma();
  await naConta(prisma, a.contaId, async (tx) => {
    await tx.agendamento.update({ where: { id: falta.agendamentoId }, data: { status: 'falta' } });
    await tx.comanda.update({
      where: { id: falta.id },
      data: { status: 'cancelada', canceladaEm: new Date(), motivoCancelamento: 'Não veio' },
    });
  });
  await prisma.$disconnect();
});

afterAll(async () => {
  await a.remover();
  await b.remover();
  await app.close();
});

describe('resumo do dia', () => {
  it('hoje: o que já foi feito, por profissional', async () => {
    const r = (await dono.get(`/resumo/dia?data=${hoje}`).expect(200)).body as ResumoDoDia;
    expect(r.totais).toMatchObject({ fechadas: 1, faturamento: 5000, clientes: 1, comissao: 2000 });
    const p = r.profissionais.find((x) => x.profissionalId === ids.prof)!;
    expect(p).toMatchObject({ nome: 'Barbeiro Teste', faturamento: 5000 });
    expect(p.itens[0]).toMatchObject({
      cliente: 'Cliente da Casa',
      situacao: 'fechada',
      origem: 'sem_agendamento',
      servicos: ['Corte'],
      primeiraVez: true,
    });
  });

  it('amanhã: o que tem marcado, quem é novo, quem faz aniversário e quem faltou', async () => {
    const r = (await dono.get(`/resumo/dia?data=${amanha}&unidadeId=${a.unidadeA}`).expect(200))
      .body as ResumoDoDia;
    expect(r.totais).toMatchObject({
      marcados: 2,
      aAtender: 1,
      faltas: 1,
      valorEmAberto: 5000,
      primeiraVez: 2,
      aniversariantes: 2,
    });
    expect(r.totais.ocupacao.disponivelMin).toBeGreaterThan(0);
    const p = r.profissionais.find((x) => x.profissionalId === ids.prof)!;
    expect(p.proximo).toMatchObject({
      cliente: 'Aniversariante',
      situacao: 'a_atender',
      aniversario: true,
    });
    expect(p.itens.map((i) => i.situacao)).toEqual(['a_atender', 'faltou']);
    expect(r.profissionais.map((x) => x.profissionalId)).not.toContain(ids.profB);
  });

  it('filtro por profissional e por unidade', async () => {
    const r = (await dono.get(`/resumo/dia?data=${amanha}&profissionalId=${ids.prof}`).expect(200))
      .body as ResumoDoDia;
    expect(r.profissionais.map((p) => p.profissionalId)).toEqual([ids.prof]);
    await dono
      .get(`/resumo/dia?data=${amanha}&profissionalId=${ids.prof}&unidadeId=${a.unidadeB}`)
      .expect(400);
  });

  it('gestor só a unidade dele; barbeiro não abre; outra conta não vê nada', async () => {
    await gestor.get(`/resumo/dia?data=${hoje}`).expect(200);
    await gestor.get(`/resumo/dia?data=${hoje}&unidadeId=${a.unidadeB}`).expect(403);
    await gestor.get(`/resumo/dia?data=${hoje}&profissionalId=${ids.profB}`).expect(403);
    await barbeiro.get(`/resumo/dia?data=${hoje}`).expect(403);
    await intruso.get(`/resumo/dia?data=${hoje}&profissionalId=${ids.prof}`).expect(404);
    const vazio = (await intruso.get(`/resumo/dia?data=${hoje}`).expect(200)).body as ResumoDoDia;
    expect(JSON.stringify(vazio)).not.toContain('Cliente da Casa');
    await dono.get('/resumo/dia?data=amanha').expect(400);
  });
});

describe('resumo do mês', () => {
  it('uma linha por dia, com o fechado de hoje e a agenda de amanhã', async () => {
    const r = (
      await dono.get(`/resumo/mes?mes=${hoje.slice(0, 7)}&unidadeId=${a.unidadeA}`).expect(200)
    ).body as ResumoDoMes;
    const linhaHoje = r.dias.find((d) => d.data === hoje)!;
    expect(linhaHoje).toMatchObject({ trabalha: true, faturamento: 5000, clientes: 1 });
    expect(r.totais.faturamento).toBe(5000);
    expect(r.dias.length).toBeGreaterThanOrEqual(28);
    if (amanha.slice(0, 7) === hoje.slice(0, 7))
      expect(r.dias.find((d) => d.data === amanha)).toMatchObject({ agendados: 2, faltas: 1 });
    await dono.get(`/resumo/mes?mes=${hoje.slice(0, 7)}&profissionalId=${ids.profB}`).expect(200);
    await gestor.get(`/resumo/mes?mes=${hoje.slice(0, 7)}&unidadeId=${a.unidadeB}`).expect(403);
    await dono.get('/resumo/mes?mes=2026-13').expect(400);
  });
});
