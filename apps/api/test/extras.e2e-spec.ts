// Etapa 6.14 a 6.18: comanda impressa, link público, importação, configuração guiada e exportação.
import type { INestApplication } from '@nestjs/common';
import { criarPrisma, naConta } from '@pente-fino/db';
import { dataLocal } from '@pente-fino/shared';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { CONFIGURACAO, type Configuracao } from '../src/config/configuracao.js';
import { como, criarApp, criarCenario, ultimoEmail, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let cenario: Cenario;
type Cliente = Awaited<ReturnType<typeof como>>;
let dono: Cliente;
let barbeiro: Cliente;
let prof = '';
let corte = '';
const http = () => request(app.getHttpServer());
const dia = (n: number) => {
  const d = new Date(`${dataLocal(new Date())}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const AMANHA = dia(1);
const slug = `e2e-${randomUUID().slice(0, 8)}`;
const binario = (res: request.Response, cb: (err: Error | null, body: Buffer) => void) => {
  const partes: Buffer[] = [];
  res.on('data', (c: Buffer) => partes.push(c));
  res.on('end', () => cb(null, Buffer.concat(partes)));
};

beforeAll(async () => {
  app = await criarApp();
  cenario = await criarCenario();
  dono = await como(app, cenario.emails.dono);
  barbeiro = await como(app, cenario.emails.barbeiro);
  await dono
    .patch(`/unidades/${cenario.unidadeA}`, {
      diasTrabalho: [0, 1, 2, 3, 4, 5, 6],
      telefone: '(11) 3000-0000',
    })
    .expect(200);
  const usuarios = (await dono.get('/usuarios')).body as { id: string; email: string }[];
  prof = (
    await dono
      .post('/profissionais', {
        unidadeId: cenario.unidadeA,
        usuarioId: usuarios.find((u) => u.email === cenario.emails.barbeiro)!.id,
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
      precos: [{ servicoId: corte, unidadeId: cenario.unidadeA, valor: 5000 }],
    })
    .expect(201);
});

afterAll(async () => {
  await cenario.remover();
  await app.close();
});

describe('cadastro de conta e configuração guiada', () => {
  const email = `novo-dono-${randomUUID().slice(0, 8)}@e2e.pentefino.dev`;
  let token = '';

  it('cria a conta e já entra; e-mail repetido e sem aceite são recusados', async () => {
    const base = {
      barbearia: 'Barbearia Nova',
      nome: 'Dona Nova',
      email,
      senha: 'senha-forte-1',
      plano: 'pro',
      ciclo: 'anual',
      aceite: true,
      abertoEm: Date.now() - 10_000,
    };
    await http()
      .post('/publico/contas')
      .send({ ...base, aceite: false })
      .expect(400);
    // WhatsApp opcional (briefing do site, B8): incompleto é recusado; válido fica no dono.
    await http()
      .post('/publico/contas')
      .send({ ...base, whatsapp: '98888' })
      .expect(400);
    // Site T2 / admin F2: de onde veio. Campo desconhecido é descartado (nada de dado pessoal).
    const r = await http()
      .post('/publico/contas')
      .send({
        ...base,
        whatsapp: '(11) 98888-7777',
        origem: {
          gclid: 'teste-gclid',
          utm_source: 'google',
          utm_medium: 'cpc',
          utm_campaign: 'lancamento',
          referrer: 'google.com',
          email: 'nao@deve.entrar',
        },
      })
      .expect(201);
    token = r.body.accessToken;
    const prisma = criarPrisma();
    try {
      const contaId = (
        JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as { conta: string }
      ).conta;
      const dono = await naConta(prisma, contaId, (tx) =>
        tx.usuario.findFirst({ where: { email }, select: { telefone: true } }),
      );
      expect(dono?.telefone).toBe('5511988887777');
      const conta = await naConta(prisma, contaId, (tx) =>
        tx.conta.findUniqueOrThrow({ where: { id: contaId }, select: { origem: true } }),
      );
      expect(conta.origem).toEqual({
        gclid: 'teste-gclid',
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'lancamento',
        referrer: 'google.com',
      });
    } finally {
      await prisma.$disconnect();
    }
    expect(r.body.usuario).toMatchObject({ email, papeis: [{ papel: 'dono', unidadeId: null }] });
    await http().post('/publico/contas').send(base).expect(409);
    await http()
      .post('/publico/contas')
      .send({ ...base, email: cenario.emails.dono })
      .expect(409);
  });

  it('cadastro pelo site começa sem e-mail confirmado: não agenda nem convida até clicar no link', async () => {
    const auth = { authorization: `Bearer ${token}` };
    expect((await http().get('/auth/eu').set(auth).expect(200)).body.emailConfirmado).toBe(false);
    const convite = await http()
      .post('/usuarios/convites')
      .set(auth)
      .send({
        nome: 'Barbeiro Novo',
        email: `b-${randomUUID().slice(0, 6)}@e2e.pentefino.dev`,
        papel: 'barbeiro',
      });
    expect(convite.status).toBe(403);
    expect(convite.body.erro.codigo).toBe('email_nao_confirmado');
    // O link vai no e-mail de boas-vindas.
    const boasVindas = await ultimoEmail(email);
    expect(boasVindas?.assunto).toContain('Bem-vindo ao Pente Fino');
    const link = /\/confirmar-email\?token=([\w-]+)/.exec(boasVindas!.texto)!;
    await http()
      .post('/publico/confirmar-email')
      .send({ token: 'x'.repeat(43) })
      .expect(400);
    // Reenviar: link novo (o anterior deixa de valer).
    expect((await http().post('/auth/reenviar-confirmacao').set(auth).expect(200)).body).toEqual({
      enviado: true,
    });
    await http().post('/publico/confirmar-email').send({ token: link[1] }).expect(400);
    const novo = /\/confirmar-email\?token=([\w-]+)/.exec((await ultimoEmail(email))!.texto)!;
    await http().post('/publico/confirmar-email').send({ token: novo[1] }).expect(204);
    // Clicar de novo no mesmo link não dá erro (já confirmado).
    await http().post('/publico/confirmar-email').send({ token: novo[1] }).expect(204);
    expect((await http().get('/auth/eu').set(auth).expect(200)).body.emailConfirmado).toBe(true);
    expect((await http().post('/auth/reenviar-confirmacao').set(auth).expect(200)).body).toEqual({
      enviado: false,
    });
  });

  it('robô é recusado: campo isca, sem carimbo, rápido demais, e-mail descartável e limite por IP', async () => {
    const config = app.get<Configuracao>(CONFIGURACAO);
    const base = {
      barbearia: 'Barbearia Robô',
      nome: 'Robô',
      senha: 'senha-forte-1',
      aceite: true,
      abertoEm: Date.now() - 10_000,
    };
    const novoEmail = () => `robo-${randomUUID().slice(0, 8)}@e2e.pentefino.dev`;
    const antes = { ...config.cadastro };
    config.cadastro.tempoMinimoMs = 2500;
    try {
      for (const extra of [
        { site: 'http://spam' },
        { abertoEm: undefined },
        { abertoEm: Date.now() - 500 },
      ]) {
        const r = await http()
          .post('/publico/contas')
          .send({ ...base, email: novoEmail(), ...extra })
          .expect(400);
        expect(r.body.erro.codigo).toBe('cadastro_recusado');
      }
      const descartavel = await http()
        .post('/publico/contas')
        .send({ ...base, email: 'robo@mailinator.com' })
        .expect(400);
      expect(descartavel.body.erro.campos[0].campo).toBe('email');
      // O contador do IP já tem os cadastros deste teste: com limite 1, o próximo passa do limite.
      config.cadastro.limitePorHora = 1;
      const primeiro = await http()
        .post('/publico/contas')
        .send({ ...base, email: novoEmail() });
      expect([201, 429]).toContain(primeiro.status);
      const depois = await http()
        .post('/publico/contas')
        .send({ ...base, email: novoEmail() })
        .expect(429);
      expect(depois.body.erro.codigo).toBe('muitos_cadastros');
    } finally {
      Object.assign(config.cadastro, antes);
    }
  });

  it('a conta nova começa sem serviços, com categorias, e pede a configuração guiada', async () => {
    const auth = { authorization: `Bearer ${token}` };
    const estado = (await http().get('/configuracao/estado').set(auth).expect(200)).body;
    expect(estado).toMatchObject({
      configurada: false,
      unidades: 1,
      servicos: 0,
      profissionais: 0,
    });
    const conta = (await http().get('/conta').set(auth).expect(200)).body;
    expect(conta).toMatchObject({ plano: 'pro', ciclo: 'anual', status: 'teste' });
    const dias = (new Date(conta.testeAte).getTime() - Date.now()) / 86_400_000;
    expect(dias).toBeGreaterThan(13.9);
    expect(dias).toBeLessThanOrEqual(14);
    expect(estado.modelos.length).toBeGreaterThan(5);
    expect(
      (await http().get('/categorias-despesa').set(auth).expect(200)).body.length,
    ).toBeGreaterThan(10);
    const criados = await http()
      .post('/configuracao/servicos')
      .set(auth)
      .send({
        servicos: [
          {
            nome: 'Corte',
            categoria: 'Cabelo',
            duracaoMin: 30,
            custoProduto: 150,
            ehExtra: false,
            pesoAtendimento: 1,
            preco: 4800,
          },
        ],
      })
      .expect(201);
    expect(criados.body).toEqual({ criados: 1 });
    const precos = (await http().get('/precos').set(auth).expect(200)).body;
    expect(precos.vigentes).toHaveLength(1);
    expect(precos.vigentes[0].valor).toBe(4800);
    await http().post('/configuracao/concluir').set(auth).expect(200);
    expect((await http().get('/configuracao/estado').set(auth)).body.configurada).toBe(true);
  });
});

describe('link público de agendamento', () => {
  it('desligado não responde; ligar exige endereço', async () => {
    await http().get(`/publico/agendamento/${slug}`).expect(404);
    await dono.patch(`/unidades/${cenario.unidadeB}`, { agendamentoPublico: true }).expect(400);
    await dono
      .patch(`/unidades/${cenario.unidadeA}`, { slug, agendamentoPublico: true })
      .expect(200);
    await dono.patch(`/unidades/${cenario.unidadeB}`, { slug }).expect(409);
  });

  it('não liga o link sem serviço com preço e sem profissional com horário (painel A7)', async () => {
    const r = await dono
      .patch(`/unidades/${cenario.unidadeB}`, { slug: `${slug}-b`, agendamentoPublico: true })
      .expect(422);
    expect(r.body.erro.codigo).toBe('link_incompleto');
    expect(r.body.erro.campos.map((c: { campo: string }) => c.campo)).toEqual([
      'servico',
      'profissional',
    ]);
    await http().get(`/publico/agendamento/${slug}-b`).expect(404);
    // Desligar ou só trocar o endereço continua livre.
    await dono.patch(`/unidades/${cenario.unidadeB}`, { agendamentoPublico: false }).expect(200);
  });

  it('mostra serviços com preço e barbeiros, sem dados internos', async () => {
    const r = (await http().get(`/publico/agendamento/${slug}`).expect(200)).body;
    expect(r).toMatchObject({ nome: 'Unidade A', telefone: '551130000000' });
    expect(r.servicos).toEqual([
      { id: corte, nome: 'Corte', duracaoMin: 30, ehExtra: false, preco: 5000 },
    ]);
    expect(r.profissionais).toEqual([{ id: prof, nome: 'Barbeiro', precos: {} }]);
    expect(JSON.stringify(r)).not.toMatch(/email|custo|contaId/);
  });

  it('cliente agenda pelo link; vira comanda prevista com origem "link"', async () => {
    const livres = (
      await http()
        .get(`/publico/agendamento/${slug}/horarios?data=${AMANHA}&servicoIds=${corte}`)
        .expect(200)
    ).body;
    const inicio = livres[0].inicios[0];
    const r = await http()
      .post(`/publico/agendamento/${slug}`)
      .send({
        nome: 'Cliente do Link',
        telefone: '(11) 97777-0001',
        servicoIds: [corte],
        profissionalId: prof,
        inicio,
      })
      .expect(201);
    expect(r.body).toMatchObject({ profissional: 'Barbeiro', servicos: ['Corte'], total: 5000 });
    expect(r.body.linkWhatsapp).toMatch(/^https:\/\/wa\.me\/551130000000\?text=/);
    const agenda = (
      await dono.get(`/agenda?unidadeId=${cenario.unidadeA}&de=${AMANHA}&ate=${AMANHA}`)
    ).body;
    expect(
      agenda.itens.find((i: { cliente: string }) => i.cliente === 'Cliente do Link'),
    ).toMatchObject({ origem: 'link', status: 'prevista' });
    // Mesmo horário de novo: o banco e a validação recusam.
    await http()
      .post(`/publico/agendamento/${slug}`)
      .send({
        nome: 'Outro',
        telefone: '11977770009',
        servicoIds: [corte],
        profissionalId: prof,
        inicio,
      })
      .expect(409);
  });

  it('limita horários por telefone e recusa passado e fora da janela', async () => {
    const livres = (
      await http().get(`/publico/agendamento/${slug}/horarios?data=${AMANHA}&servicoIds=${corte}`)
    ).body[0].inicios as string[];
    const corpo = (inicio: string) => ({
      nome: 'Cliente do Link',
      telefone: '11977770001',
      servicoIds: [corte],
      profissionalId: prof,
      inicio,
    });
    await http().post(`/publico/agendamento/${slug}`).send(corpo(livres[2]!)).expect(201);
    const terceiro = await http()
      .post(`/publico/agendamento/${slug}`)
      .send(corpo(livres[4]!))
      .expect(409);
    expect(terceiro.body.erro.mensagem).toMatch(/já tem horários marcados/);
    await http()
      .post(`/publico/agendamento/${slug}`)
      .send({ ...corpo(`${dia(-1)}T10:00:00-03:00`), telefone: '11977770002' })
      .expect(400);
    await http()
      .get(`/publico/agendamento/${slug}/horarios?data=${dia(90)}&servicoIds=${corte}`)
      .expect(400);
  });

  it('com duas unidades no link, cada página oferece a outra para trocar', async () => {
    expect((await http().get(`/publico/agendamento/${slug}`)).body.outrasUnidades).toEqual([]);
    const slugB = `${slug}-b`;
    // A B fica sem preço de propósito (o serviço não pode aparecer lá). A API não liga o link
    // assim (painel A7); liga no banco, como uma unidade ligada antes dessa regra.
    const prisma = criarPrisma();
    try {
      await naConta(prisma, cenario.contaId, (tx) =>
        tx.unidade.update({
          where: { id: cenario.unidadeB },
          data: { slug: slugB, agendamentoPublico: true, endereco: 'Rua B, 2' },
        }),
      );
    } finally {
      await prisma.$disconnect();
    }
    try {
      const a = (await http().get(`/publico/agendamento/${slug}`).expect(200)).body;
      expect(a.outrasUnidades).toEqual([{ slug: slugB, nome: 'Unidade B', endereco: 'Rua B, 2' }]);
      const b = (await http().get(`/publico/agendamento/${slugB}`).expect(200)).body;
      // Só endereço, nome e local: nenhum id interno nem da conta.
      expect(b.outrasUnidades).toEqual([{ slug, nome: 'Unidade A', endereco: null }]);
      // O mesmo serviço da barbearia, sem preço na B: não aparece para agendar lá.
      expect(b.servicos.map((x: { id: string }) => x.id)).not.toContain(corte);
    } finally {
      // Desligada, a unidade some da lista da outra.
      await dono.patch(`/unidades/${cenario.unidadeB}`, { agendamentoPublico: false }).expect(200);
    }
    expect((await http().get(`/publico/agendamento/${slug}`)).body.outrasUnidades).toEqual([]);
  });
});

describe('comanda impressa', () => {
  it('PDF A4 com as comandas do dia; barbeiro não imprime', async () => {
    const r = await dono
      .get(`/comandas/impressao?unidadeId=${cenario.unidadeA}&data=${AMANHA}&porFolha=6`)
      .buffer(true)
      .parse(binario)
      .expect(200);
    expect(r.headers['content-type']).toBe('application/pdf');
    expect((r.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    await barbeiro
      .get(`/comandas/impressao?unidadeId=${cenario.unidadeA}&data=${AMANHA}`)
      .expect(403);
  });
});

describe('importação da planilha', () => {
  it('simula com relatório por linha e só grava quando pedido', async () => {
    const linhas = [
      { nome: 'Importado Um', telefone: '(11) 96666-0001', email: '', aniversario: '10/05/1990' },
      { nome: 'Importado Dois', telefone: '123', email: '', aniversario: '' },
      { nome: '=HYPERLINK("http://x")', telefone: '11966660003', email: '', aniversario: '' },
    ];
    const simulado = (
      await dono.post('/importacao/clientes', { linhas, simular: true }).expect(200)
    ).body;
    expect(simulado).toMatchObject({
      total: 3,
      validas: 2,
      gravadas: 0,
      erros: [{ linha: 3, mensagem: expect.stringMatching(/Telefone inválido/) }],
    });
    expect((await dono.get('/clientes?busca=Importado').expect(200)).body).toHaveLength(0);
    const gravado = (
      await dono.post('/importacao/clientes', { linhas, simular: false }).expect(200)
    ).body;
    expect(gravado.gravadas).toBe(2);
    const denovo = (
      await dono.post('/importacao/clientes', { linhas: [linhas[0]], simular: true }).expect(200)
    ).body;
    expect(denovo.erros[0].mensagem).toMatch(/já cadastrado/);
  });

  it('serviços e depois preços pelo nome; barbeiro não importa', async () => {
    await dono
      .post('/importacao/servicos', {
        linhas: [
          {
            nome: 'Pigmentação',
            categoria: 'Barba',
            duracao_min: '20',
            custo_produto: '5,00',
            extra: 'sim',
            peso: '',
          },
        ],
        simular: false,
      })
      .expect(200);
    const p = (
      await dono
        .post('/importacao/precos', {
          linhas: [
            { servico: 'Pigmentação', unidade: 'Unidade A', valor: '30,00' },
            { servico: 'Inexistente', unidade: 'Unidade A', valor: '1' },
          ],
          simular: false,
        })
        .expect(200)
    ).body;
    expect(p).toMatchObject({
      gravadas: 1,
      erros: [{ linha: 3, mensagem: expect.stringMatching(/não encontrado/) }],
    });
    await barbeiro
      .post('/importacao/clientes', { linhas: [{ nome: 'X Y' }], simular: true })
      .expect(403);
  });
});

describe('exportação para o contador', () => {
  it('CSV com BOM, receitas e despesas, sem fórmula; PDF do mês', async () => {
    const mes = dataLocal(new Date()).slice(0, 7);
    // Uma comanda fechada hoje com o cliente de nome perigoso.
    const cliente = (await dono.get(`/clientes?busca=HYPERLINK`)).body[0];
    const c = await dono
      .post('/comandas', {
        unidadeId: cenario.unidadeA,
        profissionalId: prof,
        clienteId: cliente.id,
        servicoIds: [corte],
      })
      .expect(201);
    await dono
      .post(`/comandas/${c.body.id}/fechar`, { pagamentos: [{ forma: 'pix', valor: 5000 }] })
      .expect(200);
    const csv = await dono
      .get(`/exportacao?mes=${mes}&formato=csv`)
      .buffer(true)
      .parse(binario)
      .expect(200);
    const texto = (csv.body as Buffer).toString('utf-8');
    expect(texto.charCodeAt(0)).toBe(0xfeff);
    expect(texto).toMatch(/data;tipo;descricao;unidade;forma_ou_grupo;valor/);
    expect(texto).toMatch(/receita;.*Unidade A;Pix;50,00/);
    expect(texto).not.toMatch(/;=HYPERLINK/);
    const pdf = await dono
      .get(`/exportacao?mes=${mes}&formato=pdf`)
      .buffer(true)
      .parse(binario)
      .expect(200);
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    await barbeiro.get(`/exportacao?mes=${mes}`).expect(403);
  });
});
