// Site da barbearia (seção 7, lote 7a): rascunho que o dono edita, publicar, a página pública
// com os dados vivos da unidade e tirar do ar (volta a página de agendamento).
import type { INestApplication } from '@nestjs/common';
import { dataLocal, type SitePainel, type SitePublico } from '@pente-fino/shared';
import sharp from 'sharp';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let a: Cenario;
type Cliente = Awaited<ReturnType<typeof como>>;
let dono: Cliente;
let barbeiro: Cliente;
let prof = '';
const slug = `site-${Date.now().toString(36)}`;
const http = () => request(app.getHttpServer());
const hoje = dataLocal(new Date());

beforeAll(async () => {
  app = await criarApp();
  a = await criarCenario();
  dono = await como(app, a.emails.dono);
  barbeiro = await como(app, a.emails.barbeiro);
  await dono
    .patch(`/unidades/${a.unidadeA}`, {
      diasTrabalho: [2, 3, 4, 5, 6],
      telefone: '(19) 99999-0000',
      endereco: 'Rua das Palmeiras, 214',
      slug,
    })
    .expect(200);
  const usuarios = (await dono.get('/usuarios')).body as { id: string; email: string }[];
  prof = (
    await dono
      .post('/profissionais', {
        unidadeId: a.unidadeA,
        usuarioId: usuarios.find((u) => u.email === a.emails.barbeiro)!.id,
        dataEntrada: `${hoje.slice(0, 7)}-01`,
        comissaoServico: { percentualBp: 4000, valorFixo: null },
        comissaoProduto: { percentualBp: 1000, valorFixo: null },
      })
      .expect(201)
  ).body.id;
  await dono
    .put(`/profissionais/${prof}/horarios`, {
      horarios: [2, 3, 4, 5].map((d) => ({ diaSemana: d, inicioMin: 540, fimMin: 1200 })),
    })
    .expect(200);
  for (const [nome, valor] of [
    ['Corte', 5500],
    ['Barba', 4500],
  ] as const) {
    const id = (
      await dono
        .post('/servicos', {
          nome,
          duracaoMin: 30,
          custoProduto: 0,
          ehExtra: false,
          pesoAtendimento: 1,
          unidadeIds: [a.unidadeA],
        })
        .expect(201)
    ).body.id;
    await dono
      .post('/precos', {
        vigenciaInicio: hoje,
        precos: [{ servicoId: id, unidadeId: a.unidadeA, valor }],
      })
      .expect(201);
  }
});

afterAll(async () => {
  await a.remover();
  await app.close();
});

describe('site da barbearia', () => {
  it('sem nada gravado, o painel recebe a página sugerida e nada está publicado', async () => {
    const r = (await dono.get(`/unidades/${a.unidadeA}/site`).expect(200)).body as SitePainel;
    expect(r).toMatchObject({
      publicado: false,
      alteracoesPendentes: true,
      slug,
      linkLigado: false,
    });
    expect(r.rascunho.paginas.inicio[0]).toMatchObject({ tipo: 'banner', visivel: true });
    await http().get(`/publico/site/${slug}`).expect(404);
  });

  it('barbeiro não edita o site', async () => {
    await barbeiro.get(`/unidades/${a.unidadeA}/site`).expect(403);
  });

  it('grava o rascunho, recusa bloco na página errada e não publica sem o link ligado', async () => {
    const { rascunho } = (await dono.get(`/unidades/${a.unidadeA}/site`)).body as SitePainel;
    rascunho.cor = 'salvia';
    rascunho.instagram = '@barbearia.teste';
    rascunho.equipe[prof] = { foco: 'Degradê', sobre: 'Desde 2018 na casa.' };
    rascunho.paginas.inicio[0]!.titulo = 'Corte com hora marcada';
    const r = (await dono.put(`/unidades/${a.unidadeA}/site`, rascunho).expect(200))
      .body as SitePainel;
    expect(r.rascunho).toMatchObject({ cor: 'salvia', instagram: 'barbearia.teste' });

    await dono
      .put(`/unidades/${a.unidadeA}/site`, {
        ...rascunho,
        paginas: { ...rascunho.paginas, contato: [{ id: 'x', tipo: 'banner', visivel: true }] },
      })
      .expect(400);

    const erro = await dono.post(`/unidades/${a.unidadeA}/site/publicar`).expect(400);
    expect(erro.body.codigo ?? erro.body.erro?.codigo).toBe('link_desligado');
  });

  it('a prévia junta o rascunho com serviços, equipe e horário da unidade', async () => {
    const p = (await dono.get(`/unidades/${a.unidadeA}/site/previa`).expect(200))
      .body as SitePublico;
    expect(p.site.paginas.inicio[0]?.titulo).toBe('Corte com hora marcada');
    expect(p.servicos.map((s) => [s.nome, s.preco])).toEqual([
      ['Barba', 4500],
      ['Corte', 5500],
    ]);
    expect(p.equipe).toEqual([
      expect.objectContaining({ id: prof, foco: 'Degradê', sobre: 'Desde 2018 na casa.' }),
    ]);
    expect(p.horario).toEqual([
      { dias: 'Terça a sexta', horario: '9h às 20h' },
      { dias: 'Segunda, sábado e domingo', horario: null },
    ]);
    expect(p.whatsapp).toBe('https://wa.me/5519999990000');
    expect(p.nota).toBeNull();
  });

  it('publica: a página pública mostra o site; tirar do ar volta a ser só o agendamento', async () => {
    await dono.patch(`/unidades/${a.unidadeA}`, { agendamentoPublico: true }).expect(200);
    const r = (await dono.post(`/unidades/${a.unidadeA}/site/publicar`).expect(200))
      .body as SitePainel;
    expect(r).toMatchObject({ publicado: true, alteracoesPendentes: false });
    expect(r.publicadoEm).not.toBeNull();

    const pub = (await http().get(`/publico/site/${slug}`).expect(200)).body as SitePublico;
    expect(pub).toMatchObject({ slug, endereco: 'Rua das Palmeiras, 214' });
    expect(pub.site.cor).toBe('salvia');

    // Mexer no rascunho não muda o publicado até publicar de novo.
    const mudado = { ...r.rascunho, cor: 'cobre' };
    const depois = (await dono.put(`/unidades/${a.unidadeA}/site`, mudado).expect(200))
      .body as SitePainel;
    expect(depois.alteracoesPendentes).toBe(true);
    expect(((await http().get(`/publico/site/${slug}`)).body as SitePublico).site.cor).toBe(
      'salvia',
    );

    const fora = (await dono.delete(`/unidades/${a.unidadeA}/site/publicado`).expect(200))
      .body as SitePainel;
    expect(fora).toMatchObject({ publicado: false, publicadoEm: null });
    expect(fora.rascunho.cor).toBe('cobre');
    await http().get(`/publico/site/${slug}`).expect(404);
    await http().get(`/publico/agendamento/${slug}`).expect(200);
  });

  it('fotos: reduz em dois tamanhos sem os dados da câmera, valida no rascunho e entra na prévia', async () => {
    const jpg = await sharp({
      create: { width: 2400, height: 1600, channels: 3, background: '#335544' },
    })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: 'camera do dono' } } })
      .toBuffer();
    expect((await sharp(jpg).metadata()).exif).toBeDefined();
    const envio = await dono
      .post(`/unidades/${a.unidadeA}/site/fotos`, {
        tipo: 'image/jpeg',
        dados: jpg.toString('base64'),
      })
      .expect(201);
    const foto = envio.body as { id: string; largura: number; altura: number };
    expect(foto).toMatchObject({ largura: 1600, altura: 1067 });

    for (const [t, largura] of [
      [640, 640],
      [1600, 1600],
    ] as const) {
      const r = await http()
        .get(`/publico/fotos/${foto.id}-${t}.webp`)
        .buffer(true)
        .parse((res, cb) => {
          const partes: Buffer[] = [];
          res.on('data', (c: Buffer) => partes.push(c));
          res.on('end', () => cb(null, Buffer.concat(partes)));
        })
        .expect(200);
      expect(r.headers['content-type']).toBe('image/webp');
      expect(r.headers['cache-control']).toContain('immutable');
      const meta = await sharp(r.body as Buffer).metadata();
      expect(meta).toMatchObject({ format: 'webp', width: largura });
      expect(meta.exif).toBeUndefined();
    }
    await http().get(`/publico/fotos/${foto.id}-800.webp`).expect(404);
    await http().get('/publico/fotos/..%2F..%2Fetc%2Fpasswd').expect(404);

    await dono
      .post(`/unidades/${a.unidadeA}/site/fotos`, { tipo: 'image/png', dados: 'bmFvZWZvdG8=' })
      .expect(400);

    // Foto de verdade passa dos 100 KB do padrão do Express: o corpo aceita até 1 MB.
    const ruido = Buffer.alloc(700 * 500 * 3);
    for (let i = 0; i < ruido.length; i++) ruido[i] = (i * 7919) % 251;
    const grande = await sharp(ruido, { raw: { width: 700, height: 500, channels: 3 } })
      .jpeg({ quality: 95 })
      .toBuffer();
    expect(grande.toString('base64').length).toBeGreaterThan(150_000);
    await dono
      .post(`/unidades/${a.unidadeA}/site/fotos`, {
        tipo: 'image/jpeg',
        dados: grande.toString('base64'),
      })
      .expect(201);

    const { rascunho } = (await dono.get(`/unidades/${a.unidadeA}/site`)).body as SitePainel;
    rascunho.paginas.inicio[0]!.foto = foto.id;
    rascunho.logo = foto.id;
    await dono.put(`/unidades/${a.unidadeA}/site`, rascunho).expect(200);
    const p = (await dono.get(`/unidades/${a.unidadeA}/site/previa`)).body as SitePublico;
    expect(p.fotos[foto.id]).toEqual({ largura: 1600, altura: 1067 });

    rascunho.paginas.inicio[0]!.foto = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
    await dono.put(`/unidades/${a.unidadeA}/site`, rascunho).expect(400);
  });

  it('site e link em endereços separados: trocar um não muda o outro, e o antigo leva ao novo', async () => {
    await dono.patch(`/unidades/${a.unidadeA}`, { agendamentoPublico: true }).expect(200);
    const pub = (await dono.post(`/unidades/${a.unidadeA}/site/publicar`).expect(200))
      .body as SitePainel;
    // Sem endereço próprio, o site nasce com a sugestão (o do link) e fica com ele.
    expect(pub.siteSlug).toBe(slug);

    // O dono troca o LINK de agendamento: o site continua no mesmo endereço.
    const novoLink = `${slug}-agenda`;
    await dono.patch(`/unidades/${a.unidadeA}`, { slug: novoLink }).expect(200);
    const site = (await http().get(`/publico/site/${slug}`).expect(200)).body as SitePublico;
    expect(site).toMatchObject({ slug, slugAgendamento: novoLink });
    await http().get(`/publico/agendamento/${slug}`).expect(404);
    expect(
      (await http().get(`/publico/endereco-antigo/agendamento/${slug}`).expect(200)).body,
    ).toEqual({
      slug: novoLink,
    });

    // Agora troca o endereço do SITE: o link não muda; o endereço antigo do site leva ao novo.
    const novoSite = `${slug}-site`;
    const r = (
      await dono.put(`/unidades/${a.unidadeA}/site/endereco`, { slug: novoSite }).expect(200)
    ).body as SitePainel;
    expect(r).toMatchObject({ siteSlug: novoSite, slug: novoLink });
    await http().get(`/publico/site/${novoSite}`).expect(200);
    await http().get(`/publico/site/${slug}`).expect(404);
    expect((await http().get(`/publico/endereco-antigo/site/${slug}`).expect(200)).body).toEqual({
      slug: novoSite,
    });
    await http().get(`/publico/agendamento/${novoLink}`).expect(200);

    // Voltar ao endereço antigo do link: ele deixa de ser "antigo" e volta a ser o atual.
    await dono.patch(`/unidades/${a.unidadeA}`, { slug }).expect(200);
    await http().get(`/publico/agendamento/${slug}`).expect(200);
    expect(
      (await http().get(`/publico/endereco-antigo/agendamento/${novoLink}`).expect(200)).body,
    ).toEqual({
      slug,
    });
    await http().get(`/publico/endereco-antigo/agendamento/${slug}`).expect(404);

    // Endereço de site de outra unidade não pode; formato inválido também não.
    await dono.patch(`/unidades/${a.unidadeB}`, { slug: `${slug}-b` }).expect(200);
    await dono.put(`/unidades/${a.unidadeB}/site/endereco`, { slug: novoSite }).expect(409);
    await dono.put(`/unidades/${a.unidadeA}/site/endereco`, { slug: 'Com Espaço' }).expect(400);
    await http().get('/publico/endereco-antigo/qualquer/x-y-z').expect(400);
  });

  it('domínio próprio: grava, confere o DNS, libera o certificado e leva ao site', async () => {
    // Nos testes, a conferência aceita só domínio ".teste" (DOMINIO_VERIFICACAO=falso).
    const pendente = (
      await dono
        .put(`/unidades/${a.unidadeA}/site/dominio`, { dominio: 'https://www.Navalha.com.br/' })
        .expect(200)
    ).body as SitePainel;
    expect(pendente).toMatchObject({ dominio: 'navalha.com.br', dominioVerificado: false });
    expect(pendente.dominioIps.length).toBeGreaterThan(0);
    await http().get('/publico/dominio-liberado?domain=navalha.com.br').expect(404);
    await http().get('/publico/dominio/navalha.com.br').expect(404);

    const pronto = (
      await dono
        .put(`/unidades/${a.unidadeA}/site/dominio`, { dominio: 'barbearia-a.teste' })
        .expect(200)
    ).body as SitePainel;
    expect(pronto).toMatchObject({ dominio: 'barbearia-a.teste', dominioVerificado: true });
    expect(pronto.dominioIps).toEqual([]);

    // O site precisa estar publicado para o domínio abrir (e o certificado sair).
    await dono.post(`/unidades/${a.unidadeA}/site/publicar`).expect(200);
    await http().get('/publico/dominio-liberado?domain=www.barbearia-a.teste').expect(200);
    const mapa = (await http().get('/publico/dominio/barbearia-a.teste').expect(200)).body;
    expect(mapa).toEqual({
      siteSlug: pronto.siteSlug ?? expect.any(String),
      slugAgendamento: slug,
    });

    // Domínio de outra unidade, do próprio Pente Fino ou inválido: não.
    await dono
      .put(`/unidades/${a.unidadeB}/site/dominio`, { dominio: 'barbearia-a.teste' })
      .expect(409);
    await dono
      .put(`/unidades/${a.unidadeA}/site/dominio`, { dominio: 'loja.localhost' })
      .expect(400);
    await dono.put(`/unidades/${a.unidadeA}/site/dominio`, { dominio: 'sem-ponto' }).expect(400);
    await barbeiro.put(`/unidades/${a.unidadeA}/site/dominio`, { dominio: 'x.teste' }).expect(403);

    // Tirar do ar fecha o domínio; tirar o domínio também.
    await dono.delete(`/unidades/${a.unidadeA}/site/publicado`).expect(200);
    await http().get('/publico/dominio-liberado?domain=barbearia-a.teste').expect(404);
    await dono.post(`/unidades/${a.unidadeA}/site/publicar`).expect(200);
    const sem = (await dono.delete(`/unidades/${a.unidadeA}/site/dominio`).expect(200))
      .body as SitePainel;
    expect(sem).toMatchObject({ dominio: null, dominioVerificado: false });
    await http().get('/publico/dominio/barbearia-a.teste').expect(404);
  });
});
