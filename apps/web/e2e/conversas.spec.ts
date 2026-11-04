import { expect, test, type Page } from '@playwright/test';

// Etapa 10.1: quem pede atendente aparece em Conversas, com aviso em qualquer tela.
async function entrar(page: Page, email: string) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio|agenda|hoje/);
}

test('recepção vê o aviso, abre a conversa de quem pediu atendente e lê as mensagens', async ({
  page,
}) => {
  await entrar(page, 'recepcao.centro@demo.pentefino.dev');
  const aviso = page.getByRole('status').filter({ hasText: 'esperando atendente no WhatsApp' });
  await expect(aviso).toContainText('1 cliente está esperando atendente');
  await aviso.getByRole('link', { name: 'Abrir conversas' }).click();
  await expect(page).toHaveURL(/\/conversas$/);
  await expect(aviso).toHaveCount(0);

  const esperando = page.getByRole('region', { name: 'Esperando atendente (1)' });
  await esperando.getByRole('button').first().click();
  const conversa = page.getByRole('region', { name: /^Conversa com / });
  await expect(conversa.getByRole('list', { name: 'Mensagens do WhatsApp' })).toContainText(
    'pacote de noivo',
  );
  // O WhatsApp da demonstração está desconectado: a tela avisa e não deixa enviar.
  await expect(page.getByText(/não está\s+conectado/)).toBeVisible();
  await expect(conversa.getByLabel('Responder')).toBeDisabled();
  await expect(conversa.getByRole('button', { name: 'Devolver ao bot' })).toBeVisible();

  const sobra = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sobra).toBeLessThanOrEqual(0);
});

test('dono também tem Conversas e Caixa do dia, com o menu em seções', async ({ page }, info) => {
  test.skip(info.project.name === 'celular', 'seções do menu lateral só no computador');
  await entrar(page, 'dono@demo.pentefino.dev');
  const menu = page.getByRole('navigation', { name: 'Menu principal' });
  await expect(menu.getByRole('list', { name: 'WhatsApp' })).toContainText('Conversas do bot');
  await expect(menu.getByRole('list', { name: 'Dia a dia' })).toContainText('Caixa do dia');
  await expect(menu.getByLabel('1 esperando atendente')).toBeVisible();
});
