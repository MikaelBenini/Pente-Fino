// Etapa 15: recursos por plano aplicados na API. Uma conta Básico não usa recurso do Pro,
// uma Pro não usa o do Premium; ler o que já foi lançado continua livre.
import type { INestApplication } from '@nestjs/common';
import { criarPrisma, naConta, type PrismaClient } from '@pente-fino/db';
import type { EstadoDaConta, PlanoConta, UnidadePublica } from '@pente-fino/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let a: Cenario;
let prisma: PrismaClient;
type Cliente = Awaited<ReturnType<typeof como>>;
let dono: Cliente;
let barbeiro: Cliente;
const hoje = new Date().toISOString().slice(0, 10);
const http = () => request(app.getHttpServer());

async function mudarPlano(plano: PlanoConta) {
  await naConta(prisma, a.contaId, (tx) => tx.conta.updateMany({ data: { plano } }));
  // O plano fica guardado 15 s na API: um app novo lê na hora.
  await app.close();
  app = await criarApp();
  dono = await como(app, a.emails.dono);
  barbeiro = await como(app, a.emails.barbeiro);
}

beforeAll(async () => {
  prisma = criarPrisma();
  app = await criarApp();
  a = await criarCenario();
  dono = await como(app, a.emails.dono);
  barbeiro = await como(app, a.emails.barbeiro);
});

afterAll(async () => {
  await prisma.$disconnect();
  await a.remover();
  await app.close();
});

const bloqueado = (r: request.Response) => {
  expect(r.status).toBe(403);
  expect(r.body.erro.codigo).toBe('recurso_do_plano');
  return r.body.erro.mensagem as string;
};

describe('recursos por plano', () => {
  it('Básico: os do Pro respondem 403 com o convite; ler o clube continua livre', async () => {
    await mudarPlano('basico');
    expect(((await dono.get('/conta/situacao').expect(200)).body as EstadoDaConta).plano).toBe(
      'basico',
    );
    // Comissões vêm em todos os planos (estudo de planos, 12/11/2026).
    await dono.get(`/comissoes?de=${hoje}&ate=${hoje}`).expect(200);
    await barbeiro.get(`/me/comissoes?de=${hoje}&ate=${hoje}`).expect(200);
    expect(bloqueado(await dono.get(`/canais?de=${hoje}&ate=${hoje}`))).toBe(
      'Agendamentos por canal: balcão, WhatsApp e site: faz parte do plano Pro. Seu plano é o Básico; mude de plano para usar.',
    );
    bloqueado(await dono.get(`/avaliacoes?de=${hoje}&ate=${hoje}`));
    bloqueado(await dono.get(`/profissionais/desempenho?de=${hoje}&ate=${hoje}`));
    bloqueado(await dono.put('/metas', {}));
    bloqueado(await dono.post('/clube/itens', {}));
    bloqueado(await dono.post('/espera', {}));
    bloqueado(await dono.put('/bot/menu', {}));
    // Ler o que já foi lançado: livre.
    await dono.get(`/clube/adesoes`).expect(200);
    await dono.get(`/metas?mes=${hoje.slice(0, 7)}`).expect(200);
    await dono.get(`/espera?unidadeId=${a.unidadeA}&dia=${hoje}`).expect(200);
    // Desconectar o WhatsApp num plano menor: não é bloqueado pelo plano.
    const sair = await dono.delete(`/bot/conexao/${a.unidadeA}`);
    expect(sair.body?.erro?.codigo).not.toBe('recurso_do_plano');
  });

  it('Básico: o site não oferece nem aceita lista de espera', async () => {
    const slug = `planos-${a.contaId.slice(0, 8)}`;
    await dono.patch(`/unidades/${a.unidadeA}`, { endereco: 'Rua A, 1' }).expect(200);
    // Aqui só importa o plano: liga o link no banco, sem cadastrar preço e barbeiro (painel A7).
    await naConta(prisma, a.contaId, (tx) =>
      tx.unidade.update({ where: { id: a.unidadeA }, data: { slug, agendamentoPublico: true } }),
    );
    const u = (await http().get(`/publico/agendamento/${slug}`).expect(200)).body as UnidadePublica;
    expect(u.listaEspera).toBe(false);
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
    ).body.id as string;
    const r = await http()
      .post(`/publico/agendamento/${slug}/espera`)
      .send({
        nome: 'Quer Vaga',
        telefone: '11977001234',
        servicoIds: [corte],
        profissionalId: null,
        dia: hoje,
      });
    expect(r.status).toBe(409);
    expect(r.body.erro.mensagem).toBe('Esta barbearia não usa lista de espera. Tente outro dia.');
  });

  it('Pro: comissões e clube liberados; painel da rede e lucro real, não', async () => {
    await mudarPlano('pro');
    await dono.get(`/comissoes?de=${hoje}&ate=${hoje}`).expect(200);
    await dono.get(`/canais?de=${hoje}&ate=${hoje}`).expect(200);
    bloqueado(await dono.get(`/rede?de=${hoje}&ate=${hoje}`));
    bloqueado(await dono.get(`/lucratividade?de=${hoje}&ate=${hoje}`));
    bloqueado(await dono.put('/bot/automacoes', {}));
  });

  it('Premium: tudo liberado', async () => {
    await mudarPlano('premium');
    await dono.get(`/rede?de=${hoje}&ate=${hoje}`).expect(200);
    await dono.get(`/lucratividade?de=${hoje}&ate=${hoje}`).expect(200);
  });
});
