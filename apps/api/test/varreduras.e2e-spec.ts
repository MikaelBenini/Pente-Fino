// Etapa 7: isolamento rota por rota, matriz de permissões por papel e o "dia 31" da planilha.
import type { INestApplication } from '@nestjs/common';
import { criarPrisma, naConta } from '@pente-fino/db';
import { dataLocal } from '@pente-fino/shared';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let a: Cenario;
let b: Cenario;
type Cliente = Awaited<ReturnType<typeof como>>;
let donoA: Cliente;
let gestorA: Cliente;
let barbeiroA: Cliente;
let recepcaoA: Cliente;
let intruso: Cliente;
const ids = {
  usuarioBarbeiro: '',
  prof: '',
  servico: '',
  cliente: '',
  comanda: '',
  comandaFechada: '',
  agendamento: '',
  despesa: '',
  meta: '',
};
const hoje = dataLocal(new Date());
const mes = hoje.slice(0, 7);
const SENTINELA = `Cliente Sigiloso ${randomUUID().slice(0, 6)}`;

beforeAll(async () => {
  app = await criarApp();
  a = await criarCenario();
  b = await criarCenario();
  donoA = await como(app, a.emails.dono);
  gestorA = await como(app, a.emails.gestor);
  barbeiroA = await como(app, a.emails.barbeiro);
  intruso = await como(app, b.emails.dono);

  await donoA.patch(`/unidades/${a.unidadeA}`, { diasTrabalho: [0, 1, 2, 3, 4, 5, 6] }).expect(200);
  const usuarios = (await donoA.get('/usuarios')).body as { id: string; email: string }[];
  ids.usuarioBarbeiro = usuarios.find((u) => u.email === a.emails.barbeiro)!.id;
  ids.prof = (
    await donoA
      .post('/profissionais', {
        unidadeId: a.unidadeA,
        usuarioId: ids.usuarioBarbeiro,
        dataEntrada: '2026-01-01',
        comissaoServico: { percentualBp: 4000, valorFixo: null },
        comissaoProduto: { percentualBp: 1000, valorFixo: null },
      })
      .expect(201)
  ).body.id;
  ids.servico = (
    await donoA
      .post('/servicos', {
        nome: 'Corte',
        duracaoMin: 30,
        custoProduto: 0,
        ehExtra: false,
        pesoAtendimento: 1,
      })
      .expect(201)
  ).body.id;
  await donoA
    .post('/precos', {
      vigenciaInicio: hoje,
      precos: [{ servicoId: ids.servico, unidadeId: a.unidadeA, valor: 5000 }],
    })
    .expect(201);
  ids.cliente = (
    await donoA.post('/clientes', { nome: SENTINELA, telefone: '11955554444' }).expect(201)
  ).body.id;
  const c = await donoA
    .post('/comandas', {
      unidadeId: a.unidadeA,
      profissionalId: ids.prof,
      clienteId: ids.cliente,
      servicoIds: [ids.servico],
    })
    .expect(201);
  ids.comanda = c.body.id;
  ids.comandaFechada = (
    await donoA
      .post('/comandas', {
        unidadeId: a.unidadeA,
        profissionalId: ids.prof,
        clienteId: ids.cliente,
        servicoIds: [ids.servico],
      })
      .expect(201)
  ).body.id;
  await donoA
    .post(`/comandas/${ids.comandaFechada}/fechar`, { pagamentos: [{ forma: 'pix', valor: 5000 }] })
    .expect(200);
  const amanha = (() => {
    const d = new Date(`${hoje}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  })();
  ids.agendamento = (
    await donoA
      .post('/agendamentos', {
        unidadeId: a.unidadeA,
        profissionalId: ids.prof,
        clienteId: ids.cliente,
        inicio: `${amanha}T10:00:00-03:00`,
        servicoIds: [ids.servico],
      })
      .expect(201)
  ).body.agendamentoId;
  const cat = (
    await donoA.post('/categorias-despesa', { nome: 'Aluguel', grupo: 'fixa' }).expect(201)
  ).body.id;
  ids.despesa = (
    await donoA
      .post('/despesas', {
        unidadeId: a.unidadeA,
        categoriaId: cat,
        descricao: 'Aluguel sigiloso',
        valor: 300000,
        competencia: mes,
      })
      .expect(201)
  ).body.id;
  ids.meta = (
    await donoA
      .put('/metas', { unidadeId: a.unidadeA, mes, tipo: 'faturamento', objetivo: 100000 })
      .expect(200)
  ).body.id;

  const email = `recep-${randomUUID().slice(0, 8)}@e2e.pentefino.dev`;
  const convite = await donoA
    .post('/usuarios/convites', {
      nome: 'Recepção A',
      email,
      papel: 'recepcao',
      unidadeId: a.unidadeA,
    })
    .expect(201);
  await request(app.getHttpServer())
    .post('/auth/convite')
    .send({
      token: new URL(convite.body.linkConvite).searchParams.get('token'),
      senha: 'senha-recepcao-1',
    })
    .expect(200);
  recepcaoA = await como(app, email, 'senha-recepcao-1');
});

afterAll(async () => {
  await a.remover();
  await b.remover();
  await app.close();
});

describe('isolamento: o dono de outra conta, rota por rota', () => {
  const periodo = () => `de=${mes}-01&ate=${hoje}`;
  /** Nenhum dado desta conta pode aparecer na resposta, seja qual for o status. */
  function semVazamento(r: request.Response) {
    const corpo = JSON.stringify(r.body ?? '');
    for (const v of [SENTINELA, 'Aluguel sigiloso', ids.comanda, ids.cliente, ids.prof])
      expect(corpo).not.toContain(v);
  }

  it('leituras', async () => {
    const rotas = [
      `/clientes/${ids.cliente}`,
      `/clientes?busca=Sigiloso`,
      `/comandas/${ids.comanda}`,
      `/comandas?unidadeId=${a.unidadeA}&data=${hoje}`,
      `/comandas/impressao?unidadeId=${a.unidadeA}&data=${hoje}`,
      `/agenda?unidadeId=${a.unidadeA}&de=${hoje}&ate=${hoje}`,
      `/agenda/horarios-livres?unidadeId=${a.unidadeA}&data=${hoje}&duracaoMin=30`,
      `/profissionais`,
      `/profissionais/${ids.prof}/bloqueios?de=${hoje}&ate=${hoje}`,
      `/servicos`,
      `/servicos/${ids.servico}/precos`,
      `/precos`,
      `/usuarios`,
      `/unidades`,
      `/unidades/${a.unidadeA}/calendario?de=${hoje}&ate=${hoje}`,
      `/despesas?mes=${mes}`,
      `/indicadores?${periodo()}&unidadeId=${a.unidadeA}`,
      `/lucratividade?${periodo()}&unidadeId=${a.unidadeA}`,
      `/metas?mes=${mes}&unidadeId=${a.unidadeA}`,
      `/comissoes?${periodo()}&unidadeId=${a.unidadeA}`,
      `/comissoes/${ids.prof}/extrato?${periodo()}`,
      `/caixa?unidadeId=${a.unidadeA}&data=${hoje}`,
      `/exportacao?mes=${mes}&formato=csv&unidadeId=${a.unidadeA}`,
      `/profissionais/desempenho?${periodo()}&unidadeId=${a.unidadeA}`,
      `/profissionais/desempenho?${periodo()}`,
      `/profissionais/${ids.prof}/desempenho?${periodo()}`,
      `/resumo/dia?data=${hoje}`,
      `/resumo/dia?data=${hoje}&unidadeId=${a.unidadeA}`,
      `/resumo/dia?data=${hoje}&profissionalId=${ids.prof}`,
      `/resumo/mes?mes=${mes}&unidadeId=${a.unidadeA}`,
      `/bot`,
      `/bot/conexao/${a.unidadeA}`,
      `/clientes/${ids.cliente}/mensagens`,
      `/conversas?unidadeId=${a.unidadeA}`,
      `/unidades/${a.unidadeA}/regras-agendamento`,
      `/avaliacoes?${periodo()}&unidadeId=${a.unidadeA}`,
    ];
    for (const rota of rotas) {
      const r = await intruso.get(rota);
      expect([200, 403, 404], `${rota} → ${r.status}`).toContain(r.status);
      semVazamento(r);
      if (rota.startsWith('/exportacao') && r.status === 200)
        expect(r.text).not.toContain('Aluguel sigiloso');
    }
  });

  it('alterações: nada passa e nada muda', async () => {
    const tentativas: [string, string, object?][] = [
      ['patch', `/clientes/${ids.cliente}`, { nome: 'Invadido' }],
      ['post', `/clientes/${ids.cliente}/notas`, { texto: 'invasão' }],
      ['post', `/comandas/${ids.comanda}/itens`, { tipo: 'servico', servicoId: ids.servico }],
      ['post', `/comandas/${ids.comanda}/confirmar`],
      ['post', `/comandas/${ids.comanda}/fechar`, { pagamentos: [{ forma: 'pix', valor: 5000 }] }],
      ['post', `/comandas/${ids.comanda}/cancelar`, { motivo: 'invasão', falta: true }],
      ['post', `/comandas/${ids.comandaFechada}/reabrir`, { motivo: 'invasão de conta' }],
      [
        'post',
        '/comandas',
        { unidadeId: a.unidadeA, profissionalId: ids.prof, clienteId: ids.cliente, servicoIds: [] },
      ],
      [
        'post',
        '/agendamentos',
        {
          unidadeId: a.unidadeA,
          profissionalId: ids.prof,
          clienteNovo: { nome: 'X Y' },
          inicio: `${hoje}T23:00:00-03:00`,
          servicoIds: [ids.servico],
        },
      ],
      ['patch', `/agendamentos/${ids.agendamento}`, { inicio: `${hoje}T23:00:00-03:00` }],
      ['patch', `/servicos/${ids.servico}`, { nome: 'Invadido' }],
      [
        'post',
        '/precos',
        {
          vigenciaInicio: hoje,
          precos: [{ servicoId: ids.servico, unidadeId: a.unidadeA, valor: 1 }],
        },
      ],
      ['patch', `/profissionais/${ids.prof}`, { ativo: false }],
      ['put', `/profissionais/${ids.prof}/horarios`, { horarios: [] }],
      [
        'post',
        `/profissionais/${ids.prof}/regras-comissao`,
        {
          tipoItem: 'servico',
          vigenciaInicio: hoje,
          regra: { percentualBp: 10000, valorFixo: null },
        },
      ],
      [
        'post',
        `/profissionais/${ids.prof}/bloqueios`,
        { inicio: `${hoje}T10:00:00-03:00`, fim: `${hoje}T11:00:00-03:00` },
      ],
      [
        'put',
        `/usuarios/${ids.usuarioBarbeiro}/papeis`,
        { papeis: [{ papel: 'dono', unidadeId: null }] },
      ],
      ['patch', `/usuarios/${ids.usuarioBarbeiro}`, { ativo: false }],
      ['patch', `/unidades/${a.unidadeA}`, { nome: 'Invadida' }],
      ['put', `/unidades/${a.unidadeA}/calendario/${hoje}`, { trabalha: false }],
      ['patch', `/despesas/${ids.despesa}`, { valor: 1 }],
      ['delete', `/despesas/${ids.despesa}`],
      ['put', '/metas', { unidadeId: a.unidadeA, mes, tipo: 'faturamento', objetivo: 1 }],
      ['delete', `/metas/${ids.meta}`],
      [
        'post',
        '/comissoes/pagamentos',
        { profissionalId: ids.prof, periodoInicio: `${mes}-01`, periodoFim: hoje, valor: 1 },
      ],
      ['put', `/bot/horario/${a.unidadeA}`, { turnos: null }],
      ['post', '/bot/simular', { unidadeId: a.unidadeA, entrada: 'oi', sessao: null }],
      ['post', `/bot/conexao/${a.unidadeA}`],
      ['delete', `/bot/conexao/${a.unidadeA}`],
      ['post', '/caixa/abrir', { unidadeId: a.unidadeA, data: hoje, valorAbertura: 0 }],
      ['post', '/caixa/fechar', { unidadeId: a.unidadeA, data: hoje, totalInformado: 0 }],
    ];
    for (const [metodo, rota, corpo] of tentativas) {
      const r = await (
        intruso as unknown as Record<string, (u: string, c?: object) => request.Test>
      )[metodo]!(rota, corpo);
      expect([400, 403, 404, 409], `${metodo.toUpperCase()} ${rota} → ${r.status}`).toContain(
        r.status,
      );
      semVazamento(r);
    }
    // Do lado da conta A, tudo como estava.
    expect((await donoA.get(`/clientes/${ids.cliente}`)).body.nome).toBe(SENTINELA);
    expect((await donoA.get(`/comandas/${ids.comanda}`)).body.status).toBe('em_atendimento');
    expect((await donoA.get(`/comandas/${ids.comandaFechada}`)).body.status).toBe('fechada');
    expect(
      (await donoA.get(`/despesas?mes=${mes}`)).body.map((d: { valor: number }) => d.valor),
    ).toEqual([300000]);
    expect((await donoA.get('/profissionais')).body[0]).toMatchObject({ ativo: true });
    expect(
      (await donoA.get('/unidades')).body.find((u: { id: string }) => u.id === a.unidadeA).nome,
    ).toBe('Unidade A');
    expect((await donoA.get(`/metas?mes=${mes}`)).body[0].objetivo).toBe(100000);
    const prisma = criarPrisma();
    const caixasB = await naConta(prisma, b.contaId, (tx) => tx.caixaDia.count());
    await prisma.$disconnect();
    // Só os dois caixas de hoje do cenário: nada foi gravado na conta B pelas rotas da A.
    expect(caixasB).toBe(2);
  });
});

describe('permissões: cada papel tentando o que não pode', () => {
  const periodo = () => `de=${mes}-01&ate=${hoje}`;
  const matriz = (): Record<
    'barbeiro' | 'recepcao' | 'gestor',
    [string, () => string, object?][]
  > => ({
    barbeiro: [
      ['get', () => '/usuarios'],
      ['get', () => '/bot'],
      ['post', () => '/bot/simular', { unidadeId: a.unidadeA, entrada: 'oi', sessao: null }],
      ['get', () => `/bot/conexao/${a.unidadeA}`],
      ['post', () => `/bot/conexao/${a.unidadeA}`],
      ['get', () => `/clientes/${ids.cliente}/mensagens`],
      ['get', () => '/conversas'],
      ['get', () => `/avaliacoes?${periodo()}`],
      ['get', () => `/canais?${periodo()}`],
      ['put', () => '/bot/pesquisa', { ativa: false }],
      ['get', () => `/resumo/dia?data=${hoje}`],
      ['get', () => `/resumo/mes?mes=${mes}`],
      ['get', () => `/profissionais/desempenho?${periodo()}`],
      ['get', () => `/indicadores?${periodo()}`],
      ['get', () => `/despesas?mes=${mes}`],
      ['get', () => `/comissoes?${periodo()}`],
      ['get', () => `/caixa?unidadeId=${a.unidadeA}`],
      ['get', () => `/exportacao?mes=${mes}`],
      ['get', () => `/comandas/impressao?unidadeId=${a.unidadeA}&data=${hoje}`],
      [
        'post',
        () => '/servicos',
        { nome: 'X1', duracaoMin: 30, custoProduto: 0, ehExtra: false, pesoAtendimento: 1 },
      ],
      [
        'post',
        () => '/precos',
        {
          vigenciaInicio: hoje,
          precos: [{ servicoId: ids.servico, unidadeId: a.unidadeA, valor: 1 }],
        },
      ],
      [
        'post',
        () => '/agendamentos',
        {
          unidadeId: a.unidadeA,
          profissionalId: ids.prof,
          clienteNovo: { nome: 'X Y' },
          inicio: `${hoje}T23:00:00-03:00`,
          servicoIds: [ids.servico],
        },
      ],
      [
        'post',
        () => '/comandas',
        { unidadeId: a.unidadeA, profissionalId: ids.prof, clienteNovo: { nome: 'X Y' } },
      ],
      [
        'post',
        () => `/comandas/${ids.comanda}/fechar`,
        { pagamentos: [{ forma: 'pix', valor: 5000 }] },
      ],
      ['post', () => `/comandas/${ids.comandaFechada}/reabrir`, { motivo: 'tentativa' }],
      ['post', () => '/importacao/clientes', { linhas: [{ nome: 'X Y' }] }],
      ['put', () => '/metas', { unidadeId: a.unidadeA, mes, tipo: 'faturamento', objetivo: 1 }],
      ['patch', () => '/conta', { nome: 'Outra' }],
      [
        'post',
        () => '/profissionais',
        {
          unidadeId: a.unidadeA,
          nome: 'X Y',
          email: 'x@x.dev',
          dataEntrada: hoje,
          comissaoServico: { percentualBp: 1, valorFixo: null },
          comissaoProduto: { percentualBp: 1, valorFixo: null },
        },
      ],
      ['post', () => '/clientes', { nome: 'X Y' }],
    ],
    recepcao: [
      ['get', () => '/usuarios'],
      ['get', () => '/bot'],
      ['post', () => `/bot/conexao/${a.unidadeA}`],
      ['get', () => `/resumo/dia?data=${hoje}`],
      ['get', () => `/resumo/mes?mes=${mes}`],
      ['get', () => `/profissionais/desempenho?${periodo()}`],
      ['get', () => `/profissionais/${ids.prof}/desempenho?${periodo()}`],
      ['get', () => `/indicadores?${periodo()}`],
      ['get', () => `/lucratividade?${periodo()}`],
      ['get', () => `/despesas?mes=${mes}`],
      ['get', () => `/comissoes?${periodo()}`],
      ['get', () => `/exportacao?mes=${mes}`],
      [
        'post',
        () => '/servicos',
        { nome: 'X2', duracaoMin: 30, custoProduto: 0, ehExtra: false, pesoAtendimento: 1 },
      ],
      [
        'post',
        () => '/precos',
        {
          vigenciaInicio: hoje,
          precos: [{ servicoId: ids.servico, unidadeId: a.unidadeA, valor: 1 }],
        },
      ],
      ['post', () => `/comandas/${ids.comandaFechada}/reabrir`, { motivo: 'tentativa' }],
      ['post', () => '/caixa/reabrir', { unidadeId: a.unidadeA, data: hoje, motivo: 'tentativa' }],
      ['put', () => '/metas', { unidadeId: a.unidadeA, mes, tipo: 'faturamento', objetivo: 1 }],
      ['post', () => '/importacao/clientes', { linhas: [{ nome: 'X Y' }] }],
      [
        'post',
        () => '/profissionais',
        {
          unidadeId: a.unidadeA,
          nome: 'X Y',
          email: 'x@x.dev',
          dataEntrada: hoje,
          comissaoServico: { percentualBp: 1, valorFixo: null },
          comissaoProduto: { percentualBp: 1, valorFixo: null },
        },
      ],
      [
        'post',
        () => '/usuarios/convites',
        { nome: 'X Y', email: 'y@x.dev', papel: 'barbeiro', unidadeId: a.unidadeA },
      ],
    ],
    gestor: [
      ['patch', () => '/conta', { nome: 'Outra' }],
      ['put', () => '/bot/menu', { menu: { texto: 'x', opcoes: [] }, palavrasChave: [] }],
      ['post', () => '/bot/menu/publicar'],
      ['put', () => '/bot/mensagens', { mensagens: { boas_vindas: 'x' } }],
      ['post', () => '/unidades', { nome: 'Nova', diasTrabalho: [1], capacidade: 1 }],
      ['patch', () => `/unidades/${a.unidadeA}`, { capacidade: 9 }],
      [
        'post',
        () => '/servicos',
        { nome: 'X3', duracaoMin: 30, custoProduto: 0, ehExtra: false, pesoAtendimento: 1 },
      ],
      [
        'post',
        () => '/precos',
        {
          vigenciaInicio: hoje,
          precos: [{ servicoId: ids.servico, unidadeId: a.unidadeA, valor: 1 }],
        },
      ],
      ['put', () => '/metas', { unidadeId: a.unidadeA, mes, tipo: 'faturamento', objetivo: 1 }],
      ['post', () => '/importacao/clientes', { linhas: [{ nome: 'X Y' }] }],
      ['post', () => '/configuracao/servicos', { servicos: [] }],
      ['get', () => `/indicadores?${periodo()}&unidadeId=${a.unidadeB}`],
      [
        'post',
        () => '/usuarios/convites',
        { nome: 'X Y', email: 'z@x.dev', papel: 'gestor', unidadeId: a.unidadeA },
      ],
    ],
  });

  it.each(['barbeiro', 'recepcao', 'gestor'] as const)(
    '%s recebe 403 em tudo o que não pode',
    async (papel) => {
      const cliente = { barbeiro: barbeiroA, recepcao: recepcaoA, gestor: gestorA }[papel];
      for (const [metodo, rota, corpo] of matriz()[papel]) {
        const r = await (
          cliente as unknown as Record<string, (u: string, c?: object) => request.Test>
        )[metodo]!(rota(), corpo);
        expect(r.status, `${papel}: ${metodo.toUpperCase()} ${rota()}`).toBe(403);
      }
    },
  );
});

describe('o "dia 31" da planilha, com fuso', () => {
  it('comanda fechada às 23h50 de 31/10 (já 01/11 em UTC) conta em outubro, não em novembro', async () => {
    const prisma = criarPrisma();
    await naConta(prisma, a.contaId, async (tx) => {
      const c = await tx.comanda.create({
        data: {
          unidadeId: a.unidadeA,
          profissionalId: ids.prof,
          clienteId: ids.cliente,
          status: 'fechada',
          totalBruto: 2500,
          totalLiquido: 2500,
          fechadaEm: new Date('2026-10-31T23:50:00-03:00'),
        },
      });
      await tx.itemComanda.create({
        data: {
          comandaId: c.id,
          tipo: 'servico',
          servicoId: ids.servico,
          profissionalId: ids.prof,
          quantidade: 1,
          precoUnitario: 2500,
          ehExtra: true,
          pesoAtendimento: 0,
        },
      });
    });
    await prisma.$disconnect();
    const outubro = (
      await donoA
        .get(`/indicadores?de=2026-10-01&ate=2026-10-31&unidadeId=${a.unidadeA}`)
        .expect(200)
    ).body.atual;
    expect(outubro).toMatchObject({ faturamento: 2500, extrasQuantidade: 1 });
    const novembro = (
      await donoA
        .get(`/indicadores?de=2026-11-01&ate=2026-11-30&unidadeId=${a.unidadeA}`)
        .expect(200)
    ).body.atual;
    expect(novembro.extrasQuantidade).toBe(0);
  });
});
