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
  const og = await request.get('/opengraph-image');
  expect(og.ok()).toBe(true);
  expect(og.headers()['content-type']).toContain('image/png');
});

for (const rota of ['/', '/planos', '/termos', '/privacidade']) {
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
