// Nota fiscal das mensalidades (Etapa 23): a administração configura, confere os dados fiscais
// no Asaas e aplica às assinaturas; assinatura nova já sai com a nota. Provedor falso do Asaas.
import type { INestApplication } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import { criarPrisma, naConta, type PrismaClient } from '@pente-fino/db';
import type {
  ConfigNotaFiscalEntrada,
  ResultadoAplicarNota,
  RespostaEntrarAdmin,
} from '@pente-fino/shared';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { codigoDoPasso, passoDe } from '../src/admin/totp.js';
import { PROVEDOR_COBRANCA, type ProvedorCobrancaFalso } from '../src/cobranca/provedor.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let a: Cenario;
let prisma: PrismaClient;
let plataforma: PrismaClient;
let provedor: ProvedorCobrancaFalso;
let token = '';
const admin = {
  email: `nota-${randomUUID().slice(0, 8)}@pentefino.dev`,
  senha: 'senha-da-nota-123',
};
const http = () => request(app.getHttpServer());
const adm = {
  get: (url: string) => http().get(url).set('authorization', `Bearer ${token}`),
  put: (url: string, corpo: object) =>
    http().put(url).set('authorization', `Bearer ${token}`).send(corpo),
  post: (url: string) => http().post(url).set('authorization', `Bearer ${token}`).send({}),
};
const URL = '/admin/configuracoes/nota-fiscal';
const config: ConfigNotaFiscalEntrada = {
  ativa: true,
  servicoMunicipalId: null,
  codigoServico: '1.05',
  nomeServico: 'Licenciamento de uso do sistema Pente Fino',
  iss: 2,
  quando: 'pagamento',
  observacoes: 'Mensalidade do sistema',
};

beforeAll(async () => {
  app = await criarApp();
  a = await criarCenario();
  prisma = criarPrisma(process.env.DATABASE_URL);
  plataforma = criarPrisma(process.env.DATABASE_PLATAFORMA_URL);
  provedor = app.get(PROVEDOR_COBRANCA);
  await plataforma.usuarioPlataforma.create({
    data: {
      email: admin.email,
      nome: 'Nina Nota',
      papel: 'admin',
      senhaHash: await hash(admin.senha),
    },
  });
  const r1 = (await http().post('/admin/auth/entrar').send(admin).expect(200))
    .body as RespostaEntrarAdmin;
  if (r1.etapa !== 'configurar') throw new Error('esperava configurar');
  const codigo = codigoDoPasso(r1.segredo, passoDe(new Date()));
  const r2 = (
    await http()
      .post('/admin/auth/entrar')
      .send({ ...admin, codigo })
      .expect(200)
  ).body as RespostaEntrarAdmin;
  if (r2.etapa !== 'pronto') throw new Error('esperava pronto');
  token = r2.token;
});

afterAll(async () => {
  // A administração não apaga configuração: volta ao desligado.
  await plataforma.configuracaoPlataforma.update({
    where: { chave: 'nota_fiscal' },
    data: { valor: { ...config, ativa: false } },
  });
  await plataforma.usuarioPlataforma.update({
    where: { email: admin.email },
    data: { ativo: false },
  });
  await plataforma.$disconnect();
  await prisma.$disconnect();
  await a.remover();
  await app.close();
});

describe('nota fiscal das mensalidades', () => {
  it('desligada: aplicar recusa e a assinatura nova sai sem nota', async () => {
    expect((await adm.get('/admin/configuracoes').expect(200)).body.notaFiscal.ativa).toBe(false);
    expect((await adm.post(`${URL}/aplicar`).expect(409)).body.erro.mensagem).toContain('Ligue');
  });

  it('confere os dados fiscais e busca o serviço da prefeitura no Asaas', async () => {
    expect((await adm.get(`${URL}/asaas`).expect(200)).body).toMatchObject({
      configurada: true,
      inscricaoMunicipal: '123456',
    });
    const servicos = (await adm.get(`${URL}/servicos?busca=1.05`).expect(200)).body;
    expect(servicos).toEqual([expect.objectContaining({ id: 'svc_falso_105', iss: 2 })]);
    // Só a administração.
    const dono = await como(app, a.emails.dono);
    await dono.get(`${URL}/asaas`).expect(401);
  });

  it('salva com validação; assinatura nova já sai com a nota; aplicar cobre as existentes', async () => {
    await adm.put(URL, { ...config, codigoServico: '' }).expect(400);
    await adm.put(URL, { ...config, iss: 40 }).expect(400);
    await adm.put(URL, config).expect(204);
    expect((await adm.get('/admin/configuracoes').expect(200)).body.notaFiscal).toMatchObject({
      ativa: true,
      iss: 2,
      pis: 0,
    });

    const dono = await como(app, a.emails.dono);
    await dono
      .post('/conta/assinatura', { plano: 'premium', ciclo: 'mensal', documento: '529.982.247-25' })
      .expect(201);
    const conta = await naConta(prisma, a.contaId, (tx) =>
      tx.conta.findUniqueOrThrow({ where: { id: a.contaId } }),
    );
    const assinatura = conta.asaasAssinaturaId!;
    expect(provedor.notas.get(assinatura)).toMatchObject({ codigoServico: '1.05', iss: 2 });

    // Aplicar de novo (ex.: ISS mudou): todas as assinaturas recebem; recusa vira falha listada.
    provedor.notas.clear();
    provedor.notaRecusada.add(assinatura);
    const r = (await adm.post(`${URL}/aplicar`).expect(200)).body as ResultadoAplicarNota;
    expect(r.falhas).toContainEqual({
      conta: conta.nome,
      motivo: expect.stringContaining('Informações fiscais'),
    });
    provedor.notaRecusada.delete(assinatura);
    const r2 = (await adm.post(`${URL}/aplicar`).expect(200)).body as ResultadoAplicarNota;
    expect(r2.falhas.find((f) => f.conta === conta.nome)).toBeUndefined();
    expect(provedor.notas.has(assinatura)).toBe(true);
  });
});
