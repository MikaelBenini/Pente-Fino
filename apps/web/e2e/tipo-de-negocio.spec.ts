import { expect, test } from '@playwright/test';

// Fase 1a (27/11/2026): o dono escolhe o tipo de negócio e o painel passa a usar o vocabulário
// dele. Volta para barbearia no fim, para não mudar a demonstração dos outros testes.
test('dono troca para clínica de estética e a equipe passa a dizer esteticista', async ({
  page,
}, info) => {
  test.skip(
    info.project.name === 'celular',
    'muda a configuração da demonstração: um projeto basta',
  );
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('dono@demo.pentefino.dev');
  await page.getByLabel('Senha').fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio/);

  const trocar = async (rotulo: string) => {
    await page.goto('/configuracoes');
    await page.getByLabel('Qual é o seu negócio?').selectOption({ label: rotulo });
    await page.getByRole('button', { name: 'Salvar tipo de negócio' }).click();
    await expect(page.getByText('Tipo de negócio salvo.')).toBeVisible();
  };

  await page.goto('/configuracoes');
  await expect(page.getByRole('tab', { name: 'Barbearia', exact: true })).toBeVisible();
  await trocar('Clínica de estética');
  await expect(page.getByRole('tab', { name: 'Clínica', exact: true })).toBeVisible();
  await expect(page.getByLabel('Nome da clínica')).toBeVisible();

  await page.goto('/equipe');
  await expect(page.getByRole('button', { name: 'Adicionar esteticista' })).toBeVisible();

  await trocar('Barbearia');
  await page.goto('/equipe');
  await expect(page.getByRole('button', { name: 'Adicionar barbeiro' })).toBeVisible();
});
