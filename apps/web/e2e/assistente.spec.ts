import { expect, test, type Page } from '@playwright/test';

// Etapa 11: assistente da equipe no WhatsApp, no Perfil.
async function entrar(page: Page, email: string) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio|agenda|hoje/);
}

test('barbeiro vê o assistente no Perfil; sem WhatsApp conectado, não liga', async ({ page }) => {
  await entrar(page, 'rafael@demo.pentefino.dev');
  await page.goto('/perfil');
  const secao = page.getByRole('region', { name: 'Assistente no WhatsApp' });
  await expect(secao).toContainText('horários novos, remarcados e cancelados');
  await expect(secao.getByText(/não está conectado/)).toBeVisible();
  await expect(secao.getByRole('button', { name: 'Ligar o assistente' })).toBeDisabled();
});

test('recepção (fora da agenda) não tem assistente', async ({ page }) => {
  await entrar(page, 'recepcao.centro@demo.pentefino.dev');
  await page.goto('/perfil');
  await expect(page.getByRole('heading', { name: 'Trocar senha' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Assistente no WhatsApp' })).toHaveCount(0);
});
