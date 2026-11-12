import { expect, test } from '@playwright/test';

// Site público: página inicial, planos, termos, privacidade, SEO e o caminho até o cadastro.

test('página inicial apresenta a proposta e leva ao teste grátis', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /Saiba quanto sobra/ })).toBeVisible();
  // Calculadora: R$ 60 com 45% de comissão e R$ 3,50 de produto sobra R$ 29,50 por corte.
  const calculadora = page.getByRole('region', { name: 'Quanto sobra de cada corte?' });
  await calculadora.getByLabel('Preço do corte').fill('60');
  await expect(calculadora.getByText('R$ 29,50').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Perguntas frequentes' })).toBeVisible();
  await page
    .getByRole('link', { name: /Testar 14 dias grátis/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/cadastro/);
  await expect(page.getByRole('heading', { name: 'Criar conta' })).toBeVisible();
});

test('planos: anual, calculadora do Premium e cadastro com plano escolhido', async ({ page }) => {
  await page.goto('/planos');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // Anual é o padrão: Pro a R$ 124,90/mês.
  await expect(page.getByText('R$ 124,90').first()).toBeVisible();
  await page.getByRole('radio', { name: 'Mensal' }).click();
  await expect(page.getByText('R$ 149,90').first()).toBeVisible();
  // Premium mensal com 2 unidades: 249,90 + 99,90; com 3: + 99,90.
  await expect(page.getByText('R$ 349,80')).toBeVisible();
  await page.getByRole('button', { name: 'Uma unidade a mais' }).click();
  await expect(page.getByText('R$ 449,70')).toBeVisible();
  await expect(page.getByText('Em breve').first()).toBeVisible();

  await page.getByRole('link', { name: /Testar o plano Premium/ }).click();
  await expect(page).toHaveURL(/plano=premium&ciclo=mensal/);
  await expect(page.getByRole('radio', { name: /Premium/ })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Mensal' })).toBeChecked();
});

test('cadastro ignora plano inválido na URL', async ({ page }) => {
  await page.goto('/cadastro?plano=<script>&ciclo=x');
  await expect(page.getByRole('radio', { name: /^Pro/ })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Mensal' })).toBeChecked();
  await expect(page.getByRole('link', { name: 'termos de uso' })).toHaveAttribute(
    'href',
    '/termos',
  );
});

test('termos e privacidade abrem sem login', async ({ page }) => {
  await page.goto('/termos');
  await expect(page.getByRole('heading', { level: 1, name: 'Termos de uso' })).toBeVisible();
  await page.goto('/privacidade');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Política de privacidade' }),
  ).toBeVisible();
  await expect(page.getByText(/controladora/).first()).toBeVisible();
});

test('com sessão, a página inicial leva para o app', async ({ page }) => {
  await page.goto('/entrar');
  // Gestor: o dono já entra em muitos testes e o login tem limite por minuto.
  await page.getByLabel('E-mail').fill('gestor@demo.pentefino.dev');
  await page.getByLabel('Senha').fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio|agenda/);
  const destino = new URL(page.url()).pathname;
  await page.goto('/');
  await expect(page).toHaveURL(new RegExp(`${destino}$`));
});

test('robots, sitemap e imagem de compartilhamento', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /app');
  expect(robots).toContain('Sitemap:');
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain('/planos');
  expect(sitemap).toContain('/comissao-de-barbeiro');
  const og = await request.get('/opengraph-image');
  expect(og.ok()).toBe(true);
  expect(og.headers()['content-type']).toContain('image/png');
});

for (const rota of [
  '/',
  '/planos',
  '/termos',
  '/privacidade',
  '/sistema-para-barbearia',
  '/melhor-sistema-para-barbearia',
]) {
  test(`${rota} não rola para o lado`, async ({ page }) => {
    await page.goto(rota);
    const sobra = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(sobra).toBeLessThanOrEqual(0);
  });
}

// ─── Briefing do site (docs/pente-fino-melhorias.md, parte 3) ─────

test('B1: endereço que não existe responde 404; tela do sistema ainda pede login', async ({
  page,
  request,
}) => {
  const r = await request.get('/pagina-que-nao-existe', { maxRedirects: 0 });
  expect(r.status()).toBe(404);
  await page.goto('/pagina-que-nao-existe');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Página não encontrada' }),
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(1);
  await page.goto('/agenda');
  await expect(page).toHaveURL(/\/entrar\?voltar=%2Fagenda$/);
});

test('B2, B4 e B6: bot sem "em construção", preços certos para o Google e economia calculada', async ({
  page,
}) => {
  await page.goto('/planos');
  await expect(page.getByText(/bot está em construção/)).toHaveCount(0);
  await expect(page.getByText('Está incluso no Pro e no Premium, sem custo extra.')).toBeAttached();
  await expect(page.getByText('economize até R$ 504/ano').first()).toBeVisible();
  const ld = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').first().textContent())!,
  ) as { offers: { '@type': string; lowPrice: string; highPrice: string; offerCount: number } };
  expect(ld.offers).toMatchObject({
    '@type': 'AggregateOffer',
    lowPrice: '66.90',
    highPrice: '249.90',
    offerCount: 3,
  });
});

test('B3: o cupom do link já mostra o desconto; cupom inválido avisa', async ({ page }) => {
  await page.goto('/cadastro?cupom=LANCAMENTO&plano=pro&ciclo=mensal');
  await expect(page.getByText('30% de desconto para sempre aplicado (LANCAMENTO).')).toBeVisible();
  const pro = page.getByRole('radio', { name: /^Pro/ }).locator('..');
  await expect(pro.locator('s')).toHaveText(/R\$ 149,90/);
  await expect(pro).toContainText('R$ 104,93/mês');
  await page.goto('/cadastro?cupom=INVALIDO');
  await expect(page.getByText('Cupom não encontrado.')).toBeVisible();
});

test('B8: WhatsApp opcional com máscara no cadastro', async ({ page }) => {
  await page.goto('/cadastro');
  const campo = page.getByLabel('WhatsApp (opcional)');
  await campo.pressSequentially('11988887777');
  await expect(campo).toHaveValue('(11) 98888-7777');
  await expect(page.getByLabel('Seu nome')).toHaveAttribute('aria-required', 'true');
  await page.getByRole('button', { name: 'Mostrar senha' }).click();
  await expect(page.getByLabel('Senha')).toHaveAttribute('type', 'text');
});

test('C1 e P1: faixa da oferta leva ao cupom; promessas parciais com o selo do plano', async ({
  page,
}) => {
  await page.goto('/');
  const faixa = page.getByRole('region', { name: 'Oferta de lançamento' });
  await expect(faixa.getByRole('link', { name: 'Ativar desconto' })).toHaveAttribute(
    'href',
    '/cadastro?cupom=LANCAMENTO',
  );
  await expect(
    page.getByRole('heading', { name: /O que dá lucro, e o que só dá trabalho/ }),
  ).toContainText('Premium');
  await expect(page.getByRole('heading', { name: /WhatsApp que agenda sozinho/ })).toContainText(
    'Pro e Premium',
  );
  // Fechada, a faixa não volta neste navegador.
  await faixa.getByRole('button', { name: 'Fechar a faixa da oferta' }).click();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Oferta de lançamento' })).toHaveCount(0);
});

test('B7: "Planos" aparece no topo também no celular', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Site' });
  for (const nome of ['Planos', 'Entrar', 'Testar grátis'])
    await expect(nav.getByRole('link', { name: nome })).toBeVisible();
});

// Site T1, T2 e T3: de onde veio o visitante (anúncio), os passos do funil e a conversão com valor.
test('do anúncio ao cadastro: origem guardada, eventos do funil e conversão com valor', async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name === 'celular', 'a medição é a mesma no celular');
  // Visitante que aceitou os cookies; os eventos do dataLayer ficam anotados para o teste.
  await page.addInitScript(() => {
    localStorage.setItem('pf-cookies', 'aceito');
    const anotar = (e: unknown) => {
      const lista = JSON.parse(sessionStorage.getItem('eventos-e2e') ?? '[]') as unknown[];
      lista.push(e);
      sessionStorage.setItem('eventos-e2e', JSON.stringify(lista));
    };
    const dl: unknown[] = [];
    dl.push = (...itens: unknown[]) => {
      itens.forEach(anotar);
      return Array.prototype.push.apply(dl, itens);
    };
    (window as unknown as { dataLayer: unknown[] }).dataLayer = dl;
  });
  const sufixoT = Date.now().toString(36);
  await page.goto('/?gclid=gclid-e2e&utm_source=google&utm_medium=cpc&utm_campaign=e2e');
  // A tela grava a origem logo depois de carregar.
  await expect
    .poll(async () => (await context.cookies()).some((c) => c.name === 'pf_origem'))
    .toBe(true);
  const cookie = (await context.cookies()).find((c) => c.name === 'pf_origem');
  expect(decodeURIComponent(cookie!.value)).toContain('"gclid":"gclid-e2e"');
  expect(cookie!.expires - Date.now() / 1000).toBeGreaterThan(89 * 86_400);

  await page.goto('/planos');
  await page.getByRole('radio', { name: 'Mensal' }).click();
  await page
    .getByRole('link', { name: /Testar grátis|Começar|Criar conta/ })
    .first()
    .click();
  await page.waitForURL(/\/cadastro/);
  await page.getByLabel('Nome da barbearia').fill(`Barbearia Anúncio ${sufixoT}`);
  await page.getByLabel('Seu nome').fill('Dono Anúncio');
  await page.getByLabel('E-mail').fill(`anuncio-${sufixoT}@e2e.pentefino.dev`);
  await page.getByLabel('Senha').fill('senha-forte-123');
  await page.getByText('Li e aceito').click();
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.waitForURL(/configuracao-inicial/);

  const eventos = (await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('eventos-e2e') ?? '[]'),
  )) as { event?: string; value?: number; currency?: string; posicao?: string }[];
  const nomes = eventos.map((e) => e.event).filter(Boolean);
  for (const n of ['view_planos', 'toggle_ciclo', 'click_cta', 'begin_sign_up', 'sign_up'])
    expect(nomes, n).toContain(n);
  // Conversão só no sucesso, com valor e moeda (lance por valor no Google Ads).
  const conversao = eventos.find((e) => e.event === 'sign_up')!;
  expect(conversao.currency).toBe('BRL');
  expect(conversao.value).toBeGreaterThan(0);
  expect(nomes.indexOf('begin_sign_up')).toBeLessThan(nomes.indexOf('sign_up'));
});

// ─── Site N1: páginas por termo de busca ─────
test('N1: página por termo de busca tem H1, canonical, perguntas para o Google e cadastro', async ({
  page,
}) => {
  await page.goto('/comissao-de-barbeiro');
  await expect(
    page.getByRole('heading', { level: 1, name: /Comissão de barbeiro calculada sozinha/ }),
  ).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    /\/comissao-de-barbeiro$/,
  );
  // Comissão vem em todos os planos: sem selo. O preço sai da tabela.
  await expect(page.getByRole('heading', { name: /Item a item/ })).not.toContainText('Pro');
  await expect(page.getByText(/A partir de R\$\s66,90 por mês no plano anual/)).toBeVisible();
  const dados = await page.locator('script[type="application/ld+json"]').allTextContents();
  const faq = dados.map((d) => JSON.parse(d)).find((d) => d['@type'] === 'FAQPage');
  expect(faq.mainEntity.length).toBeGreaterThanOrEqual(3);
  await expect(page.getByRole('link', { name: 'Criar conta grátis' })).toHaveAttribute(
    'href',
    /\/cadastro/,
  );
  // O bot é do Pro: a página do WhatsApp mostra o selo, e o rodapé liga todas as páginas.
  await page
    .getByRole('navigation', { name: 'Veja também' })
    .getByRole('link', { name: 'WhatsApp para barbearia' })
    .click();
  await expect(page.getByRole('heading', { name: /Agenda 24 horas/ })).toContainText(
    'Pro e Premium',
  );
  await expect(page.getByRole('navigation', { name: 'Recursos' }).getByRole('link')).toHaveCount(8);
});

// ─── Site N2: comparações justas, com fonte e data ─────
test('N2: comparação mostra os dois lados, a fonte com data e leva às outras', async ({ page }) => {
  await page.goto('/comparativo/appbarber');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Pente Fino ou AppBarber?' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Onde o AppBarber é melhor' })).toBeVisible();
  // Preço do Pente Fino lido da tabela de planos: 5 barbeiros cabem no Pro.
  const tabela = page.getByRole('table', { name: 'Pente Fino e AppBarber lado a lado' });
  await expect(tabela.getByRole('row', { name: /5 barbeiros/ })).toContainText('R$ 149,90 (Pro)');
  await expect(page.getByText(/Conferido em 12\/11\/2026/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'https://appbarber.com.br/' })).toHaveAttribute(
    'rel',
    /nofollow/,
  );
  await page
    .getByRole('navigation', { name: 'Outras comparações' })
    .getByRole('link', { name: 'Como escolher o sistema' })
    .click();
  await expect(
    page.getByRole('table', { name: 'Pente Fino, AppBarber, Trinks e Booksy lado a lado' }),
  ).toBeVisible();
  // Sem preço claro na fonte, a tabela manda para a página de planos do concorrente.
  await expect(page.getByText('Veja na página de planos').first()).toBeVisible();
});
