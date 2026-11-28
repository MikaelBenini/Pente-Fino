import { expect, test } from '@playwright/test';

// ADR 0015 (27/11/2026): a licença é o produto contratado. O dono vê a licença em Configurações,
// mas não troca (só a administração); o link de cadastro já traz a licença da página de vendas.
test('Configurações mostra a licença, sem trocar o tipo de negócio', async ({ page }) => {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('dono@demo.pentefino.dev');
  await page.getByLabel('Senha').fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio/);

  await page.goto('/configuracoes');
  await expect(page.getByText('Produto', { exact: true })).toBeVisible();
  await expect(page.getByText('Para trocar, fale com o suporte.')).toBeVisible();
  await expect(page.getByLabel('Qual é o seu negócio?')).toHaveCount(0);
});

test('cadastro pelo link da estética fala com a clínica e mostra o preço dela', async ({
  page,
}) => {
  await page.goto('/cadastro?licenca=estetica&plano=basico');
  await expect(page.getByLabel('Nome da clínica')).toBeVisible();
  await expect(page.getByText('Clínica de estética · plano')).toBeVisible();
  await expect(page.getByText('R$ 89,90/mês').first()).toBeVisible();
});
