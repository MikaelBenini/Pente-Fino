import { expect, test, type Page } from '@playwright/test';

// Etapa 15: central de avisos. Caixa fechado com diferença avisa o gestor, não quem fechou.
async function entrar(page: Page, email: string) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio|agenda|hoje/);
}

/** Um dia passado ainda sem caixa fechado: cada execução usa um dia diferente. */
function diaPassado() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 200 - (Math.floor(Date.now() / 1000) % 150));
  return d.toISOString().slice(0, 10);
}

test('caixa com diferença: o gestor recebe o aviso e abre o caixa pelo link', async ({
  browser,
}, info) => {
  test.skip(info.project.name === 'celular', 'balcão no computador; o sino é o mesmo');
  const dia = diaPassado();
  const recepcao = await (await browser.newContext()).newPage();
  await entrar(recepcao, 'recepcao.centro@demo.pentefino.dev');
  await recepcao.goto(`/caixa?dia=${dia}`);
  await expect(recepcao.getByLabel('Dia', { exact: true })).toHaveValue(dia);
  await recepcao.getByLabel('Troco na gaveta (R$)').fill('0');
  await recepcao.getByRole('button', { name: 'Abrir caixa' }).click();
  await recepcao.getByLabel('Dinheiro contado na gaveta (R$)').fill('12,34');
  await recepcao.getByRole('button', { name: 'Fechar caixa' }).click();
  await recepcao
    .getByRole('dialog', { name: 'Fechar o caixa do dia?' })
    .getByRole('button', { name: 'Fechar caixa' })
    .click();
  await expect(recepcao.getByRole('button', { name: 'Fechar caixa' })).toHaveCount(0);

  const gestor = await (await browser.newContext()).newPage();
  await entrar(gestor, 'gestor@demo.pentefino.dev');
  const sino = gestor
    .getByRole('link', { name: /^Avisos: \d+ não lidos?$/ })
    .filter({ visible: true });
  await expect(sino).toBeVisible();
  await sino.click();
  await expect(gestor.getByRole('heading', { name: 'Avisos' })).toBeVisible();
  const ddmm = `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
  const aviso = gestor
    .getByRole('list', { name: 'Meus avisos' })
    .getByRole('link', { name: new RegExp(`Caixa de ${ddmm} fechado com diferença`) })
    .first();
  await expect(aviso).toContainText(/sobram R\$\s12,34/);
  await aviso.click();
  await gestor.waitForURL(new RegExp(`/caixa\\?dia=${dia}`));
  await expect(gestor.getByLabel('Dia', { exact: true })).toHaveValue(dia);
  // Abrir pelo link marca como lido.
  await gestor.goto('/avisos');
  const lido = gestor
    .getByRole('list', { name: 'Meus avisos' })
    .getByRole('link', { name: new RegExp(`Caixa de ${ddmm} fechado com diferença`) })
    .first();
  await expect(lido).not.toContainText('não lido');
});
