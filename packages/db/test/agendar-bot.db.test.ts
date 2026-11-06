// Etapa 11: agendar pela conversa do WhatsApp, do "oi" ao horário marcado.
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  atenderMensagem,
  avisarProximoCliente,
  criarAgendamentoNoBanco,
  lembretesDoAgendamento,
  primeirasRotinas,
  rodarRotinaEquipe,
  criarPrisma,
  enviarLembrete,
  hashCodigoAssistente,
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
    const servicos = await fala(tel, '1');
    expect(servicos).toContain('1. Barba · R$ 35,00 · 30 min\n2. Corte · R$ 45,00 · 30 min');
    expect(servicos).toContain('pelo site? http://app.teste/agendar?u=navalha-');
    // Um profissional só: pula a escolha e vai direto aos dias.
    const dias = await fala(tel, '1 e 2');
    expect(dias).toMatch(/Qual dia fica melhor\?\n\n1\. Hoje \(ter, 01\/12\)/);
    const horarios = await fala(tel, '1');
    expect(horarios).toContain('Horários livres hoje (ter, 01/12):\n\n1. 09:00\n2. 09:15');
    expect(horarios).toContain('7. Ver mais horários\n0. Outro dia');
    const mais = await fala(tel, '7');
    expect(mais).toMatch(/1\. 10:30/);
    const resumo = await fala(tel, '1');
    expect(resumo).toContain(
      '✂️ Barba + Corte\n💈 Com Rafael\n📅 Hoje (ter, 01/12), às 10:30\n💰 R$ 80,00',
    );
    const pronto = await fala(tel, '1');
    expect(pronto).toContain('Pronto, horário marcado! ✅');

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
    await fala(t2, '1');
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
    await fala(tel, '1');
    const dias = await fala(tel, '2'); // Corte → dias
    expect(dias).toContain('Qual dia fica melhor?');
    expect(dias).not.toContain('Hoje');
  });

  it('intervalo de 30 min: o horário colado num atendimento sai da lista', async () => {
    await regras({ antecedenciaMin: 0, intervaloMin: 30 });
    const tel = '5511955550003';
    await fala(tel, 'oi');
    await fala(tel, '1');
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
      await fala(cli, '1', quando);
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
