import { expect, test, type Page } from '@playwright/test';
import { menuPara, type Papel } from '@pente-fino/shared';

const SENHA = 'pentefino123';

const PAPEIS: { email: string; papel: Papel; inicial: string; proibida: string }[] = [
  { email: 'dono@demo.pentefino.dev', papel: 'dono', inicial: '/inicio', proibida: '/hoje' },
  { email: 'gestor@demo.pentefino.dev', papel: 'gestor', inicial: '/inicio', proibida: '/hoje' },
  {
    email: 'recepcao.centro@demo.pentefino.dev',
    papel: 'recepcao',
    inicial: '/agenda',
    proibida: '/financeiro',
  },
  {
    email: 'rafael@demo.pentefino.dev',
    papel: 'barbeiro',
    inicial: '/hoje',
    proibida: '/financeiro',
  },
];

async function entrar(page: Page, email: string) {
  await page.goto('/entrar');
  await preencherLogin(page, email);
}

/** Preenche e envia o login na página atual (sem recarregar: preserva o ?voltar=). */
async function preencherLogin(page: Page, email: string) {
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

/** Ids dos itens de menu visíveis: menu lateral no computador; barra + "Mais" no celular. */
async function itensDoMenu(page: Page, celular: boolean): Promise<string[]> {
  if (!celular) {
    const nav = page.getByRole('navigation', { name: 'Menu principal' });
    await expect(nav).toBeVisible();
    return nav
      .locator('[data-menu]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-menu')!));
  }
  const barra = page.getByRole('navigation', { name: 'Menu rápido' });
  await expect(barra).toBeVisible();
  const atalhos = await barra
    .locator('[data-menu]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-menu')!));
  await barra.getByRole('button', { name: 'Mais' }).click();
  const folha = page.getByRole('dialog', { name: 'Mais opções' });
  await expect(folha).toBeVisible();
  const resto = await folha
    .locator('[data-menu]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-menu')!));
  await folha.getByRole('button', { name: 'Fechar' }).click();
  return [...atalhos, ...resto];
}

for (const { email, papel, inicial, proibida } of PAPEIS) {
  test(`${papel} vê só o menu dele`, async ({ page }, info) => {
    const celular = info.project.name === 'celular';
    await entrar(page, email);
    await expect(page).toHaveURL(new RegExp(`${inicial}$`));

    const esperado = menuPara([papel]).map((i) => i.id);
    expect(await itensDoMenu(page, celular)).toEqual(esperado);

    // Endereço digitado à mão também não abre tela de outro papel.
    await page.goto(proibida);
    await expect(
      page.getByRole('heading', { name: 'Esta tela não faz parte do seu acesso' }),
    ).toBeVisible();
  });
}

test('sem sessão, qualquer tela leva ao login e volta para ela depois', async ({ page }) => {
  await page.goto('/comandas');
  await expect(page).toHaveURL(/\/entrar\?voltar=%2Fcomandas$/);
  await preencherLogin(page, 'recepcao.centro@demo.pentefino.dev');
  await expect(page).toHaveURL(/\/comandas$/);
});

test('login errado mostra a mensagem da API', async ({ page }) => {
  await page.goto('/entrar');
  // E-mail que nenhum outro teste usa: não divide o limite de tentativas por minuto.
  await page.getByLabel('E-mail').fill('ninguem@demo.pentefino.dev');
  await page.getByLabel('Senha').fill('senha-errada');
  await page.getByRole('button', { name: 'Entrar' }).click();
  // O Next também tem um role=alert (anúncio de rota): olha só dentro do formulário.
  await expect(page.locator('form').getByRole('alert')).toHaveText('E-mail ou senha incorretos.');
});

test('sair encerra a sessão', async ({ page }, info) => {
  await entrar(page, 'rafael@demo.pentefino.dev');
  await expect(page).toHaveURL(/\/hoje$/);
  if (info.project.name === 'celular') {
    await page
      .getByRole('navigation', { name: 'Menu rápido' })
      .getByRole('button', { name: 'Mais' })
      .click();
    await page
      .getByRole('dialog', { name: 'Mais opções' })
      .getByRole('button', { name: 'Sair' })
      .click();
  } else {
    await page.getByRole('button', { name: 'Sair' }).click();
  }
  await expect(page).toHaveURL(/\/entrar$/);
  await page.goto('/hoje');
  await expect(page).toHaveURL(/\/entrar/);
});
