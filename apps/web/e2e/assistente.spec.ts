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

test('barbeiro vê "Meus preços" no Perfil, com o preço da unidade; valor inválido não é enviado', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'celular', 'o mesmo formulário; basta um aparelho');
  await entrar(page, 'rafael@demo.pentefino.dev');
  await page.goto('/perfil');
  const secao = page.getByRole('region', { name: 'Meus preços' });
  await expect(secao).toContainText('Deixe vazio para usar o preço da unidade');
  await expect(secao.getByText(/^Unidade: R\$/).first()).toBeVisible();
  const campo = secao.getByLabel(/^Meu preço de /).first();
  await expect(campo).toHaveAttribute('placeholder', 'o da unidade');
  await campo.fill('abc');
  await secao.getByRole('button', { name: 'Salvar meus preços' }).click();
  await expect(secao.getByText(/Valor inválido em/)).toBeVisible();
});
