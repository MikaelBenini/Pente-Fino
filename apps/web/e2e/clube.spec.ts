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

  // Resultado: a mensalidade recebida entra no lucro do plano.
  await page.getByRole('tab', { name: 'Resultado' }).click();
  const tabela = page.getByRole('table', { name: 'Resultado do clube por plano' });
  await expect(tabela.getByRole('row', { name: new RegExp(plano) })).toContainText('99,90');
  const sobra = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sobra).toBeLessThanOrEqual(0);
});

// Etapa 24: clube online — o dono ativa a conta para receber, manda o link do plano pelo
// WhatsApp e o cliente assina pela página pública, indo para o pagamento.
test('clube online: conta para receber, link pelo WhatsApp e assinatura pelo cliente', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'celular', 'cadastro no computador');
  const plano = `Clube Online ${sufixo}`;
  await entrar(page, 'dono@demo.pentefino.dev');
  await page.goto('/clube');
  await page.getByRole('tab', { name: 'Receber online' }).click();
  const form = page.getByRole('form', { name: 'Dados para receber' });
  const conta = page.getByText('Conta no Asaas', { exact: true });
  // Espera a aba carregar: o formulário (sem conta) ou a conta (de uma execução anterior).
  // Olhar antes de carregar pulava o cadastro e o link era recusado mais adiante.
  await expect(form.or(conta)).toBeVisible();
  if (await form.isVisible()) {
    await form.getByLabel('Razão social').fill('Barbearia Demo LTDA');
    await form.getByLabel('CNPJ').fill('12.345.678/0001-90');
    await form.getByLabel('Faturamento por mês (R$)').fill('30000');
    await form.getByLabel('E-mail (login no Asaas)').fill('financeiro@demo.pentefino.dev');
    await form.getByLabel('Celular').fill('11988887777');
    await form.getByLabel('CEP').fill('01310100');
    await form.getByLabel('Bairro').fill('Bela Vista');
    await form.getByLabel('Rua').fill('Av. Paulista');
    await form.getByLabel('Número').fill('1000');
    await form.getByRole('button', { name: 'Criar conta para receber' }).click();
  }
  await expect(conta).toBeVisible();

  await page.getByRole('tab', { name: 'Planos' }).click();
  await page.getByRole('button', { name: 'Novo plano' }).click();
  const novo = page.getByRole('dialog', { name: 'Novo plano' });
  await novo.getByLabel('Nome').fill(plano);
  await novo.getByLabel('Valor por mês (R$)').fill('119,90');
  await novo.getByLabel('Corte', { exact: true }).check();
  await novo.locator('[id^="plano-qtd-"]').first().fill('4');
  await novo.getByRole('button', { name: 'Criar plano' }).click();
  await expect(novo).toBeHidden();
  const cartao = page
    .getByRole('list', { name: 'Planos do clube' })
    .getByRole('listitem')
    .filter({ hasText: plano });
  // O WhatsApp não abre no teste: a janela nova fica no wa.me com a mensagem no endereço.
  await page.context().route(/wa\.me|whatsapp\.com/, (r) => r.fulfill({ body: 'WhatsApp' }));
  const [whats] = await Promise.all([
    page.waitForEvent('popup'),
    cartao.getByRole('button', { name: 'Mandar pelo WhatsApp' }).click(),
  ]);
  await whats.waitForURL(/wa\.me/);
  const texto = new URL(whats.url()).searchParams.get('text') ?? '';
  expect(texto).toContain(`*${plano}*`);
  const link = /https?:\/\/\S+\/assinar\?\S+/.exec(texto)![0];
  await whats.close();

  // O cliente abre o link (página pública) e assina; a próxima tela é a do Asaas.
  await page.route(/sandbox\.asaas\.com/, (r) => r.fulfill({ body: 'Pagamento Asaas' }));
  const url = new URL(link);
  await page.goto(`${url.pathname}${url.search}`);
  await expect(
    page.getByRole('heading', { name: 'Assine e garanta seus atendimentos' }),
  ).toBeVisible();
  await expect(page.getByRole('radio', { name: new RegExp(plano) })).toBeChecked();
  const dados = page.getByRole('form', { name: 'Seus dados' });
  await dados.getByLabel('Nome completo').fill('Cliente do Link');
  await dados.getByLabel('WhatsApp com DDD').fill(`119${Date.now().toString().slice(-8)}`);
  await dados.getByLabel('CPF').fill('529.982.247-25');
  await dados.getByRole('button', { name: /Assinar por R\$\s?119,90\/mês/ }).click();
  await expect(page).toHaveURL(/sandbox\.asaas\.com/);
});
