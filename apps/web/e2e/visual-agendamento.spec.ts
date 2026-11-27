import { expect, test, type Page } from '@playwright/test';

// Lote 7l: a página de agendamento com a cara da barbearia, separada do site (vale ao salvar).
async function entrar(page: Page) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('dono@demo.pentefino.dev');
  await page.getByLabel('Senha').fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio|agenda|hoje/);
}

test('visual da página de agendamento: liga, aparece no link e desliga', async ({
  page,
  browser,
}) => {
  await entrar(page);
  await page.goto('/pagina');
  // Espera a tela carregar: o seletor de unidade só aparece depois.
  await expect(page.getByRole('heading', { level: 1, name: 'Minha página' })).toBeVisible();
  // Cada assunto na sua aba (pedido do dono em 15/11): o site vem primeiro.
  await expect(page.getByRole('tab', { name: 'Site', selected: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Página de agendamento' }).click();
  await expect(page.getByRole('region', { name: 'Página de agendamento' })).toBeVisible();
  const unidade = page.getByLabel('Unidade', { exact: true });
  if (await unidade.isVisible()) await unidade.selectOption({ label: 'Jardins' });
  await expect(unidade).toHaveValue(/.+/);
  await expect(unidade.locator('option:checked')).toHaveText('Jardins');
  const secao = page.getByRole('region', { name: 'Página de agendamento' });
  const titulo = `Marque com a gente ${Date.now().toString(36)}`;
  const ligar = secao.getByLabel('Usar o seu visual na página de agendamento');
  if (!(await ligar.isChecked())) await secao.getByText('Usar o seu visual').click();
  await secao.getByLabel('Título (opcional)').fill(titulo);
  // A página inteira veste o tema escolhido, e a barbearia pode tirar a marca do Pente Fino.
  await secao.getByRole('radio', { name: /^Clube/ }).check({ force: true });
  const marca = secao.getByLabel('Mostrar “Agendamento pelo Pente Fino” no fim da página');
  if (await marca.isChecked())
    await secao.getByText('Mostrar “Agendamento pelo Pente Fino” no fim da página').click();
  await secao.getByRole('button', { name: 'Salvar página de agendamento' }).click();
  await expect(secao.getByText('Salvo.')).toBeVisible();

  const cliente = await (await browser.newContext()).newPage();
  await cliente.goto('/b/demo-jardins');
  await expect(cliente.getByText(titulo)).toBeVisible();
  await expect(cliente.getByText('Agendamento pelo Pente Fino')).toHaveCount(0);
  const fundo = await cliente
    .locator('div.fixed.inset-0.-z-20')
    .evaluate((d) => getComputedStyle(d).backgroundColor);
  expect(fundo).toBe('rgb(35, 26, 22)');

  await secao.getByText('Usar o seu visual').click();
  await secao.getByRole('button', { name: 'Salvar página de agendamento' }).click();
  await expect(secao.getByText('Salvo.')).toBeVisible();
  await cliente.reload();
  await expect(cliente.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(cliente.getByText(titulo)).toHaveCount(0);
  await cliente.close();
});
