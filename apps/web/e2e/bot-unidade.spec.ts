import { expect, test, type Page } from '@playwright/test';

// Lista do dono em 16/11/2026: bot por unidade, mensagens automáticas de anúncio, convite
// desligável e o simulador dizendo de onde veio o menu.
async function entrar(page: Page) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('dono@demo.pentefino.dev');
  await page.getByLabel('Senha', { exact: true }).fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL(/inicio|agenda|hoje/);
}
const visivel = <T extends { filter: (o: { visible: boolean }) => T }>(l: T) =>
  l.filter({ visible: true });

test.describe.configure({ mode: 'serial' });

test('editar o padrão ou uma unidade; a unidade usa o padrão até personalizar', async ({
  page,
}) => {
  await entrar(page);
  await page.goto('/bot');
  const escopo = visivel(page.getByLabel('Editando'));
  await expect(escopo).toBeVisible();
  const opcoes = await escopo.locator('option').allTextContents();
  expect(opcoes[0]).toBe('Padrão da barbearia (todas as unidades)');
  await escopo.selectOption({ label: opcoes[1]! });
  await expect(page.getByText(/usa o menu e as mensagens do padrão da conta/)).toBeVisible();
});

test('mensagens prontas: o convite para receber lembretes liga e desliga', async ({ page }) => {
  await entrar(page);
  await page.goto('/bot');
  await page.getByRole('tab', { name: '2. Respostas' }).click();
  await page.getByRole('tab', { name: 'Mensagens prontas' }).click();
  const chave = visivel(
    page.getByLabel('Mandar o convite para receber lembretes na primeira conversa'),
  );
  await expect(chave).toBeChecked();
  await chave.uncheck();
  await expect(chave).not.toBeChecked();
  await chave.check();
  await expect(chave).toBeChecked();
});

test('mensagens automáticas de anúncio: ligar, testar no simulador e desligar', async ({
  page,
}) => {
  await entrar(page);
  await page.goto('/bot');
  await page.getByRole('tab', { name: '3. Automáticas' }).click();
  await visivel(page.getByLabel('Ligar as mensagens automáticas de anúncio')).check();
  await visivel(page.getByLabel('Mensagem 1 (a primeira resposta)')).fill(
    'Que bom que veio pelo anúncio! Qual serviço?',
  );
  await visivel(page.getByRole('button', { name: 'Salvar mensagens automáticas' })).click();
  await expect(page.getByText('Quem vier de anúncio já recebe estas mensagens.')).toBeVisible();

  await page.getByRole('tab', { name: 'Testar' }).click();
  await visivel(page.getByLabel('Chegou por anúncio')).check();
  await visivel(page.getByLabel('Mensagem do cliente')).fill('oi');
  await visivel(page.getByRole('button', { name: 'Enviar' })).click();
  const conversa = visivel(page.getByRole('log', { name: 'Conversa de teste' }));
  await expect(conversa).toContainText('Que bom que veio pelo anúncio! Qual serviço?');
  await expect(page.getByText(/^Menu usado: /)).toBeVisible();

  // Volta a desligar, para não mudar o resto dos testes.
  await page.getByRole('tab', { name: '3. Automáticas' }).click();
  await visivel(page.getByLabel('Ligar as mensagens automáticas de anúncio')).uncheck();
  await visivel(page.getByRole('button', { name: 'Salvar mensagens automáticas' })).click();
  await expect(page.getByText('As mensagens de anúncio estão desligadas.')).toBeVisible();
});
