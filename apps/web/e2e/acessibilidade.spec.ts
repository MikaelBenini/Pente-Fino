import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { menuPara } from '@pente-fino/shared';

// Painel X4: auditoria automática (axe, WCAG 2 A e AA) em todas as telas do painel, no
// computador e no celular. Falha com qualquer problema "serious" ou "critical".
const ROTAS = [
  ...new Set([
    ...menuPara(['dono']).map((i) => i.rota),
    '/configuracoes',
    '/ajuda',
    '/perfil',
    '/avisos',
  ]),
];

async function entrar(page: Page, email: string) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio|agenda|hoje/);
}

async function problemasGraves(page: Page) {
  const r = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return r.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({
      regra: v.id,
      impacto: v.impact,
      onde: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
      quantos: v.nodes.length,
    }));
}

test('telas do painel sem problema grave de acessibilidade (axe)', async ({ page }) => {
  test.setTimeout(240_000);
  await entrar(page, 'dono@demo.pentefino.dev');
  const achados: Record<string, unknown> = {};
  for (const rota of ROTAS) {
    await page.goto(rota);
    await page.waitForLoadState('networkidle');
    const p = await problemasGraves(page);
    if (p.length) achados[rota] = p;
  }
  expect(achados).toEqual({});
});

// Painel X1: as caixas de serviço do Novo agendamento eram lidas como "on". Os diálogos também
// passam pela auditoria, abertos.
test('diálogos abertos sem problema grave de acessibilidade (axe)', async ({ page }) => {
  test.setTimeout(120_000);
  await entrar(page, 'recepcao.centro@demo.pentefino.dev');
  await page.goto('/agenda');
  await page.getByRole('button', { name: 'Novo agendamento' }).first().click();
  const dialogo = page.getByRole('dialog', { name: 'Novo agendamento' });
  await expect(dialogo).toBeVisible();
  await page.waitForLoadState('networkidle');
  const achados: Record<string, unknown> = {};
  const novo = await problemasGraves(page);
  if (novo.length) achados['Novo agendamento'] = novo;
  // Cada caixa de serviço tem nome (o do serviço), nunca "on".
  const caixas = dialogo.getByRole('checkbox');
  for (const nome of await caixas.evaluateAll((els) =>
    els.map((e) => (e as HTMLInputElement).labels?.[0]?.textContent?.trim() ?? ''),
  ))
    expect(nome, 'caixa sem nome').not.toBe('');
  await dialogo.getByRole('button', { name: 'Fechar' }).click();

  await page.goto('/comandas');
  const aberta = page.getByRole('link', { name: /Abrir|Ver comanda/ }).first();
  if (await aberta.count()) {
    await aberta.click();
    await page.waitForLoadState('networkidle');
    const comanda = await problemasGraves(page);
    if (comanda.length) achados['Comanda'] = comanda;
  }
  expect(achados).toEqual({});
});
