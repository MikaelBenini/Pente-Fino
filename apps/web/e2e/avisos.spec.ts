import { expect, test, type Page } from '@playwright/test';

// Etapa 15: central de avisos. Caixa fechado com diferença avisa o gestor, não quem fechou.
async function entrar(page: Page, email: string) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio|agenda|hoje/);
}

/** Um dia passado para começar a procura: cada execução começa num dia diferente. */
function diaPassado(antes = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 200 - (Math.floor(Date.now() / 1000) % 150) - antes);
  return d.toISOString().slice(0, 10);
}

/**
 * Abre o caixa de um dia passado que ainda não tem caixa. O banco de desenvolvimento guarda os
 * caixas das execuções anteriores: em vez de sortear um dia só (e às vezes cair num já fechado),
 * procura até 20 dias seguidos.
 */
async function diaSemCaixa(page: Page): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const dia = diaPassado(i);
    await page.goto(`/caixa?dia=${dia}`);
    await expect(page.getByLabel('Dia', { exact: true })).toHaveValue(dia);
    // Espera a tela decidir: sem caixa (campo do troco), fechado ou aberto.
    const troco = page.getByLabel('Troco na gaveta (R$)');
    // As esperas que perdem a corrida terminam em erro quando a página muda: não importam.
    const esperar = (l: ReturnType<Page['getByText']>, r: 'livre' | 'usado') =>
      l.waitFor({ timeout: 10_000 }).then(
        () => r,
        () => null,
      );
    const estado = await Promise.race([
      esperar(troco, 'livre'),
      esperar(page.getByText('Caixa fechado').first(), 'usado'),
      esperar(page.getByRole('button', { name: 'Fechar caixa' }), 'usado'),
    ]);
    if (estado === 'livre') return dia;
  }
  throw new Error('nenhum dia sem caixa nos 20 procurados');
}

test('caixa com diferença: o gestor recebe o aviso e abre o caixa pelo link', async ({
  browser,
}, info) => {
  test.skip(info.project.name === 'celular', 'balcão no computador; o sino é o mesmo');
  const recepcao = await (await browser.newContext()).newPage();
  await entrar(recepcao, 'recepcao.centro@demo.pentefino.dev');
  const dia = await diaSemCaixa(recepcao);
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

test('Perfil → Avisos: a recepção escolhe o que vai para o celular e a escolha fica', async ({
  page,
}) => {
  await entrar(page, 'recepcao.jardins@demo.pentefino.dev');
  await page.goto('/perfil');
  const secao = page.getByRole('region', { name: 'Avisos' });
  const pendentes = secao.getByLabel('Comandas esperando confirmação do barbeiro');
  await expect(pendentes).toBeVisible();
  // Recepção não tem resumo do dia nem caixa com diferença.
  await expect(secao.getByLabel('Resumo do dia da unidade')).toHaveCount(0);
  await expect(secao.getByLabel('Receber o resumo do dia também por e-mail')).toHaveCount(0);
  const antes = await pendentes.isChecked();
  await pendentes.setChecked(!antes);
  await expect(secao.getByRole('status')).toHaveText('Preferências salvas.');
  await page.reload();
  await expect(
    page
      .getByRole('region', { name: 'Avisos' })
      .getByLabel('Comandas esperando confirmação do barbeiro'),
  ).toBeChecked({ checked: !antes });
});

test('Perfil → Avisos: o barbeiro escolhe se as mudanças da agenda vão para o celular', async ({
  page,
}) => {
  await entrar(page, 'rafael@demo.pentefino.dev');
  await page.goto('/perfil');
  const secao = page.getByRole('region', { name: 'Avisos' });
  await expect(
    secao.getByLabel('Horário novo, remarcado ou cancelado na minha agenda'),
  ).toBeVisible();
  // Barbeiro não recebe avisos de gestão.
  await expect(secao.getByLabel('Resumo do dia da unidade')).toHaveCount(0);
});

test('Perfil → Avisos: o barbeiro liga e desliga as mudanças da agenda no celular', async ({
  page,
}) => {
  await entrar(page, 'rafael@demo.pentefino.dev');
  await page.goto('/perfil');
  const agenda = page
    .getByRole('region', { name: 'Avisos' })
    .getByLabel('Horário novo, remarcado ou cancelado na minha agenda');
  await expect(agenda).toBeVisible();
  const antes = await agenda.isChecked();
  await agenda.setChecked(!antes);
  await expect(page.getByRole('region', { name: 'Avisos' }).getByRole('status')).toHaveText(
    'Preferências salvas.',
  );
  await agenda.setChecked(antes);
  await page.reload();
  await expect(
    page
      .getByRole('region', { name: 'Avisos' })
      .getByLabel('Horário novo, remarcado ou cancelado na minha agenda'),
  ).toBeChecked({ checked: antes });
});
