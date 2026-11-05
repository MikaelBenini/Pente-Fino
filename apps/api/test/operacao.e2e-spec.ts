// Etapa 6.6 a 6.9: clientes, agenda, comanda, fechamento e caixa.
import type { INestApplication } from '@nestjs/common';
import { criarPrisma, naConta } from '@pente-fino/db';
import { dataLocal, FILA_WHATSAPP_ENTRADA, type TrabalhoWhatsappEntrada } from '@pente-fino/shared';
import { Queue } from 'bullmq';
import type { App } from 'supertest/types.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let cenario: Cenario;
let outra: Cenario;
type Cliente = Awaited<ReturnType<typeof como>>;
let dono: Cliente;
let gestor: Cliente;
let barbeiro: Cliente;
let recepcao: Cliente;
let profBarbeiro = '';
let profOutro = '';
let corte = '';
let barba = '';
let sobrancelha = '';
let pomada = '';

const dia = (n: number) => {
  const d = new Date(`${dataLocal(new Date())}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const as = (d: string, hhmm: string) => `${d}T${hhmm}:00-03:00`;
const AMANHA = dia(1);
const ONTEM = dia(-1);

beforeAll(async () => {
  app = await criarApp();
  cenario = await criarCenario();
  outra = await criarCenario();
  dono = await como(app, cenario.emails.dono);
  gestor = await como(app, cenario.emails.gestor);
  barbeiro = await como(app, cenario.emails.barbeiro);

  // Unidade A abre todos os dias (o teste roda em qualquer dia da semana).
  await dono
    .patch(`/unidades/${cenario.unidadeA}`, { diasTrabalho: [0, 1, 2, 3, 4, 5, 6] })
    .expect(200);
  const usuarios = (await dono.get('/usuarios')).body as { id: string; email: string }[];
  const idBarbeiro = usuarios.find((u) => u.email === cenario.emails.barbeiro)!.id;
  const regra = { percentualBp: 4000, valorFixo: null };
  const p1 = await dono
    .post('/profissionais', {
      unidadeId: cenario.unidadeA,
      usuarioId: idBarbeiro,
      dataEntrada: dia(-30),
      comissaoServico: regra,
      comissaoProduto: { percentualBp: 1000, valorFixo: null },
    })
    .expect(201);
  profBarbeiro = p1.body.id;
  const p2 = await dono
    .post('/profissionais', {
      unidadeId: cenario.unidadeA,
      nome: 'Outro Barbeiro',
      email: `outro-${Date.now()}@e2e.pentefino.dev`,
      dataEntrada: dia(-30),
      comissaoServico: { percentualBp: 5000, valorFixo: null },
      comissaoProduto: regra,
    })
    .expect(201);
  profOutro = p2.body.id;

  const servico = async (nome: string, duracaoMin: number, ehExtra: boolean) =>
    (
      await dono
        .post('/servicos', {
          nome,
          duracaoMin,
          custoProduto: 200,
          ehExtra,
          pesoAtendimento: ehExtra ? 0 : 1,
        })
        .expect(201)
    ).body.id as string;
  corte = await servico('Corte', 30, false);
  barba = await servico('Barba', 30, false);
  sobrancelha = await servico('Sobrancelha', 10, true);
  // Preço valendo desde ontem (o teste de pendente usa ontem): grava direto no banco.
  const prisma = criarPrisma();
  await naConta(prisma, cenario.contaId, (tx) =>
    tx.precoServico.createMany({
      data: [
        [corte, 5000],
        [barba, 3500],
        [sobrancelha, 1500],
      ].map(([servicoId, valor]) => ({
        servicoId: servicoId as string,
        unidadeId: cenario.unidadeA,
        valor: valor as number,
        vigenciaInicio: new Date(`${dia(-30)}T00:00:00Z`),
      })),
    }),
  );
  await prisma.$disconnect();
  pomada = (
    await dono.post('/produtos', { nome: 'Pomada', precoVenda: 4500, custo: 1800 }).expect(201)
  ).body.id;

  const email = `recep-${Date.now()}@e2e.pentefino.dev`;
  const convite = await dono
    .post('/usuarios/convites', {
      nome: 'Recepção Teste',
      email,
      papel: 'recepcao',
      unidadeId: cenario.unidadeA,
    })
    .expect(201);
  const token = new URL(convite.body.linkConvite).searchParams.get('token');
  const request = (await import('supertest')).default;
  await request(app.getHttpServer())
    .post('/auth/convite')
    .send({ token, senha: 'senha-recepcao-1' })
    .expect(200);
  recepcao = await como(app, email, 'senha-recepcao-1');
});

afterAll(async () => {
  await cenario.remover();
  await outra.remover();
  await app.close();
});

describe('clientes', () => {
  let cliente = '';

  it('recepção cadastra; telefone repetido dá conflito; busca por nome e telefone', async () => {
    const r = await recepcao
      .post('/clientes', { nome: 'João Pedro', telefone: '(11) 99999-0001' })
      .expect(201);
    cliente = r.body.id;
    await recepcao.post('/clientes', { nome: 'Outro', telefone: '11 99999-0001' }).expect(409);
    expect(
      (await recepcao.get('/clientes?busca=joão').expect(200)).body.map(
        (c: { id: string }) => c.id,
      ),
    ).toContain(cliente);
    expect((await recepcao.get('/clientes?busca=99999-0001').expect(200)).body[0].telefone).toBe(
      '5511999990001',
    );
  });

  it('barbeiro não vê cliente que nunca atendeu', async () => {
    await barbeiro.get(`/clientes/${cliente}`).expect(404);
    expect((await barbeiro.get('/clientes').expect(200)).body).toEqual([]);
    await barbeiro.post('/clientes', { nome: 'Novo' }).expect(403);
  });
});

describe('agenda e comanda: agendar → atender → confirmar → fechar', () => {
  let comanda = '';
  let agendamento = '';

  it('recepção agenda: cria a comanda prevista com o preço do dia', async () => {
    const r = await recepcao
      .post('/agendamentos', {
        unidadeId: cenario.unidadeA,
        profissionalId: profBarbeiro,
        clienteNovo: { nome: 'Carlos Lima', telefone: '11988880002' },
        inicio: as(AMANHA, '10:00'),
        servicoIds: [corte, barba],
      })
      .expect(201);
    comanda = r.body.id;
    agendamento = r.body.agendamentoId;
    expect(r.body).toMatchObject({
      status: 'prevista',
      totalLiquido: 8500,
      servicos: ['Corte', 'Barba'],
      cliente: 'Carlos Lima',
    });
    expect(new Date(r.body.fim).getTime() - new Date(r.body.inicio).getTime()).toBe(60 * 60_000);
  });

  it('não agenda por cima, fora do expediente, nem pelo barbeiro', async () => {
    const base = {
      unidadeId: cenario.unidadeA,
      profissionalId: profBarbeiro,
      clienteNovo: { nome: 'Fulano' },
      servicoIds: [corte],
    };
    const cima = await recepcao
      .post('/agendamentos', { ...base, inicio: as(AMANHA, '10:30') })
      .expect(409);
    expect(cima.body.erro.mensagem).toMatch(/já tem um agendamento/);
    const fora = await recepcao
      .post('/agendamentos', { ...base, inicio: as(AMANHA, '22:00') })
      .expect(409);
    expect(fora.body.erro.mensagem).toMatch(/Fora do expediente/);
    await barbeiro.post('/agendamentos', { ...base, inicio: as(AMANHA, '15:00') }).expect(403);
  });

  it('dia de folga da unidade não aceita agendamento', async () => {
    const depois = dia(2);
    await gestor
      .put(`/unidades/${cenario.unidadeA}/calendario/${depois}`, {
        trabalha: false,
        motivo: 'Feriado',
      })
      .expect(200);
    await recepcao
      .post('/agendamentos', {
        unidadeId: cenario.unidadeA,
        profissionalId: profBarbeiro,
        clienteNovo: { nome: 'X Y' },
        inicio: as(depois, '10:00'),
        servicoIds: [corte],
      })
      .expect(409);
    const livres = (
      await recepcao
        .get(`/agenda/horarios-livres?unidadeId=${cenario.unidadeA}&data=${depois}&duracaoMin=30`)
        .expect(200)
    ).body;
    expect(livres.every((l: { inicios: string[] }) => l.inicios.length === 0)).toBe(true);
  });

  it('horários livres pulam o agendado', async () => {
    const r = (
      await recepcao
        .get(
          `/agenda/horarios-livres?unidadeId=${cenario.unidadeA}&data=${AMANHA}&duracaoMin=30&profissionalId=${profBarbeiro}`,
        )
        .expect(200)
    ).body;
    const inicios = r[0].inicios.map((i: string) => new Date(i).getTime());
    expect(inicios).not.toContain(new Date(as(AMANHA, '10:00')).getTime());
    expect(inicios).not.toContain(new Date(as(AMANHA, '10:30')).getTime());
    expect(inicios).toContain(new Date(as(AMANHA, '11:00')).getTime());
  });

  it('agenda: recepção vê todos; barbeiro só a coluna dele', async () => {
    const a = (
      await recepcao
        .get(`/agenda?unidadeId=${cenario.unidadeA}&de=${AMANHA}&ate=${AMANHA}`)
        .expect(200)
    ).body;
    expect(a.profissionais).toHaveLength(2);
    expect(a.itens[0]).toMatchObject({ cliente: 'Carlos Lima', status: 'prevista' });
    const b = (
      await barbeiro
        .get(`/agenda?unidadeId=${cenario.unidadeA}&de=${AMANHA}&ate=${AMANHA}`)
        .expect(200)
    ).body;
    expect(b.profissionais.map((p: { id: string }) => p.id)).toEqual([profBarbeiro]);
  });

  it('remarcar para outro horário livre', async () => {
    const r = await recepcao
      .patch(`/agendamentos/${agendamento}`, { inicio: as(AMANHA, '14:00') })
      .expect(200);
    expect(new Date(r.body.inicio).getTime()).toBe(new Date(as(AMANHA, '14:00')).getTime());
  });

  it('barbeiro lança extra e produto na própria comanda; não mexe na do outro', async () => {
    await barbeiro.post(`/comandas/${comanda}/iniciar`).expect(200);
    await barbeiro
      .post(`/comandas/${comanda}/itens`, { tipo: 'servico', servicoId: sobrancelha })
      .expect(201);
    const r = await barbeiro
      .post(`/comandas/${comanda}/itens`, { tipo: 'produto', produtoId: pomada })
      .expect(201);
    expect(r.body).toMatchObject({ status: 'em_atendimento', totalLiquido: 8500 + 1500 + 4500 });
    expect(
      r.body.itens.find((i: { descricao: string }) => i.descricao === 'Sobrancelha').ehExtra,
    ).toBe(true);
    await barbeiro
      .post(`/comandas/${comanda}/itens`, {
        tipo: 'nao_operacional',
        descricao: 'Gorjeta',
        valor: 1000,
      })
      .expect(403);

    const outra = await recepcao
      .post('/agendamentos', {
        unidadeId: cenario.unidadeA,
        profissionalId: profOutro,
        clienteNovo: { nome: 'Cliente do Outro' },
        inicio: as(AMANHA, '10:00'),
        servicoIds: [corte],
      })
      .expect(201);
    await barbeiro.get(`/comandas/${outra.body.id}`).expect(404);
    await barbeiro.post(`/comandas/${outra.body.id}/confirmar`).expect(404);
  });

  it('barbeiro confirma; depois disso não mexe nos itens', async () => {
    const r = await barbeiro.post(`/comandas/${comanda}/confirmar`).expect(200);
    expect(r.body.status).toBe('confirmada');
    const item = r.body.itens[0].id;
    const bloqueado = await barbeiro.delete(`/comandas/${comanda}/itens/${item}`).expect(400);
    expect(bloqueado.body.erro.mensagem).toMatch(/já confirmada/);
  });

  it('fechar: pagamentos precisam bater com o total (com desconto rateado)', async () => {
    const errado = await recepcao
      .post(`/comandas/${comanda}/fechar`, {
        desconto: 500,
        pagamentos: [{ forma: 'pix', valor: 10000 }],
      })
      .expect(400);
    expect(errado.body.erro.campos[0].mensagem).toMatch(/Faltam R\$ 40,00/);
    const r = await recepcao
      .post(`/comandas/${comanda}/fechar`, {
        desconto: 500,
        pagamentos: [
          { forma: 'dinheiro', valor: 4000 },
          { forma: 'credito', valor: 10000 },
        ],
      })
      .expect(200);
    expect(r.body).toMatchObject({
      status: 'fechada',
      totalBruto: 14500,
      desconto: 500,
      totalLiquido: 14000,
    });
    // Comissão: 40% sobre os serviços (com o desconto rateado) e 10% sobre o produto.
    const comissoes = Object.fromEntries(
      r.body.itens.map((i: { descricao: string; comissaoValor: number }) => [
        i.descricao,
        i.comissaoValor,
      ]),
    );
    expect(comissoes).toEqual({ Corte: 1931, Barba: 1352, Sobrancelha: 580, Pomada: 434 });
  });

  it('recepção não reabre; gestor reabre com motivo e a comissão sai até fechar de novo', async () => {
    await recepcao
      .post(`/comandas/${comanda}/reabrir`, { motivo: 'Pagamento lançado errado' })
      .expect(403);
    await gestor.post(`/comandas/${comanda}/reabrir`, { motivo: 'abc' }).expect(400);
    const r = await gestor
      .post(`/comandas/${comanda}/reabrir`, { motivo: 'Pagamento lançado errado' })
      .expect(200);
    expect(r.body.status).toBe('reaberta');
    expect(r.body.pagamentos).toEqual([]);
    expect(r.body.itens.every((i: { comissaoValor: number }) => i.comissaoValor === 0)).toBe(true);
    const fechada = await recepcao
      .post(`/comandas/${comanda}/fechar`, { pagamentos: [{ forma: 'pix', valor: 14000 }] })
      .expect(200);
    expect(fechada.body.status).toBe('fechada');
    const prisma = criarPrisma();
    const auditoria = await naConta(prisma, cenario.contaId, (tx) =>
      tx.auditoria.findMany({ where: { entidadeId: comanda }, orderBy: { criadoEm: 'asc' } }),
    );
    await prisma.$disconnect();
    expect(auditoria.map((a) => a.acao)).toEqual(['fechar', 'reabrir', 'fechar']);
    expect(auditoria[1]!.motivo).toBe('Pagamento lançado errado');
  });

  it('caixa: entradas por forma, fechar com divergência e travar o dia', async () => {
    const caixa = (
      await recepcao.get(`/caixa?unidadeId=${cenario.unidadeA}&data=${AMANHA}`).expect(200)
    ).body;
    expect(caixa).toMatchObject({ situacao: 'aberto', totalRecebido: 14000, fechadas: 1 });
    expect(caixa.porForma).toEqual([{ forma: 'pix', total: 14000, quantidade: 1 }]);
    const fechado = (
      await recepcao
        .post('/caixa/fechar', { unidadeId: cenario.unidadeA, data: AMANHA, totalInformado: 500 })
        .expect(200)
    ).body;
    expect(fechado).toMatchObject({ situacao: 'fechado', dinheiroEsperado: 0, divergencia: 500 });
    await gestor
      .post(`/comandas/${comanda}/reabrir`, { motivo: 'Tentar depois do caixa' })
      .expect(409);
    await recepcao
      .post('/caixa/reabrir', {
        unidadeId: cenario.unidadeA,
        data: AMANHA,
        motivo: 'Contagem errada',
      })
      .expect(403);
    await gestor
      .post('/caixa/reabrir', {
        unidadeId: cenario.unidadeA,
        data: AMANHA,
        motivo: 'Contagem errada',
      })
      .expect(200);
  });
});

describe('casos especiais', () => {
  it('cliente sem horário: recepção abre a comanda na hora', async () => {
    const r = await recepcao
      .post('/comandas', {
        unidadeId: cenario.unidadeA,
        profissionalId: profOutro,
        clienteNovo: { nome: 'Passou na Frente' },
        servicoIds: [corte],
      })
      .expect(201);
    expect(r.body).toMatchObject({
      status: 'em_atendimento',
      totalLiquido: 5000,
      agendamentoId: null,
    });
    const lista = (await recepcao.get(`/comandas?unidadeId=${cenario.unidadeA}`).expect(200)).body;
    expect(lista.map((c: { id: string }) => c.id)).toContain(r.body.id);
  });

  it('cliente não veio: comanda cancelada como falta, fora do faturamento', async () => {
    const r = await recepcao
      .post('/agendamentos', {
        unidadeId: cenario.unidadeA,
        profissionalId: profBarbeiro,
        clienteNovo: { nome: 'Faltoso' },
        inicio: as(AMANHA, '16:00'),
        servicoIds: [corte],
      })
      .expect(201);
    await barbeiro
      .post(`/comandas/${r.body.id}/cancelar`, { motivo: 'Não veio', falta: true })
      .expect(403);
    const c = await recepcao
      .post(`/comandas/${r.body.id}/cancelar`, { motivo: 'Não veio', falta: true })
      .expect(200);
    expect(c.body.status).toBe('cancelada');
    await recepcao
      .post(`/comandas/${r.body.id}/fechar`, { pagamentos: [{ forma: 'pix', valor: 5000 }] })
      .expect(400);
    const livres = (
      await recepcao.get(
        `/agenda/horarios-livres?unidadeId=${cenario.unidadeA}&data=${AMANHA}&duracaoMin=30&profissionalId=${profBarbeiro}`,
      )
    ).body;
    expect(livres[0].inicios.map((i: string) => new Date(i).getTime())).toContain(
      new Date(as(AMANHA, '16:00')).getTime(),
    );
  });

  it('horário que passou sem confirmação vira pendente: recepção não fecha, gestor fecha', async () => {
    const r = await recepcao
      .post('/agendamentos', {
        unidadeId: cenario.unidadeA,
        profissionalId: profBarbeiro,
        clienteNovo: { nome: 'Ontem' },
        inicio: as(ONTEM, '10:00'),
        servicoIds: [corte],
      })
      .expect(201);
    expect(r.body.status).toBe('pendente');
    const negado = await recepcao
      .post(`/comandas/${r.body.id}/fechar`, { pagamentos: [{ forma: 'dinheiro', valor: 5000 }] })
      .expect(400);
    expect(negado.body.erro.mensagem).toMatch(/ainda não confirmou/);
    await gestor
      .post(`/comandas/${r.body.id}/fechar`, { pagamentos: [{ forma: 'dinheiro', valor: 5000 }] })
      .expect(200);
  });
});

describe('isolamento', () => {
  it('outra conta não vê nem mexe em comanda, cliente ou agenda daqui', async () => {
    const intruso = await como(app, outra.emails.dono);
    const lista = (await recepcao.get(`/comandas?unidadeId=${cenario.unidadeA}&data=${AMANHA}`))
      .body as { id: string; clienteId: string }[];
    const alvo = lista[0]!;
    await intruso.get(`/comandas/${alvo.id}`).expect(404);
    await intruso.post(`/comandas/${alvo.id}/reabrir`, { motivo: 'invasão de conta' }).expect(404);
    await intruso.get(`/clientes/${alvo.clienteId}`).expect(404);
    await intruso
      .get(`/agenda?unidadeId=${cenario.unidadeA}&de=${AMANHA}&ate=${AMANHA}`)
      .expect(404);
    await intruso.get(`/caixa?unidadeId=${cenario.unidadeA}`).expect(404);
    await intruso
      .post('/caixa/abrir', { unidadeId: cenario.unidadeA, data: AMANHA, valorAbertura: 0 })
      .expect(404);
    await intruso
      .post('/caixa/fechar', { unidadeId: cenario.unidadeA, data: AMANHA, totalInformado: 0 })
      .expect(404);
  });
});

describe('lembretes do WhatsApp', () => {
  it('marcar com dias de antecedência agenda 24 h e 2 h; remarcar agenda os do horário novo', async () => {
    const fila = new Queue<TrabalhoWhatsappEntrada>(FILA_WHATSAPP_ENTRADA, {
      connection: { url: process.env.REDIS_URL! },
    });
    try {
      const r = await recepcao
        .post('/agendamentos', {
          unidadeId: cenario.unidadeA,
          profissionalId: profBarbeiro,
          clienteNovo: { nome: 'Lembrado', telefone: '11988880077' },
          inicio: as(dia(5), '11:00'),
          servicoIds: [corte],
        })
        .expect(201);
      const id = r.body.agendamentoId as string;
      const doAgendamento = async () =>
        (await fila.getJobs(['delayed', 'waiting']))
          .filter((j) => j.data?.tipo === 'lembrete' && j.data.agendamentoId === id)
          .map((j) => j.data as Extract<TrabalhoWhatsappEntrada, { tipo: 'lembrete' }>);
      let jobs = await doAgendamento();
      expect(jobs.map((j) => j.lembrete).sort()).toEqual(['24h', '2h']);
      expect(jobs[0]!.inicio).toBe(new Date(as(dia(5), '11:00')).toISOString());

      await recepcao.patch(`/agendamentos/${id}`, { inicio: as(dia(6), '11:00') }).expect(200);
      jobs = await doAgendamento();
      const novo = new Date(as(dia(6), '11:00')).toISOString();
      expect(
        jobs
          .filter((j) => j.inicio === novo)
          .map((j) => j.lembrete)
          .sort(),
      ).toEqual(['24h', '2h']);
      await Promise.all(
        (await fila.getJobs(['delayed', 'waiting']))
          .filter((j) => j.data?.tipo === 'lembrete' && j.data.agendamentoId === id)
          .map((j) => j.remove()),
      );
    } finally {
      await fila.close();
    }
  });
});
