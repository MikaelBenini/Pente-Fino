import { expect, test, type Page } from '@playwright/test';

// Etapa 10A: construtor do menu, simulador, publicação e versão anterior.
async function entrar(page: Page, email: string) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio|agenda|hoje/);
}
const visivel = <T extends { filter: (o: { visible: boolean }) => T }>(l: T) =>
  l.filter({ visible: true });

test.describe.configure({ mode: 'serial' });

test('dono conversa com o bot no simulador', async ({ page }) => {
  await entrar(page, 'dono@demo.pentefino.dev');
  await page.goto('/bot');
  await expect(
    visivel(page.getByRole('heading', { name: 'Bot do WhatsApp', level: 1 })),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Testar' }).click();
  await visivel(page.getByLabel('Mensagem do cliente')).fill('oi');
  await visivel(page.getByRole('button', { name: 'Enviar' })).click();
  const conversa = visivel(page.getByRole('log', { name: 'Conversa de teste' }));
  await expect(conversa).toContainText('Olá, João!');
  await expect(conversa).toContainText('Como posso ajudar?');
  await visivel(page.getByRole('button', { name: '2. Ver preços' })).click();
  await expect(conversa).toContainText('Nossos preços:');
  await expect(conversa).toContainText('R$');
});

test('dono edita, testa o rascunho, publica e volta à versão anterior', async ({ page }, info) => {
  test.skip(info.project.name === 'celular', 'edição feita no computador');
  await entrar(page, 'dono@demo.pentefino.dev');
  await page.goto('/bot');
  await visivel(page.getByRole('button', { name: 'Adicionar opção' }))
    .first()
    .click();
  const nome = visivel(page.getByLabel('Nome na lista')).last();
  await nome.fill('Conhecer o clube');
  // Sem resposta, não publica.
  await expect(visivel(page.getByText('Corrija antes de publicar:'))).toBeVisible();
  await expect(visivel(page.getByRole('button', { name: 'Publicar' }))).toBeDisabled();
  await visivel(page.getByLabel('Resposta')).nth(4).fill('Corte ilimitado por R$ 99,90 ao mês.');
  await expect(visivel(page.getByText('Corrija antes de publicar:'))).toHaveCount(0);
  await visivel(page.getByRole('button', { name: 'Salvar rascunho' })).click();
  await expect(visivel(page.getByText('Rascunho salvo.'))).toBeVisible();

  await page.getByRole('tab', { name: 'Testar' }).click();
  await visivel(page.getByLabel('Mensagem do cliente')).fill('oi');
  await visivel(page.getByRole('button', { name: 'Enviar' })).click();
  await expect(visivel(page.getByRole('log', { name: 'Conversa de teste' }))).toContainText(
    '5. Conhecer o clube',
  );

  await page.getByRole('tab', { name: 'Menu' }).click();
  await visivel(page.getByRole('button', { name: 'Publicar' })).click();
  await expect(visivel(page.getByText('Este é o menu que o bot usa.'))).toBeVisible();
  await visivel(page.getByRole('button', { name: 'Voltar à versão anterior' })).click();
  await visivel(
    page.getByRole('dialog').getByRole('button', { name: 'Usar a versão anterior' }),
  ).click();
  await expect(visivel(page.getByText('Versão anterior publicada.'))).toBeVisible();
  await expect(visivel(page.getByLabel('Nome na lista'))).toHaveCount(4);
});

test('gestor vê e testa, mas não edita o menu', async ({ page }) => {
  await entrar(page, 'gestor@demo.pentefino.dev');
  await page.goto('/bot');
  await expect(
    visivel(page.getByText('Só o dono edita o menu. Você pode ver e testar como o bot responde.')),
  ).toBeVisible();
  await expect(visivel(page.getByLabel('Nome na lista')).first()).toBeDisabled();
  await expect(visivel(page.getByRole('button', { name: 'Publicar' }))).toHaveCount(0);
});

test('tela do bot não rola para o lado', async ({ page }) => {
  await entrar(page, 'gestor@demo.pentefino.dev');
  await page.goto('/bot');
  await expect(visivel(page.getByLabel('Nome na lista')).first()).toBeVisible();
  const sobra = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sobra).toBeLessThanOrEqual(0);
});

test('dono conecta o WhatsApp pelo QR Code e desconecta', async ({ page }, info) => {
  test.skip(info.project.name === 'celular', 'conexão é da conta: um projeto basta');
  await entrar(page, 'dono@demo.pentefino.dev');
  await page.goto('/bot?aba=conexao');
  await expect(visivel(page.getByRole('tab', { name: 'Conexão' }))).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const centro = visivel(page.getByRole('listitem').filter({ hasText: 'Centro' })).first();
  await centro.getByRole('button', { name: /Conectar pelo QR Code|Reconectar/ }).click();
  const qr = centro.getByAltText(/QR Code para conectar o WhatsApp/);
  await expect(qr).toBeVisible();
  await expect(centro.getByText('Aparelhos conectados')).toBeVisible();
  await expect(centro.getByText(/WhatsApp de teste/)).toBeVisible();
  await centro.getByRole('button', { name: 'Desconectar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Desconectar' }).click();
  await expect(qr).toHaveCount(0);
  await expect(centro.getByText('Desconectado')).toBeVisible();
});
