// Site da barbearia (seção 7, lote 7a): rascunho que o dono edita, publicar, a página pública
// com os dados vivos da unidade e tirar do ar (volta a página de agendamento).
import type { INestApplication } from '@nestjs/common';
import { dataLocal, type SitePainel, type SitePublico } from '@pente-fino/shared';
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
});
