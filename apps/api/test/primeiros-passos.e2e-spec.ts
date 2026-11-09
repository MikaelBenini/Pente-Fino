// Tutorial do Início (Etapa 23): cada passo se marca sozinho pelo que a barbearia já fez.
import type { INestApplication } from '@nestjs/common';
import { criarPrisma, naConta } from '@pente-fino/db';
import { progressoPrimeirosPassos, type EstadoPrimeirosPassos } from '@pente-fino/shared';
import type { App } from 'supertest/types.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let a: Cenario;

beforeAll(async () => {
  app = await criarApp();
  a = await criarCenario();
});

afterAll(async () => {
  await a.remover();
  await app.close();
});

it('marca os passos pelo que existe; o barbeiro não acessa', async () => {
  const dono = await como(app, a.emails.dono);
  await (await como(app, a.emails.barbeiro)).get('/conta/primeiros-passos').expect(403);
  const antes = (await dono.get('/conta/primeiros-passos').expect(200))
    .body as EstadoPrimeirosPassos;
  // O cenário já tem gestor, recepção e barbeiro com acesso: convite feito; o resto não.
  expect(antes).toMatchObject({ convite: true, servicos: false, whatsapp: false, comanda: false });

  const servico = (
    await dono
      .post('/servicos', {
        nome: 'Corte',
        duracaoMin: 30,
        custoProduto: 0,
        ehExtra: false,
        pesoAtendimento: 1,
      })
      .expect(201)
  ).body.id as string;
  const prisma = criarPrisma();
  await naConta(prisma, a.contaId, (tx) =>
    tx.precoServico.create({
      data: { servicoId: servico, unidadeId: a.unidadeA, valor: 5000, vigenciaInicio: new Date() },
    }),
  );
  await prisma.$disconnect();
  const depois = (await dono.get('/conta/primeiros-passos').expect(200))
    .body as EstadoPrimeirosPassos;
  expect(depois.servicos).toBe(true);
  expect(progressoPrimeirosPassos(depois).feitos).toBe(progressoPrimeirosPassos(antes).feitos + 1);
});
