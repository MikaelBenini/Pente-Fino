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
