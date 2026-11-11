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
  // Painel P6: "Adicionar ao calendário" baixa um .ics com o horário e o link de remarcar.
  const calendario = page.getByRole('link', { name: 'Adicionar ao calendário' });
  await expect(calendario).toHaveAttribute('download', 'horario.ics');
  const ics = decodeURIComponent((await calendario.getAttribute('href'))!.split(',')[1]!);
  expect(ics).toMatch(/BEGIN:VEVENT[\s\S]*DTSTART:\d{8}T\d{6}Z[\s\S]*\/horario\?t=/);
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

test('cliente troca de unidade no meio do agendamento sem perder o que fez', async ({ page }) => {
  // Quem veio pela conversa do WhatsApp da unidade não vê a troca: já está na unidade certa.
  await page.goto('/agendar?u=demo-centro&c=tokenDeTeste123');
  await expect(page.getByRole('heading', { name: /Barbearia Pente Fino/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Agendar em outra unidade' })).toHaveCount(0);

  await page.goto('/agendar?u=demo-centro');
  await page.getByLabel(/^Corte · 30 min$/).check();
  // Um barbeiro do Centro: não existe na outra unidade.
  await page
    .getByRole('group')
    .filter({ has: page.getByRole('button', { name: 'Sem preferência' }) })
    .getByRole('button')
    .nth(1)
    .click();
  await page.getByLabel('Nome').fill(`Cliente Troca ${sufixo}`);
  await page.getByLabel('WhatsApp').fill('(11) 98888-7777');

  await page.getByRole('button', { name: 'Agendar em outra unidade' }).click();
  await page
    .getByRole('list', { name: 'Outras unidades' })
    .getByRole('button', { name: /Jardins/ })
    .click();
  // Painel P3: o endereço passa a ser o da outra unidade, sem recarregar a tela.
  await page.waitForURL(/\/b\/demo-jardins(\?|$)/);
  await expect(page.getByText('Jardins', { exact: true }).first()).toBeVisible();
  // Mantém o serviço e os dados; o barbeiro volta para "Sem preferência", com aviso.
  await expect(page.getByLabel(/^Corte · 30 min$/)).toBeChecked();
  await expect(page.getByLabel('Nome')).toHaveValue(`Cliente Troca ${sufixo}`);
  await expect(page.getByLabel('WhatsApp')).toHaveValue('(11) 98888-7777');
  await expect(page.getByRole('button', { name: 'Sem preferência' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(
    page.getByRole('status').filter({ hasText: 'Agora você está agendando na unidade Jardins' }),
  ).toContainText('escolha o barbeiro de novo');

  // E agenda na unidade nova.
  await page
    .getByRole('button', { name: /^(domingo|segunda|terça|quarta|quinta|sexta|sábado), \d+ de / })
    .nth(diasAteProximoUtil())
    .click();
  await page
    .getByRole('group', { name: /Horários livres/ })
    .getByRole('button')
    .first()
    .click();
  await page.getByLabel('WhatsApp').fill(`(11) 9${String(Date.now()).slice(-8)}`);
  await page.getByRole('button', { name: /^Agendar \d{2}:\d{2}/ }).click();
  await expect(page.getByRole('heading', { name: 'Horário marcado' })).toBeVisible();
  await expect(page.getByText('Jardins', { exact: true })).toBeVisible();
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

// Painel P1, P3 e P4: endereço curto, prévia da barbearia e o Google só com a opção ligada.
test('página da unidade em /b/<slug>: 301 do endereço antigo, prévia e Google', async ({
  page,
  browser,
}, info) => {
  test.skip(info.project.name === 'celular', 'o que muda é o HTML e os cabeçalhos');
  const antigo = await page.request.get('/agendar?u=demo-centro&c=tokenDeTeste123', {
    maxRedirects: 0,
  });
  expect(antigo.status()).toBe(301);
  expect(antigo.headers()['location']).toMatch(/^\/b\/demo-centro\?.*c=tokenDeTeste123/);

  await page.goto('/b/demo-centro');
  await expect(page.getByRole('heading', { name: /Barbearia Pente Fino/ })).toBeVisible();
  await expect(page).toHaveTitle(/^Agende na Barbearia Pente Fino/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    /\/b\/demo-centro\/opengraph-image/,
  );
  // Padrão: fora do Google.
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
  // A prévia usa o endereço oficial (APP_URL); o teste busca pelo caminho, na porta do teste.
  const og = new URL((await page.locator('meta[property="og:image"]').getAttribute('content'))!);
  const imagem = await page.request.get(`${og.pathname}${og.search}`);
  expect(imagem.headers()['content-type']).toBe('image/png');

  // O dono liga "Aparecer no Google": JSON-LD de barbearia e a página indexável.
  const dono = await browser.newPage();
  await entrar(dono, 'dono@demo.pentefino.dev');
  await dono.goto('/configuracoes?aba=link');
  // Liga na outra unidade (Jardins): a Centro fica no padrão para o resto dos testes.
  const secao = dono.getByRole('region', { name: 'Link de Jardins' });
  const google = secao.getByLabel('Aparecer no Google');
  // A caixa mostra o que está gravado: muda quando o servidor confirma.
  await google.click();
  await expect(google).toBeChecked();
  await expect(secao.getByText(/aparece nas buscas do Google/)).toBeVisible();
  try {
    // Os dados da prévia ficam em cache por alguns minutos: o teste confere pela API.
    const r = (await (await page.request.get('/api/publico/agendamento/demo-jardins')).json()) as {
      aparecerNoGoogle: boolean;
    };
    expect(r.aparecerNoGoogle).toBe(true);
  } finally {
    await google.click();
    await expect(google).not.toBeChecked();
    await dono.close();
  }
});
