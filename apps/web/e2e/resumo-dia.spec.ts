import { expect, test, type Page } from '@playwright/test';

// Resumo do dia: o que tem para hoje por barbeiro, filtros e o mês dia a dia.
async function entrar(page: Page, email: string) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio|agenda|hoje/);
}
const visivel = <T extends { filter: (o: { visible: boolean }) => T }>(l: T) =>
  l.filter({ visible: true });

test('dono vê o dia por barbeiro, filtra e abre um dia pelo mês', async ({ page }) => {
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

  // Mês dia a dia, e de volta a um dia.
  await page.getByRole('tab', { name: 'Mês dia a dia' }).click();
  const tabela = visivel(page.getByRole('table', { name: /dia a dia/ }));
  await expect(tabela).toBeVisible();
  await tabela
    .getByRole('button', { name: /^Abrir / })
    .first()
    .click();
  await expect(page.getByRole('tab', { name: 'Dia', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
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
