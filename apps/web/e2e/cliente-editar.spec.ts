import { expect, test, type Page } from '@playwright/test';

// Pedido do dono em 13/11: o cliente que chega pelo bot vem só com nome e WhatsApp; a ficha passa
// a ter "Editar dados" para completar, por exemplo, o aniversário.
async function entrar(page: Page) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('dono@demo.pentefino.dev');
  await page.getByLabel('Senha').fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio|agenda|hoje/);
}

test('ficha do cliente: editar os dados e pôr o aniversário', async ({ page }) => {
  await entrar(page);
  await page.goto('/clientes');
  const nome = `Cliente Bot ${Date.now().toString(36)}`;
  await page.getByRole('button', { name: /Novo cliente/ }).click();
  const novo = page.getByRole('dialog', { name: 'Novo cliente' });
  await novo.getByLabel('Nome').fill(nome);
  await novo.getByRole('button', { name: 'Cadastrar' }).click();
  await expect(novo).toBeHidden();

  await page.getByLabel(/Buscar/).fill(nome);
  await page.getByRole('button', { name: nome }).click();
  const ficha = page.getByRole('dialog', { name: nome });
  await expect(ficha.getByText('Aniversário')).toBeVisible();
  await ficha.getByRole('button', { name: 'Editar dados' }).click();

  const editar = page.getByRole('dialog', { name: `Editar ${nome}` });
  await editar.getByLabel(/Aniversário/).fill('1990-05-12');
  await editar.getByLabel('E-mail (opcional)').fill('cliente.bot@exemplo.com.br');
  await editar.getByRole('button', { name: 'Salvar dados' }).click();
  await expect(editar).toBeHidden();
  await expect(ficha.getByText('12/05')).toBeVisible();
});
