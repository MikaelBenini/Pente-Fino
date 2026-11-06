// Etapa 11: assistente da equipe no WhatsApp pelo Perfil.
import type { INestApplication } from '@nestjs/common';
import {
  criarPrisma,
  hashCodigoAssistente,
  instanciaDaUnidade,
  naConta,
  type PrismaClient,
} from '@pente-fino/db';
import {
  dataLocal,
  type CodigoAssistente,
  type EstadoAssistente,
  type EstadoPush,
} from '@pente-fino/shared';
import type { App } from 'supertest/types.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

// A API só repassa a chave pública ao navegador: no CI (sem chaves no .env), uma de teste.
process.env.VAPID_CHAVE_PUBLICA ||= 'BTeste' + 'x'.repeat(80);

let app: INestApplication<App>;
let a: Cenario;
type Cliente = Awaited<ReturnType<typeof como>>;
let dono: Cliente;
let barbeiro: Cliente;
let recepcao: Cliente;
let prisma: PrismaClient;

beforeAll(async () => {
  app = await criarApp();
  a = await criarCenario();
  dono = await como(app, a.emails.dono);
  barbeiro = await como(app, a.emails.barbeiro);
  recepcao = await como(app, a.emails.recepcao);
  prisma = criarPrisma();
});

afterAll(async () => {
  await prisma.$disconnect();
  await a.remover();
  await app.close();
});

describe('assistente da equipe', () => {
  it('quem não está na agenda não tem assistente', async () => {
    await recepcao.get('/me/assistente').expect(404);
  });

  it('barbeiro liga: código de 6 dígitos com o link da unidade; o código fica só como hash', async () => {
    const usuarios = (await dono.get('/usuarios')).body as { id: string; email: string }[];
    await dono
      .post('/profissionais', {
        unidadeId: a.unidadeA,
        usuarioId: usuarios.find((u) => u.email === a.emails.barbeiro)!.id,
        dataEntrada: dataLocal(new Date()),
        comissaoServico: { percentualBp: 4000, valorFixo: null },
        comissaoProduto: { percentualBp: 1000, valorFixo: null },
      })
      .expect(201);
    await naConta(prisma, a.contaId, (tx) =>
      tx.botConexao.create({
        data: {
          unidadeId: a.unidadeA,
          instancia: instanciaDaUnidade(a.unidadeA),
          status: 'conectado',
          numero: '5511900003333',
        },
      }),
    );
    expect((await barbeiro.get('/me/assistente').expect(200)).body).toMatchObject({
      situacao: 'desligado',
      unidade: 'Unidade A',
      whatsappConectado: true,
    });
    const c = (await barbeiro.post('/me/assistente').expect(201)).body as CodigoAssistente;
    expect(c.codigo).toMatch(/^\d{6}$/);
    expect(c.link).toBe(`https://wa.me/5511900003333?text=ATIVAR%20${c.codigo}`);
    const linha = await naConta(prisma, a.contaId, (tx) => tx.assistenteEquipe.findFirstOrThrow());
    expect(linha.codigoHash).toBe(hashCodigoAssistente(c.codigo));
    expect(JSON.stringify(linha)).not.toContain(`"${c.codigo}"`);
    expect((await barbeiro.get('/me/assistente').expect(200)).body.situacao).toBe('aguardando');
  });

  it('ligado: escolhe os avisos e desliga', async () => {
    await naConta(prisma, a.contaId, (tx) =>
      tx.assistenteEquipe.updateMany({
        data: { telefone: '5511944449999', confirmadoEm: new Date(), ativo: true },
      }),
    );
    const r = (
      await barbeiro
        .put('/me/assistente/avisos', { horarioNovo: false, mudancas: true })
        .expect(200)
    ).body as EstadoAssistente;
    expect(r).toMatchObject({
      situacao: 'ligado',
      telefone: '5511944449999',
      avisos: { horarioNovo: false, mudancas: true },
    });
    const d = (await barbeiro.delete('/me/assistente').expect(200)).body as EstadoAssistente;
    expect(d).toMatchObject({ situacao: 'desligado', telefone: null });
  });

  it('dono fora da agenda tem o assistente só com os avisos de gestão; barbeiro, só os da agenda', async () => {
    const d = (await dono.get('/me/assistente').expect(200)).body as EstadoAssistente;
    expect(d).toMatchObject({ unidade: 'Unidade A', situacao: 'desligado' });
    expect(d.disponiveis).toEqual(['faltas', 'notaBaixa', 'resumoGestao']);
    const b = (await barbeiro.get('/me/assistente').expect(200)).body as EstadoAssistente;
    expect(b.disponiveis).not.toContain('faltas');
    expect(b.disponiveis).toContain('proximoCliente');
    await recepcao.get('/me/assistente').expect(404);
  });
});

describe('notificações no celular (push)', () => {
  const inscricao = {
    endpoint: 'https://push.teste.pentefino.dev/aparelho-1',
    expirationTime: null,
    keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) },
  };

  it('liga e desliga por aparelho; o teste vai para a fila do worker', async () => {
    const antes = (await barbeiro.get('/me/push').expect(200)).body as EstadoPush;
    expect(antes.chavePublica).toBeTruthy();
    expect(antes.aparelhos).toBe(0);
    expect((await barbeiro.post('/me/push', inscricao).expect(200)).body.aparelhos).toBe(1);
    // O mesmo aparelho de novo não duplica.
    expect((await barbeiro.post('/me/push', inscricao).expect(200)).body.aparelhos).toBe(1);
    // Cada um vê só os próprios aparelhos.
    expect((await dono.get('/me/push').expect(200)).body.aparelhos).toBe(0);
    await barbeiro.post('/me/push/teste', {}).expect(202);
    expect(
      (await barbeiro.post('/me/push/remover', { endpoint: inscricao.endpoint }).expect(200)).body
        .aparelhos,
    ).toBe(0);
    await barbeiro.post('/me/push', { endpoint: 'nao-e-url', keys: {} }).expect(400);
  });
});
