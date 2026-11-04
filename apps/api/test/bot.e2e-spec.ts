// Etapa 10A: menu do bot (rascunho, publicar, voltar), mensagens prontas, horário e simulador.
import type { INestApplication } from '@nestjs/common';
import {
  dataLocal,
  MENU_BOT_PADRAO,
  type EstadoBot,
  type MenuBot,
  type RespostaSimulacao,
} from '@pente-fino/shared';
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

const simular = (quem: Cliente, entrada: string, extra: object = {}) =>
  quem.post('/bot/simular', { unidadeId: a.unidadeA, entrada, sessao: null, ...extra });

beforeAll(async () => {
  app = await criarApp();
  a = await criarCenario();
  b = await criarCenario();
  dono = await como(app, a.emails.dono);
  gestor = await como(app, a.emails.gestor);
  barbeiro = await como(app, a.emails.barbeiro);
  intruso = await como(app, b.emails.dono);
  const corte = (
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
      precos: [{ servicoId: corte, unidadeId: a.unidadeA, valor: 4500 }],
    })
    .expect(201);
});

afterAll(async () => {
  await a.remover();
  await b.remover();
  await app.close();
});

describe('bot: estado e simulador', () => {
  it('conta começa com o menu padrão publicado e as mensagens prontas', async () => {
    const e = (await dono.get('/bot').expect(200)).body as EstadoBot;
    expect(e.publicado.menu).toEqual(MENU_BOT_PADRAO);
    expect(e.rascunho).toBeNull();
    expect(e.temAnterior).toBe(false);
    expect(e.podeEditar).toBe(true);
    expect(e.mensagens.boas_vindas).toBe('Olá, {cliente}! Aqui é a {unidade}.');
    expect(e.unidades.map((u) => u.nome).sort()).toEqual(['Unidade A', 'Unidade B']);
  });

  it('simula a conversa com a unidade de verdade (nome e preços)', async () => {
    const r1 = (await simular(dono, 'oi', { cliente: 'Carlos Lima' }).expect(200))
      .body as RespostaSimulacao;
    expect(r1.respostas[0]).toBe('Olá, Carlos! Aqui é a Unidade A.');
    expect(r1.respostas[1]).toMatch(/^Como posso ajudar\?\n\n1\. Agendar horário/);
    const r2 = (await simular(dono, '2', { sessao: r1.sessao }).expect(200))
      .body as RespostaSimulacao;
    expect(r2.acao).toBe('ver_precos');
    expect(r2.respostas[0]).toBe('Nossos preços:\n• Corte: R$ 45,00');
  });
});

describe('bot: rascunho, publicar e voltar', () => {
  const novo: MenuBot = structuredClone(MENU_BOT_PADRAO);
  novo.menu.opcoes.push({
    id: 'clube',
    rotulo: 'Conhecer o clube',
    resposta: 'O clube tem corte ilimitado por R$ 99,90 ao mês.',
    acao: null,
    submenu: null,
  });

  it('rascunho não muda o bot até publicar; o simulador mostra os dois', async () => {
    const r = await dono.put('/bot/menu', novo).expect(200);
    expect(r.body.problemas).toEqual([]);
    const rasc = (await simular(dono, 'oi').expect(200)).body as RespostaSimulacao;
    expect(rasc.respostas[1]).toContain('5. Conhecer o clube');
    const pub = (await simular(dono, 'oi', { versao: 'publicado' }).expect(200))
      .body as RespostaSimulacao;
    expect(pub.respostas[1]).not.toContain('Conhecer o clube');
  });

  it('publica e depois volta à versão anterior', async () => {
    await dono.post('/bot/menu/publicar').expect(204);
    let e = (await dono.get('/bot').expect(200)).body as EstadoBot;
    expect(e.publicado.menu.menu.opcoes).toHaveLength(5);
    expect(e.publicado.publicadoPor).toBe('Dona Teste');
    expect(e.rascunho).toBeNull();
    expect(e.temAnterior).toBe(true);
    await dono.post('/bot/menu/restaurar').expect(204);
    e = (await dono.get('/bot').expect(200)).body as EstadoBot;
    expect(e.publicado.menu).toEqual(MENU_BOT_PADRAO);
  });

  it('menu com problema não publica e diz onde está o problema', async () => {
    const ruim = structuredClone(MENU_BOT_PADRAO);
    ruim.menu.opcoes.push({ id: 'vazia', rotulo: '', resposta: '', acao: null, submenu: null });
    const salvo = await dono.put('/bot/menu', ruim).expect(200);
    expect(salvo.body.problemas.map((p: { onde: string }) => p.onde)).toContain(
      'Opção 5 do menu principal',
    );
    const r = await dono.post('/bot/menu/publicar').expect(400);
    expect(JSON.stringify(r.body)).toContain('Dê um nome para a opção.');
    await dono.delete('/bot/menu/rascunho').expect(204);
    await dono.post('/bot/menu/publicar').expect(400); // nada para publicar
  });
});

describe('bot: mensagens prontas e horário', () => {
  it('mensagem editada aparece na conversa; variável desconhecida é recusada', async () => {
    await dono
      .put('/bot/mensagens', {
        mensagens: { boas_vindas: 'Fala, {cliente}! Bem-vindo à {unidade}.' },
      })
      .expect(200);
    const r = (await simular(dono, 'oi', { cliente: 'Ana' }).expect(200)).body as RespostaSimulacao;
    expect(r.respostas[0]).toBe('Fala, Ana! Bem-vindo à Unidade A.');
    await dono.put('/bot/mensagens', { mensagens: { boas_vindas: 'Oi {senha}' } }).expect(400);
  });

  it('horário próprio do bot e a mensagem de fora do horário', async () => {
    await gestor
      .put(`/bot/horario/${a.unidadeA}`, {
        turnos: [1, 2, 3, 4, 5].map((d) => ({ diaSemana: d, inicioMin: 540, fimMin: 1080 })),
      })
      .expect(204);
    const e = (await dono.get('/bot').expect(200)).body as EstadoBot;
    expect(e.unidades.find((u) => u.id === a.unidadeA)!.descricao).toBe(
      'de segunda a sexta, das 9h às 18h',
    );
    const r = (await simular(dono, 'oi', { foraDoHorario: true }).expect(200))
      .body as RespostaSimulacao;
    expect(r.respostas[0]).toBe(
      'Agora estamos fechados. Funcionamos de segunda a sexta, das 9h às 18h. Você pode agendar pelo menu a qualquer hora.',
    );
    await gestor.put(`/bot/horario/${a.unidadeA}`, { turnos: null }).expect(204);
    const depois = (await dono.get('/bot').expect(200)).body as EstadoBot;
    expect(depois.unidades.find((u) => u.id === a.unidadeA)!.horario).toBeNull();
  });
});

describe('bot: permissões e isolamento', () => {
  it('gestor vê, testa e ajusta o horário da unidade dele, mas não edita o menu', async () => {
    const e = (await gestor.get('/bot').expect(200)).body as EstadoBot;
    expect(e.podeEditar).toBe(false);
    expect(e.unidades.map((u) => u.id)).toEqual([a.unidadeA]);
    await gestor.put('/bot/menu', MENU_BOT_PADRAO).expect(403);
    await gestor.post('/bot/menu/publicar').expect(403);
    await gestor.put('/bot/mensagens', { mensagens: { boas_vindas: 'x' } }).expect(403);
    await simular(gestor, 'oi').expect(200);
    await gestor
      .post('/bot/simular', { unidadeId: a.unidadeB, entrada: 'oi', sessao: null })
      .expect(403);
    await gestor.put(`/bot/horario/${a.unidadeB}`, { turnos: null }).expect(403);
  });

  it('barbeiro não acessa; outra conta não vê nem mexe', async () => {
    await barbeiro.get('/bot').expect(403);
    await barbeiro
      .post('/bot/simular', { unidadeId: a.unidadeA, entrada: 'oi', sessao: null })
      .expect(403);
    const delas = (await intruso.get('/bot').expect(200)).body as EstadoBot;
    expect(delas.unidades.map((u) => u.id)).not.toContain(a.unidadeA);
    expect(JSON.stringify(delas)).not.toContain('Bem-vindo à');
    await intruso
      .post('/bot/simular', { unidadeId: a.unidadeA, entrada: 'oi', sessao: null })
      .expect(404);
    await intruso.put(`/bot/horario/${a.unidadeA}`, { turnos: null }).expect(404);
  });
});
