import { expect, test, type Page } from '@playwright/test';

// Seção 7: busca global. Ctrl+K (ou o botão "Procurar") acha uma tela, um cliente ou uma comanda
// de hoje, sem passar pelo menu.
async function entrar(page: Page) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('dono@demo.pentefino.dev');
  await page.getByLabel('Senha').fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio|agenda|hoje/);
}

test('procurar: acha a tela por outra palavra e o cliente pelo nome', async ({ page }, info) => {
  await entrar(page);
  await page.goto('/clientes');
  const nome = `Cliente Procura ${Date.now().toString(36)}`;
  await page.getByRole('button', { name: /Novo cliente/ }).click();
  const novo = page.getByRole('dialog', { name: 'Novo cliente' });
  await novo.getByLabel('Nome').fill(nome);
  await novo.getByRole('button', { name: 'Cadastrar' }).click();
  await expect(novo).toBeHidden();

  // No computador, pelo atalho; no celular, pelo botão da barra de cima.
  const abrir = async () => {
    if (info.project.name === 'celular')
      await page.getByRole('button', { name: 'Procurar', exact: true }).click();
    else await page.keyboard.press('Control+k');
  };
  await abrir();
  const caixa = page.getByRole('dialog', { name: 'Procurar' });
  const campo = caixa.getByRole('combobox', { name: 'Tela, cliente ou comanda de hoje' });
  await campo.fill('despesa');
  await expect(caixa.getByRole('option')).toHaveCount(1);
  await expect(caixa.getByRole('option', { name: /Financeiro/ })).toBeVisible();
  await campo.press('Enter');
  await expect(page).toHaveURL(/\/financeiro/);
  await expect(caixa).toBeHidden();

  await abrir();
  await campo.fill(nome);
  const achado = caixa.getByRole('option', { name: new RegExp(nome) });
  await expect(achado).toBeVisible();
  await achado.click();
  await expect(page).toHaveURL(/\/clientes\?id=/);
  await expect(page.getByRole('dialog', { name: nome })).toBeVisible();
});
