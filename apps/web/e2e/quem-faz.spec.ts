import { expect, test, type Page } from '@playwright/test';

// P5 (lote 7g): o dono marca os serviços que cada barbeiro faz, na Equipe.
async function entrar(page: Page) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('dono@demo.pentefino.dev');
  await page.getByLabel('Senha').fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio|agenda|hoje/);
}

test('serviços que o barbeiro faz: marcar, conferir e voltar a fazer todos', async ({ page }) => {
  await entrar(page);
  await page.goto('/equipe');
  const botao = page.getByRole('button', { name: 'Serviços que faz' }).first();
  await botao.click();
  const dialogo = page.getByRole('dialog', { name: /^Serviços que / });
  const todos = dialogo.getByLabel(/Faz todos os serviços/);
  await expect(todos).toBeChecked();

  // Desmarca todos e deixa só o primeiro serviço da lista.
  await dialogo.getByText(/Faz todos os serviços/).click();
  const primeiro = dialogo.getByRole('checkbox').nth(1);
  await primeiro.check();
  await dialogo.getByRole('button', { name: 'Salvar serviços' }).click();
  await expect(dialogo).toBeHidden();

  await botao.click();
  await expect(dialogo.getByLabel(/Faz todos os serviços/)).not.toBeChecked();
  await expect(dialogo.getByRole('checkbox').nth(1)).toBeChecked();

  // Volta como estava.
  await dialogo.getByText(/Faz todos os serviços/).click();
  await dialogo.getByRole('button', { name: 'Salvar serviços' }).click();
  await expect(dialogo).toBeHidden();
});
