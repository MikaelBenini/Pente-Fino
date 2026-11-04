import { expect, test } from '@playwright/test';

// Movimento: anima ao chegar, termina sempre visível e some com "reduzir movimento".
// Só o que está na tela: o Next guarda telas anteriores escondidas (display: none).
const opacidades = (seletor: string) =>
  `[...document.querySelectorAll('${seletor}')].filter((e) => e.getClientRects().length > 0).map((e) => Number(getComputedStyle(e).opacity))`;

test('página inicial anima a abertura e a comanda, e termina toda visível', async ({ page }) => {
  await page.goto('/');
  const animacao = await page.evaluate(
    () => getComputedStyle(document.querySelector('.comanda-imprime')!).animationName,
  );
  expect(animacao).toBe('imprimir');
  await page.waitForTimeout(1600);
  const abertura = (await page.evaluate(opacidades('.animar-escalonado > *'))) as number[];
  expect(abertura.length).toBeGreaterThan(3);
  expect(abertura.every((o) => o === 1)).toBe(true);
  const sobra = await page.evaluate(() =>
    Number(getComputedStyle(document.querySelector('[data-sobra]')!).opacity),
  );
  expect(sobra).toBe(1);
});

test('com "reduzir movimento", nada fica escondido nem se mexe', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.waitForTimeout(100);
  const tudo = (await page.evaluate(
    opacidades('.animar-escalonado > *, .revelar, .comanda-imprime li'),
  )) as number[];
  expect(tudo.every((o) => o === 1)).toBe(true);
  const revelar = await page.evaluate(
    () => getComputedStyle(document.querySelector('.revelar')!).animationName,
  );
  expect(revelar).toBe('none');
});

test('barra de navegação aparece no clique e some ao chegar', async ({ page }) => {
  await page.goto('/');
  const barra = page.locator('.barra-navegacao');
  await expect(barra).toHaveAttribute('data-estado', 'parado');
  await page
    .getByRole('link', { name: /^Planos( e preços)?$/ })
    .filter({ visible: true })
    .first()
    .click();
  await page.waitForURL(/\/planos/);
  await expect(barra).toHaveAttribute('data-estado', 'parado', { timeout: 5000 });
});

test('carregando aparece com o desenho da tela e o app entra animado', async ({ page }) => {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('gestor@demo.pentefino.dev');
  await page.getByLabel('Senha').fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio/);
  const entrada = await page.evaluate(
    () => getComputedStyle(document.querySelector('main .animar-entrada')!).animationName,
  );
  expect(entrada).toBe('entrar');
  await expect(
    page.getByRole('heading', { name: 'Faturamento' }).filter({ visible: true }).first(),
  ).toBeVisible();
  await page.waitForTimeout(1200);
  const cartoes = (await page.evaluate(opacidades('main .animar-escalonado > *'))) as number[];
  expect(cartoes.every((o) => o === 1)).toBe(true);
});
