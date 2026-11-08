import { expect, test, type Page } from '@playwright/test';

// Etapa 6D nas telas: link público, cadastro + configuração guiada, importação, impressão e exportação.
const SENHA = 'pentefino123';
const sufixo = Date.now().toString(36);

async function entrar(page: Page, email: string, senha = SENHA) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio|agenda|hoje/);
}

/** Dias à frente (pelo calendário de São Paulo) até o próximo dia de expediente do Centro. */
function diasAteProximoUtil(): number {
  const hojeSp = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
    new Date(),
  );
  const d = new Date(`${hojeSp}T12:00:00Z`);
  for (let n = 1; ; n++) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0 && !/-11-(02|15)$/.test(d.toISOString().slice(0, 10))) return n;
  }
}

test('cliente agenda pelo link público, sem login', async ({ page }) => {
  await page.goto('/agendar?u=demo-centro');
  await expect(page.getByRole('heading', { name: /Barbearia Pente Fino/ })).toBeVisible();
  await page.getByLabel(/^Corte · 30 min$/).check();
  await page.getByRole('button', { name: 'Sem preferência' }).click();
  // Botões de dia: o primeiro é hoje.
  await page
    .getByRole('button', { name: /^(domingo|segunda|terça|quarta|quinta|sexta|sábado), \d+ de / })
    .nth(diasAteProximoUtil())
    .click();
  await page
    .getByRole('group', { name: /Horários livres/ })
    .getByRole('button')
    .first()
    .click();
  await page.getByLabel('Nome').fill(`Cliente Link ${sufixo}`);
  await page.getByLabel('WhatsApp').fill(`(11) 9${String(Date.now()).slice(-8)}`);
  await page.getByRole('button', { name: /^Agendar \d{2}:\d{2}/ }).click();
  await expect(page.getByRole('heading', { name: 'Horário marcado' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Confirmar pelo WhatsApp' })).toHaveAttribute(
    'href',
    /^https:\/\/wa\.me\/551130000001\?text=/,
  );
  // O link do horário: ver, remarcar com o mesmo barbeiro e cancelar, sem login.
  await page.getByRole('link', { name: 'Ver, remarcar ou cancelar' }).click();
  await page.waitForURL(/\/horario\?t=[A-Za-z0-9_-]{22}$/);
  await expect(page.getByRole('heading', { name: 'Horário marcado' })).toBeVisible();
  await page.getByRole('button', { name: 'Remarcar' }).click();
  await page
    .getByRole('button', { name: /^(domingo|segunda|terça|quarta|quinta|sexta|sábado), \d+ de / })
    .nth(diasAteProximoUtil())
    .click();
  await page.getByRole('group', { name: 'Horários livres' }).getByRole('button').last().click();
  await page.getByRole('button', { name: /^Remarcar para \d{2}:\d{2}$/ }).click();
  await expect(page.getByText('Pronto, horário remarcado.')).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar horário' }).click();
  await page.getByRole('button', { name: 'Sim, cancelar' }).click();
  await expect(page.getByRole('heading', { name: 'Horário cancelado' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remarcar' })).toHaveCount(0);
});

test('link de horário que não existe explica o problema', async ({ page }) => {
  await page.goto(`/horario?t=${'x'.repeat(22)}`);
  await expect(page.getByRole('heading', { name: 'Link não encontrado' })).toBeVisible();
});

test('link de unidade inexistente explica o problema', async ({ page }) => {
  await page.goto('/agendar?u=nao-existe-mesmo');
  await expect(
    page.getByRole('heading', { name: 'Página de agendamento não encontrada' }),
  ).toBeVisible();
});

test('dono novo cria a conta e passa pela configuração guiada', async ({ page }, info) => {
  test.skip(info.project.name === 'celular', 'cadastro no computador');
  await page.goto('/cadastro');
  await page.getByLabel('Nome da barbearia').fill(`Barbearia Teste ${sufixo}`);
  await page.getByLabel('Seu nome').fill('Dona Teste');
  await page.getByLabel('E-mail').fill(`dona-${sufixo}@e2e.pentefino.dev`);
  await page.getByLabel('Senha').fill('senha-forte-123');
  await page.getByText('Li e aceito').click();
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.waitForURL(/configuracao-inicial/);
  await page.getByLabel('Endereço').fill('Rua do Teste, 10');
  await page.getByRole('button', { name: 'Salvar e seguir' }).click();
  await page.getByLabel('Preço de Corte', { exact: true }).fill('52,00');
  await page.getByRole('button', { name: /^Criar \d+ serviços e seguir$/ }).click();
  await page.getByRole('button', { name: 'Pular por agora' }).click();
  await page.getByRole('button', { name: 'Ir para o Início' }).click();
  await page.waitForURL(/inicio/);
  await expect(page.getByText('Termine a configuração da barbearia')).toHaveCount(0);
  // Cadastro pelo site: aviso para confirmar o e-mail, com o botão de reenviar (Etapa 15.4).
  const confirmar = page.getByRole('status').filter({ hasText: 'Confirme seu e-mail' });
  await expect(confirmar).toBeVisible();
  await confirmar.getByRole('button', { name: 'Reenviar e-mail' }).click();
  await expect(confirmar).toContainText('Link enviado');
  await page.goto('/servicos');
  await page.getByRole('tab', { name: 'Tabela de preços' }).click();
  await expect(page.getByLabel('Unidade principal (R$), Corte', { exact: true })).toHaveValue(
    '52,00',
  );
});

test('dono importa clientes com prévia e relatório de erros', async ({ page }, info) => {
  test.skip(info.project.name === 'celular', 'importação no computador');
  await entrar(page, 'dono@demo.pentefino.dev');
  await page.goto('/configuracoes');
  await page.getByRole('tab', { name: 'Importar planilha' }).click();
  const csv = `nome;telefone;email;aniversario\nImportado A ${sufixo};(11) 9${String(Date.now()).slice(-8)};;10/05/1990\nImportado B ${sufixo};123;;\n`;
  await page
    .locator('#importar-arquivo')
    .setInputFiles({ name: 'clientes.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  const previa = page.getByRole('region', { name: 'Prévia da importação' });
  await expect(previa).toContainText('2 linhas · 1 prontas · 1 com problema');
  await expect(previa.getByRole('row', { name: /3 Telefone inválido/ })).toBeVisible();
  await page.getByRole('button', { name: 'Importar 1 linha' }).click();
  await expect(page.getByText('1 linha importada.')).toBeVisible();
});

test('impressão das comandas e exportação para o contador baixam pelo /api', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'celular', 'arquivos no computador');
  await entrar(page, 'dono@demo.pentefino.dev');
  await page.goto('/comandas');
  const link = page.getByRole('link', { name: 'Imprimir 4 por folha' });
  await expect(link).toBeVisible();
  const pdf = await page.request.get((await link.getAttribute('href'))!);
  expect(pdf.headers()['content-type']).toBe('application/pdf');
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');

  await page.goto('/financeiro');
  const csv = await page.request.get(
    (await page.getByRole('link', { name: 'Planilha do mês (CSV)' }).getAttribute('href'))!,
  );
  expect(csv.headers()['content-disposition']).toMatch(
    /attachment; filename="pente-fino-\d{4}-\d{2}\.csv"/,
  );
  expect(await csv.text()).toMatch(/data;tipo;descricao;unidade;forma_ou_grupo;valor/);
});
