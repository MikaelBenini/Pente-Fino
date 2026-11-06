// Etapa 11: link do cliente para ver, remarcar ou cancelar o próprio horário, sem login.
import type { INestApplication } from '@nestjs/common';
import { criarPrisma, naConta, type PrismaClient } from '@pente-fino/db';
import { dataLocal, type HorarioDoLink } from '@pente-fino/shared';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let a: Cenario;
let dono: Awaited<ReturnType<typeof como>>;
let prisma: PrismaClient;
let prof = '';
let corte = '';
const http = () => request(app.getHttpServer());
const dia = (n: number) => {
  const d = new Date(`${dataLocal(new Date())}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const slug = `e2e-${randomUUID().slice(0, 8)}`;

/** Agenda pelo site no dia e devolve o token do link de gerenciamento. */
async function agendar(data: string, telefone: string, indice = 0) {
  const livres = (
    await http()
      .get(`/publico/agendamento/${slug}/horarios?data=${data}&servicoIds=${corte}`)
      .expect(200)
  ).body[0].inicios as string[];
  const r = await http()
    .post(`/publico/agendamento/${slug}`)
    .send({
      nome: 'Cliente do Link',
      telefone,
      servicoIds: [corte],
      profissionalId: prof,
      inicio: livres[indice],
    })
    .expect(201);
  expect(r.body.linkGerenciar).toMatch(/^\/horario\?t=[A-Za-z0-9_-]{22}$/);
  return { token: (r.body.linkGerenciar as string).split('=')[1]!, inicio: livres[indice]! };
}

beforeAll(async () => {
  app = await criarApp();
  a = await criarCenario();
  dono = await como(app, a.emails.dono);
  prisma = criarPrisma();
  await dono
    .patch(`/unidades/${a.unidadeA}`, {
      diasTrabalho: [0, 1, 2, 3, 4, 5, 6],
      telefone: '(11) 3000-0000',
      slug,
      agendamentoPublico: true,
    })
    .expect(200);
  const usuarios = (await dono.get('/usuarios')).body as { id: string; email: string }[];
  prof = (
    await dono
      .post('/profissionais', {
        unidadeId: a.unidadeA,
        usuarioId: usuarios.find((u) => u.email === a.emails.barbeiro)!.id,
        dataEntrada: dia(-10),
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
      vigenciaInicio: dataLocal(new Date()),
      precos: [{ servicoId: corte, unidadeId: a.unidadeA, valor: 5000 }],
    })
    .expect(201);
});

afterAll(async () => {
  await prisma.$disconnect();
  await a.remover();
  await app.close();
});

describe('link do horário', () => {
  it('abre o horário sem login, sem dado pessoal; token errado não abre', async () => {
    const { token, inicio } = await agendar(dia(2), '11977771001');
    const h = (await http().get(`/publico/horario/${token}`).expect(200)).body as HorarioDoLink;
    expect(h).toMatchObject({
      unidade: 'Unidade A',
      inicio: new Date(inicio).toISOString(),
      servicos: ['Corte'],
      total: 5000,
      profissional: 'Barbeiro',
      situacao: 'marcado',
      podeMudar: true,
      linkWhatsapp: 'https://wa.me/551130000000',
    });
    expect(JSON.stringify(h)).not.toMatch(/11977771001|contaId|email/);
    // O banco guarda só o hash.
    const linha = await naConta(prisma, a.contaId, (tx) => tx.linkHorario.findFirstOrThrow());
    expect(linha.tokenHash).not.toContain(token);
    await http()
      .get(`/publico/horario/${'x'.repeat(22)}`)
      .expect(404);
    await http().get('/publico/horario/curto').expect(400);
  });

  it('remarca para outro horário livre do mesmo profissional e fica na auditoria', async () => {
    const { token, inicio } = await agendar(dia(3), '11977771002');
    const livres = (
      await http()
        .get(`/publico/horario/${token}/horarios?data=${dia(4)}`)
        .expect(200)
    ).body as { profissionalId: string; inicios: string[] }[];
    expect(livres.map((l) => l.profissionalId)).toEqual([prof]);
    const novo = livres[0]!.inicios[1]!;
    const h = (
      await http().post(`/publico/horario/${token}/remarcar`).send({ inicio: novo }).expect(200)
    ).body as HorarioDoLink;
    expect(h.inicio).toBe(new Date(novo).toISOString());
    const audit = await naConta(prisma, a.contaId, (tx) =>
      tx.auditoria.findFirst({
        where: { acao: 'remarcar_pelo_cliente' },
        orderBy: { criadoEm: 'desc' },
      }),
    );
    expect(audit).toMatchObject({ usuarioId: null, motivo: 'Remarcado pelo cliente (link)' });
    expect((audit!.antes as { inicio: string }).inicio).toBe(new Date(inicio).toISOString());
    // Horário ocupado por outra pessoa: recusa.
    const outro = await agendar(dia(5), '11977771003');
    await http()
      .post(`/publico/horario/${token}/remarcar`)
      .send({ inicio: outro.inicio })
      .expect(409);
  });

  it('cancela: libera o horário, não conta falta, e o link mostra cancelado sem botões', async () => {
    const { token } = await agendar(dia(6), '11977771004');
    const h = (await http().post(`/publico/horario/${token}/cancelar`).send({}).expect(200))
      .body as HorarioDoLink;
    expect(h).toMatchObject({ situacao: 'cancelado', podeMudar: false });
    await http().post(`/publico/horario/${token}/cancelar`).send({}).expect(409);
    await http()
      .post(`/publico/horario/${token}/remarcar`)
      .send({ inicio: `${dia(7)}T10:00:00-03:00` })
      .expect(409);
  });

  it('dentro do prazo da unidade só mostra; mudar fica com a barbearia', async () => {
    const { token } = await agendar(dia(1), '11977771005');
    await naConta(prisma, a.contaId, (tx) =>
      tx.unidade.update({
        where: { id: a.unidadeA },
        data: { regrasAgendamento: { prazoMudarMin: 2880 } },
      }),
    );
    const h = (await http().get(`/publico/horario/${token}`).expect(200)).body as HorarioDoLink;
    expect(h).toMatchObject({ situacao: 'marcado', podeMudar: false });
    expect(h.motivo).toContain('48 horas antes');
    await http().post(`/publico/horario/${token}/cancelar`).send({}).expect(409);
  });
});
