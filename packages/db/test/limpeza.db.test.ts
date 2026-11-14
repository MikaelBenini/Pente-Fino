// Exclusão automática de dados (Etapa 15.4): o que passou de 90 dias sai em lotes, avaliação
// perde só o comentário, conta parada ou sem confirmação sai com registro na auditoria da
// plataforma e conta com cobrança viva no Asaas fica retida.
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  apagarContaNaLimpeza,
  avisosDeExclusao,
  contasParaLimpeza,
  criarPrisma,
  limparDadosDaConta,
  limparSessoesDaAdministracao,
  limparVisitasDoSite,
  naConta,
  situacaoDaContaNaLimpeza,
  type PrismaClient,
} from '../src/index.js';

const envDaRaiz = new URL('../../../.env', import.meta.url);
if (existsSync(envDaRaiz)) process.loadEnvFile(envDaRaiz);

let app: PrismaClient;
let plataforma: PrismaClient;
const ativa = randomUUID();
const semConfirmar = randomUUID();
const cancelada = randomUUID();
const comAsaas = randomUUID();
const agora = new Date('2027-06-01T15:00:00Z');
const velho = new Date('2027-01-01T12:00:00Z'); // mais de 90 dias antes de "agora"
const recente = new Date('2027-05-20T12:00:00Z');
let avaliacaoId = '';

async function criarConta(id: string, dados: object, donoConfirmado = true) {
  await naConta(app, id, async (tx) => {
    await tx.conta.create({ data: { id, nome: `Barbearia ${id.slice(0, 4)}`, ...dados } });
    const dono = await tx.usuario.create({
      data: {
        nome: 'Dono Teste',
        email: `dono-${id.slice(0, 8)}@limpeza.dev`,
        emailConfirmadoEm: donoConfirmado ? new Date() : null,
      },
    });
    await tx.papelUsuario.create({ data: { usuarioId: dono.id, papel: 'dono' } });
  });
}

beforeAll(async () => {
  app = criarPrisma();
  plataforma = criarPrisma(process.env.DATABASE_PLATAFORMA_URL);
  await criarConta(ativa, { status: 'ativa' });
  await naConta(app, ativa, async (tx) => {
    const unidade = await tx.unidade.create({ data: { nome: 'Centro' } });
    const usuario = await tx.usuario.findFirstOrThrow();
    const cliente = await tx.cliente.create({ data: { nome: 'Caio', telefone: '5511900001111' } });
    const msg = (criadoEm: Date, i: number) => ({
      unidadeId: unidade.id,
      telefone: '5511900001111',
      direcao: 'entrada' as const,
      texto: `oi ${i}`,
      status: 'recebida' as const,
      criadoEm,
    });
    // 5 velhas (saem em lotes de 2) e 1 recente (fica).
    await tx.mensagem.createMany({
      data: [...[0, 1, 2, 3, 4].map((i) => msg(velho, i)), msg(recente, 9)],
    });
    await tx.tokenAcesso.createMany({
      data: [
        { usuarioId: usuario.id, tipo: 'renovacao', hash: randomUUID(), expiraEm: velho },
        { usuarioId: usuario.id, tipo: 'renovacao', hash: randomUUID(), expiraEm: recente },
      ],
    });
    await tx.aviso.createMany({
      data: [
        { usuarioId: usuario.id, tipo: 'x', titulo: 'Lido', texto: '.', chave: 'a', lidoEm: velho },
        { usuarioId: usuario.id, tipo: 'x', titulo: 'Não lido', texto: '.', chave: 'b' },
      ],
    });
    const profissional = await tx.profissional.create({
      data: { usuarioId: usuario.id, unidadeId: unidade.id, dataEntrada: velho },
    });
    const comanda = await tx.comanda.create({
      data: { unidadeId: unidade.id, profissionalId: profissional.id, clienteId: cliente.id },
    });
    const av = await tx.avaliacao.create({
      data: {
        unidadeId: unidade.id,
        comandaId: comanda.id,
        profissionalId: profissional.id,
        clienteId: cliente.id,
        telefone: '5511900001111',
        status: 'respondida',
        notaAtendimento: 5,
        comentario: 'Ótimo corte',
        respondidaEm: velho,
        enviarEm: velho,
        expiraEm: new Date(velho.getTime() + 86_400_000),
        criadoEm: velho,
      },
    });
    avaliacaoId = av.id;
  });
  // Cadastro pelo site em 20/05, sem confirmar: aviso em 25/05, sai em 27/05.
  await criarConta(
    semConfirmar,
    { status: 'teste', criadoEm: new Date('2027-05-20T15:00:00Z') },
    false,
  );
  await criarConta(cancelada, {
    status: 'cancelada',
    canceladaEm: new Date('2027-02-01T15:00:00Z'),
  });
  await criarConta(comAsaas, {
    status: 'teste',
    testeAte: new Date('2027-01-01T15:00:00Z'),
    asaasAssinaturaId: `sub_${comAsaas}`,
  });
});

afterAll(async () => {
  for (const id of [ativa, semConfirmar, cancelada, comAsaas])
    await naConta(app, id, (tx) => tx.conta.deleteMany({ where: { id } }));
  await app.$disconnect();
  await plataforma.$disconnect();
});

describe('limpeza de dados', () => {
  it('a rotina enxerga contas de qualquer situação', async () => {
    const ids = (await contasParaLimpeza(app)).map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining([ativa, semConfirmar, cancelada, comAsaas]));
    // Fora da rotina, nada de lista entre contas.
    expect(await app.conta.count({ where: { id: cancelada } })).toBe(0);
  });

  it('em toda conta: o que passou de 90 dias sai em lotes; avaliação perde só o comentário', async () => {
    const r = await limparDadosDaConta(app, ativa, { agora, lote: 2 });
    expect(r).toMatchObject({ mensagens: 5, tokens: 1, avisosLidos: 1, comentarios: 1 });
    const sobrou = await naConta(app, ativa, async (tx) => ({
      mensagens: await tx.mensagem.count(),
      tokens: await tx.tokenAcesso.count(),
      avisos: await tx.aviso.count(),
      avaliacao: await tx.avaliacao.findUniqueOrThrow({ where: { id: avaliacaoId } }),
    }));
    expect(sobrou).toMatchObject({ mensagens: 1, tokens: 1, avisos: 1 });
    expect(sobrou.avaliacao).toMatchObject({ comentario: null, notaAtendimento: 5 });
    // De novo: nada a apagar.
    expect(
      Object.values(await limparDadosDaConta(app, ativa, { agora })).every((n) => n === 0),
    ).toBe(true);
  });

  it('decide por conta: ativa fica, sem confirmar avisa e depois sai, parada sai, com Asaas é retida', async () => {
    expect((await situacaoDaContaNaLimpeza(app, ativa, agora))!.decisao).toEqual({
      tipo: 'manter',
    });

    const aviso = (await situacaoDaContaNaLimpeza(
      app,
      semConfirmar,
      new Date('2027-05-25T15:00:00Z'),
    ))!;
    expect(aviso.decisao).toMatchObject({ tipo: 'avisar', motivo: 'sem_confirmar', dias: 2 });
    // Admin U9: a previsão bate com o aviso (2 dias depois), e a ativa não tem previsão.
    expect(aviso.prevista).toEqual({ motivo: 'sem_confirmar', apagaEm: '2027-05-27' });
    expect((await situacaoDaContaNaLimpeza(app, ativa, agora))!.prevista).toBeNull();
    const [email] = avisosDeExclusao('Barbearia X', aviso, { appUrl: 'https://pf.dev' });
    expect(email).toMatchObject({ para: `dono-${semConfirmar.slice(0, 8)}@limpeza.dev` });
    expect(email!.assunto).toContain('Confirme seu e-mail');
    expect(email!.html).toContain('27/05/2027');
    expect(email!.html).toContain('https://pf.dev/entrar');

    const parada = (await situacaoDaContaNaLimpeza(app, cancelada, agora))!;
    expect(parada).toMatchObject({ decisao: { tipo: 'apagar', motivo: 'parada' }, retencao: null });

    const retida = (await situacaoDaContaNaLimpeza(app, comAsaas, agora))!;
    expect(retida.decisao.tipo).toBe('apagar');
    expect(retida.retencao).toContain('Asaas');
  });

  it('apagar a conta leva tudo junto e a auditoria da plataforma guarda que ela saiu', async () => {
    await apagarContaNaLimpeza(app, cancelada, 'Barbearia Cancelada', 'parada');
    expect((await contasParaLimpeza(app)).map((c) => c.id)).not.toContain(cancelada);
    const usuarios = await naConta(app, cancelada, (tx) => tx.usuario.count());
    expect(usuarios).toBe(0);
    const registro = await plataforma.auditoriaPlataforma.findFirstOrThrow({
      where: { contaAfetadaId: cancelada, acao: 'conta_apagada' },
    });
    expect(registro).toMatchObject({ depois: { conta: 'Barbearia Cancelada' } });
    expect(registro.motivo).toContain('90 dias');
  });

  it('visitas da página de vendas: passou de 90 dias sai; a aplicação não lê a tabela', async () => {
    const visitaId = randomUUID();
    await plataforma.eventoVisitaSite.createMany({
      data: [
        { visitaId, tipo: 'entrada', pagina: '/', criadoEm: new Date('2020-01-01') },
        { visitaId, tipo: 'clique', pagina: '/', valor: 'planos' },
      ],
    });
    expect(await limparVisitasDoSite(app)).toBeGreaterThanOrEqual(1);
    expect(await plataforma.eventoVisitaSite.count({ where: { visitaId } })).toBe(1);
    await expect(app.eventoVisitaSite.count()).rejects.toThrow();
  });

  it('sessões antigas da administração saem; a rotina grava a execução', async () => {
    const u = await plataforma.usuarioPlataforma.create({
      data: {
        email: `limpeza-${ativa.slice(0, 8)}@pf.dev`,
        nome: 'Lia',
        papel: 'admin',
        senhaHash: 'x',
      },
    });
    await plataforma.sessaoPlataforma.createMany({
      data: [
        { usuarioId: u.id, tokenHash: randomUUID(), expiraEm: new Date('2020-01-01') },
        { usuarioId: u.id, tokenHash: randomUUID(), expiraEm: new Date(Date.now() + 3_600_000) },
      ],
    });
    expect(await limparSessoesDaAdministracao(app)).toBeGreaterThanOrEqual(1);
    expect(await plataforma.sessaoPlataforma.count({ where: { usuarioId: u.id } })).toBe(1);
    await plataforma.usuarioPlataforma.update({ where: { id: u.id }, data: { ativo: false } });

    const e = await app.execucaoLimpeza.create({ data: { apagados: { mensagens: 1 } } });
    expect(
      (await plataforma.execucaoLimpeza.findUniqueOrThrow({ where: { id: e.id } })).apagados,
    ).toEqual({
      mensagens: 1,
    });
  });
});
