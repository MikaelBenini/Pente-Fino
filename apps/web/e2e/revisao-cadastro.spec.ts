import { expect, test, type Page } from '@playwright/test';

// Revisão do dono em 16/11/2026: cupom que sumia do cadastro, total do anual, unidade em uso,
// avisos × bot × Automações e o login.

test('cadastro anual com o cupom: total do ano por plano e o que será cobrado depois do teste', async ({
  page,
}) => {
  await page.goto('/cadastro?cupom=LANCAMENTO&plano=pro&ciclo=anual');
  await expect(page.getByLabel('Cupom de desconto (opcional)')).toHaveValue('LANCAMENTO');
  await expect(page.getByText('por ano, numa cobrança só').first()).toBeVisible();
  const resumo = page.getByText('Depois do teste grátis, se assinar:');
  await expect(resumo.locator('..')).toContainText(/R\$ [\d.,]+ por ano \(R\$ [\d.,]+\/mês\)/);
  await expect(resumo.locator('..')).toContainText('Cupom LANCAMENTO aplicado: 30% de desconto');
  // No mensal, o resumo é por mês.
  await page.getByRole('radio', { name: 'Mensal' }).check();
  await expect(resumo.locator('..')).toContainText(/R\$ [\d.,]+ por mês/);
});

async function cupomFora(page: Page) {
  // Como a API respondia a quem estourava o limite: 429, sem dizer nada do cupom.
  await page.route('**/api/publico/cupom/**', (r) =>
    r.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ codigo: 'muitas_requisicoes', mensagem: 'Muitas tentativas.' }),
    }),
  );
}

test('falha passageira na conferência não apaga o cupom do link nem dos botões', async ({
  page,
}) => {
  await cupomFora(page);
  await page.goto('/cadastro?cupom=LANCAMENTO');
  await expect(page.getByText('Não deu para conferir o cupom agora.')).toBeVisible();
  await expect(page.getByLabel('Cupom de desconto (opcional)')).toHaveValue('LANCAMENTO');

  await page.goto('/planos');
  await expect(page.locator('a[href*="plano=pro"]').first()).toHaveAttribute(
    'href',
    /cupom=LANCAMENTO/,
  );
});

test('planos: avisos, bot e Automações lado a lado', async ({ page }) => {
  await page.goto('/planos');
  const quadro = page.getByRole('region', {
    name: 'Avisos, bot e Automações: o que vem em cada um',
  });
  await expect(quadro.getByRole('heading', { name: 'Avisos no WhatsApp' })).toBeVisible();
  await expect(quadro.getByText('Todos os planos')).toBeVisible();
  await expect(quadro.getByRole('heading', { name: 'Bot que marca pela conversa' })).toBeVisible();
  await expect(quadro.getByRole('heading', { name: 'Automações', exact: true })).toBeVisible();
});

test('login: mostrar senha e o envio vazio pede o e-mail e a senha', async ({ page }) => {
  await page.goto('/entrar');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByText('Informe o e-mail.')).toBeVisible();
  await expect(page.getByText('Informe a senha.')).toBeVisible();
  await expect(page.getByText('E-mail inválido.')).toHaveCount(0);

  const senha = page.getByLabel('Senha', { exact: true });
  await senha.fill('segredo123');
  await expect(senha).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Mostrar senha' }).click();
  await expect(senha).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Esconder senha' }).click();
  await expect(senha).toHaveAttribute('type', 'password');
});

test('com "Todas as unidades" no alto, a agenda diz qual unidade mostra e a escolha vale nas comandas', async ({
  page,
}) => {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('dono@demo.pentefino.dev');
  await page.getByLabel('Senha', { exact: true }).fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL(/inicio|agenda|hoje/);

  await page.goto('/agenda');
  const seletor = page.getByLabel('Unidade desta tela');
  await expect(seletor).toBeVisible();
  await expect(
    page.getByText(/No alto está "Todas as unidades"; esta tela mostra a /),
  ).toBeVisible();
  const opcoes = await seletor.locator('option').allTextContents();
  const outra = opcoes[opcoes.length - 1]!;
  await seletor.selectOption({ label: outra });
  await expect(page.getByText(`esta tela mostra a ${outra}`, { exact: false })).toBeVisible();

  await page.goto('/comandas');
  await expect(page.getByLabel('Unidade desta tela')).toHaveValue(
    await page
      .getByLabel('Unidade desta tela')
      .locator('option', { hasText: outra })
      .getAttribute('value')
      .then((v) => v ?? ''),
  );
});

test('Configurações → Unidades: copiar de outra unidade, escolhendo o que vem', async ({
  page,
}) => {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('dono@demo.pentefino.dev');
  await page.getByLabel('Senha', { exact: true }).fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL(/inicio|agenda|hoje/);

  await page.goto('/configuracoes');
  await page.getByRole('tab', { name: 'Unidades' }).click();
  await page.getByRole('button', { name: 'Copiar de outra unidade' }).first().click();
  const dialogo = page.getByRole('dialog', { name: /^Copiar para / });
  await expect(dialogo.getByLabel('Copiar da unidade')).toBeVisible();
  // Só as regras de agendamento: desmarca o resto.
  for (const nome of [
    'Horário de funcionamento',
    'Folgas e feriados',
    'Horário do bot',
    'Site (rascunho)',
    'Visual da página de agendamento',
  ])
    await dialogo.getByLabel(nome).uncheck();
  await expect(dialogo.getByText(/Nunca vêm: endereço/)).toBeVisible();
  await dialogo.getByRole('button', { name: 'Copiar 1 item' }).click();
  await expect(dialogo.getByText('Regras de agendamento: copiado.')).toBeVisible();
  await dialogo.getByRole('button', { name: 'Fechar' }).last().click();
});
