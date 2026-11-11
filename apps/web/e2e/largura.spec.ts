import { expect, test, type Page } from '@playwright/test';
import { menuPara } from '@pente-fino/shared';

// Painel A8: em 375 px, nenhuma tela do painel pode passar da largura do celular (a barra de
// navegação de baixo, fixa, ficava com 716 px em /servicos e fora da tela).
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

/** Os elementos mais externos que passam da largura da janela, para achar o culpado. */
function vazamentos(page: Page) {
  return page.evaluate(() => {
    const largura = document.documentElement.clientWidth;
    const passa = (el: Element) => el.getBoundingClientRect().right > largura + 1;
    const fora: string[] = [];
    for (const el of document.body.querySelectorAll('*')) {
      if (!passa(el) || (el.parentElement && passa(el.parentElement))) continue;
      const classe = typeof el.className === 'string' ? el.className.slice(0, 90) : '';
      const r = el.getBoundingClientRect();
      fora.push(
        `${el.tagName.toLowerCase()} [${classe}] ${Math.round(r.left)}→${Math.round(r.right)}`,
      );
      if (fora.length >= 5) break;
    }
    return { scroll: document.documentElement.scrollWidth, largura, fora };
  });
}

test('nenhuma tela do painel passa da largura do celular (375 px)', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 375, height: 812 });
  await entrar(page, 'dono@demo.pentefino.dev');
  for (const rota of ROTAS) {
    await page.goto(rota);
    await page.waitForLoadState('networkidle');
    const r = await vazamentos(page);
    expect.soft(r.scroll, `${rota}: ${r.fora.join(' | ')}`).toBe(r.largura);
  }
});
