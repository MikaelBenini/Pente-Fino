// Etapa 10.1: pesquisa de 1 a 5 depois do atendimento — agenda no fechamento, sai pelo
// worker, é respondida pela conversa e aparece na ficha, no ranking e nas Métricas.
import type { INestApplication } from '@nestjs/common';
import {
  atenderMensagem,
  criarPrisma,
  iniciarPesquisa,
  instanciaDaUnidade,
  naConta,
  type PrismaClient,
} from '@pente-fino/db';
import {
  dataLocal,
  FILA_WHATSAPP_ENTRADA,
  MENSAGENS_BOT_PADRAO,
  type FichaProfissional,
  type LinhaRankingEquipe,
  type ResumoAvaliacoes,
  type TrabalhoWhatsappEntrada,
} from '@pente-fino/shared';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import type { App } from 'supertest/types.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let a: Cenario;
type Cliente = Awaited<ReturnType<typeof como>>;
let dono: Cliente;
let gestor: Cliente;
let barbeiro: Cliente;
let prisma: PrismaClient;
let fila: Queue<TrabalhoWhatsappEntrada>;
let prof = '';
let corte = '';
let instancia = '';
const hoje = dataLocal(new Date());
// A pesquisa sai 1 h depois do fechamento: perto da meia-noite a resposta cai no dia seguinte.
const ateAmanha = dataLocal(new Date(Date.now() + 2 * 3_600_000));
const periodo = `de=${hoje.slice(0, 7)}-01&ate=${ateAmanha}`;

/** Cliente que aceitou avisos e já escreveu para a unidade (pode receber a pesquisa). */
async function clienteDoWhatsapp(telefone: string, consentimento = true) {
  return naConta(prisma, a.contaId, async (tx) => {
    const c = await tx.cliente.create({
      data: { nome: `Cliente ${telefone.slice(-4)}`, telefone, consentimentoMsg: consentimento },
    });
    await tx.mensagem.create({
      data: {
        unidadeId: a.unidadeA,
        clienteId: c.id,
        telefone,
        direcao: 'entrada',
        texto: 'oi',
        status: 'recebida',
        idExterno: randomUUID(),
      },
    });
    return c.id;
  });
}

async function fecharComanda(clienteId: string) {
  const c = await dono
    .post('/comandas', {
      unidadeId: a.unidadeA,
      profissionalId: prof,
      clienteId,
      servicoIds: [corte],
    })
    .expect(201);
  await dono
    .post(`/comandas/${c.body.id}/fechar`, { pagamentos: [{ forma: 'pix', valor: 5000 }] })
    .expect(200);
  return c.body.id as string;
}

const responder = (telefone: string, texto: string, agora: Date) =>
  atenderMensagem(
    prisma,
    {
      tipo: 'mensagem',
      instancia,
      idExterno: randomUUID(),
      telefone,
      nome: null,
      texto,
      recebidaEm: agora.toISOString(),
    },
    { appUrl: 'http://app.teste', agora },
  );

beforeAll(async () => {
  app = await criarApp();
  a = await criarCenario();
  dono = await como(app, a.emails.dono);
  gestor = await como(app, a.emails.gestor);
  barbeiro = await como(app, a.emails.barbeiro);
  prisma = criarPrisma();
  fila = new Queue(FILA_WHATSAPP_ENTRADA, { connection: { url: process.env.REDIS_URL! } });
  instancia = instanciaDaUnidade(a.unidadeA);

  await dono.patch(`/unidades/${a.unidadeA}`, { diasTrabalho: [0, 1, 2, 3, 4, 5, 6] }).expect(200);
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
  corte = (
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
      precos: [{ servicoId: corte, unidadeId: a.unidadeA, valor: 5000 }],
    })
    .expect(201);
  await naConta(prisma, a.contaId, (tx) =>
    tx.botConexao.create({ data: { unidadeId: a.unidadeA, instancia, status: 'conectado' } }),
  );
});

afterAll(async () => {
  const jobs = await fila.getJobs(['waiting', 'delayed', 'completed', 'failed']);
  await Promise.all(
    jobs
      .filter((j) => j.data?.tipo === 'pesquisa' && j.data.contaId === a.contaId)
      .map((j) => j.remove()),
  );
  await fila.close();
  await prisma.$disconnect();
  await a.remover();
  await app.close();
});

describe('pesquisa depois do atendimento', () => {
  const telefone = '5511977001100';
  let avaliacaoId = '';
  let enviarEm = new Date();

  it('fechar a comanda agenda a pesquisa para uma hora depois, na fila do worker', async () => {
    const clienteId = await clienteDoWhatsapp(telefone);
    const comandaId = await fecharComanda(clienteId);
    const av = await naConta(prisma, a.contaId, (tx) =>
      tx.avaliacao.findUnique({ where: { comandaId } }),
    );
    expect(av).toMatchObject({ status: 'agendada', profissionalId: prof, telefone });
    avaliacaoId = av!.id;
    enviarEm = av!.enviarEm;
    const minutos = (av!.enviarEm.getTime() - Date.now()) / 60_000;
    expect(minutos).toBeGreaterThan(55);
    const job = await fila.getJob(`pesquisa_${avaliacaoId}`);
    expect(job?.data).toEqual({ tipo: 'pesquisa', contaId: a.contaId, avaliacaoId });
    expect(job?.opts.delay).toBeGreaterThan(55 * 60_000);
  });

  it('não agenda para quem não aceitou avisos, nem uma segunda vez na mesma semana', async () => {
    const sem = await clienteDoWhatsapp('5511977001101', false);
    const c1 = await fecharComanda(sem);
    const c2 = await fecharComanda(
      (await naConta(prisma, a.contaId, (tx) => tx.cliente.findFirst({ where: { telefone } })))!.id,
    );
    const n = await naConta(prisma, a.contaId, (tx) =>
      tx.avaliacao.count({ where: { comandaId: { in: [c1, c2] } } }),
    );
    expect(n).toBe(0);
  });

  it('na hora, sai a pergunta com o nome de quem atendeu; o cliente responde pela conversa', async () => {
    const inicio = await iniciarPesquisa(prisma, a.contaId, avaliacaoId, enviarEm);
    expect(inicio).toMatchObject({ tipo: 'enviar', instancia });
    const pergunta = await naConta(prisma, a.contaId, (tx) =>
      tx.mensagem.findUnique({
        where: { id: (inicio as { mensagemIds: string[] }).mensagemIds[0]! },
      }),
    );
    expect(pergunta?.texto).toContain('atendimento de Barbeiro');

    const depois = (min: number) => new Date(enviarEm.getTime() + min * 60_000);
    const r1 = await responder(telefone, '2', depois(10));
    if (r1.tipo !== 'respondida') throw new Error(r1.tipo);
    // Nota 2: o worker agenda o aviso para dono e gestor (espera, caso o cliente pare aqui)...
    expect(r1.notaBaixa).toEqual({ avaliacaoId, concluida: false });
    await responder(telefone, '4', depois(11));
    const fim = await responder(telefone, 'Demorou para começar.', depois(12));
    // ...e no fim da pesquisa, já com o comentário.
    expect(fim).toMatchObject({ notaBaixa: { avaliacaoId, concluida: true } });
    const av = await naConta(prisma, a.contaId, (tx) =>
      tx.avaliacao.findUnique({ where: { id: avaliacaoId } }),
    );
    expect(av).toMatchObject({
      status: 'respondida',
      notaAtendimento: 2,
      notaBarbearia: 4,
      comentario: 'Demorou para começar.',
    });
    // Depois do obrigado, a conversa volta ao bot normal.
    const textos = await naConta(prisma, a.contaId, (tx) =>
      tx.mensagem.findMany({
        where: { telefone, direcao: 'saida' },
        orderBy: { criadoEm: 'asc' },
        select: { texto: true },
      }),
    );
    expect(textos.at(-1)?.texto).toBe(MENSAGENS_BOT_PADRAO.pesquisa_obrigado);
  });

  it('a nota aparece na ficha (barbeiro vê a dele), no ranking e nas Métricas com a nota baixa', async () => {
    const ficha = (await barbeiro.get(`/profissionais/${prof}/desempenho?${periodo}`).expect(200))
      .body as FichaProfissional;
    expect(ficha.avaliacoes).toMatchObject({ media: 2, respostas: 1, enviadas: 1 });
    expect(ficha.avaliacoes.comentarios[0]).toMatchObject({
      comentario: 'Demorou para começar.',
      cliente: null,
    });

    const ranking = (await dono.get(`/profissionais/desempenho?${periodo}`).expect(200))
      .body as LinhaRankingEquipe[];
    expect(ranking.find((l) => l.profissionalId === prof)?.notaMedia).toBe(2);

    const r = (await gestor.get(`/avaliacoes?${periodo}`).expect(200)).body as ResumoAvaliacoes;
    expect(r).toMatchObject({
      pesquisaAtiva: true,
      atendimento: { media: 2, respostas: 1, taxaResposta: 1 },
      barbearia: { media: 4 },
    });
    expect(r.baixas[0]).toMatchObject({ notaAtendimento: 2, cliente: 'Cliente 1100' });
    await barbeiro.get(`/avaliacoes?${periodo}`).expect(403);
  });

  it('o dono desliga a pesquisa: fechar não agenda mais nada', async () => {
    await gestor.put('/bot/pesquisa', { ativa: false }).expect(403);
    await dono.put('/bot/pesquisa', { ativa: false }).expect(200);
    expect((await dono.get('/bot').expect(200)).body.pesquisaAtiva).toBe(false);
    const comandaId = await fecharComanda(await clienteDoWhatsapp('5511977001102'));
    const n = await naConta(prisma, a.contaId, (tx) =>
      tx.avaliacao.count({ where: { comandaId } }),
    );
    expect(n).toBe(0);
  });
});
