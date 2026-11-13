import { expect, test, type Page } from '@playwright/test';

// Seção 7, lote 7b: o painel "Minha página". O dono edita um bloco, vê a prévia mudar, troca a
// cor, publica e o cliente vê na hora; depois tira do ar e o link volta a ser o agendamento.
const SLUG = 'demo-jardins';

async function entrar(page: Page) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('dono@demo.pentefino.dev');
  await page.getByLabel('Senha').fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio|agenda|hoje/);
}

test('Minha página: editar, ver a prévia, publicar e tirar do ar', async ({ page, browser }) => {
  test.setTimeout(120_000);
  await entrar(page);
  await page.goto('/pagina');
  await expect(page.getByRole('heading', { level: 1, name: 'Minha página' })).toBeVisible();
  const unidade = page.getByLabel('Unidade', { exact: true });
  if (await unidade.isVisible()) await unidade.selectOption({ label: 'Jardins' });

  const titulo = `Jardins com hora marcada ${Date.now().toString(36)}`;
  await page.getByRole('button', { name: 'Banner', exact: true }).click();
  await page.getByLabel('Título', { exact: true }).fill(titulo);
  const previa = page.getByRole('region', { name: 'Prévia' });
  await expect(previa.getByRole('heading', { level: 1, name: titulo })).toBeVisible();

  // Esconder e mostrar um bloco reflete na prévia.
  await page.getByRole('button', { name: 'Esconder Faixa de destaques' }).click();
  await expect(previa.getByRole('region', { name: 'Destaques' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Mostrar Faixa de destaques' }).click();
  await expect(previa.getByRole('region', { name: 'Destaques' })).toBeVisible();

  // Link da prévia troca a página editada, sem sair do painel.
  await previa.getByRole('link', { name: 'Ver serviços e preços' }).click();
  await expect(page).toHaveURL(/\/pagina$/);
  await expect(page.getByLabel('Página', { exact: true })).toHaveValue('servicos');
  await page.getByLabel('Página', { exact: true }).selectOption('inicio');

  await page.getByRole('tab', { name: 'Tema' }).click();
  await page.getByLabel('Sálvia').check({ force: true });
  await page.getByRole('button', { name: 'Celular' }).click();
  await expect(page.getByRole('button', { name: 'Celular' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await expect(page.getByText('Rascunho salvo.')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /^Publicar (página|alterações)$/ }).click();
  await expect(page.getByText('Publicado. O cliente já vê a página nova.')).toBeVisible();
  await expect(page.getByText(/^No ar desde /)).toBeVisible();

  const visitante = await (await browser.newContext()).newPage();
  await visitante.goto(`/b/${SLUG}`);
  await expect(visitante.getByRole('heading', { level: 1, name: titulo })).toBeVisible();

  await page.getByRole('button', { name: 'Tirar do ar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Tirar do ar' }).click();
  await expect(page.getByText(/O site saiu do ar/)).toBeVisible();
  await expect(page.getByText('Ainda não publicada')).toBeVisible();
  await visitante.goto(`/b/${SLUG}`);
  await expect(visitante.getByRole('heading', { level: 1, name: titulo })).toHaveCount(0);
  await visitante.close();
});
