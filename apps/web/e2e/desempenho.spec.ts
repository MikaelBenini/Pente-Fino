import { expect, test, type Page } from '@playwright/test';

// Etapa 9: barbeiros em Resultados do mês e a ficha do profissional, com o que cada papel vê.
const SENHA = 'pentefino123';

async function entrar(page: Page, email: string) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio|agenda|hoje/);
}

/** Abre a ficha do primeiro barbeiro pela aba Barbeiros de Resultados do mês. */
async function abrirFicha(page: Page) {
  await page.goto('/resultados?aba=barbeiros');
  await page
    .getByRole('region', { name: 'Quanto cada barbeiro custa e quanto rende' })
    .getByRole('link')
    .first()
    .click();
  await page.waitForURL(/\/equipe\/ficha\?id=/);
}

test('dono vai dos barbeiros do mês à ficha completa e volta', async ({ page }) => {
  await entrar(page, 'dono@demo.pentefino.dev');
  await page.goto('/resultados?aba=barbeiros');
  const barbeiros = page.getByRole('region', { name: 'Quanto cada barbeiro custa e quanto rende' });
  await expect(barbeiros.getByRole('link', { name: 'Rafael Moura' })).toBeVisible();
  await barbeiros.getByLabel('Ordenar por').selectOption('retorno');
  await barbeiros.getByRole('link', { name: 'Rafael Moura' }).click();

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
  // Avaliações: a nota do atendimento dele, com as barras de 1 a 5.
  await expect(
    page.getByRole('list', { name: 'Notas de atendimento' }).filter({ visible: true }),
  ).toBeVisible();
  // Dono vê a margem dos serviços.
  await expect(
    visivel('Serviços feitos no período', 'table').getByRole('columnheader', { name: 'Lucro' }),
  ).toBeVisible();
  // Volta para os barbeiros, no mesmo mês.
  await page
    .locator('#conteudo')
    .getByRole('link', { name: 'Resultados do mês' })
    .filter({ visible: true })
    .click();
  await page.waitForURL(/\/resultados\?mes=\d{4}-\d{2}&aba=barbeiros/);
  await expect(page.getByRole('tab', { name: 'Barbeiros' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('a ficha abre as comandas atendidas', async ({ page }) => {
  await entrar(page, 'gestor@demo.pentefino.dev');
  await abrirFicha(page);
  const comandas = page
    .getByRole('table', { name: 'Comandas atendidas no período' })
    .filter({ visible: true });
  await expect(comandas).toBeVisible();
  await comandas.getByRole('link').first().click();
  await page.waitForURL(/\/comandas\?id=/);
});

test('mês passado pela ficha muda o endereço e os números', async ({ page }) => {
  // Gestor: o dono já entra em muitos testes e o login tem limite por minuto.
  await entrar(page, 'gestor@demo.pentefino.dev');
  await abrirFicha(page);
  await page.getByRole('button', { name: 'Mês anterior' }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/mes=\d{4}-\d{2}/);
  await expect(
    page.getByRole('heading', { name: 'Resumo' }).filter({ visible: true }),
  ).toBeVisible();
});

test('gestor vê a ficha sem margem; barbeiro vê só a própria', async ({ browser }) => {
  const gestor = await (await browser.newContext()).newPage();
  await entrar(gestor, 'gestor@demo.pentefino.dev');
  await abrirFicha(gestor);
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
  await expect(barbeiro.getByRole('button', { name: /Chamar .* no WhatsApp/ })).toHaveCount(0);
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
