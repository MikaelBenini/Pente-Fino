// Nota fiscal das mensalidades (Etapa 23): a administração configura, confere os dados fiscais
// no Asaas e aplica às assinaturas; assinatura nova já sai com a nota. Provedor falso do Asaas.
import type { INestApplication } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import { criarPrisma, naConta, type PrismaClient } from '@pente-fino/db';
import type {
  AssinaturaDetalhe,
  ConfigNotaFiscalEntrada,
  ProntidaoNotaFiscal,
  ResultadoAplicarNota,
  RespostaEntrarAdmin,
  SaudeDoSistema,
} from '@pente-fino/shared';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { codigoDoPasso, passoDe } from '../src/admin/totp.js';
import { PROVEDOR_COBRANCA, type ProvedorCobrancaFalso } from '../src/cobranca/provedor.js';
import { como, criarApp, criarCenario, noAsaas, type Cenario } from './ajudantes.js';

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
      inscricaoMunicipal: '4.821.390-7',
      pendencias: [],
    });
    const servicos = (await adm.get(`${URL}/servicos?busca=1.05`).expect(200)).body;
    expect(servicos).toEqual([expect.objectContaining({ id: 'svc_falso_105', iss: 2 })]);
    // Só a administração.
    const dono = await como(app, a.emails.dono);
    await dono.get(`${URL}/asaas`).expect(401);
  });

  // Admin R2: a auditoria de 10/11 achou a emissão ligada com a inscrição "123456".
  it('sem o acesso fiscal: não liga, mas salva desligada e tudo segue igual', async () => {
    const pronta = { ...provedor.situacao };
    provedor.situacao = { ...pronta, inscricaoMunicipal: '123456', acessoPrefeitura: false };
    try {
      const r = await adm.put(URL, config).expect(422);
      expect(r.body.erro.codigo).toBe('nota_fiscal_pendente');
      expect(r.body.erro.campos.map((c: { campo: string }) => c.campo)).toEqual([
        'inscricao_exemplo',
        'sem_acesso_prefeitura',
      ]);
      expect((await adm.get('/admin/configuracoes').expect(200)).body.notaFiscal.ativa).toBe(false);
      // Desligada, salva: fica pronta para quando houver o acesso.
      await adm.put(URL, { ...config, ativa: false }).expect(204);
      const p = (await adm.get(`${URL}/asaas`).expect(200)).body as ProntidaoNotaFiscal;
      expect(p.pendencias.map((x) => x.codigo)).toEqual([
        'inscricao_exemplo',
        'sem_acesso_prefeitura',
      ]);
      // Sem dados fiscais no Asaas: o mesmo, com o motivo certo.
      provedor.situacao = {
        configurada: false,
        inscricaoMunicipal: null,
        simplesNacional: null,
        acessoPrefeitura: false,
      };
      const r2 = await adm.put(URL, config).expect(422);
      expect(r2.body.erro.campos[0].campo).toBe('sem_dados_fiscais');
    } finally {
      provedor.situacao = pronta;
    }
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

  it('webhook do Asaas: a nota chega à fatura da barbearia e à Saúde do sistema', async () => {
    const webhook = (corpo: object, registrar = true) => {
      if (registrar) noAsaas(provedor, corpo);
      return http()
        .post('/webhooks/asaas')
        .set('asaas-access-token', process.env.ASAAS_WEBHOOK_TOKEN!)
        .send(corpo)
        .expect(200);
    };
    const conta = await naConta(prisma, a.contaId, (tx) =>
      tx.conta.findUniqueOrThrow({ where: { id: a.contaId } }),
    );
    const fatura = await naConta(prisma, a.contaId, (tx) =>
      tx.faturaAssinatura.findFirstOrThrow({ where: { idExterno: { not: null } } }),
    );
    const id = `inv_${randomUUID().slice(0, 12)}`;
    const nota = (status: string, extra: object = {}) => ({
      id,
      customer: conta.asaasClienteId,
      payment: fatura.idExterno,
      status,
      value: fatura.valor / 100,
      ...extra,
    });
    const dono = await como(app, a.emails.dono);
    const naFatura = async () =>
      ((await dono.get('/conta/assinatura').expect(200)).body as AssinaturaDetalhe).faturas.find(
        (f) => f.id === fatura.id,
      )!.notaFiscal;

    expect(await naFatura()).toBeNull();
    await webhook({ event: 'INVOICE_CREATED', invoice: nota('SCHEDULED') });
    expect(await naFatura()).toEqual({ status: 'agendada', numero: null, pdfUrl: null });
    await webhook({
      event: 'INVOICE_AUTHORIZED',
      invoice: nota('AUTHORIZED', { number: '1234', pdfUrl: 'https://www.asaas.com/n/pdf/1' }),
    });
    // Repetido e atrasado (o Asaas avisa "pelo menos uma vez"): a nota emitida não volta atrás.
    await webhook({ event: 'INVOICE_SYNCHRONIZED', invoice: nota('SCHEDULED') });
    expect(await naFatura()).toEqual({
      status: 'emitida',
      numero: '1234',
      pdfUrl: 'https://www.asaas.com/n/pdf/1',
    });

    // Nota que não saiu: a barbearia vê "em emissão"; a administração vê o motivo.
    const outra = `inv_${randomUUID().slice(0, 12)}`;
    await webhook({
      event: 'INVOICE_ERROR',
      invoice: {
        id: outra,
        customer: conta.asaasClienteId,
        payment: `pay_${randomUUID().slice(0, 8)}`,
        status: 'ERROR',
        statusDescription: 'Inscrição municipal inválida para o município.',
        pdfUrl: 'javascript:alert(1)',
      },
    });
    const saude = (await adm.get('/admin/saude').expect(200)).body as SaudeDoSistema;
    expect(saude.notasFiscais.ultimaEmitida).toMatchObject({ conta: conta.nome, numero: '1234' });
    expect(saude.notasFiscais.erros).toContainEqual(
      expect.objectContaining({
        conta: conta.nome,
        mensagem: 'Inscrição municipal inválida para o município.',
      }),
    );
    const guardada = await naConta(prisma, a.contaId, (tx) =>
      tx.notaFiscalMensalidade.findUniqueOrThrow({ where: { idExterno: outra } }),
    );
    // Link que não é https não é guardado (vira link na tela da barbearia).
    expect(guardada.pdfUrl).toBeNull();

    // Nota que não existe no Asaas (corpo inventado com o token certo): ignorada.
    const falsa = await webhook(
      {
        event: 'INVOICE_AUTHORIZED',
        invoice: { id: 'inv_inventada', customer: conta.asaasClienteId, status: 'AUTHORIZED' },
      },
      false,
    );
    expect(falsa.body.resultado).toBe('ignorado');

    // Cliente que não é conta do Pente Fino (ex.: subconta do clube): ignorado.
    const r = await webhook({
      event: 'INVOICE_AUTHORIZED',
      invoice: { id: 'inv_de_fora', customer: 'cus_de_fora', status: 'AUTHORIZED' },
    });
    expect(r.body.resultado).toBe('ignorado');
  });
});
