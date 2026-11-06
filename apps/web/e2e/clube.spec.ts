import { expect, test, type Page } from '@playwright/test';

// Etapa 13: o dono cria um plano do clube e coloca um cliente nele.
const SENHA = 'pentefino123';
const sufixo = Date.now().toString(36);

async function entrar(page: Page, email: string) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio|agenda|hoje/);
}

test('dono cria o plano e coloca um cliente novo; a lista mostra o que resta', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'celular', 'cadastro no computador');
  const plano = `Clube E2E ${sufixo}`;
  await entrar(page, 'dono@demo.pentefino.dev');
  await page.goto('/clube');
  await page.getByRole('tab', { name: 'Planos' }).click();
  await page.getByRole('button', { name: 'Novo plano' }).click();
  const form = page.getByRole('dialog', { name: 'Novo plano' });
  await form.getByLabel('Nome').fill(plano);
  await form.getByLabel('Valor por mês (R$)').fill('99,90');
  await form.getByLabel('Corte', { exact: true }).check();
  await form.locator('[id^="plano-qtd-"]').first().fill('4');
  await form.getByRole('button', { name: 'Criar plano' }).click();
  await expect(form).toBeHidden();
  const cartao = page
    .getByRole('list', { name: 'Planos do clube' })
    .getByRole('listitem')
    .filter({ hasText: plano });
  await expect(cartao).toContainText('R$ 99,90');
  await expect(cartao).toContainText('Corte: 4× no mês');

  await page.getByRole('tab', { name: 'Assinantes' }).click();
  await page.getByRole('button', { name: 'Novo assinante' }).click();
  const novo = page.getByRole('dialog', { name: 'Novo assinante' });
  await novo.getByRole('button', { name: 'Cadastrar cliente novo' }).click();
  await novo.getByLabel('Nome do cliente').fill(`Assinante ${sufixo}`);
  await novo.getByRole('button', { name: 'Usar este cliente' }).click();
  const opcao = await novo
    .getByLabel('Plano')
    .locator('option', { hasText: plano })
    .getAttribute('value');
  await novo.getByLabel('Plano').selectOption(opcao!);
  await novo.getByRole('button', { name: 'Colocar no plano' }).click();
  await expect(novo).toBeHidden();
  const linha = page
    .getByRole('list', { name: 'Assinantes do clube' })
    .getByRole('listitem')
    .filter({ hasText: `Assinante ${sufixo}` });
  await expect(linha).toContainText('Corte: restam 4');
  await expect(linha).toContainText('Ativa');

  // Pix da barbearia e a mensalidade com QR.
  await page.getByRole('tab', { name: 'Planos' }).click();
  await page.getByLabel('Chave Pix').fill('pix@demo.pentefino.dev');
  await page.getByLabel('Nome de quem recebe').fill('Barbearia Pente Fino');
  await page.getByLabel('Cidade').fill('São Paulo');
  await page.getByRole('button', { name: 'Salvar Pix' }).click();
  await expect(page.getByText('Chave Pix salva.')).toBeVisible();
  await page.getByRole('tab', { name: 'Assinantes' }).click();
  await linha.getByRole('button', { name: 'Receber mensalidade' }).click();
  const receber = page.getByRole('dialog', { name: 'Receber mensalidade' });
  await expect(receber.getByRole('img', { name: 'QR Code do Pix da mensalidade' })).toBeVisible();
  await expect(receber).toContainText('R$ 99,90');
  await receber.screenshot({
    path: test.info().outputPath('mensalidade.png'),
  });
  await receber.getByRole('button', { name: 'Confirmar recebimento' }).click();
  await expect(receber).toBeHidden();
});
