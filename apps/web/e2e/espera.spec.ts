import { expect, test, type Page } from '@playwright/test';

// Etapa 14: lista de espera no balcão.
const sufixo = Date.now().toString(36);

async function entrar(page: Page, email: string) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio|agenda|hoje/);
}

test('a recepção põe um cliente na lista de espera do dia e tira', async ({ page }, info) => {
  test.skip(info.project.name === 'celular', 'balcão no computador');
  await entrar(page, 'recepcao.centro@demo.pentefino.dev');
  await page.goto('/agenda');
  await page.getByRole('button', { name: 'Lista de espera' }).click();
  const lista = page.getByRole('dialog', { name: 'Lista de espera' });
  await lista.getByRole('button', { name: 'Pôr na lista' }).click();
  await lista.getByRole('button', { name: 'Cadastrar cliente novo' }).click();
  await lista.getByLabel('Nome do cliente').fill(`Espera ${sufixo}`);
  await lista.getByRole('button', { name: 'Usar este cliente' }).click();
  await lista.getByLabel(/^Corte · \d+ min$/).check();
  await lista.getByLabel('A partir de').fill('09:00');
  await lista.getByLabel('Até').fill('12:00');
  await lista.getByRole('button', { name: 'Pôr na lista' }).click();
  const item = lista
    .getByRole('list', { name: 'Lista de espera do dia' })
    .getByRole('listitem')
    .filter({ hasText: `Espera ${sufixo}` });
  await expect(item).toContainText('09:00 às 12:00');
  await expect(item).toContainText('qualquer barbeiro');
  await item.getByRole('button', { name: 'Tirar' }).click();
  await expect(item).toHaveCount(0);
});

test('a recepção bloqueia o almoço de toda semana e remove', async ({ page }, info) => {
  test.skip(info.project.name === 'celular', 'balcão no computador');
  await entrar(page, 'recepcao.centro@demo.pentefino.dev');
  await page.goto('/agenda');
  await page.getByRole('button', { name: 'Bloquear horário' }).click();
  const d = page.getByRole('dialog', { name: 'Bloquear horário' });
  await d.getByLabel('Bloquear').selectOption('semana');
  await d.getByLabel('Dia da semana').selectOption({ label: 'Terça' });
  await d.getByLabel('Das').fill('12:00');
  await d.getByLabel('Até', { exact: true }).fill('13:00');
  await d.getByLabel('Motivo (opcional)').fill(`Almoço ${sufixo}`);
  await d.getByRole('button', { name: 'Bloquear', exact: true }).click();
  await expect(d.getByText('Bloqueio salvo.')).toBeVisible();
  const item = d
    .getByRole('list', { name: 'Bloqueios que repetem' })
    .getByRole('listitem')
    .filter({ hasText: `Almoço ${sufixo}` });
  await expect(item).toContainText('Terça, 12:00 às 13:00');
  await item.getByRole('button', { name: 'Remover' }).click();
  await expect(item).toHaveCount(0);
});
