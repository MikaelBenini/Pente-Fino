// Etapa 6.1 a 6.5: conta, unidades, equipe, serviços, preços e profissionais.
import type { INestApplication } from '@nestjs/common';
import { criarPrisma, naConta } from '@pente-fino/db';
import { dataLocal } from '@pente-fino/shared';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let cenario: Cenario;
let outra: Cenario;
const hoje = dataLocal(new Date());
const amanha = (() => {
  const d = new Date(`${hoje}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
})();

beforeAll(async () => {
  app = await criarApp();
  cenario = await criarCenario();
  outra = await criarCenario();
});

afterAll(async () => {
  await cenario.remover();
  await outra.remover();
  await app.close();
});

const regra = (percentualBp: number) => ({ percentualBp, valorFixo: null });

describe('conta e unidades', () => {
  it('dono vê o plano e o uso; gestor não altera a conta', async () => {
    const dono = await como(app, cenario.emails.dono);
    const r = await dono.get('/conta').expect(200);
    expect(r.body).toMatchObject({
      plano: 'premium',
      uso: { unidades: 2 },
      limites: { unidades: null },
    });
    await dono.patch('/conta', { nome: 'Barbearia Renomeada' }).expect(200);
    const gestor = await como(app, cenario.emails.gestor);
    await gestor.patch('/conta', { nome: 'Invasão' }).expect(403);
  });

  it('plano básico barra a segunda unidade', async () => {
    const prisma = criarPrisma();
    await naConta(prisma, outra.contaId, (tx) =>
      tx.conta.update({ where: { id: outra.contaId }, data: { plano: 'basico' } }),
    );
    await prisma.$disconnect();
    const dono = await como(app, outra.emails.dono);
    const r = await dono
      .post('/unidades', { nome: 'Unidade C', diasTrabalho: [1, 2, 3], capacidade: 2 })
      .expect(400);
    expect(r.body.erro).toMatchObject({ codigo: 'limite_plano' });
    expect(r.body.erro.mensagem).toMatch(/plano Básico permite 1 unidade/);
  });

  it('dono cria e altera unidade; gestor não', async () => {
    const dono = await como(app, cenario.emails.dono);
    const criada = await dono
      .post('/unidades', {
        nome: 'Unidade C',
        diasTrabalho: [2, 3, 4, 5, 6],
        capacidade: 2,
        telefone: '(11) 3333-4444',
      })
      .expect(201);
    expect(criada.body).toMatchObject({
      nome: 'Unidade C',
      telefone: '551133334444',
      fuso: 'America/Sao_Paulo',
    });
    await dono.patch(`/unidades/${criada.body.id}`, { capacidade: 4 }).expect(200);
    const gestor = await como(app, cenario.emails.gestor);
    await gestor.patch(`/unidades/${cenario.unidadeA}`, { capacidade: 9 }).expect(403);
  });

  it('calendário: gestor marca feriado na unidade dele, não na outra', async () => {
    const gestor = await como(app, cenario.emails.gestor);
    await gestor
      .put(`/unidades/${cenario.unidadeA}/calendario/2026-12-25`, {
        trabalha: false,
        motivo: 'Natal',
      })
      .expect(200);
    await gestor
      .put(`/unidades/${cenario.unidadeB}/calendario/2026-12-25`, { trabalha: false })
      .expect(403);
    const dias = await gestor
      .get(`/unidades/${cenario.unidadeA}/calendario?de=2026-12-01&ate=2026-12-31`)
      .expect(200);
    expect(dias.body).toEqual([{ data: '2026-12-25', trabalha: false, motivo: 'Natal' }]);
    await gestor.delete(`/unidades/${cenario.unidadeA}/calendario/2026-12-25`).expect(204);
  });
});

describe('equipe', () => {
  it('dono lista todos; gestor só a unidade dele', async () => {
    const dono = await como(app, cenario.emails.dono);
    expect((await dono.get('/usuarios').expect(200)).body).toHaveLength(3);
    const gestor = await como(app, cenario.emails.gestor);
    const lista = (await gestor.get('/usuarios').expect(200)).body as { email: string }[];
    expect(lista.map((u) => u.email).sort()).toEqual(
      [cenario.emails.barbeiro, cenario.emails.gestor].sort(),
    );
    const barbeiro = await como(app, cenario.emails.barbeiro);
    await barbeiro.get('/usuarios').expect(403);
  });

  it('gestor não mexe no dono nem leva alguém para outra unidade', async () => {
    const dono = await como(app, cenario.emails.dono);
    const usuarios = (await dono.get('/usuarios')).body as { id: string; email: string }[];
    const id = (e: string) => usuarios.find((u) => u.email === e)!.id;
    const gestor = await como(app, cenario.emails.gestor);
    await gestor.patch(`/usuarios/${id(cenario.emails.dono)}`, { ativo: false }).expect(403);
    await gestor
      .put(`/usuarios/${id(cenario.emails.barbeiro)}/papeis`, {
        papeis: [{ papel: 'barbeiro', unidadeId: cenario.unidadeB }],
      })
      .expect(403);
    await gestor
      .put(`/usuarios/${id(cenario.emails.barbeiro)}/papeis`, {
        papeis: [{ papel: 'gestor', unidadeId: cenario.unidadeA }],
      })
      .expect(403);
  });

  it('não se altera a si mesmo e a conta nunca fica sem dono', async () => {
    const dono = await como(app, cenario.emails.dono);
    const usuarios = (await dono.get('/usuarios')).body as { id: string; email: string }[];
    const idDono = usuarios.find((u) => u.email === cenario.emails.dono)!.id;
    await dono.patch(`/usuarios/${idDono}`, { ativo: false }).expect(409);
    await dono
      .put(`/usuarios/${idDono}/papeis`, {
        papeis: [{ papel: 'gestor', unidadeId: cenario.unidadeA }],
      })
      .expect(409);
  });

  it('dono troca o papel e desativa; quem foi desativado não entra mais', async () => {
    const dono = await como(app, cenario.emails.dono);
    const email = `temp-${randomUUID().slice(0, 8)}@e2e.pentefino.dev`;
    const convite = await dono
      .post('/usuarios/convites', {
        nome: 'Temporário',
        email,
        papel: 'recepcao',
        unidadeId: cenario.unidadeA,
      })
      .expect(201);
    const id = convite.body.usuarioId as string;
    const r = await dono
      .put(`/usuarios/${id}/papeis`, { papeis: [{ papel: 'gestor', unidadeId: cenario.unidadeB }] })
      .expect(200);
    expect(r.body.papeis).toEqual([{ papel: 'gestor', unidadeId: cenario.unidadeB }]);
    expect(r.body.pendente).toBe(true);
    const desativado = await dono.patch(`/usuarios/${id}`, { ativo: false }).expect(200);
    expect(desativado.body.ativo).toBe(false);
  });

  it('papel sem unidade só para dono', async () => {
    const dono = await como(app, cenario.emails.dono);
    const usuarios = (await dono.get('/usuarios')).body as { id: string; email: string }[];
    const id = usuarios.find((u) => u.email === cenario.emails.barbeiro)!.id;
    const r = await dono
      .put(`/usuarios/${id}/papeis`, { papeis: [{ papel: 'gestor', unidadeId: null }] })
      .expect(400);
    expect(r.body.erro.campos[0].mensagem).toMatch(/Só o dono vale em todas/);
  });
});

describe('serviços e preços', () => {
  let corte = '';

  it('dono cadastra; nome repetido dá conflito; barbeiro não cadastra', async () => {
    const dono = await como(app, cenario.emails.dono);
    const s = await dono
      .post('/servicos', {
        nome: 'Corte',
        categoria: 'Cabelo',
        duracaoMin: 30,
        custoProduto: 150,
        ehExtra: false,
        pesoAtendimento: 1,
      })
      .expect(201);
    corte = s.body.id;
    await dono
      .post('/servicos', {
        nome: 'Corte',
        duracaoMin: 30,
        custoProduto: 0,
        ehExtra: false,
        pesoAtendimento: 1,
      })
      .expect(409);
    const barbeiro = await como(app, cenario.emails.barbeiro);
    await barbeiro
      .post('/servicos', {
        nome: 'X',
        duracaoMin: 30,
        custoProduto: 0,
        ehExtra: false,
        pesoAtendimento: 1,
      })
      .expect(403);
  });

  it('barbeiro vê o serviço, mas não o custo', async () => {
    const barbeiro = await como(app, cenario.emails.barbeiro);
    const lista = (await barbeiro.get('/servicos').expect(200)).body as {
      id: string;
      custoProduto: number;
    }[];
    expect(lista.find((s) => s.id === corte)?.custoProduto).toBe(0);
    const dono = await como(app, cenario.emails.dono);
    expect(
      ((await dono.get('/servicos')).body as { id: string; custoProduto: number }[]).find(
        (s) => s.id === corte,
      )?.custoProduto,
    ).toBe(150);
  });

  it('preço vale a partir da data; o passado não muda; o futuro fica programado', async () => {
    const dono = await como(app, cenario.emails.dono);
    await dono
      .post('/precos', {
        vigenciaInicio: '2020-01-01',
        precos: [{ servicoId: corte, unidadeId: cenario.unidadeA, valor: 4000 }],
      })
      .expect(400);
    await dono
      .post('/precos', {
        vigenciaInicio: hoje,
        precos: [
          { servicoId: corte, unidadeId: cenario.unidadeA, valor: 4500 },
          { servicoId: corte, unidadeId: cenario.unidadeB, valor: 5000 },
        ],
      })
      .expect(201);
    await dono
      .post('/precos', {
        vigenciaInicio: amanha,
        precos: [{ servicoId: corte, unidadeId: cenario.unidadeA, valor: 4800 }],
      })
      .expect(201);
    const tabela = (await dono.get('/precos').expect(200)).body;
    expect(tabela.vigentes).toEqual(
      expect.arrayContaining([
        { servicoId: corte, unidadeId: cenario.unidadeA, valor: 4500, vigenciaInicio: hoje },
      ]),
    );
    expect(tabela.programados).toEqual([
      { servicoId: corte, unidadeId: cenario.unidadeA, valor: 4800, vigenciaInicio: amanha },
    ]);
    const amanhaTabela = (await dono.get(`/precos?data=${amanha}`)).body;
    expect(
      amanhaTabela.vigentes.find((p: { unidadeId: string }) => p.unidadeId === cenario.unidadeA)
        .valor,
    ).toBe(4800);
    expect((await dono.get(`/servicos/${corte}/precos`)).body).toHaveLength(3);
  });

  it('gestor vê só os preços da unidade dele e não altera preço', async () => {
    const gestor = await como(app, cenario.emails.gestor);
    const tabela = (await gestor.get('/precos').expect(200)).body as {
      vigentes: { unidadeId: string }[];
    };
    expect(new Set(tabela.vigentes.map((p) => p.unidadeId))).toEqual(new Set([cenario.unidadeA]));
    await gestor
      .post('/precos', {
        vigenciaInicio: hoje,
        precos: [{ servicoId: corte, unidadeId: cenario.unidadeA, valor: 1 }],
      })
      .expect(403);
  });
});

describe('profissionais', () => {
  let profissionalId = '';

  it('gestor adiciona barbeiro novo já convidando; horários padrão da unidade', async () => {
    const gestor = await como(app, cenario.emails.gestor);
    const email = `novo-${randomUUID().slice(0, 8)}@e2e.pentefino.dev`;
    const r = await gestor
      .post('/profissionais', {
        unidadeId: cenario.unidadeA,
        nome: 'Bruno Novo',
        email,
        telefone: '11 98888-1111',
        dataEntrada: hoje,
        comissaoServico: regra(4000),
        comissaoProduto: regra(1000),
      })
      .expect(201);
    profissionalId = r.body.id;
    expect(r.body).toMatchObject({
      nome: 'Bruno Novo',
      pendente: true,
      ativo: true,
      dataEntrada: hoje,
    });
    expect(r.body.linkWhatsapp).toMatch(/^https:\/\/wa\.me\/5511988881111/);
    expect(r.body.horarios.map((h: { diaSemana: number }) => h.diaSemana)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(r.body.regras).toHaveLength(2);
  });

  it('gestor não cadastra na unidade de outro', async () => {
    const gestor = await como(app, cenario.emails.gestor);
    await gestor
      .post('/profissionais', {
        unidadeId: cenario.unidadeB,
        nome: 'X Y',
        email: `x-${randomUUID()}@x.dev`,
        dataEntrada: hoje,
        comissaoServico: regra(4000),
        comissaoProduto: regra(1000),
      })
      .expect(403);
  });

  it('horários sobrepostos são recusados; válidos substituem os atuais', async () => {
    const dono = await como(app, cenario.emails.dono);
    const ruim = await dono
      .put(`/profissionais/${profissionalId}/horarios`, {
        horarios: [
          { diaSemana: 1, inicioMin: 540, fimMin: 720 },
          { diaSemana: 1, inicioMin: 700, fimMin: 900 },
        ],
      })
      .expect(400);
    expect(ruim.body.erro.campos[0].mensagem).toMatch(/sobrepondo/);
    const ok = await dono
      .put(`/profissionais/${profissionalId}/horarios`, {
        horarios: [
          { diaSemana: 1, inicioMin: 540, fimMin: 720 },
          { diaSemana: 1, inicioMin: 780, fimMin: 1140 },
        ],
      })
      .expect(200);
    expect(ok.body.horarios).toHaveLength(2);
  });

  it('nova regra de comissão vale de hoje em diante', async () => {
    const dono = await como(app, cenario.emails.dono);
    await dono
      .post(`/profissionais/${profissionalId}/regras-comissao`, {
        tipoItem: 'servico',
        vigenciaInicio: '2020-01-01',
        regra: regra(5000),
      })
      .expect(400);
    const r = await dono
      .post(`/profissionais/${profissionalId}/regras-comissao`, {
        tipoItem: 'servico',
        vigenciaInicio: amanha,
        regra: regra(4500),
      })
      .expect(201);
    expect(r.body.regras[0]).toMatchObject({
      tipoItem: 'servico',
      percentualBp: 4500,
      vigenciaInicio: amanha,
    });
  });

  it('bloqueio de agenda pela recepção da unidade', async () => {
    const dono = await como(app, cenario.emails.dono);
    const b = await dono
      .post(`/profissionais/${profissionalId}/bloqueios`, {
        inicio: `${amanha}T12:00:00-03:00`,
        fim: `${amanha}T13:00:00-03:00`,
        motivo: 'Almoço',
      })
      .expect(201);
    const lista = await dono
      .get(`/profissionais/${profissionalId}/bloqueios?de=${amanha}&ate=${amanha}`)
      .expect(200);
    expect(lista.body).toHaveLength(1);
    await dono.delete(`/profissionais/${profissionalId}/bloqueios/${b.body.id}`).expect(204);
  });

  it('barbeiro vê só o próprio cadastro e sem regra de comissão de outros', async () => {
    const barbeiro = await como(app, cenario.emails.barbeiro);
    expect((await barbeiro.get('/profissionais').expect(200)).body).toEqual([]);
    await barbeiro.put(`/profissionais/${profissionalId}/horarios`, { horarios: [] }).expect(403);
  });

  it('desativar com data de saída libera a vaga do plano', async () => {
    const dono = await como(app, cenario.emails.dono);
    const r = await dono.patch(`/profissionais/${profissionalId}`, { dataSaida: hoje }).expect(200);
    expect(r.body).toMatchObject({ ativo: false, dataSaida: hoje });
  });
});

describe('isolamento entre contas nas rotas novas', () => {
  it('dono de outra conta não enxerga nem altera nada desta', async () => {
    const intruso = await como(app, outra.emails.dono);
    await intruso.patch(`/unidades/${cenario.unidadeA}`, { capacidade: 1 }).expect(404);
    await intruso
      .put(`/unidades/${cenario.unidadeA}/calendario/2026-12-24`, { trabalha: false })
      .expect(404);
    const servicos = (await intruso.get('/servicos').expect(200)).body as unknown[];
    expect(servicos).toEqual([]);
    const usuarios = (await intruso.get('/usuarios').expect(200)).body as { email: string }[];
    expect(usuarios.every((u) => !u.email.includes(cenario.emails.dono.split('@')[0]!))).toBe(true);
    const precos = (await intruso.get('/precos').expect(200)).body;
    expect(precos.vigentes).toEqual([]);
    await intruso
      .post('/precos', {
        vigenciaInicio: hoje,
        precos: [{ servicoId: randomUUID(), unidadeId: cenario.unidadeA, valor: 1 }],
      })
      .expect(404);
    const http = request(app.getHttpServer());
    await http.get('/conta').expect(401);
  });
});
