import { expect, test, type Page } from '@playwright/test';

// Resumo do dia: o que tem para hoje por barbeiro e filtros; o dia aberto pelo endereço.
async function entrar(page: Page, email: string) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio|agenda|hoje/);
}
const visivel = <T extends { filter: (o: { visible: boolean }) => T }>(l: T) =>
  l.filter({ visible: true });

test('dono vê o dia por barbeiro e filtra', async ({ page }) => {
  await entrar(page, 'dono@demo.pentefino.dev');
  await page.goto('/dia');
  await expect(
    visivel(page.getByRole('heading', { name: 'Resumo do dia', level: 1 })),
  ).toBeVisible();
  await expect(visivel(page.getByRole('heading', { name: 'Atendidos' }))).toBeVisible();
  await expect(visivel(page.getByRole('heading', { name: 'Rafael Moura' }))).toBeVisible();

  // Só um barbeiro.
  await visivel(page.getByLabel('Barbeiro')).selectOption({ label: 'Rafael Moura' });
  await expect(visivel(page.getByRole('heading', { name: 'Rafael Moura' }))).toBeVisible();
  await expect(visivel(page.getByRole('heading', { name: 'Diego Prado' }))).toHaveCount(0);

  // Dia anterior: o que já foi feito.
  await visivel(page.getByRole('button', { name: 'Dia anterior' })).click();
  await expect(visivel(page.getByRole('button', { name: 'Hoje', exact: true }))).toBeVisible();
});

test('o dia escolhido pelo endereço abre direto (vindo do mês dia a dia)', async ({ page }) => {
  await entrar(page, 'gestor@demo.pentefino.dev');
  await page.goto('/resultados');
  const tabela = visivel(page.getByRole('table', { name: /dia a dia/ }));
  await expect(tabela).toBeVisible();
  await tabela
    .getByRole('link', { name: /^Abrir / })
    .first()
    .click();
  await page.waitForURL(/\/dia\?dia=\d{4}-\d{2}-\d{2}/);
  await expect(
    visivel(page.getByRole('heading', { name: 'Resumo do dia', level: 1 })),
  ).toBeVisible();
  await expect(visivel(page.getByRole('heading', { name: 'Atendidos' }))).toBeVisible();
});

test('o resumo do dia é da gestão: barbeiro não acessa', async ({ page }) => {
  await entrar(page, 'rafael@demo.pentefino.dev');
  await page.goto('/dia');
  await expect(
    page.getByRole('heading', { name: 'Esta tela não faz parte do seu acesso' }),
  ).toBeVisible();
});

test('resumo do dia não rola para o lado', async ({ page }) => {
  await entrar(page, 'gestor@demo.pentefino.dev');
  await page.goto('/dia');
  await expect(visivel(page.getByRole('heading', { name: 'Atendidos' }))).toBeVisible();
  const sobra = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sobra).toBeLessThanOrEqual(0);
});
