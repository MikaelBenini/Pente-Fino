// Etapa 11: agendar pela conversa do WhatsApp, do "oi" ao horário marcado.
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { formatarMoeda } from '@pente-fino/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  atenderMensagem,
  avisarFaltaParaGestao,
  avisarNotaBaixa,
  avisarProximoCliente,
  criarAgendamentoNoBanco,
  lembretesDoAgendamento,
  primeirasRotinas,
  rodarRotinaEquipe,
  contasComAutomacoes,
  contextoDaConversa,
  cancelarPeloCliente,
  criarPrisma,
  oferecerVaga,
  vagaDe,
  numerosDasAutomacoes,
  rodarAutomacoes,
  encerrarEsperaDoAtendente,
  enviarNotificacao,
  notificacaoDoHorario,
  enviarLembrete,
  hashCodigoAssistente,
  hashTokenAgendamento,
  hashTokenHorario,
  instanciaDaUnidade,
  moverAgendamento,
  naConta,
  type PrismaClient,
} from '../src/index.js';

const envDaRaiz = new URL('../../../.env', import.meta.url);
if (existsSync(envDaRaiz)) process.loadEnvFile(envDaRaiz);

let prisma: PrismaClient;
const conta = randomUUID();
let unidadeId = '';
let instancia = '';
let profissionalId = '';
let corte = '';
// Terça, 01/12/2026, 09:00 em São Paulo: o dia inteiro pela frente.
const agora = new Date('2026-12-01T12:00:00Z');
const naMinhaConta = <T>(fn: Parameters<typeof naConta<T>>[2]) => naConta(prisma, conta, fn);

/** Uma mensagem do cliente → os textos que o bot respondeu. */
async function fala(telefone: string, texto: string, quando = agora) {
  const r = await atenderMensagem(
    prisma,
    {
      tipo: 'mensagem',
      instancia,
      idExterno: randomUUID(),
      telefone,
      nome: 'Cliente Zap',
      texto,
      recebidaEm: quando.toISOString(),
    },
    { appUrl: 'http://app.teste', agora: quando },
  );
  if (r.tipo !== 'respondida') throw new Error(r.tipo);
  const ms = await naMinhaConta((tx) =>
    tx.mensagem.findMany({ where: { id: { in: r.saidas } }, orderBy: { criadoEm: 'asc' } }),
  );
  return r.saidas.map((id) => ms.find((m) => m.id === id)!.texto).join('\n---\n');
}

/** "Agendar" no menu; com site ligado, o bot pergunta o canal e o cliente escolhe a conversa. */
async function comecarAgendar(telefone: string, quando = agora) {
  const r = await fala(telefone, '1', quando);
  return r.includes('Como você prefere marcar?') ? fala(telefone, '1', quando) : r;
}

beforeAll(async () => {
  prisma = criarPrisma();
  await naMinhaConta(async (tx) => {
    await tx.conta.create({ data: { id: conta, nome: 'Barbearia Navalha' } });
    const u = await tx.unidade.create({
      data: {
        nome: 'Centro',
        diasTrabalho: [0, 1, 2, 3, 4, 5, 6],
        agendamentoPublico: true,
        slug: `navalha-${conta.slice(0, 8)}`,
        // Sem antecedência mínima: os testes marcam a partir de "agora" (09:00).
        regrasAgendamento: { antecedenciaMin: 0 },
      },
    });
    unidadeId = u.id;
    instancia = instanciaDaUnidade(u.id);
    await tx.botConexao.create({ data: { unidadeId, instancia, status: 'conectado' } });
    const usuario = await tx.usuario.create({
      data: { nome: 'Rafael Moura', email: `rafael-${conta}@teste.dev` },
    });
    const p = await tx.profissional.create({
      data: { usuarioId: usuario.id, unidadeId, dataEntrada: new Date('2026-01-01') },
    });
    profissionalId = p.id;
    await tx.horarioProfissional.createMany({
      data: [0, 1, 2, 3, 4, 5, 6].map((diaSemana) => ({
        profissionalId,
        diaSemana,
        inicioMin: 9 * 60,
        fimMin: 12 * 60,
      })),
    });
    const s1 = await tx.servico.create({ data: { nome: 'Corte', duracaoMin: 30 } });
    const s2 = await tx.servico.create({ data: { nome: 'Barba', duracaoMin: 30 } });
    corte = s1.id;
    await tx.precoServico.createMany({
      data: [
        { servicoId: s1.id, unidadeId, valor: 4500, vigenciaInicio: new Date('2026-01-01') },
        { servicoId: s2.id, unidadeId, valor: 3500, vigenciaInicio: new Date('2026-01-01') },
      ],
    });
  });
});

afterAll(async () => {
  await naMinhaConta((tx) => tx.conta.deleteMany({ where: { id: conta } }));
  await prisma.$disconnect();
});

describe('agendar pela conversa', () => {
  const tel = '5511977771111';

  it('do menu ao horário marcado, com dois serviços', async () => {
    await fala(tel, 'oi');
    // Com o site ligado, o bot pergunta por onde marcar.
    expect(await fala(tel, '1')).toContain('Como você prefere marcar?\n\n1. Por aqui, na conversa');
    const servicos = await fala(tel, '1');
    expect(servicos).toContain('1. Barba · R$ 35,00 · 30 min\n2. Corte · R$ 45,00 · 30 min');
    expect(servicos).toContain('pelo site? http://app.teste/agendar?u=navalha-');
    // Um profissional só: pula a escolha e vai direto aos dias.
    const dias = await fala(tel, '1 e 2');
    expect(dias).toMatch(/Qual dia fica melhor\?\n\n1\. Hoje \(ter, 01\/12\)/);
    const horarios = await fala(tel, '1');
    expect(horarios).toContain('Horários livres hoje (ter, 01/12):\n\n1. 09:00\n2. 09:15');
    expect(horarios).toContain(
      '7. Ver mais horários\n8. Nenhum serve: me avise se vagar neste dia\n0. Outro dia',
    );
    const mais = await fala(tel, '7');
    expect(mais).toMatch(/1\. 10:30/);
    const resumo = await fala(tel, '1');
    expect(resumo).toContain(
      '✂️ Barba + Corte\n💈 Com Rafael\n📅 Hoje (ter, 01/12), às 10:30\n💰 R$ 80,00',
    );
    const pronto = await fala(tel, '1');
    expect(pronto).toContain('Pronto, horário marcado! ✅');
    // A confirmação leva o link do horário; o banco guarda só o hash do token.
    const token = /http:\/\/app\.teste\/horario\?t=([A-Za-z0-9_-]{22})/.exec(pronto)?.[1];
    expect(token).toBeDefined();
    const link = await naMinhaConta((tx) =>
      tx.linkHorario.findUnique({ where: { tokenHash: hashTokenHorario(token!) } }),
    );
    expect(link).not.toBeNull();

    const ag = await naMinhaConta((tx) =>
      tx.agendamento.findFirst({
        where: { cliente: { telefone: tel } },
        include: { comanda: true },
      }),
    );
    expect(ag).toMatchObject({ origem: 'bot', profissionalId, status: 'agendado' });
    expect(ag!.fim.getTime() - ag!.inicio.getTime()).toBe(60 * 60_000);
    expect(ag!.comanda).toMatchObject({ status: 'prevista', totalLiquido: 8000 });
  });

  it('horário ocupado por outra pessoa no meio: avisa e mostra os que sobraram', async () => {
    const t2 = '5511977772222';
    await fala(t2, 'oi');
    await comecarAgendar(t2);
    await fala(t2, '2'); // Corte
    await fala(t2, '1'); // hoje
    await fala(t2, '1'); // 09:00 → resumo
    // Outra pessoa pega as 09:00 antes da confirmação.
    await naMinhaConta(async (tx) => {
      const c = await tx.cliente.create({ data: { nome: 'Balcão', telefone: '5511900009999' } });
      await criarAgendamentoNoBanco(tx, {
        unidadeId,
        profissionalId,
        clienteId: c.id,
        inicio: new Date('2026-12-01T12:00:00Z'),
        servicoIds: [corte],
        origem: 'balcao',
        criadoPorId: null,
      });
    });
    const r = await fala(t2, '1');
    expect(r).toContain('Esse horário acabou de ser ocupado.');
    expect(r).toMatch(/1\. 09:30/);
  });

  it('"atendente" no meio larga o agendamento; "0" volta ao menu', async () => {
    const t3 = '5511977773333';
    await fala(t3, 'oi');
    await fala(t3, '1');
    expect(await fala(t3, '0')).toMatch(/Como posso ajudar\?/);
    await fala(t3, '1');
    expect(await fala(t3, 'atendente')).toContain('Um atendente vai responder');
  });

  it('quem já tem 2 horários futuros é mandado para a recepção', async () => {
    const t4 = '5511977774444';
    await fala(t4, 'oi');
    const c = await naMinhaConta((tx) => tx.cliente.findFirstOrThrow({ where: { telefone: t4 } }));
    await naMinhaConta(async (tx) => {
      for (const iso of ['2026-12-02T12:00:00Z', '2026-12-03T12:00:00Z'])
        await criarAgendamentoNoBanco(tx, {
          unidadeId,
          profissionalId,
          clienteId: c.id,
          inicio: new Date(iso),
          servicoIds: [corte],
          origem: 'balcao',
          criadoPorId: null,
        });
    });
    expect(await fala(t4, '1')).toContain('Você já tem horários marcados com a gente');
  });
});

describe('meus horários', () => {
  /** Cliente com um horário marcado (pelo balcão) no instante informado. */
  async function comHorario(telefone: string, iso: string) {
    await fala(telefone, 'oi');
    return naMinhaConta(async (tx) => {
      const c = await tx.cliente.findFirstOrThrow({ where: { telefone } });
      const r = await criarAgendamentoNoBanco(tx, {
        unidadeId,
        profissionalId,
        clienteId: c.id,
        inicio: new Date(iso),
        servicoIds: [corte],
        origem: 'balcao',
        criadoPorId: null,
      });
      return r.agendamentoId;
    });
  }

  it('remarcar: mesmo serviço e profissional, novo horário, na auditoria', async () => {
    const id = await comHorario('5511977775555', '2026-12-02T13:00:00Z'); // amanhã 10:00
    const acoes = await fala('5511977775555', 'meus horários');
    expect(acoes).toContain('📅 Amanhã (qua, 02/12), às 10:00 · Corte com Rafael');
    expect(acoes).toContain('1. Remarcar\n2. Cancelar');
    expect(await fala('5511977775555', '1')).toContain('Qual dia fica melhor?');
    await fala('5511977775555', '3'); // quinta, 03/12
    await fala('5511977775555', '2'); // 09:45 (09:00 ocupado por outro cliente)
    const pronto = await fala('5511977775555', '1');
    expect(pronto).toContain('Pronto, horário remarcado! ✅');
    const ag = await naMinhaConta((tx) => tx.agendamento.findUniqueOrThrow({ where: { id } }));
    expect(ag.inicio.toISOString()).toBe('2026-12-03T12:45:00.000Z');
    expect(ag.status).toBe('agendado');
    const audit = await naMinhaConta((tx) =>
      tx.auditoria.count({ where: { entidadeId: id, acao: 'remarcar_pelo_cliente' } }),
    );
    expect(audit).toBe(1);
  });

  it('cancelar: pede confirmação, libera o horário e não conta como falta', async () => {
    const id = await comHorario('5511977776666', '2026-12-04T13:00:00Z');
    await fala('5511977776666', 'desmarcar');
    expect(await fala('5511977776666', '2')).toContain('1. Sim, cancelar\n2. Não, manter');
    expect(await fala('5511977776666', '1')).toContain('Pronto, horário cancelado.');
    const ag = await naMinhaConta((tx) =>
      tx.agendamento.findUniqueOrThrow({ where: { id }, include: { comanda: true } }),
    );
    expect(ag.status).toBe('cancelado');
    expect(ag.comanda).toMatchObject({
      status: 'cancelada',
      motivoCancelamento: 'Cancelado pelo cliente (WhatsApp)',
    });
  });

  it('em cima da hora (menos de 2 h): manda falar com a recepção', async () => {
    await comHorario('5511977777777', '2026-12-01T13:00:00Z'); // hoje 10:00, agora são 09:00
    expect(await fala('5511977777777', 'meu horário')).toContain(
      'Seu horário é daqui a pouco (10:00). Para mudar agora, responda ATENDENTE.',
    );
  });

  it('sem horário marcado: convida a agendar', async () => {
    await fala('5511977778888', 'oi');
    expect(await fala('5511977778888', '4')).toContain('Você não tem horário marcado com a gente.');
  });
});

describe('lembretes', () => {
  /** Cliente que já conversou e aceita avisos, com horário no dia 05/12 às 10:00. */
  async function clienteComHorario(
    telefone: string,
    consentimento = true,
    inicio = '2026-12-05T13:00:00.000Z',
  ) {
    await fala(telefone, 'oi');
    return naMinhaConta(async (tx) => {
      const achado = await tx.cliente.findFirstOrThrow({ where: { telefone } });
      const c = await tx.cliente.update({
        where: { id: achado.id },
        data: { consentimentoMsg: consentimento },
      });
      const r = await criarAgendamentoNoBanco(tx, {
        unidadeId,
        profissionalId,
        clienteId: c.id,
        inicio: new Date(inicio),
        servicoIds: [corte],
        origem: 'balcao',
        criadoPorId: null,
      });
      return r.agendamentoId;
    });
  }
  const vespera = new Date('2026-12-04T13:00:00Z');
  const job = (
    agendamentoId: string,
    lembrete: '24h' | '2h',
    inicio = '2026-12-05T13:00:00.000Z',
  ) => ({
    contaId: conta,
    agendamentoId,
    lembrete,
    inicio,
  });
  const ag = (id: string) =>
    naMinhaConta((tx) => tx.agendamento.findUniqueOrThrow({ where: { id } }));

  it('24 h antes: manda com as opções, não repete, e "1" confirma', async () => {
    const tel = '5511966661111';
    const id = await clienteComHorario(tel);
    const r = await enviarLembrete(prisma, job(id, '24h'), vespera);
    expect(r).toMatchObject({ tipo: 'enviar', instancia });
    const texto = await naMinhaConta((tx) =>
      tx.mensagem.findUniqueOrThrow({
        where: { id: (r as { mensagemIds: string[] }).mensagemIds[0]! },
      }),
    );
    expect(texto.texto).toContain('Lembrete do seu horário na Barbearia Navalha');
    expect(texto.texto).toContain('📅 Amanhã (sáb, 05/12), às 10:00\n✂️ Corte com Rafael');
    expect(texto.texto).toContain('1. Confirmo\n2. Remarcar\n3. Cancelar');
    expect(await enviarLembrete(prisma, job(id, '24h'), vespera)).toEqual({
      tipo: 'pular',
      motivo: 'já enviado',
    });

    expect(await fala(tel, '1', new Date(vespera.getTime() + 10 * 60_000))).toBe(
      'Confirmado! ✅ Te esperamos.',
    );
    expect(await ag(id)).toMatchObject({ status: 'confirmado' });
    expect((await ag(id)).confirmadoEm).toBeInstanceOf(Date);
    // Já confirmou: o de 2 h não pergunta de novo.
    expect(await enviarLembrete(prisma, job(id, '2h'), new Date('2026-12-05T11:00:00Z'))).toEqual({
      tipo: 'pular',
      motivo: 'já confirmado',
    });
  });

  it('abertura editada em Bot → Mensagens; dia, hora e opções continuam fixos', async () => {
    const tel = '5511966663333';
    const id = await clienteComHorario(tel, true, '2026-12-05T12:00:00.000Z');
    await naMinhaConta((tx) =>
      tx.modeloMensagem.create({
        data: { tipo: 'lembrete_primeiro', texto: 'Fala, {cliente}! Amanhã tem {barbearia}:' },
      }),
    );
    const r = await enviarLembrete(
      prisma,
      job(id, '24h', '2026-12-05T12:00:00.000Z'),
      new Date('2026-12-04T12:00:00Z'),
    );
    const texto = await naMinhaConta((tx) =>
      tx.mensagem.findUniqueOrThrow({
        where: { id: (r as { mensagemIds: string[] }).mensagemIds[0]! },
      }),
    );
    expect(texto.texto).toMatch(/^Fala, Cliente! Amanhã tem Barbearia Navalha:\n\n📅 Amanhã/);
    expect(texto.texto).toContain('1. Confirmo\n2. Remarcar\n3. Cancelar');
    await naMinhaConta((tx) =>
      tx.modeloMensagem.deleteMany({ where: { tipo: 'lembrete_primeiro' } }),
    );
  });

  it('remarcado depois: o lembrete do horário antigo não sai', async () => {
    const id = await clienteComHorario('5511966662222', true, '2026-12-05T13:30:00.000Z');
    await naMinhaConta((tx) => moverAgendamento(tx, id, new Date('2026-12-06T13:00:00Z')));
    expect(
      await enviarLembrete(prisma, job(id, '24h', '2026-12-05T13:30:00.000Z'), vespera),
    ).toEqual({ tipo: 'pular', motivo: 'remarcado' });
  });

  it('"3" no lembrete leva a cancelar, com confirmação', async () => {
    const tel = '5511966663333';
    const id = await clienteComHorario(tel, true, '2026-12-05T14:00:00.000Z');
    await enviarLembrete(prisma, job(id, '24h', '2026-12-05T14:00:00.000Z'), vespera);
    const depois = new Date(vespera.getTime() + 5 * 60_000);
    expect(await fala(tel, '3', depois)).toContain('1. Sim, cancelar\n2. Não, manter');
    expect(await fala(tel, '1', depois)).toContain('Pronto, horário cancelado.');
    expect(await ag(id)).toMatchObject({ status: 'cancelado' });
  });

  it('quem não aceitou avisos não recebe', async () => {
    const id = await clienteComHorario('5511966664444', false, '2026-12-05T14:30:00.000Z');
    expect(
      await enviarLembrete(prisma, job(id, '24h', '2026-12-05T14:30:00.000Z'), vespera),
    ).toEqual({
      tipo: 'pular',
      motivo: 'cliente sem avisos',
    });
  });
});

describe('regras da unidade', () => {
  const regras = (r: object) =>
    naMinhaConta((tx) =>
      tx.unidade.update({ where: { id: unidadeId }, data: { regrasAgendamento: r } }),
    );
  afterAll(() => regras({ antecedenciaMin: 0 }));

  it('antecedência de 3 h: hoje (das 9h às 12h) não tem mais horário para o cliente', async () => {
    await regras({ antecedenciaMin: 180 });
    const tel = '5511955550001';
    await fala(tel, 'oi');
    await comecarAgendar(tel);
    const dias = await fala(tel, '2'); // Corte → dias
    expect(dias).toContain('Qual dia fica melhor?');
    expect(dias).not.toContain('Hoje');
  });

  it('intervalo de 30 min: o horário colado num atendimento sai da lista', async () => {
    await regras({ antecedenciaMin: 0, intervaloMin: 30 });
    const tel = '5511955550003';
    await fala(tel, 'oi');
    await comecarAgendar(tel);
    await fala(tel, '2');
    // Hoje não sobra horário com a folga; amanhã é a opção 1 (outro cliente das 09:00 às 09:30).
    const horarios = await fala(tel, '1');
    // Sem intervalo, o primeiro seria 09:30; com 30 min de folga, só a partir das 10:00.
    expect(horarios).toContain('Horários livres amanhã (qua, 02/12):\n\n1. 10:00');
  });

  it('limite de 1 horário por cliente; conversa desligada manda o link', async () => {
    await regras({ antecedenciaMin: 0, maxFuturos: 1 });
    const tel = '5511977775555'; // já tem horário marcado (remarcado em "meus horários")
    expect(await fala(tel, 'agendar')).toContain('Você já tem horários marcados com a gente');

    await regras({ antecedenciaMin: 0, pelaConversa: false });
    const r = await fala('5511955550002', 'agendar');
    expect(r).toContain('http://app.teste/agendar?u=navalha-');
    expect(r).not.toContain('Qual serviço');
  });
});

describe('assistente da equipe', () => {
  const equipe = '5511944440000';
  const quando = new Date('2026-12-01T12:30:00Z'); // terça, 09:30: dentro do expediente

  it('ATIVAR com o código liga o número, que não vira cliente', async () => {
    await naMinhaConta(async (tx) => {
      const p = await tx.profissional.findUniqueOrThrow({ where: { id: profissionalId } });
      await tx.assistenteEquipe.create({
        data: {
          usuarioId: p.usuarioId,
          unidadeId,
          codigoHash: hashCodigoAssistente('123456'),
          codigoExpiraEm: new Date(quando.getTime() + 30 * 60_000),
        },
      });
    });
    expect(await fala(equipe, 'ativar 123456', quando)).toContain('Pronto, Rafael!');
    const cliente = await naMinhaConta((tx) =>
      tx.cliente.findFirst({ where: { telefone: equipe } }),
    );
    expect(cliente).toBeNull();
  });

  it('responde agenda, comissão e ajuda — com o primeiro nome do cliente, nunca o telefone', async () => {
    const agenda = await fala(equipe, 'agenda', quando);
    expect(agenda).toMatch(/^Hoje \(ter, 01\/12\): \d+ horários?/);
    expect(agenda).not.toMatch(/\d{10,}/);
    expect(await fala(equipe, 'comissão', quando)).toContain('Comissão de dezembro');
    expect(await fala(equipe, 'qual meu próximo?', quando)).toContain('AGENDA · seus horários');
  });

  it('cliente marcando pelo bot: o profissional recebe "horário novo"; PARAR pausa', async () => {
    const cli = '5511944441111';
    const marcar = async () => {
      await fala(cli, 'oi', quando);
      await comecarAgendar(cli, quando);
      await fala(cli, '2', quando); // Corte
      await fala(cli, '2', quando); // amanhã
      await fala(cli, '1', quando);
      return fala(cli, '1', quando);
    };
    const avisos = () =>
      naMinhaConta((tx) =>
        tx.mensagem.count({
          where: { telefone: equipe, direcao: 'saida', texto: { startsWith: '📅 Horário novo' } },
        }),
      );
    expect(await marcar()).toContain('📅 Horário novo na sua agenda:');
    expect(await avisos()).toBe(1);

    expect(await fala(equipe, 'PARAR', quando)).toContain('Avisos desligados');
    await naMinhaConta((tx) =>
      tx.agendamento.updateMany({
        where: { cliente: { telefone: cli } },
        data: { status: 'cancelado' },
      }),
    );
    await marcar();
    expect(await avisos()).toBe(1);
  });

  describe('avisos com hora marcada', () => {
    // Quinta, 10/12: horário do João às 11:30 (14:30Z).
    const inicio = '2026-12-10T14:30:00.000Z';
    let agId = '';
    let assistenteId = '';
    let clienteId = '';

    it('ao marcar, entra o "próximo cliente" 15 min antes; na hora avisa, com "primeira vez"', async () => {
      expect(await fala(equipe, 'LIGAR', quando)).toContain('Avisos ligados');
      agId = await naMinhaConta(async (tx) => {
        const c = await tx.cliente.create({
          data: { nome: 'João Pedro Lima', telefone: '5511955550000' },
        });
        clienteId = c.id;
        const r = await criarAgendamentoNoBanco(tx, {
          unidadeId,
          profissionalId,
          clienteId: c.id,
          inicio: new Date(inicio),
          servicoIds: [corte],
          origem: 'balcao',
          criadoPorId: null,
        });
        assistenteId = (await tx.assistenteEquipe.findFirstOrThrow({ where: { unidadeId } })).id;
        return r.agendamentoId;
      });
      const trabalhos = await naMinhaConta((tx) => lembretesDoAgendamento(tx, conta, agId, quando));
      const proximo = trabalhos.find((t) => t.dados.tipo === 'proximo_cliente')!;
      expect(proximo.jobId).toBe(`proximo_${agId}_${new Date(inicio).getTime()}`);
      expect(quando.getTime() + proximo.atrasoMs).toBe(new Date('2026-12-10T14:15:00Z').getTime());

      const naHora = new Date('2026-12-10T14:15:00Z');
      const a = await avisarProximoCliente(
        prisma,
        { contaId: conta, agendamentoId: agId, inicio },
        naHora,
      );
      expect(a).toMatchObject({ instancia });
      const texto = await naMinhaConta((tx) =>
        tx.mensagem.findUniqueOrThrow({ where: { id: a!.mensagemIds[0]! } }),
      );
      expect(texto.texto).toBe('⏰ Próximo cliente às 11:30: João (primeira vez) · Corte');
      // Remarcado depois: o trabalho do horário antigo não manda nada.
      expect(
        await avisarProximoCliente(
          prisma,
          { contaId: conta, agendamentoId: agId, inicio: '2026-12-10T15:00:00.000Z' },
          naHora,
        ),
      ).toBeNull();
    });

    it('agenda do dia: manda só no próprio dia e já devolve a do dia seguinte', async () => {
      const cedo = new Date('2026-12-10T11:00:00Z'); // 08:00, 1 h antes do expediente
      const r = await rodarRotinaEquipe(
        prisma,
        { contaId: conta, assistenteId, rotina: 'agenda', dia: '2026-12-10' },
        cedo,
      );
      const texto = await naMinhaConta((tx) =>
        tx.mensagem.findUniqueOrThrow({ where: { id: r.aviso!.mensagemIds[0]! } }),
      );
      expect(texto.texto).toMatch(/^Bom dia! ☀️\nHoje \(qui, 10\/12\): 1 horário/);
      expect(texto.texto).toContain('João');
      expect(r.proxima?.jobId).toBe(`rotina_${assistenteId}_agenda_2026-12-11`);
      expect(cedo.getTime() + r.proxima!.atrasoMs).toBe(new Date('2026-12-11T11:00:00Z').getTime());

      // Trabalho atrasado (worker parado): não manda a agenda de ontem.
      const atrasado = await rodarRotinaEquipe(
        prisma,
        { contaId: conta, assistenteId, rotina: 'agenda', dia: '2026-12-09' },
        cedo,
      );
      expect(atrasado.aviso).toBeNull();
      expect(atrasado.proxima?.dados.dia).toBe('2026-12-11');
    });

    it('resumo: atendidos e comissão do dia; cliente que já veio não é mais "primeira vez"', async () => {
      await naMinhaConta(async (tx) => {
        const c = await tx.comanda.findFirstOrThrow({ where: { agendamentoId: agId } });
        await tx.itemComanda.updateMany({
          where: { comandaId: c.id },
          data: { comissaoValor: 1800 },
        });
        await tx.comanda.update({
          where: { id: c.id },
          data: { status: 'fechada', fechadaEm: new Date('2026-12-10T15:10:00Z') },
        });
      });
      const fim = new Date('2026-12-10T15:15:00Z'); // 12:15, 15 min depois do expediente
      const r = await rodarRotinaEquipe(
        prisma,
        { contaId: conta, assistenteId, rotina: 'resumo', dia: '2026-12-10' },
        fim,
      );
      const texto = await naMinhaConta((tx) =>
        tx.mensagem.findUniqueOrThrow({ where: { id: r.aviso!.mensagemIds[0]! } }),
      );
      expect(texto.texto).toContain('✂️ 1 atendimento fechado');
      expect(texto.texto).toMatch(/Comissão do dia: R\$\s?18,00/);
      expect(r.proxima?.jobId).toBe(`rotina_${assistenteId}_resumo_2026-12-11`);

      const outro = '2026-12-15T13:00:00.000Z';
      const id2 = await naMinhaConta(async (tx) => {
        const x = await criarAgendamentoNoBanco(tx, {
          unidadeId,
          profissionalId,
          clienteId,
          inicio: new Date(outro),
          servicoIds: [corte],
          origem: 'balcao',
          criadoPorId: null,
        });
        return x.agendamentoId;
      });
      const a = await avisarProximoCliente(
        prisma,
        { contaId: conta, agendamentoId: id2, inicio: outro },
        new Date('2026-12-15T12:45:00Z'),
      );
      const t2 = await naMinhaConta((tx) =>
        tx.mensagem.findUniqueOrThrow({ where: { id: a!.mensagemIds[0]! } }),
      );
      expect(t2.texto).toBe('⏰ Próximo cliente às 10:00: João · Corte');
    });

    it('aviso desligado não sai; assistente desligado no Perfil encerra a sequência', async () => {
      const cedo = new Date('2026-12-04T11:00:00Z');
      await naMinhaConta((tx) =>
        tx.assistenteEquipe.update({
          where: { id: assistenteId },
          data: {
            avisos: {
              horarioNovo: true,
              mudancas: true,
              proximoCliente: true,
              agendaDoDia: false,
              resumoDoDia: true,
            },
          },
        }),
      );
      const semAviso = await rodarRotinaEquipe(
        prisma,
        { contaId: conta, assistenteId, rotina: 'agenda', dia: '2026-12-04' },
        cedo,
      );
      expect(semAviso.aviso).toBeNull();
      expect(semAviso.proxima?.dados.dia).toBe('2026-12-05');

      const primeiras = await naMinhaConta((tx) => primeirasRotinas(tx, conta, assistenteId, cedo));
      expect(primeiras.map((t) => t.jobId)).toEqual([
        `rotina_${assistenteId}_agenda_2026-12-05`,
        `rotina_${assistenteId}_resumo_2026-12-04`,
      ]);

      await naMinhaConta((tx) =>
        tx.assistenteEquipe.update({
          where: { id: assistenteId },
          data: { confirmadoEm: null, telefone: null },
        }),
      );
      expect(
        await rodarRotinaEquipe(
          prisma,
          { contaId: conta, assistenteId, rotina: 'resumo', dia: '2026-12-04' },
          cedo,
        ),
      ).toEqual({ aviso: null, proxima: null });
    });
  });
});

describe('gestão no assistente (dono e gestor)', () => {
  const dona = '5511933330000';
  const dia = '2026-12-17'; // quinta
  const quando = new Date('2026-12-17T12:30:00Z'); // 09:30
  let assistenteId = '';
  let agId = '';
  const texto = (id: string) =>
    naMinhaConta((tx) => tx.mensagem.findUniqueOrThrow({ where: { id } })).then((m) => m.texto);

  beforeAll(async () => {
    await naMinhaConta(async (tx) => {
      const u = await tx.usuario.create({
        data: { nome: 'Ana Souza', email: `ana-${conta}@teste.dev` },
      });
      await tx.papelUsuario.create({ data: { usuarioId: u.id, papel: 'dono' } });
      const a = await tx.assistenteEquipe.create({
        data: { usuarioId: u.id, unidadeId, telefone: dona, confirmadoEm: quando, ativo: true },
      });
      assistenteId = a.id;
      const c = await tx.cliente.create({
        data: { nome: 'Marcos Prado', telefone: '5511922220000' },
      });
      const r = await criarAgendamentoNoBanco(tx, {
        unidadeId,
        profissionalId,
        clienteId: c.id,
        inicio: new Date(`${dia}T13:00:00.000Z`),
        servicoIds: [corte],
        origem: 'balcao',
        criadoPorId: null,
      });
      agId = r.agendamentoId;
    });
  });

  it('dona fora da agenda: RESUMO responde; a ajuda não fala de agenda nem comissão', async () => {
    expect(await fala(dona, 'resumo', quando)).toMatch(/^Hoje até agora · Centro\n\n💰 R\$/);
    const ajuda = await fala(dona, 'agenda', quando);
    expect(ajuda).toContain('RESUMO');
    expect(ajuda).not.toContain('COMISSÃO');
  });

  it('falta marcada: a dona recebe com o nome do cliente e de quem atenderia', async () => {
    const avisos = await naMinhaConta(async (tx) => {
      await tx.agendamento.update({ where: { id: agId }, data: { status: 'falta' } });
      return avisarFaltaParaGestao(tx, agId, quando);
    });
    expect(avisos).toHaveLength(1);
    expect(await texto(avisos[0]!.mensagemIds[0]!)).toBe(
      '🚫 Falta · Centro\nMarcos Prado não veio às 10:00 com Rafael.',
    );
  });

  it('nota baixa: sai uma vez só, com o comentário e o link do cliente', async () => {
    const avaliacaoId = await naMinhaConta(async (tx) => {
      const c = await tx.comanda.findFirstOrThrow({ where: { agendamentoId: agId } });
      const av = await tx.avaliacao.create({
        data: {
          unidadeId,
          comandaId: c.id,
          profissionalId,
          clienteId: c.clienteId!,
          telefone: '5511922220000',
          status: 'respondida',
          notaAtendimento: 2,
          comentario: 'Demorou',
          enviarEm: quando,
          respondidaEm: new Date('2026-12-17T14:00:00Z'),
          expiraEm: new Date('2026-12-18T12:00:00Z'),
        },
      });
      return av.id;
    });
    const primeiro = await avisarNotaBaixa(prisma, { contaId: conta, avaliacaoId }, quando);
    expect(primeiro).toHaveLength(1);
    const t = await texto(primeiro[0]!.mensagemIds[0]!);
    expect(t).toContain('Marcos Prado, atendido por Rafael: atendimento 2');
    expect(t).toContain('"Demorou"');
    expect(t).toContain('https://wa.me/5511922220000');
    expect(await avisarNotaBaixa(prisma, { contaId: conta, avaliacaoId }, quando)).toEqual([]);
  });

  it('resumo da unidade no fim do expediente, com falta e nota baixa; só a rotina de gestão', async () => {
    const r = await rodarRotinaEquipe(
      prisma,
      { contaId: conta, assistenteId, rotina: 'gestao', dia },
      new Date(`${dia}T15:15:00Z`),
    );
    const t = await texto(r.aviso!.mensagemIds[0]!);
    expect(t.split('\n')[0]).toBe('Resumo de hoje · Centro');
    expect(t).toContain('🚫 1 falta');
    expect(t).toContain('⚠️ 1 nota baixa');
    expect(r.proxima?.jobId).toBe(`rotina_${assistenteId}_gestao_2026-12-18`);

    const primeiras = await naMinhaConta((tx) => primeirasRotinas(tx, conta, assistenteId, quando));
    expect(primeiras.map((p) => p.dados.rotina)).toEqual(['gestao']);
  });

  it('quem não é dono nem gestor não recebe aviso de gestão', async () => {
    await naMinhaConta((tx) =>
      tx.papelUsuario.updateMany({
        where: { usuario: { email: `ana-${conta}@teste.dev` } },
        data: { papel: 'recepcao' },
      }),
    );
    expect(await naMinhaConta((tx) => avisarFaltaParaGestao(tx, agId, quando))).toEqual([]);
  });
});

describe('faltas e atendente', () => {
  it('3 faltas em 90 dias: o bot manda falar com a equipe em vez de agendar', async () => {
    const tel = '5511911110000';
    await fala(tel, 'oi');
    await naMinhaConta(async (tx) => {
      const c = await tx.cliente.findFirstOrThrow({ where: { telefone: tel } });
      for (const dia of ['2026-10-05', '2026-10-12', '2026-11-02']) {
        const r = await criarAgendamentoNoBanco(tx, {
          unidadeId,
          profissionalId,
          clienteId: c.id,
          inicio: new Date(`${dia}T13:00:00Z`),
          servicoIds: [corte],
          origem: 'balcao',
          criadoPorId: null,
        });
        await tx.agendamento.update({ where: { id: r.agendamentoId }, data: { status: 'falta' } });
      }
    });
    expect(await fala(tel, '1')).toContain('fale com a nossa equipe: responda ATENDENTE');
  });

  it('pediu atendente e ninguém respondeu em 2 h: o bot volta e avisa, uma vez só', async () => {
    const tel = '5511911112222';
    const pedido = new Date('2026-12-01T13:00:00Z');
    await fala(tel, 'oi', pedido);
    const r = await atenderMensagem(
      prisma,
      {
        tipo: 'mensagem',
        instancia,
        idExterno: randomUUID(),
        telefone: tel,
        nome: null,
        texto: 'atendente',
        recebidaEm: pedido.toISOString(),
      },
      { appUrl: 'http://app.teste', agora: pedido },
    );
    if (r.tipo !== 'respondida') throw new Error(r.tipo);
    expect(r.esperaAtendente).toBe(pedido.toISOString());
    const job = { contaId: conta, unidadeId, telefone: tel, desde: r.esperaAtendente! };
    const volta = await encerrarEsperaDoAtendente(prisma, job);
    const texto = await naMinhaConta((tx) =>
      tx.mensagem.findUniqueOrThrow({ where: { id: volta!.mensagemIds[0]! } }),
    );
    expect(texto.texto).toContain('Nossa equipe não conseguiu responder agora');
    const sessao = await naMinhaConta((tx) =>
      tx.botSessao.findFirstOrThrow({ where: { telefone: tel } }),
    );
    expect(sessao.atendenteDesde).toBeNull();
    expect(await encerrarEsperaDoAtendente(prisma, job)).toBeNull();
  });
});

describe('canal de agendamento', () => {
  const canal = (telefone: string) =>
    naMinhaConta((tx) => tx.cliente.findFirstOrThrow({ where: { telefone } })).then(
      (c) => c.canalPreferido,
    );

  it('escolhe o site: link com token curto (telefone fora da URL); da próxima vez o link vem direto', async () => {
    const tel = '5511933331111';
    await fala(tel, 'oi');
    await fala(tel, '1');
    const site = await fala(tel, '2');
    const token = /http:\/\/app\.teste\/agendar\?u=navalha-[a-z0-9]+&c=([A-Za-z0-9_-]{10})\n/.exec(
      site,
    )?.[1];
    expect(token).toBeDefined();
    expect(site).not.toContain(tel);
    expect(await canal(tel)).toBe('site');
    const t = await naMinhaConta((tx) =>
      tx.tokenAgendamento.findUnique({ where: { tokenHash: hashTokenAgendamento(token!) } }),
    );
    expect(t?.usadoEm).toBeNull();

    // Volta outro dia: "Agendar" já manda o link; "1" troca para a conversa.
    const depois = new Date(agora.getTime() + 3 * 3_600_000);
    await fala(tel, '0', depois);
    expect(await fala(tel, '1', depois)).toContain('Marque pelo site, com seu nome e telefone');
    expect(await fala(tel, '1', depois)).toContain('Qual serviço você quer?');
    expect(await canal(tel)).toBe('conversa');
  });

  it('"AGENDAR POR AQUI" (do site) vai direto para os serviços e guarda a conversa', async () => {
    const tel = '5511933332222';
    expect(await fala(tel, 'AGENDAR POR AQUI')).toContain('Qual serviço você quer?');
    expect(await canal(tel)).toBe('conversa');
  });
});

describe('notificações no celular (push)', () => {
  const quando = new Date('2026-12-01T12:30:00Z'); // terça, 09:30: dentro do expediente
  let agId = '';
  let usuarioId = '';

  it('sem aparelho ligado não monta nada; com aparelho, monta só perto do expediente', async () => {
    agId = await naMinhaConta(async (tx) => {
      usuarioId = (await tx.profissional.findUniqueOrThrow({ where: { id: profissionalId } }))
        .usuarioId;
      const c = await tx.cliente.create({
        data: { nome: 'Pedro Alves', telefone: '5511922223333' },
      });
      const r = await criarAgendamentoNoBanco(tx, {
        unidadeId,
        profissionalId,
        clienteId: c.id,
        inicio: new Date('2026-12-21T12:00:00Z'),
        servicoIds: [corte],
        origem: 'balcao',
        criadoPorId: null,
      });
      return r.agendamentoId;
    });
    expect(await naMinhaConta((tx) => notificacaoDoHorario(tx, agId, 'novo', quando))).toBeNull();
    await naMinhaConta((tx) =>
      tx.inscricaoPush.createMany({
        data: [
          {
            usuarioId,
            endpoint: 'https://push.teste/um',
            p256dh: 'chave-um-12345',
            auth: 'auth-um-123',
          },
          {
            usuarioId,
            endpoint: 'https://push.teste/dois',
            p256dh: 'chave-dois-1234',
            auth: 'auth-dois-12',
          },
        ],
      }),
    );
    expect(await naMinhaConta((tx) => notificacaoDoHorario(tx, agId, 'novo', quando))).toEqual({
      contaId: conta,
      usuarioId,
      titulo: 'Horário novo',
      corpo: 'Segunda, 21/12, 09:00 · Pedro · Corte',
      url: '/agenda',
      etiqueta: `horario-${agId}`,
    });
    // 23:00: fora da janela do expediente, não incomoda.
    expect(
      await naMinhaConta((tx) =>
        notificacaoDoHorario(tx, agId, 'novo', new Date('2026-12-02T02:00:00Z')),
      ),
    ).toBeNull();
  });

  it('entrega a cada aparelho e remove o que o serviço diz que não existe mais', async () => {
    const enviados: string[] = [];
    const r = await enviarNotificacao(
      prisma,
      { contaId: conta, usuarioId, titulo: 'Teste', corpo: 'Oi', url: '/agenda' },
      async (inscricao, carga) => {
        enviados.push(inscricao.endpoint);
        expect(JSON.parse(carga)).toMatchObject({ titulo: 'Teste', url: '/agenda' });
        return inscricao.endpoint.endsWith('dois') ? 410 : 201;
      },
    );
    expect(r).toEqual({ entregues: 1, aparelhos: 2, removidos: 1 });
    expect(enviados).toHaveLength(2);
    const restantes = await naMinhaConta((tx) =>
      tx.inscricaoPush.findMany({ where: { usuarioId } }),
    );
    expect(restantes.map((x) => x.endpoint)).toEqual(['https://push.teste/um']);
  });
});

describe('automações: retorno e aniversário', () => {
  const rotina = new Date('2026-12-01T13:00:00Z'); // terça, 10:00
  const tel = { a: '5511988880001', b: '5511988880002', c: '5511988880003', d: '5511988880004' };

  /** Visita fechada no dia (09:00 local), direto no banco. */
  async function visita(clienteId: string, dia: string, hora = '12:00') {
    await naMinhaConta(async (tx) => {
      const r = await criarAgendamentoNoBanco(tx, {
        unidadeId,
        profissionalId,
        clienteId,
        inicio: new Date(`${dia}T${hora}:00Z`),
        servicoIds: [corte],
        origem: 'balcao',
        criadoPorId: null,
      });
      await tx.comanda.update({
        where: { id: r.comandaId },
        data: { status: 'fechada', fechadaEm: new Date(`${dia}T${hora}:30Z`) },
      });
    });
  }
  async function cliente(
    telefone: string,
    extra: { aniversario?: string; consentimento?: boolean } = {},
  ) {
    await fala(telefone, 'oi', new Date('2026-09-01T12:00:00Z'));
    return naMinhaConta(async (tx) => {
      const c = await tx.cliente.findFirstOrThrow({ where: { telefone } });
      await tx.cliente.update({
        where: { id: c.id },
        data: {
          consentimentoMsg: extra.consentimento ?? true,
          ...(extra.aniversario ? { aniversario: new Date(`${extra.aniversario}T00:00:00Z`) } : {}),
        },
      });
      return c.id;
    });
  }
  const textosPara = (telefone: string) =>
    naMinhaConta((tx) =>
      tx.mensagem.findMany({
        where: { telefone, automacao: { not: null } },
        orderBy: { criadoEm: 'asc' },
      }),
    );

  it('convida quem passou do tempo de costume e dá parabéns no dia; respeita aceite e horário marcado', async () => {
    const a = await cliente(tel.a);
    await visita(a, '2026-10-01');
    await visita(a, '2026-10-22', '12:30'); // costume: 21 dias → em 01/12 passou
    const b = await cliente(tel.b, { aniversario: '1990-12-01' });
    await visita(b, '2026-11-25', '13:00'); // veio há pouco, mas é aniversário
    const c = await cliente(tel.c, { consentimento: false });
    await visita(c, '2026-10-02', '13:30');
    const d = await cliente(tel.d);
    await visita(d, '2026-10-03', '14:00');
    await naMinhaConta(async (tx) => {
      await criarAgendamentoNoBanco(tx, {
        unidadeId,
        profissionalId,
        clienteId: d,
        inicio: new Date('2026-12-28T12:00:00Z'),
        servicoIds: [corte],
        origem: 'balcao',
        criadoPorId: null,
      });
      await tx.conta.update({
        where: { id: conta },
        data: { automacoes: { retorno: true, retornoDiasPadrao: 30, aniversario: true } },
      });
    });
    expect(await contasComAutomacoes(prisma)).toContain(conta);

    const envios = await rodarAutomacoes(prisma, conta, rotina, 'http://app.teste');
    expect(envios.flatMap((e) => e.mensagemIds).length).toBeGreaterThanOrEqual(2);
    const [ma] = await textosPara(tel.a);
    expect(ma).toMatchObject({ automacao: 'retorno', status: 'pendente' });
    expect(ma!.texto).toContain('Faz um tempinho que você não passa na Barbearia Navalha');
    const mb = await textosPara(tel.b);
    expect(mb.map((m) => m.automacao)).toEqual(['aniversario']);
    expect(mb[0]!.texto).toMatch(/^Feliz aniversário, Cliente!/);
    expect(await textosPara(tel.c)).toEqual([]);
    expect(await textosPara(tel.d)).toEqual([]);

    // Rodou de novo no mesmo dia: nada repetido (um convite por ciclo, um parabéns por ano).
    const deNovo = await rodarAutomacoes(prisma, conta, new Date(rotina.getTime() + 3_600_000));
    expect(deNovo.flatMap((e) => e.mensagemIds).filter((id) => [ma!.id].includes(id))).toEqual([]);
    expect((await textosPara(tel.a)).length).toBe(1);
    expect((await textosPara(tel.b)).length).toBe(1);
  });

  it('números: enviadas, quem respondeu em 48 h e quem marcou em 7 dias', async () => {
    await naMinhaConta((tx) =>
      tx.mensagem.updateMany({
        where: { telefone: tel.a, automacao: 'retorno' },
        data: { criadoEm: rotina },
      }),
    );
    const resposta = new Date(rotina.getTime() + 2 * 3_600_000);
    await fala(tel.a, 'AGENDAR POR AQUI', resposta);
    const n = await naMinhaConta((tx) =>
      numerosDasAutomacoes(
        tx,
        { telefone: tel.a },
        new Date('2026-12-01T03:00:00Z'),
        new Date('2026-12-02T03:00:00Z'),
      ),
    );
    expect(n.find((x) => x.automacao === 'retorno')).toEqual({
      automacao: 'retorno',
      enviadas: 1,
      respondidas: 1,
      agendamentos: 0,
    });
  });
});

describe('clube: aviso de vencimento e opção no bot', () => {
  const rotina = new Date('2026-12-01T13:00:00Z');
  const tel = '5511977771212';
  let adesaoId = '';

  it('3 dias antes de renovar: aviso com plano, valor e data, e o Pix copia e cola; um por ciclo', async () => {
    await fala(tel, 'oi', new Date('2026-11-20T12:00:00Z'));
    adesaoId = await naMinhaConta(async (tx) => {
      const c = await tx.cliente.findFirstOrThrow({ where: { telefone: tel } });
      await tx.cliente.update({ where: { id: c.id }, data: { consentimentoMsg: true } });
      await tx.conta.update({
        where: { id: conta },
        data: { pix: { chave: 'pix@navalha.dev', nome: 'Barbearia Navalha', cidade: 'Sao Paulo' } },
      });
      const plano = await tx.itemClube.create({
        data: {
          unidadeId,
          tipo: 'assinatura',
          nome: 'Clube Navalha',
          valor: 9990,
          servicos: { create: [{ servicoId: corte, quantidade: 4 }] },
        },
      });
      const a = await tx.adesaoClube.create({
        data: {
          clienteId: c.id,
          itemClubeId: plano.id,
          inicio: new Date('2026-11-03T00:00:00Z'),
          vencimento: new Date('2026-12-03T00:00:00Z'),
        },
      });
      return a.id;
    });
    await rodarAutomacoes(prisma, conta, rotina, 'http://app.teste');
    const msgs = await naMinhaConta((tx) =>
      tx.mensagem.findMany({
        where: { telefone: tel, automacao: 'clube' },
        orderBy: { criadoEm: 'asc' },
      }),
    );
    expect(msgs).toHaveLength(2);
    expect(msgs[0]!.texto).toBe(
      'Oi, Cliente! Seu plano Clube Navalha na Barbearia Navalha renova em 03/12: R$ 99,90. Dá para pagar pelo Pix abaixo e mostrar o comprovante na recepção.'.replace(
        'R$ 99,90',
        formatarMoeda(9990),
      ),
    );
    expect(msgs[1]!.texto).toMatch(/^000201.*0115pix@navalha\.dev/);
    await rodarAutomacoes(prisma, conta, new Date(rotina.getTime() + 3_600_000));
    expect(
      await naMinhaConta((tx) =>
        tx.mensagem.count({ where: { telefone: tel, automacao: 'clube' } }),
      ),
    ).toBe(2);
    expect(
      (await naMinhaConta((tx) => tx.adesaoClube.findUniqueOrThrow({ where: { id: adesaoId } })))
        .avisoVencimentoEm,
    ).not.toBeNull();
  });

  it('o contexto do bot traz o plano do assinante e os planos da unidade', async () => {
    const ctx = await naMinhaConta(async (tx) => {
      const u = await tx.unidade.findUniqueOrThrow({
        where: { id: unidadeId },
        include: { profissionais: { include: { horarios: true } }, botConexao: true },
      });
      const c = await tx.cliente.findFirstOrThrow({ where: { telefone: tel } });
      return contextoDaConversa(tx, u, rotina, 'http://app.teste', {
        cliente: null,
        clienteId: c.id,
      });
    });
    expect(ctx.clube?.planos.map((p) => p.nome)).toContain('Clube Navalha');
    expect(ctx.clube?.assinatura).toMatchObject({
      plano: 'Clube Navalha',
      vencimento: '2026-12-03',
      emDia: true,
      restantes: [{ servico: 'Corte', restam: 4 }],
    });
  });
});

describe('lista de espera', () => {
  // Terça, 22/12, 09:00 local (12:00Z): o horário que vai vagar.
  const vagaInicio = '2026-12-22T12:00:00.000Z';
  const agoraEspera = new Date('2026-12-01T12:00:00Z');
  const tel = { dono: '5511944000001', b: '5511944000002', c: '5511944000003' };

  async function clienteQueConversou(telefone: string) {
    await fala(telefone, 'oi', new Date('2026-11-20T12:00:00Z'));
    return naMinhaConta(async (tx) => {
      const c = await tx.cliente.findFirstOrThrow({ where: { telefone } });
      await tx.cliente.update({ where: { id: c.id }, data: { consentimentoMsg: true } });
      return c.id;
    });
  }

  it('um cancelamento vira atendimento de quem está na lista, sem a recepção intervir', async () => {
    const dono = await clienteQueConversou(tel.dono);
    const b = await clienteQueConversou(tel.b);
    const c = await clienteQueConversou(tel.c);
    const agId = await naMinhaConta(async (tx) => {
      const r = await criarAgendamentoNoBanco(tx, {
        unidadeId,
        profissionalId,
        clienteId: dono,
        inicio: new Date(vagaInicio),
        servicoIds: [corte],
        origem: 'balcao',
        criadoPorId: null,
      });
      // B pediu primeiro (9h às 11h, com o Rafael); C depois (qualquer um).
      for (const [clienteId, prof] of [
        [b, profissionalId],
        [c, null],
      ] as const)
        await tx.listaEspera.create({
          data: {
            unidadeId,
            clienteId,
            profissionalId: prof,
            servicoIds: [corte],
            dia: new Date('2026-12-22T00:00:00Z'),
            deMin: 9 * 60,
            ateMin: 11 * 60,
            origem: 'balcao',
          },
        });
      return r.agendamentoId;
    });

    // O dono do horário cancela: a vaga vai para a lista, na ordem.
    const liberado = await naMinhaConta((tx) => cancelarPeloCliente(tx, agId, 'WhatsApp'));
    const oferta = await oferecerVaga(prisma, vagaDe(conta, liberado), agoraEspera);
    expect(oferta?.mensagemIds).toHaveLength(2);
    const textoB = await naMinhaConta((tx) =>
      tx.mensagem.findFirstOrThrow({ where: { telefone: tel.b, automacao: 'espera' } }),
    );
    expect(textoB.texto).toContain('Vagou um horário que você pediu:');
    expect(textoB.texto).toContain('09:00 com Rafael');

    // B responde "1" primeiro: leva; C fica sabendo que foi preenchido.
    const resposta = new Date(agoraEspera.getTime() + 5 * 60_000);
    expect(await fala(tel.b, '1', resposta)).toContain('Pronto, horário marcado');
    const marcado = await naMinhaConta((tx) =>
      tx.agendamento.findFirst({
        where: { clienteId: b, inicio: new Date(vagaInicio), status: 'agendado' },
        include: { comanda: true },
      }),
    );
    expect(marcado?.comanda?.status).toBe('prevista');
    const avisoC = await naMinhaConta((tx) =>
      tx.mensagem.findMany({
        where: { telefone: tel.c, automacao: 'espera' },
        orderBy: { criadoEm: 'asc' },
      }),
    );
    expect(avisoC.at(-1)?.texto).toContain('acabou de ser preenchido');
    const pedidos = await naMinhaConta((tx) =>
      tx.listaEspera.findMany({
        where: { clienteId: { in: [b, c] } },
        orderBy: { criadoEm: 'asc' },
      }),
    );
    expect(pedidos.map((x) => x.status)).toEqual(['atendido', 'aguardando']);

    // C responde depois: a oferta não vale mais.
    expect(await fala(tel.c, '1', new Date(resposta.getTime() + 60_000))).toContain(
      'não vale mais',
    );
  });
});

describe('lista de espera pela conversa e "avisar se vagar antes"', () => {
  // Segunda, 28/12, 09:00 local; o dia de interesse é a terça, 29/12.
  const seg = new Date('2026-12-28T12:00:00Z');
  const ocupante = '5511944100000';

  it('empurrado para depois: pergunta, entra na lista e, quando vaga antes, antecipa com "1"', async () => {
    // Das 9h às 10h30 da terça tudo ocupado por outra pessoa.
    await fala(ocupante, 'oi', seg);
    const ocupados = await naMinhaConta(async (tx) => {
      const c = await tx.cliente.findFirstOrThrow({ where: { telefone: ocupante } });
      const ids: string[] = [];
      for (const h of ['12:00', '12:30', '13:00']) {
        const r = await criarAgendamentoNoBanco(tx, {
          unidadeId,
          profissionalId,
          clienteId: c.id,
          inicio: new Date(`2026-12-29T${h}:00Z`),
          servicoIds: [corte],
          origem: 'balcao',
          criadoPorId: null,
        });
        ids.push(r.agendamentoId);
      }
      return ids;
    });
    const tel = '5511944100001';
    await fala(tel, 'oi', seg);
    await naMinhaConta(async (tx) => {
      const c = await tx.cliente.findFirstOrThrow({ where: { telefone: tel } });
      await tx.cliente.update({ where: { id: c.id }, data: { consentimentoMsg: true } });
    });
    await comecarAgendar(tel, seg);
    await fala(tel, '2', seg); // Corte
    const horarios = await fala(tel, '2', seg); // amanhã (terça)
    expect(horarios).toMatch(/1\. 10:30/);
    expect(horarios).toContain('Nenhum serve: me avise se vagar neste dia');
    await fala(tel, '1', seg); // 10:30, o primeiro livre
    const marcado = await fala(tel, '1', seg);
    expect(marcado).toContain('Pronto, horário marcado!');
    expect(marcado).toContain('Quer que eu avise se vagar um horário antes do seu');
    expect(await fala(tel, '1', seg)).toContain('Se vagar um horário antes do seu');
    const pedido = await naMinhaConta((tx) =>
      tx.listaEspera.findFirstOrThrow({ where: { cliente: { telefone: tel } } }),
    );
    expect(pedido).toMatchObject({ origem: 'antecipar', deMin: 0, ateMin: 10 * 60 + 15 });
    expect(pedido.agendamentoId).toBeTruthy();

    // O das 9h desmarca: a vaga vai para ele, que antecipa.
    const liberado = await naMinhaConta((tx) => cancelarPeloCliente(tx, ocupados[0]!, 'WhatsApp'));
    const oferta = await oferecerVaga(
      prisma,
      vagaDe(conta, liberado),
      new Date(seg.getTime() + 3_600_000),
    );
    expect(oferta?.mensagemIds).toHaveLength(1);
    expect(await fala(tel, '1', new Date(seg.getTime() + 3_700_000))).toContain('antecipado');
    const ag = await naMinhaConta((tx) =>
      tx.agendamento.findUniqueOrThrow({ where: { id: pedido.agendamentoId! } }),
    );
    expect(ag.inicio.toISOString()).toBe('2026-12-29T12:00:00.000Z');
  });

  it('"nenhum serve" na lista de horários põe o cliente na lista daquele dia', async () => {
    const tel = '5511944100002';
    await fala(tel, 'oi', seg);
    await comecarAgendar(tel, seg);
    await fala(tel, '2', seg);
    const horarios = await fala(tel, '2', seg);
    const n = /(\d+)\. Nenhum serve/.exec(horarios)![1]!;
    expect(await fala(tel, n, seg)).toContain('Se vagar um horário nesse dia, eu te aviso');
    const pedido = await naMinhaConta((tx) =>
      tx.listaEspera.findFirstOrThrow({ where: { cliente: { telefone: tel } } }),
    );
    expect(pedido).toMatchObject({ origem: 'bot', deMin: 0, ateMin: 1440, servicoIds: [corte] });
    expect(pedido.dia.toISOString().slice(0, 10)).toBe('2026-12-29');
  });
});
