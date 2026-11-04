import { expect, test } from '@playwright/test';

// Site público: página inicial, planos, termos, privacidade, SEO e o caminho até o cadastro.

test('página inicial apresenta a proposta e leva ao teste grátis', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /Saiba quanto sobra/ })).toBeVisible();
  await expect(page.getByText('Exemplo fictício')).toBeVisible();
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
  await page.getByLabel('E-mail').fill('dono@demo.pentefino.dev');
  await page.getByLabel('Senha').fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio/);
  await page.goto('/');
  await page.waitForURL(/inicio/);
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
