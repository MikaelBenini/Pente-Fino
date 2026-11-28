import { expect, test } from '@playwright/test';

// Duas contas, um login (ADR 0015, 27/11/2026): o dono abre outro negócio pelo menu, com 20% de
// desconto. A criação da conta é coberta pela API (contas-mesmo-login.e2e-spec.ts); aqui, a tela.
test('dono vê "Abrir outro negócio" e o preço com 20% de desconto', async ({ page }) => {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('dono@demo.pentefino.dev');
  await page.getByLabel('Senha').fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio/);

  await page.goto('/outro-negocio');
  await expect(page.getByRole('heading', { name: 'Abrir outro negócio' })).toBeVisible();
  await page.getByLabel('Produto').selectOption('estetica');
  await page.getByLabel('Plano').selectOption('basico');
  // Estética Básico R$ 89,90 com 20%: R$ 71,92.
  await expect(page.getByText('R$ 71,92 por mês')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abrir o negócio' })).toBeDisabled();
  await page.getByLabel('Nome do negócio').fill('Clínica Bela');
  await expect(page.getByRole('button', { name: 'Abrir o negócio' })).toBeEnabled();
});
