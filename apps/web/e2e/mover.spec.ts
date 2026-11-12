import { expect, test, type Page } from '@playwright/test';

// Etapa 14: mover agendamento arrastando (computador) e pelo botão "Mover horário" (celular).
const sufixo = Date.now().toString(36);

async function entrar(page: Page, email: string) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio|agenda|hoje/);
}

/**
 * Uma quarta-feira daqui a umas semanas, com a agenda livre. O banco de desenvolvimento guarda os
 * horários das execuções anteriores (cada uma marca na primeira vaga do dia): a semana varia entre
 * 30 quartas, para a primeira vaga não ir parar no fim do expediente.
 */
function quartaDistante(semanas: number) {
  const d = new Date();
  const espalhar = Math.floor(Date.now() / 60_000) % 30;
  d.setUTCDate(d.getUTCDate() + (semanas + espalhar) * 7);
  while (d.getUTCDay() !== 3) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function agendar(page: Page, cliente: string, dia: string) {
  await page.goto(`/agenda?dia=${dia}`);
  await page.getByRole('button', { name: 'Novo agendamento' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Novo agendamento' });
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
  // Painel M6: fica na Agenda com o aviso; a comanda abre pelo atalho.
  await page.getByRole('link', { name: 'Abrir comanda' }).click();
  await page.waitForURL(/\/comandas\?id=/);
}

test('a recepção arrasta o horário para outro barbeiro e 30 min depois, e desfaz', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'celular', 'arrastar é no computador e no tablet');
  const cliente = `Arrasta ${sufixo}`;
  const dia = quartaDistante(6);
  await entrar(page, 'recepcao.centro@demo.pentefino.dev');
  await agendar(page, cliente, dia);
  await page.goto(`/agenda?dia=${dia}`);

  const bloco = page.getByRole('button', { name: new RegExp(cliente) }).filter({ visible: true });
  await expect(bloco).toBeVisible();
  const origem = page.locator('[data-profissional]', { has: bloco }).filter({ visible: true });
  const idOrigem = await origem.getAttribute('data-profissional');
  // A coluna vizinha (a da esquerda, ou a da direita se for a primeira): com muitos barbeiros
  // a agenda rola na horizontal, e as duas precisam estar na tela.
  const colunas = page.locator('[data-profissional]').filter({ visible: true });
  const ids = await colunas.evaluateAll((els) =>
    els.map((e) => e.getAttribute('data-profissional')),
  );
  const i = ids.indexOf(idOrigem);
  const idDestino = ids[i > 0 ? i - 1 : i + 1]!;
  const destino = page.locator(`[data-profissional="${idDestino}"]`).filter({ visible: true });
  await bloco.scrollIntoViewIfNeeded();
  await destino.scrollIntoViewIfNeeded();
  await bloco.scrollIntoViewIfNeeded();
  const b = (await bloco.boundingBox())!;
  const d = (await destino.boundingBox())!;
  // Segura, arrasta para a coluna do lado e 30 min para baixo (1,4 px por minuto).
  await page.mouse.move(b.x + b.width / 2, b.y + 10);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 10, b.y + 20, { steps: 4 });
  await page.mouse.move(d.x + d.width / 2, b.y + 10 + 42, { steps: 12 });
  await page.mouse.up();

  const confirmar = page.getByRole('dialog', { name: 'Mover horário' });
  await expect(confirmar).toContainText(
    new RegExp(
      `Mover o horário de Corte do Arrasta das \\d{2}:\\d{2} com Rafael para \\d{2}:\\d{2} com \\w+\\?`,
    ),
  );
  await expect(
    confirmar.getByRole('checkbox', { name: 'Avisar o cliente pelo WhatsApp do novo horário' }),
  ).toBeChecked();
  await confirmar.getByRole('button', { name: 'Mover' }).click();
  await expect(page.getByRole('status').filter({ hasText: /Horário movido para/ })).toBeVisible();
  await expect(destino.getByRole('button', { name: new RegExp(cliente) })).toBeVisible();

  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(origem.getByRole('button', { name: new RegExp(cliente) })).toBeVisible();
  await expect(destino.getByRole('button', { name: new RegExp(cliente) })).toHaveCount(0);
});

test('no celular, "Mover horário" da comanda escolhe barbeiro e horário', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'celular', 'o mesmo movimento pelo botão');
  const cliente = `Move ${sufixo}`;
  const dia = quartaDistante(7);
  await entrar(page, 'recepcao.centro@demo.pentefino.dev');
  await agendar(page, cliente, dia);
  await page.getByRole('button', { name: 'Mover horário' }).click();
  const escolha = page.getByRole('dialog', { name: 'Mover horário' });
  const barbeiro = escolha.getByLabel('Barbeiro');
  const nomes = await barbeiro.locator('option').allTextContents();
  await barbeiro.selectOption({ label: nomes.find((n) => n !== 'Rafael Moura')! });
  await escolha
    .getByRole('button', { name: /^\d{2}:\d{2}$/ })
    .first()
    .click();
  const confirmar = page.getByRole('dialog', { name: 'Mover horário' });
  await expect(confirmar).toContainText(/Mover o horário de Corte do Move/);
  await confirmar.getByRole('button', { name: 'Mover' }).click();
  await expect(page.getByRole('status').filter({ hasText: /Horário movido para/ })).toBeVisible();
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(page.getByRole('status').filter({ hasText: /Horário movido para/ })).toHaveCount(0);
});
