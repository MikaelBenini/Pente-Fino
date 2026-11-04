import { expect, test, type Page } from '@playwright/test';

// Etapa 9: ranking da equipe e ficha do profissional, com o que cada papel pode ver.
const SENHA = 'pentefino123';

async function entrar(page: Page, email: string) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio|agenda|hoje/);
}

test('dono vai do ranking da equipe à ficha completa do barbeiro', async ({ page }) => {
  await entrar(page, 'dono@demo.pentefino.dev');
  await page.goto('/equipe');
  const ranking = page
    .getByRole('table', { name: 'Desempenho da equipe' })
    .filter({ visible: true });
  await expect(ranking).toBeVisible();
  await expect(ranking.getByRole('link', { name: /Rafael Moura/ })).toBeVisible();
  await page.getByLabel('Ordenar por').filter({ visible: true }).selectOption('taxaRetorno');
  await ranking.getByRole('link', { name: /Rafael Moura/ }).click();

  await page.waitForURL(/\/equipe\/ficha\?id=/);
  const visivel = (nome: string | RegExp, papel: 'heading' | 'table' = 'heading') =>
    page.getByRole(papel, { name: nome }).filter({ visible: true });
  await expect(visivel('Rafael Moura')).toBeVisible();
  for (const secao of ['Resumo', 'Evolução', 'Serviços', 'Clientes', 'Rotina', 'Avaliações'])
    await expect(
      page.getByRole('heading', { name: secao, level: 2, exact: true }).filter({ visible: true }),
    ).toBeVisible();
  await expect(visivel('Ticket médio')).toBeVisible();
  await expect(visivel('Para chamar de volta')).toBeVisible();
  // Dono vê a margem dos serviços.
  await expect(
    visivel('Serviços feitos no período', 'table').getByRole('columnheader', { name: 'Lucro' }),
  ).toBeVisible();
  // Comandas atendidas abrem a comanda.
  const comandas = visivel('Comandas atendidas no período', 'table');
  await expect(comandas).toBeVisible();
  await comandas.getByRole('link').first().click();
  await page.waitForURL(/\/comandas\?id=/);
});

test('mês passado pela ficha muda o endereço e os números', async ({ page }) => {
  await entrar(page, 'dono@demo.pentefino.dev');
  await page.goto('/equipe');
  await page
    .getByRole('table', { name: 'Desempenho da equipe' })
    .filter({ visible: true })
    .getByRole('link')
    .first()
    .click();
  await page.waitForURL(/\/equipe\/ficha\?id=/);
  await page.getByRole('button', { name: 'Mês anterior' }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/mes=\d{4}-\d{2}/);
  await expect(
    page.getByRole('heading', { name: 'Resumo' }).filter({ visible: true }),
  ).toBeVisible();
});

test('gestor vê a ficha sem margem; barbeiro vê só a própria', async ({ browser }) => {
  const gestor = await (await browser.newContext()).newPage();
  await entrar(gestor, 'gestor@demo.pentefino.dev');
  await gestor.goto('/equipe');
  await gestor
    .getByRole('table', { name: 'Desempenho da equipe' })
    .filter({ visible: true })
    .getByRole('link')
    .first()
    .click();
  await gestor.waitForURL(/\/equipe\/ficha\?id=/);
  const servicos = gestor
    .getByRole('table', { name: 'Serviços feitos no período' })
    .filter({ visible: true });
  await expect(servicos).toBeVisible();
  await expect(servicos.getByRole('columnheader', { name: 'Lucro' })).toHaveCount(0);

  const barbeiro = await (await browser.newContext()).newPage();
  await entrar(barbeiro, 'rafael@demo.pentefino.dev');
  await barbeiro.goto('/desempenho');
  await expect(
    barbeiro.getByRole('heading', { name: 'Desempenho', level: 1 }).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    barbeiro.getByRole('heading', { name: 'Ticket médio' }).filter({ visible: true }),
  ).toBeVisible();
  await expect(barbeiro.getByRole('columnheader', { name: 'Lucro' })).toHaveCount(0);
  await expect(barbeiro.getByRole('link', { name: /Chamar .* no WhatsApp/ })).toHaveCount(0);
  await expect(barbeiro.getByText(/vs\. média da unidade/)).toHaveCount(0);
  // A ficha dos colegas continua fora do alcance.
  await barbeiro.goto('/equipe');
  await expect(
    barbeiro.getByRole('heading', { name: 'Esta tela não faz parte do seu acesso' }),
  ).toBeVisible();
});

test('ficha e desempenho não rolam para o lado', async ({ page }) => {
  await entrar(page, 'rafael@demo.pentefino.dev');
  await page.goto('/desempenho');
  await expect(
    page.getByRole('heading', { name: 'Rotina', level: 2 }).filter({ visible: true }),
  ).toBeVisible();
  const sobra = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sobra).toBeLessThanOrEqual(0);
});
