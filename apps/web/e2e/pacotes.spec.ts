import { expect, test } from '@playwright/test';

// Fase 1d (E2): o dono liga "Pacotes" em Configurações, cadastra o pacote, vende a um cliente novo
// e a ficha mostra o saldo. No fim desliga, para a demonstração voltar como estava.
const sufixo = Date.now().toString(36);

test('pacotes: ligar a função, cadastrar, vender e ver o saldo na ficha', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'celular', 'cadastro no computador');
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('dono@demo.pentefino.dev');
  await page.getByLabel('Senha').fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio/);

  await page.goto('/configuracoes');
  const funcao = page.getByLabel(/Pacotes de sessões com saldo/);
  if (!(await funcao.isChecked())) await funcao.click();
  await expect(funcao).toBeChecked();
  await expect(page.getByRole('link', { name: 'Pacotes' }).first()).toBeVisible();

  try {
    await page.goto('/pacotes');
    await page.getByRole('button', { name: 'Novo pacote' }).click();
    const form = page.getByRole('dialog', { name: 'Novo pacote' });
    await form.getByLabel('Nome', { exact: true }).fill(`4 cortes ${sufixo}`);
    const corte = await form
      .getByLabel('Serviço das sessões')
      .locator('option', { hasText: /^Corte$/ })
      .first()
      .getAttribute('value');
    await form.getByLabel('Serviço das sessões').selectOption(corte!);
    await form.getByLabel('Sessões', { exact: true }).fill('4');
    await form.getByLabel('Valor (R$)').fill('160,00');
    await expect(form.getByText('R$ 40,00 por sessão')).toBeVisible();
    await form.getByRole('button', { name: 'Criar pacote' }).click();
    await expect(form).toBeHidden();

    const cartao = page
      .getByRole('list', { name: 'Pacotes' })
      .getByRole('listitem')
      .filter({ hasText: `4 cortes ${sufixo}` });
    await expect(cartao).toContainText('R$ 160,00');
    await cartao.getByRole('button', { name: 'Vender' }).click();
    const venda = page.getByRole('dialog', { name: `Vender 4 cortes ${sufixo}` });
    await venda.getByRole('button', { name: 'Cadastrar cliente novo' }).click();
    await venda.getByLabel('Nome do cliente').fill(`Cliente Pacote ${sufixo}`);
    await venda.getByRole('button', { name: 'Usar este cliente' }).click();
    await venda.getByRole('button', { name: 'Receber R$ 160,00' }).click();
    await expect(venda).toBeHidden();
    await expect(cartao).toContainText('1 cliente com saldo');

    await page.goto('/clientes');
    await page.getByLabel(/Buscar/).fill(`Cliente Pacote ${sufixo}`);
    await page.getByRole('button', { name: `Cliente Pacote ${sufixo}` }).click();
    const ficha = page.getByRole('dialog', { name: `Cliente Pacote ${sufixo}` });
    await expect(
      ficha.getByRole('list', { name: 'Pacotes do cliente' }).getByRole('listitem'),
    ).toContainText('restam 4 de 4');
  } finally {
    await page.goto('/configuracoes');
    const marcada = page.getByLabel(/Pacotes de sessões com saldo/);
    if (await marcada.isChecked()) await marcada.click();
    await expect(page.getByLabel(/Pacotes de sessões com saldo/)).not.toBeChecked();
  }
});
