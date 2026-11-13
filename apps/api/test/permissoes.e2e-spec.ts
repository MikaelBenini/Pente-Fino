// Revisão de permissões (Etapa 21). Duas garantias:
// 1. Política: toda rota é pública (numa lista conhecida), da administração ou declara os papéis.
//    Rota nova sem regra quebra este teste: quem cria decide de propósito quem acessa.
// 2. Unidade: quem trabalha na unidade A não lê nem mexe no que é da unidade B, também nas rotas
//    por id (que não trazem unidadeId e dependem do serviço para conferir).
import type { INestApplication } from '@nestjs/common';
import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { MetadataScanner, Reflector } from '@nestjs/core';
import { criarPrisma, naConta } from '@pente-fino/db';
import { dataLocal } from '@pente-fino/shared';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PAPEIS_ACEITOS, ROTA_PUBLICA } from '../src/auth/decoradores.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

/** Rotas sem login, cada uma protegida de outro jeito (token, assinatura, limite ou só leitura). */
const PUBLICAS = new Set([
  'GET /',
  'GET /health',
  'GET /chat/conversas/:id', // chat do site: exige o segredo da conversa (x-chat-token)
  'GET /publico/agendamento/:slug',
  'GET /publico/agendamento/:slug/cliente', // exige o token do link do bot
  'GET /publico/agendamento/:slug/horarios',
  'GET /publico/clube/:slug',
  'GET /publico/cupom/:codigo',
  'GET /publico/horario/:token',
  'GET /publico/horario/:token/horarios',
  'GET /publico/paginas', // só endereço e data das páginas que ligaram "Aparecer no Google"
  'GET /publico/precos',
  'POST /admin/auth/entrar',
  'POST /auth/convite',
  'POST /auth/esqueci-senha',
  'POST /auth/login',
  'POST /auth/redefinir-senha',
  'POST /auth/renovar',
  'POST /auth/sair',
  'POST /chat/conversas', // chat do site: visitante começa (limite por IP)
  'POST /chat/conversas/:id/mensagens', // exige o segredo da conversa (limite por IP)
  'POST /publico/agendamento/:slug',
  'POST /publico/agendamento/:slug/espera',
  'POST /publico/clube/:slug/assinar',
  'POST /publico/confirmar-email',
  'POST /publico/contas',
  'POST /publico/horario/:token/antecipar',
  'POST /publico/horario/:token/cancelar',
  'POST /publico/horario/:token/remarcar',
  'POST /webhooks/asaas', // token do Asaas no cabeçalho
  'POST /webhooks/whatsapp', // assinatura da instância
]);

/** Logado, qualquer papel: só o que é da própria pessoa ou da conta, sem dado de cliente. */
const QUALQUER_PAPEL = new Set([
  'GET /auth/eu',
  'GET /conta',
  'GET /conta/situacao',
  'GET /unidades',
  'POST /auth/reenviar-confirmacao',
  'POST /auth/trocar-senha',
]);

interface Rota {
  rota: string;
  publica: boolean;
  papeis: string[] | undefined;
  admin: boolean;
}

function rotasDaApi(): Rota[] {
  const scanner = new MetadataScanner();
  const reflector = new Reflector();
  const r: Rota[] = [];
  for (const C of Reflect.getMetadata('controllers', AppModule) as (new () => object)[]) {
    const base = reflector.get<string>(PATH_METADATA, C) ?? '';
    const guardasClasse = (Reflect.getMetadata(GUARDS_METADATA, C) ?? []) as { name: string }[];
    for (const nome of scanner.getAllMethodNames(C.prototype)) {
      const h = (C.prototype as Record<string, () => unknown>)[nome]!;
      const caminho = Reflect.getMetadata(PATH_METADATA, h) as string | undefined;
      if (caminho === undefined) continue;
      const metodo = RequestMethod[Reflect.getMetadata(METHOD_METADATA, h) as number];
      const guardas = [
        ...guardasClasse,
        ...((Reflect.getMetadata(GUARDS_METADATA, h) ?? []) as { name: string }[]),
      ];
      r.push({
        rota: `${metodo} /${base}/${caminho}`.replace(/\/+/g, '/').replace(/([^ ])\/$/, '$1'),
        publica: Boolean(reflector.getAllAndOverride(ROTA_PUBLICA, [h, C])),
        papeis: reflector.getAllAndOverride<string[]>(PAPEIS_ACEITOS, [h, C]),
        admin: guardas.some((g) => g.name === 'AdminGuard'),
      });
    }
  }
  return r;
}

describe('política de acesso das rotas', () => {
  const rotas = rotasDaApi();

  it('a API tem as rotas esperadas (o teste enxerga os controllers)', () => {
    expect(rotas.length).toBeGreaterThan(200);
  });

  it('rota sem login só se estiver na lista de públicas (ou for da administração, com a guarda dela)', () => {
    const fora = rotas.filter((r) => r.publica && !r.admin && !PUBLICAS.has(r.rota));
    expect(fora.map((r) => r.rota)).toEqual([]);
  });

  it('rota da administração passa pela guarda da administração', () => {
    const semGuarda = rotas.filter(
      (r) => r.rota.includes(' /admin/') && r.rota !== 'POST /admin/auth/entrar' && !r.admin,
    );
    expect(semGuarda.map((r) => r.rota)).toEqual([]);
  });

  it('rota logada sem @Papeis só se estiver na lista de "qualquer papel"', () => {
    const fora = rotas.filter(
      (r) => !r.publica && !r.admin && !r.papeis && !QUALQUER_PAPEL.has(r.rota),
    );
    expect(fora.map((r) => r.rota)).toEqual([]);
  });

  it('as listas não guardam rota que não existe mais', () => {
    const existentes = new Set(rotas.map((r) => r.rota));
    expect([...PUBLICAS, ...QUALQUER_PAPEL].filter((r) => !existentes.has(r))).toEqual([]);
  });
});

describe('uma unidade não mexe na outra', () => {
  let app: INestApplication<App>;
  let a: Cenario;
  type Cliente = Awaited<ReturnType<typeof como>>;
  let dono: Cliente;
  let gestor: Cliente;
  let recepcao: Cliente;
  let barbeiro: Cliente;
  let profB = '';
  let comandaB = '';
  let agendamentoB = '';
  let clienteB = '';

  const amanha = () => {
    const d = new Date(`${dataLocal(new Date())}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  };

  beforeAll(async () => {
    app = await criarApp();
    a = await criarCenario();
    dono = await como(app, a.emails.dono);
    gestor = await como(app, a.emails.gestor);
    recepcao = await como(app, a.emails.recepcao);
    barbeiro = await como(app, a.emails.barbeiro);
    await dono
      .patch(`/unidades/${a.unidadeB}`, { diasTrabalho: [0, 1, 2, 3, 4, 5, 6] })
      .expect(200);
    profB = (
      await dono
        .post('/profissionais', {
          unidadeId: a.unidadeB,
          nome: 'Barbeiro da B',
          email: `barbeiro-b-${Date.now()}@e2e.pentefino.dev`,
          dataEntrada: dataLocal(new Date(Date.now() - 30 * 86_400_000)),
          comissaoServico: { percentualBp: 4000, valorFixo: null },
          comissaoProduto: { percentualBp: 1000, valorFixo: null },
        })
        .expect(201)
    ).body.id;
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
    const prisma = criarPrisma();
    await naConta(prisma, a.contaId, (tx) =>
      tx.precoServico.create({
        data: {
          servicoId: corte,
          unidadeId: a.unidadeB,
          valor: 5000,
          vigenciaInicio: new Date(Date.now() - 30 * 86_400_000),
        },
      }),
    );
    await prisma.$disconnect();
    const r = await dono
      .post('/agendamentos', {
        unidadeId: a.unidadeB,
        profissionalId: profB,
        clienteNovo: { nome: 'Cliente da B', telefone: '11977776666' },
        inicio: `${amanha()}T10:00:00-03:00`,
        servicoIds: [corte],
      })
      .expect(201);
    comandaB = r.body.id;
    agendamentoB = r.body.agendamentoId;
    clienteB = r.body.clienteId;
  });

  afterAll(async () => {
    await a.remover();
    await app.close();
  });

  /** Negado: 403 (sem permissão) ou 404 (não existe para quem pergunta). */
  const negado = (s: number) => expect([403, 404]).toContain(s);

  it('comanda da unidade B: recepção, gestor e barbeiro da A não abrem nem mexem', async () => {
    for (const quem of [recepcao, gestor, barbeiro]) {
      negado((await quem.get(`/comandas/${comandaB}`)).status);
      negado((await quem.post(`/comandas/${comandaB}/iniciar`, {})).status);
      negado((await quem.post(`/comandas/${comandaB}/nao-veio`, {})).status);
    }
    for (const quem of [recepcao, gestor]) {
      negado((await quem.post(`/comandas/${comandaB}/fechar`, { pagamentos: [] })).status);
      negado(
        (await quem.post(`/comandas/${comandaB}/cancelar`, { motivo: 'teste de acesso' })).status,
      );
    }
    // Nada mudou.
    expect((await dono.get(`/comandas/${comandaB}`).expect(200)).body.status).toBe('prevista');
  });

  it('agendamento e agenda do barbeiro da B: a recepção da A não move nem bloqueia', async () => {
    negado(
      (
        await recepcao.patch(`/agendamentos/${agendamentoB}`, {
          inicio: `${amanha()}T11:00:00-03:00`,
        })
      ).status,
    );
    negado(
      (
        await recepcao.post(`/profissionais/${profB}/bloqueios`, {
          inicio: `${amanha()}T14:00:00-03:00`,
          fim: `${amanha()}T15:00:00-03:00`,
          motivo: 'teste',
        })
      ).status,
    );
    negado((await recepcao.get(`/profissionais/${profB}/bloqueios-recorrentes`)).status);
  });

  it('desempenho e comissão do barbeiro da B: ninguém da A vê', async () => {
    const periodo = `?de=${amanha().slice(0, 8)}01&ate=${amanha()}`;
    negado((await gestor.get(`/profissionais/${profB}/desempenho${periodo}`)).status);
    negado((await barbeiro.get(`/profissionais/${profB}/desempenho${periodo}`)).status);
    negado((await barbeiro.get(`/comissoes/${profB}/extrato${periodo}`)).status);
    // O dono vê (a rota funciona; o "negado" acima não é erro de parâmetro).
    await dono.get(`/profissionais/${profB}/desempenho${periodo}`).expect(200);
  });

  it('cliente é da conta (vale em todas as unidades), mas a conversa da B não aparece na A', async () => {
    const prisma = criarPrisma();
    await naConta(prisma, a.contaId, (tx) =>
      tx.mensagem.create({
        data: {
          unidadeId: a.unidadeB,
          clienteId: clienteB,
          telefone: '5511977776666',
          direcao: 'entrada',
          texto: 'Mensagem na unidade B',
          status: 'recebida',
        },
      }),
    );
    await prisma.$disconnect();
    expect((await recepcao.get(`/clientes/${clienteB}/mensagens`).expect(200)).body).toEqual([]);
    const doDono = (await dono.get(`/clientes/${clienteB}/mensagens`).expect(200)).body;
    expect(doDono).toEqual([expect.objectContaining({ texto: 'Mensagem na unidade B' })]);
    // A recepção da A não consegue mandar pelo número da B.
    const envio = (await recepcao.get(`/conversas/cliente/${clienteB}`).expect(200)).body;
    expect(envio.podeBot).toBe(false);
  });
});
