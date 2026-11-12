import { expect, test, type Page } from '@playwright/test';

// Etapa 6A nas telas: serviços e preços, equipe e calendário.
const SENHA = 'pentefino123';
const sufixo = Date.now().toString(36);

async function entrar(page: Page, email: string) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio|agenda|hoje/);
}

test.describe.configure({ mode: 'serial' });

test('preço livre: serviço de química com faixa; mínimo maior que o máximo é recusado', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'celular', 'cadastro feito no computador');
  const nome = `Química ${sufixo}`;
  await entrar(page, 'dono@demo.pentefino.dev');
  await page.goto('/servicos');
  await page.getByRole('button', { name: 'Novo serviço' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Novo serviço' });
  await dialogo.getByLabel('Nome').fill(nome);
  await expect(dialogo.getByLabel('Valor mínimo (R$)')).toBeHidden();
  await dialogo.getByLabel(/Preço livre/).check();
  await dialogo.getByLabel('Valor mínimo (R$)').fill('250,00');
  await dialogo.getByLabel('Valor máximo (R$)').fill('80,00');
  await dialogo.getByRole('button', { name: 'Cadastrar serviço' }).click();
  await expect(dialogo.getByText('O mínimo não pode ser maior que o máximo.')).toBeVisible();
  await dialogo.getByLabel('Valor mínimo (R$)').fill('80,00');
  await dialogo.getByLabel('Valor máximo (R$)').fill('250,00');
  await dialogo.getByRole('button', { name: 'Cadastrar serviço' }).click();
  await expect(dialogo).toBeHidden();
  await expect(page.getByRole('row', { name: new RegExp(nome) })).toContainText('Preço livre');
  // Com um serviço de preço livre, o dono decide se o barbeiro também digita o valor.
  await expect(page.getByLabel(/O barbeiro também digita o valor/)).toBeVisible();
});

test('dono cadastra serviço e grava o preço pela tabela', async ({ page }, info) => {
  test.skip(info.project.name === 'celular', 'cadastro feito no computador');
  const nome = `Barboterapia ${sufixo}`;
  await entrar(page, 'dono@demo.pentefino.dev');
  await page.goto('/servicos');
  await page.getByRole('button', { name: 'Novo serviço' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Novo serviço' });
  await dialogo.getByLabel('Nome').fill(nome);
  await dialogo.getByLabel('Duração (minutos)').fill('40');
  await dialogo.getByLabel('Custo de produto (R$)').fill('6,50');
  await dialogo.getByRole('button', { name: 'Cadastrar serviço' }).click();
  await expect(dialogo).toBeHidden();
  const linha = page.getByRole('row', { name: new RegExp(nome) });
  await expect(linha).toContainText('40 min');
  await expect(linha).toContainText('R$ 6,50');

  // Editar o serviço criado pelo próprio nome, num notebook comum (1366 px): antes o "Editar"
  // ficava no fim da tabela, fora da tela.
  await page.setViewportSize({ width: 1366, height: 768 });
  const editar = page.getByRole('button', { name: `Editar ${nome}` });
  // Dentro da largura da tela, sem rolar a tabela para o lado (a lista pode ser longa: a altura
  // não importa aqui).
  const caixa = (await editar.boundingBox())!;
  expect(caixa.x).toBeGreaterThanOrEqual(0);
  expect(caixa.x + caixa.width).toBeLessThanOrEqual(1366);
  await editar.click();
  const edicao = page.getByRole('dialog', { name: `Editar ${nome}` });
  await expect(edicao.getByLabel('Duração (minutos)')).toHaveValue('40');
  await edicao.getByLabel('Duração (minutos)').fill('45');
  await edicao.getByRole('button', { name: 'Salvar' }).click();
  await expect(edicao).toBeHidden();
  await expect(linha).toContainText('45 min');

  await page.getByRole('tab', { name: 'Tabela de preços' }).click();
  await page.getByLabel(`Centro (R$), ${nome}`).fill('85,00');
  await page.getByRole('button', { name: 'Gravar 1 preço' }).click();
  await expect(page.getByText(/1 preço gravado, valendo a partir de/)).toBeVisible();
  await page.reload();
  await page.getByRole('tab', { name: 'Tabela de preços' }).click();
  await expect(page.getByLabel(`Centro (R$), ${nome}`)).toHaveValue('85,00');
});

test('dono adiciona barbeiro novo e recebe o link do WhatsApp', async ({ page }, info) => {
  test.skip(info.project.name === 'celular', 'cadastro feito no computador');
  await entrar(page, 'dono@demo.pentefino.dev');
  await page.goto('/equipe');
  await page.getByRole('tab', { name: 'Profissionais' }).click();
  await page.getByRole('button', { name: 'Adicionar barbeiro' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Adicionar barbeiro' });
  await dialogo.getByLabel('Unidade').selectOption({ label: 'Jardins' });
  await dialogo.getByLabel('Nome').fill(`Caio Teste ${sufixo}`);
  await dialogo.getByLabel('E-mail').fill(`caio-${sufixo}@e2e.pentefino.dev`);
  await dialogo.getByLabel('WhatsApp (opcional)').fill('(11) 97777-1234');
  await dialogo.getByLabel('Comissão em serviços (%)').fill('42,5');
  await dialogo.getByRole('button', { name: 'Adicionar' }).click();
  await expect(
    dialogo.getByText('Barbeiro cadastrado e convite enviado por e-mail.'),
  ).toBeVisible();
  await expect(dialogo.getByRole('link', { name: 'Enviar convite pelo WhatsApp' })).toHaveAttribute(
    'href',
    /wa\.me\/5511977771234/,
  );
  await dialogo.getByRole('button', { name: 'Concluir' }).click();
  const cartao = page.getByRole('listitem').filter({ hasText: `Caio Teste ${sufixo}` });
  await expect(cartao).toContainText('42,5%');
  await expect(cartao).toContainText('Convite pendente');
});

test('barbeiro convidado em Acessos aparece para completar o cadastro', async ({ page }, info) => {
  test.skip(info.project.name === 'celular', 'cadastro feito no computador');
  const nome = `Davi Acesso ${sufixo}`;
  await entrar(page, 'dono@demo.pentefino.dev');
  await page.goto('/equipe');
  await page.getByRole('tab', { name: 'Acessos ao sistema' }).click();
  await page.getByRole('button', { name: 'Convidar pessoa' }).click();
  const convite = page.getByRole('dialog', { name: 'Convidar pessoa' });
  await convite.getByLabel('Nome').fill(nome);
  await convite.getByLabel('E-mail').fill(`davi-${sufixo}@e2e.pentefino.dev`);
  await convite.getByLabel('Papel').selectOption({ label: 'Barbeiro' });
  await convite.getByLabel('Unidade').selectOption({ label: 'Centro' });
  await convite.getByRole('button', { name: 'Enviar convite' }).click();
  await expect(convite.getByText(/Completar\s+cadastro/)).toBeVisible();
  await convite.getByRole('button', { name: 'Concluir' }).click();

  await page.getByRole('tab', { name: 'Profissionais' }).click();
  const faltam = page.getByRole('region', { name: 'Falta completar o cadastro' });
  await faltam
    .getByRole('listitem')
    .filter({ hasText: nome })
    .getByRole('button', { name: 'Completar cadastro' })
    .click();
  const dialogo = page.getByRole('dialog', { name: `Completar cadastro de ${nome}` });
  await expect(dialogo.getByLabel('Nome')).toHaveCount(0); // a pessoa já vem escolhida
  await dialogo.getByLabel('Comissão em serviços (%)').fill('45');
  await dialogo.getByRole('button', { name: 'Adicionar' }).click();
  await expect(dialogo).toBeHidden();
  await expect(faltam.getByText(nome)).toHaveCount(0);
  await expect(page.getByRole('listitem').filter({ hasText: nome })).toContainText('45%');
});

test('gestor vê os preços sem editar e marca feriado na unidade dele', async ({ page }) => {
  await entrar(page, 'gestor@demo.pentefino.dev');
  await page.goto('/servicos');
  await page.getByRole('tab', { name: 'Tabela de preços' }).click();
  await expect(page.getByText('Só o dono altera a tabela.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Gravar/ })).toHaveCount(0);

  await page.goto('/configuracoes');
  await page.getByRole('tab', { name: 'Folgas e feriados' }).click();
  await page.getByLabel('Data').fill('2026-12-24');
  await page.getByLabel('Motivo').fill(`Véspera de Natal ${sufixo}`);
  await page.getByRole('button', { name: 'Marcar' }).click();
  const item = page.getByRole('listitem').filter({ hasText: `Véspera de Natal ${sufixo}` });
  await expect(item).toContainText('24/12/2026');
  await expect(item).toContainText('Fechado');
  await item.getByRole('button', { name: /Remover/ }).click();
  await expect(item).toHaveCount(0);
});

test('clientes para recuperar: a recepção vê os motivos e abre a ficha', async ({ page }) => {
  await entrar(page, 'recepcao.centro@demo.pentefino.dev');
  await page.goto('/clientes');
  await page.getByRole('tab', { name: 'Para recuperar' }).click();
  const lista = page.getByRole('list', { name: 'Clientes para recuperar' });
  const vazio = page.getByText('Ninguém para recuperar agora');
  await expect(lista.or(vazio)).toBeVisible();
  if (await lista.isVisible()) {
    await expect(lista.getByRole('listitem').first()).toContainText(
      /Nota baixa sem resolver|Faltou e não voltou|Passou do tempo de costume/,
    );
    await lista.getByRole('button', { name: 'Abrir ficha' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
  }
  const sobra = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sobra).toBeLessThanOrEqual(0);
});
