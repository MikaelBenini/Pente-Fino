import { expect, test } from '@playwright/test';

// Etapa 11: regras de agendamento da unidade em Configurações → Agendamento.
test('dono muda a janela de agendamento e desliga o segundo lembrete', async ({ page }, info) => {
  test.skip(
    info.project.name === 'celular',
    'muda a configuração da demonstração: um projeto basta',
  );
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('dono@demo.pentefino.dev');
  await page.getByLabel('Senha').fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio/);
  await page.goto('/configuracoes');
  await page.getByRole('tab', { name: 'Agendamento', exact: true }).click();

  const janela = page.getByLabel('Até quantos dias à frente', { exact: true });
  await expect(janela).toHaveValue('45');
  await janela.fill('30');
  await page.getByLabel('Segundo lembrete').uncheck();
  await page.getByRole('button', { name: 'Salvar regras' }).click();
  await expect(page.getByText('Regras salvas.')).toBeVisible();

  await page.reload();
  await page.getByRole('tab', { name: 'Agendamento', exact: true }).click();
  await expect(page.getByLabel('Até quantos dias à frente', { exact: true })).toHaveValue('30');
  await expect(page.getByLabel('Segundo lembrete')).not.toBeChecked();

  // Volta ao padrão para os outros testes.
  await page.getByLabel('Até quantos dias à frente', { exact: true }).fill('45');
  await page.getByLabel('Segundo lembrete').check();
  await page.getByRole('button', { name: 'Salvar regras' }).click();
  await expect(page.getByText('Regras salvas.')).toBeVisible();
});
