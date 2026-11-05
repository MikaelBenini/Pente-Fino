import { expect, test, type Page } from '@playwright/test';

// Etapa 10.1: contas de teste da cobrança — teste vencido e cartão recusado.
async function entrar(page: Page, email: string) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio|configuracao-inicial/);
}

test('teste vencido: aviso em toda tela, aba Assinatura e nada grava', async ({ page }) => {
  await entrar(page, 'expirado@demo.pentefino.dev');
  const aviso = page.getByRole('alert').filter({ hasText: 'teste grátis terminou' });
  await expect(aviso).toBeVisible();
  await aviso.getByRole('link', { name: 'Ver assinatura' }).click();
  await expect(page).toHaveURL(/\/configuracoes\?aba=assinatura$/);
  await expect(
    page.getByRole('tab', { name: 'Assinatura' }).filter({ visible: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Teste terminado').filter({ visible: true })).toBeVisible();

  // Tentar gravar mostra a explicação, sem apagar nada.
  await page.goto('/clientes');
  await page.getByRole('button', { name: /Novo cliente/ }).click();
  const dialogo = page.getByRole('dialog', { name: 'Novo cliente' });
  await dialogo.getByLabel('Nome').fill('Cliente Bloqueado');
  await dialogo.getByRole('button', { name: /Cadastrar|Salvar/ }).click();
  await expect(dialogo.getByText(/só para consulta/)).toBeVisible();
});

test('cartão recusado: motivo e o botão para pagar ou trocar o cartão', async ({ page }) => {
  await entrar(page, 'recusado@demo.pentefino.dev');
  await page.goto('/configuracoes?aba=assinatura');
  const recusa = page.getByRole('region', { name: 'Pagamento recusado' });
  await expect(recusa).toContainText('saldo insuficiente');
  await expect(recusa.getByRole('link', { name: /Pagar ou trocar o cartão/ })).toHaveAttribute(
    'href',
    /asaas/,
  );
  await expect(
    page.getByRole('table', { name: 'Faturas da assinatura' }).filter({ visible: true }),
  ).toContainText('Recusada');
});

test('conta em dia não mostra aviso de assinatura', async ({ page }) => {
  await entrar(page, 'dono@demo.pentefino.dev');
  await expect(page.getByText(/teste grátis|fatura está vencida/)).toHaveCount(0);
});
