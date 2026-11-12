// Administração: falhas invisíveis (admin R7, R8 e R9). E-mail que não saiu aparece na Saúde
// do sistema e no "Precisa de atenção", com reenviar e descartar; WhatsApp caído há mais de 2 h
// pede atenção; acesso que chega com IP interno é avisado.
import type { INestApplication } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import { criarPrisma, naConta, type PrismaClient } from '@pente-fino/db';
import {
  CHAVE_BATIMENTO_WORKER,
  CHAVE_ROTINAS_WORKER,
  FILA_EMAILS,
  type FalhaDeEmail,
  type Pendencia,
  type RespostaEntrarAdmin,
  type SaudeDoSistema,
} from '@pente-fino/shared';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { codigoDoPasso, passoDe } from '../src/admin/totp.js';
import { LIMITE_RECUSAS_POR_IP } from '../src/comum/webhooks-recusados.js';
import { criarApp, criarCenario, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let a: Cenario;
let prisma: PrismaClient;
let plataforma: PrismaClient;
let fila: Queue;
let token = '';
const conexao = { url: process.env.REDIS_URL! };
const admin = {
  email: `saude-${randomUUID().slice(0, 8)}@pentefino.dev`,
  senha: 'senha-da-saude-123',
};
const http = () => request(app.getHttpServer());
const adm = {
  get: (url: string) => http().get(url).set('authorization', `Bearer ${token}`),
  post: (url: string, corpo: object = {}) =>
    http().post(url).set('authorization', `Bearer ${token}`).send(corpo),
};

/** Põe na fila um e-mail que o "servidor de e-mail" recusa, e espera ele cair nas falhas. */
async function emailQueFalha(para: string, modelo: string): Promise<string> {
  const job = await fila.add(
    'enviar',
    { para, assunto: 'Confirme seu e-mail no Pente Fino', texto: 'oi', modelo },
    { attempts: 1 },
  );
  const smtp = new Worker(
    FILA_EMAILS,
    async (j) => {
      if (j.id === job.id) throw new Error('550 5.1.1 Mailbox unavailable');
    },
    { connection: conexao },
  );
  try {
    for (let i = 0; i < 50 && !(await job.isFailed()); i++)
      await new Promise((r) => setTimeout(r, 100));
  } finally {
    await smtp.close();
  }
  expect(await job.isFailed()).toBe(true);
  return String(job.id);
}

beforeAll(async () => {
  app = await criarApp();
  a = await criarCenario();
  prisma = criarPrisma(process.env.DATABASE_URL);
  plataforma = criarPrisma(process.env.DATABASE_PLATAFORMA_URL);
  fila = new Queue(FILA_EMAILS, { connection: conexao });
  await plataforma.usuarioPlataforma.create({
    data: {
      email: admin.email,
      nome: 'Sara Saúde',
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
  await plataforma.usuarioPlataforma.update({
    where: { email: admin.email },
    data: { ativo: false },
  });
  await fila.close();
  await plataforma.$disconnect();
  await prisma.$disconnect();
  await a.remover();
  await app.close();
});

describe('e-mails que não saíram (admin R7)', () => {
  it('aparecem com o destinatário mascarado e o motivo; pedem atenção; reenviar e descartar', async () => {
    const para = `dono.${randomUUID().slice(0, 6)}@barbearia.dev`;
    const id = await emailQueFalha(para, 'confirmar_email');

    const falhas = (await adm.get('/admin/saude/emails').expect(200)).body as FalhaDeEmail[];
    const f = falhas.find((x) => x.id === id)!;
    expect(f).toMatchObject({
      para: `${para.slice(0, 2)}***@barbearia.dev`,
      modelo: 'Confirmação do e-mail',
      motivo: '550 5.1.1 Mailbox unavailable',
      tentativas: 1,
      critico: true,
    });
    // O endereço inteiro e o conteúdo nunca saem para a tela.
    expect(JSON.stringify(falhas)).not.toContain(para);

    const pend = (await adm.get('/admin/pendencias').expect(200)).body as Pendencia[];
    expect(pend.find((p) => p.tipo === 'falha_email')).toMatchObject({
      contaId: null,
      irPara: 'saude',
      prioridade: 1,
    });

    // Reenviar: sai das falhas e volta para a fila.
    await adm.post(`/admin/saude/emails/${id}/reenviar`).expect(204);
    expect(await (await fila.getJob(id))!.isFailed()).toBe(false);
    await adm.post(`/admin/saude/emails/${id}/reenviar`).expect(404);
    await (await fila.getJob(id))!.remove();

    // Descartar: pede o motivo e fica na auditoria.
    const outro = await emailQueFalha(`x${para}`, 'fim_teste');
    await adm.post(`/admin/saude/emails/${outro}/descartar`, { motivo: 'ok' }).expect(400);
    await adm
      .post(`/admin/saude/emails/${outro}/descartar`, { motivo: 'E-mail digitado errado' })
      .expect(204);
    expect(await fila.getJob(outro)).toBeUndefined();
    const auditoria = await plataforma.auditoriaPlataforma.findMany({
      where: {
        acao: { in: ['reenviar_email', 'descartar_email'] },
        usuario: { email: admin.email },
      },
      orderBy: { criadoEm: 'asc' },
    });
    expect(auditoria.map((x) => x.acao)).toEqual(['reenviar_email', 'descartar_email']);
    expect(auditoria[1]).toMatchObject({ motivo: 'E-mail digitado errado' });
    expect(JSON.stringify(auditoria)).not.toContain(para);
  });
});

describe('WhatsApp caído (admin R8)', () => {
  it('caído há mais de 2 h entra em "Precisa de atenção" como urgente', async () => {
    await naConta(prisma, a.contaId, (tx) =>
      tx.botConexao.create({
        data: {
          unidadeId: a.unidadeA,
          instancia: `saude-${randomUUID().slice(0, 8)}`,
          status: 'desconectado',
          caiuEm: new Date(Date.now() - 3 * 3_600_000),
        },
      }),
    );
    const pend = (await adm.get('/admin/pendencias').expect(200)).body as Pendencia[];
    expect(pend).toContainEqual(
      expect.objectContaining({
        tipo: 'whatsapp_caido',
        contaId: a.contaId,
        prioridade: 1,
        detalhe: expect.stringMatching(/caído há 3 horas/),
      }),
    );
  });
});

describe('IP de quem acessa (admin R9)', () => {
  it('a auditoria guarda o IP sem o prefixo IPv6; acesso com IP interno é avisado na Saúde', async () => {
    const entrada = await plataforma.auditoriaPlataforma.findFirst({
      where: { usuario: { email: admin.email }, acao: 'configurar_segundo_fator' },
    });
    // O teste chama a API pela máquina local: o IP é interno e vem sem "::ffff:".
    expect(entrada?.ip).toMatch(/^(127\.0\.0\.1|::1)$/);
    const saude = (await adm.get('/admin/saude').expect(200)).body as SaudeDoSistema;
    expect(saude.ipsInternos.acessos).toBeGreaterThan(0);
    expect(saude.ipsInternos.ultimo).not.toBeNull();
  });
});

describe('worker, rotinas e webhooks recusados (V3, W3, W4)', () => {
  const redis = new Redis(process.env.REDIS_URL!, { lazyConnect: true });
  const ipLocal = ['127.0.0.1', '::1'];
  const limparIp = () => redis.del(...ipLocal.map((ip) => `webhook:falhas:${ip}`));
  const saude = async () => (await adm.get('/admin/saude').expect(200)).body as SaudeDoSistema;

  afterAll(async () => {
    await limparIp();
    redis.disconnect();
  });

  it('worker sem sinal há mais de 2 min aparece parado; rotina sem rodar no prazo, atrasada', async () => {
    await redis.set(CHAVE_BATIMENTO_WORKER, new Date(Date.now() - 10 * 60_000).toISOString());
    await redis.hset(
      CHAVE_ROTINAS_WORKER,
      'avisos',
      JSON.stringify({
        quando: new Date(Date.now() - 2 * 3_600_000).toISOString(),
        resultado: 'x',
      }),
    );
    let s = await saude();
    expect(s.worker.parado).toBe(true);
    expect(s.rotinas.find((r) => r.rotina === 'avisos')).toMatchObject({
      atrasada: true,
      resultado: 'x',
    });
    await redis.set(CHAVE_BATIMENTO_WORKER, new Date().toISOString());
    await redis.hset(
      CHAVE_ROTINAS_WORKER,
      'avisos',
      JSON.stringify({ quando: new Date().toISOString(), resultado: 'avisos: 0 notificações' }),
    );
    s = await saude();
    expect(s.worker.parado).toBe(false);
    expect(s.rotinas.find((r) => r.rotina === 'avisos')?.atrasada).toBe(false);
    expect(Array.isArray(s.segredosCurtos)).toBe(true);
  });

  it('segredo errado fica registrado com o IP; depois do limite, o IP leva 429', async () => {
    await limparIp();
    const antes = (await saude()).webhooksRecusados.total7Dias;
    await http()
      .post('/webhooks/asaas')
      .set('asaas-access-token', 'errado-'.repeat(5))
      .send({ event: 'PAYMENT_RECEIVED', payment: { id: 'pay_x' } })
      .expect(401);
    const s = await saude();
    expect(s.webhooksRecusados.total7Dias).toBe(antes + 1);
    expect(s.webhooksRecusados.ultimos[0]).toMatchObject({ rota: 'asaas' });
    expect(ipLocal).toContain(s.webhooksRecusados.ultimos[0]!.ip);

    // Muitos erros do mesmo IP: bloqueado antes de conferir o segredo (Asaas e Evolution não erram).
    for (const ip of ipLocal) await redis.set(`webhook:falhas:${ip}`, LIMITE_RECUSAS_POR_IP);
    await http().post('/webhooks/whatsapp').send({ instance: 'x' }).expect(429);
    await limparIp();
  });
});

describe('servidor, backup e webhook do Asaas (admin U9)', () => {
  // O usuário de banco da administração não apaga configurações (só lê, grava e atualiza): no
  // fim, o backup volta para "ok" em vez de sair, para a tela local não mostrar a falha simulada.
  afterAll(async () => {
    await plataforma.configuracaoPlataforma.update({
      where: { chave: 'estado_backup' },
      data: { valor: { quando: new Date().toISOString(), ok: true, tamanho: '—' } },
    });
  });

  it('mostra o último backup, o servidor, a versão e o último aviso do Asaas', async () => {
    const agora = Date.now();
    const gravar = (chave: string, valor: object) =>
      plataforma.configuracaoPlataforma.upsert({
        where: { chave },
        create: { chave, valor },
        update: { valor },
      });
    await gravar('estado_backup', {
      quando: new Date(agora - 3_600_000).toISOString(),
      ok: true,
      tamanho: '1.2M',
      externo: true,
    });
    await gravar('estado_servidor', {
      quando: new Date(agora - 60_000).toISOString(),
      discoPct: 42,
      memoriaPct: 63,
      tlsAte: new Date(agora + 10 * 86_400_000).toISOString(),
    });
    // Um aviso do Asaas aceito (o token certo; a cobrança não existe, então é ignorada).
    await http()
      .post('/webhooks/asaas')
      .set('asaas-access-token', process.env.ASAAS_WEBHOOK_TOKEN!)
      .send({ event: 'PAYMENT_CREATED', payment: { id: 'pay_saude_u9' } })
      .expect(200);

    let s = (await adm.get('/admin/saude').expect(200)).body as SaudeDoSistema;
    expect(s.backup).toMatchObject({ ok: true, tamanho: '1.2M', externo: true, atrasado: false });
    expect(s.servidor).toMatchObject({ discoPct: 42, memoriaPct: 63, tlsDias: 9 });
    expect(s.versao.versao).toBeTruthy();
    expect(Date.parse(s.versao.iniciadaEm)).toBeLessThanOrEqual(agora);
    expect(s.webhookAsaas).toMatchObject({ evento: 'PAYMENT_CREATED', resultado: 'ignorado' });

    // Backup de dois dias atrás: atrasado; com erro, aparece o motivo.
    await gravar('estado_backup', {
      quando: new Date(agora - 48 * 3_600_000).toISOString(),
      ok: false,
      erro: 'Falhou na linha 40 do backup.sh',
    });
    s = (await adm.get('/admin/saude').expect(200)).body as SaudeDoSistema;
    expect(s.backup).toMatchObject({
      ok: false,
      atrasado: true,
      erro: 'Falhou na linha 40 do backup.sh',
    });
  });
});
