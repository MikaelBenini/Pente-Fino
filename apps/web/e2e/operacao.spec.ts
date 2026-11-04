import { expect, test, type Browser, type Page } from '@playwright/test';

// Fluxo crítico: agendar → atender → confirmar → fechar → reabrir (Etapa 6B).
const SENHA = 'pentefino123';
const sufixo = Date.now().toString(36);

/** Próximo dia de expediente do Centro (segunda a sábado, fora os feriados do seed). */
function proximoDiaUtil(): string {
  const d = new Date();
  for (;;) {
    d.setUTCDate(d.getUTCDate() + 1);
    const iso = d.toISOString().slice(0, 10);
    if (d.getUTCDay() !== 0 && !/-11-(02|15)$/.test(iso)) return iso;
  }
}

async function entrarComo(browser: Browser, email: string, projeto: string): Promise<Page> {
  const contexto = await browser.newContext(
    projeto === 'celular'
      ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true }
      : { viewport: { width: 1366, height: 860 } },
  );
  const page = await contexto.newPage();
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio|agenda|hoje/);
  return page;
}

test.describe.configure({ mode: 'serial' });

test('agendar, atender, confirmar, receber e reabrir', async ({ browser }, info) => {
  test.skip(
    info.project.name === 'celular',
    'o fluxo inteiro roda uma vez; o celular é coberto pelo barbeiro abaixo',
  );
  const dia = proximoDiaUtil();
  const cliente = `Cliente E2E ${sufixo}`;

  // 1. Recepção agenda pelo horário livre.
  const recepcao = await entrarComo(
    browser,
    'recepcao.centro@demo.pentefino.dev',
    info.project.name,
  );
  await recepcao.goto('/agenda');
  await recepcao.getByRole('button', { name: 'Novo agendamento' }).click();
  const dialogo = recepcao.getByRole('dialog', { name: 'Novo agendamento' });
  await dialogo.getByRole('button', { name: 'Cadastrar cliente novo' }).click();
  await dialogo.getByLabel('Nome do cliente').fill(cliente);
  await dialogo.getByRole('button', { name: 'Usar este cliente' }).click();
  await dialogo.getByLabel('Corte · 30 min').check();
  await dialogo.getByLabel('Dia').fill(dia);
  await dialogo.getByLabel('Barbeiro').selectOption({ label: 'Rafael Moura' });
  await dialogo
    .getByRole('button', { name: /^\d{2}:\d{2}$/ })
    .first()
    .click();
  await dialogo.getByRole('button', { name: /^Agendar \d{2}:\d{2}$/ }).click();
  await recepcao.waitForURL(/\/comandas\?id=/);
  const url = recepcao.url();
  await expect(recepcao.getByRole('heading', { name: cliente })).toBeVisible();
  await expect(
    recepcao.getByText('Prevista', { exact: true }).filter({ visible: true }),
  ).toBeVisible();

  // 2. Barbeiro começa, lança um extra em um toque e confirma.
  const barbeiro = await entrarComo(browser, 'rafael@demo.pentefino.dev', info.project.name);
  await barbeiro.goto(url.replace(/^https?:\/\/[^/]+/, ''));
  await barbeiro.getByRole('button', { name: 'Começar atendimento' }).click();
  await expect(
    barbeiro.getByText('Em atendimento', { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await barbeiro.getByRole('button', { name: 'Sobrancelha' }).click();
  await expect(barbeiro.getByRole('listitem').filter({ hasText: 'Sobrancelha' })).toContainText(
    'Extra',
  );
  await barbeiro.getByRole('button', { name: 'Confirmar atendimento' }).click();
  await expect(
    barbeiro.getByText('Confirmada', { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await expect(barbeiro.getByRole('button', { name: 'Receber e fechar' })).toHaveCount(0);

  // 3. Recepção recebe dividido (Pix + dinheiro) e fecha.
  await recepcao.reload();
  await recepcao.getByRole('button', { name: 'Receber e fechar' }).click();
  const fechar = recepcao.getByRole('dialog', { name: 'Receber e fechar' });
  await expect(fechar).toContainText('R$ 65,00');
  await fechar.getByLabel('Valor (R$)').fill('50,00');
  await fechar.getByRole('button', { name: 'Dividir em outra forma' }).click();
  await expect(fechar.getByLabel('Valor (R$)').nth(1)).toHaveValue('15,00');
  // Cada forma uma vez: a segunda linha já vem em dinheiro e não oferece Pix de novo.
  const segunda = fechar.getByLabel('Forma', { exact: true }).nth(1);
  await expect(segunda).toHaveValue('dinheiro');
  await expect(segunda.locator('option', { hasText: 'Pix' })).toHaveCount(0);
  await fechar.getByRole('button', { name: 'Continuar' }).click();
  await recepcao
    .getByRole('dialog', { name: 'Fechar comanda de R$ 65,00?' })
    .getByRole('button', { name: 'Fechar comanda' })
    .click();
  await expect(
    recepcao.getByText('Fechada', { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await expect(recepcao.locator('dl').getByText('Pix', { exact: true })).toBeVisible();
  await expect(recepcao.getByRole('button', { name: 'Reabrir comanda' })).toHaveCount(0);

  // 3b. O barbeiro já vê a comissão do atendimento no extrato.
  await barbeiro.goto('/comissoes');
  await expect(
    barbeiro
      .getByRole('table', { name: 'Extrato de comissões' })
      .getByRole('row', { name: new RegExp(cliente) })
      .first(),
  ).toBeVisible();

  // 4. Gestor reabre com motivo.
  const gestor = await entrarComo(browser, 'gestor@demo.pentefino.dev', info.project.name);
  await gestor.goto(url.replace(/^https?:\/\/[^/]+/, ''));
  await gestor.getByRole('button', { name: 'Reabrir comanda' }).click();
  const reabrir = gestor.getByRole('dialog', { name: 'Reabrir comanda fechada?' });
  await reabrir.getByLabel('Motivo (fica registrado)').fill('Forma de pagamento lançada errada');
  await reabrir.getByRole('button', { name: 'Reabrir' }).click();
  await expect(
    gestor.getByText('Reaberta', { exact: true }).filter({ visible: true }),
  ).toBeVisible();
});

test('barbeiro no celular vê só as próprias comandas', async ({ page }, info) => {
  test.skip(info.project.name !== 'celular', 'específico do celular');
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('rafael@demo.pentefino.dev');
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/hoje/);
  await page
    .getByRole('navigation', { name: 'Menu rápido' })
    .getByRole('link', { name: 'Comandas' })
    .click();
  await expect(page.getByRole('heading', { name: 'Comandas' })).toBeVisible();
  await page.getByRole('tab', { name: /Fechadas/ }).click();
  const itens = page.getByRole('tabpanel').getByRole('link');
  const n = await itens.count();
  for (let i = 0; i < Math.min(n, 5); i++) await expect(itens.nth(i)).toContainText('Rafael Moura');
  await expect(page.getByRole('button', { name: 'Abrir comanda' })).toHaveCount(0);
});

test('recepção vê o caixa do dia e a agenda por profissional', async ({ page }) => {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('recepcao.centro@demo.pentefino.dev');
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/agenda/);
  await expect(page.getByRole('radio', { name: 'Semana' })).toBeVisible();
  await page.getByRole('radio', { name: 'Mês' }).click();
  await expect(page.getByRole('button', { name: /horários$|fechado$/ }).first()).toBeVisible();
  await page.goto('/caixa');
  await expect(page.getByRole('heading', { name: 'Caixa do dia' })).toBeVisible();
  await expect(page.getByText('Deve ter na gaveta')).toBeVisible();
});

test('cliente que não veio: a recepção marca falta e a comanda sai do faturamento', async ({
  browser,
}, info) => {
  test.skip(info.project.name === 'celular', 'balcão no computador');
  const recepcao = await entrarComo(
    browser,
    'recepcao.centro@demo.pentefino.dev',
    info.project.name,
  );
  await recepcao.goto('/agenda');
  await recepcao.getByRole('button', { name: 'Novo agendamento' }).click();
  const dialogo = recepcao.getByRole('dialog', { name: 'Novo agendamento' });
  await dialogo.getByRole('button', { name: 'Cadastrar cliente novo' }).click();
  await dialogo.getByLabel('Nome do cliente').fill(`Faltoso ${sufixo}`);
  await dialogo.getByRole('button', { name: 'Usar este cliente' }).click();
  await dialogo.getByLabel('Corte · 30 min').check();
  await dialogo.getByLabel('Dia').fill(proximoDiaUtil());
  await dialogo.getByLabel('Barbeiro').selectOption({ label: 'Diego Prado' });
  await dialogo
    .getByRole('button', { name: /^\d{2}:\d{2}$/ })
    .last()
    .click();
  await dialogo.getByRole('button', { name: /^Agendar \d{2}:\d{2}$/ }).click();
  await recepcao.waitForURL(/\/comandas\?id=/);
  await recepcao.getByRole('button', { name: 'Cancelar ou marcar falta' }).click();
  const cancelar = recepcao.getByRole('dialog', { name: 'Cancelar comanda' });
  await cancelar.getByLabel('Motivo').fill('Não compareceu');
  await cancelar.getByRole('button', { name: 'Cancelar comanda' }).click();
  await expect(
    recepcao.getByText('Cancelada', { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await expect(recepcao.getByText('Cancelada: Não compareceu')).toBeVisible();
  await expect(recepcao.getByRole('button', { name: 'Receber e fechar' })).toHaveCount(0);
});

test('a ponte /api recusa alteração vinda de outro site (CSRF)', async ({ playwright }, info) => {
  test.skip(info.project.name === 'celular', 'uma vez basta');
  const base = info.project.use.baseURL!;
  const outroSite = await playwright.request.newContext({
    baseURL: base,
    extraHTTPHeaders: { origin: 'https://site-malicioso.example' },
  });
  const r = await outroSite.post('/api/auth/login', {
    data: { email: 'dono@demo.pentefino.dev', senha: SENHA },
  });
  expect(r.status()).toBe(403);
  expect((await r.json()).erro.codigo).toBe('origem_invalida');
  const semOrigem = await playwright.request.newContext({ baseURL: base });
  expect(
    (
      await semOrigem.post('/api/auth/login', {
        data: { email: 'dono@demo.pentefino.dev', senha: SENHA },
      })
    ).status(),
  ).toBe(403);
  await outroSite.dispose();
  await semOrigem.dispose();
});
