import { expect, test, type Page } from '@playwright/test';

// Etapa 10.1: quem pede atendente aparece em Conversas, com aviso em qualquer tela.
async function entrar(page: Page, email: string) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio|agenda|hoje/);
}

test('recepção vê o aviso, abre a conversa de quem pediu atendente e lê as mensagens', async ({
  page,
}) => {
  await entrar(page, 'recepcao.centro@demo.pentefino.dev');
  const aviso = page.getByRole('status').filter({ hasText: 'esperando atendente no WhatsApp' });
  await expect(aviso).toContainText('1 cliente está esperando atendente');
  await aviso.getByRole('link', { name: 'Abrir conversas' }).click();
  await expect(page).toHaveURL(/\/conversas$/);
  await expect(aviso).toHaveCount(0);

  const esperando = page.getByRole('region', { name: 'Esperando atendente (1)' });
  await esperando.getByRole('button').first().click();
  const conversa = page.getByRole('region', { name: /^Conversa com / });
  await expect(conversa.getByRole('list', { name: 'Mensagens do WhatsApp' })).toContainText(
    'pacote de noivo',
  );
  // O WhatsApp da demonstração está desconectado: a tela avisa e não deixa enviar.
  await expect(page.getByText(/não está\s+conectado/)).toBeVisible();
  await expect(conversa.getByLabel('Responder')).toBeDisabled();
  await expect(conversa.getByRole('button', { name: 'Devolver ao bot' })).toBeVisible();

  const sobra = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sobra).toBeLessThanOrEqual(0);

  // "Agendar" abre a Agenda com o novo agendamento já com o cliente da conversa.
  await conversa.getByRole('link', { name: 'Agendar' }).click();
  await expect(page).toHaveURL(/\/agenda\?agendar=/);
  const novo = page.getByRole('dialog', { name: 'Novo agendamento' });
  await expect(novo).toBeVisible();
  await novo.getByRole('button', { name: 'Fechar' }).first().click();
  await page.goBack();
  // No celular a conversa volta aberta; no computador, abre de novo pela lista.
  if (!(await conversa.isVisible())) await esperando.getByRole('button').first().click();

  // "Ver cliente" abre a ficha; "Mandar mensagem" explica por que o bot não envia agora
  // (WhatsApp desconectado) e oferece o link com o texto pronto.
  await conversa.getByRole('link', { name: 'Ver cliente' }).click();
  await expect(page).toHaveURL(/\/clientes\?id=/);
  await page.getByRole('button', { name: 'Mandar mensagem' }).click();
  const janela = page.getByRole('dialog', { name: /^Mensagem para / });
  await expect(janela.getByText(/está desconectado/)).toBeVisible();
  await expect(
    janela.getByRole('button', { name: /Enviar pelo WhatsApp da Centro/ }),
  ).toBeDisabled();
  await expect(janela.getByRole('link', { name: 'Abrir no meu WhatsApp' })).toHaveAttribute(
    'href',
    /^https:\/\/wa\.me\/55\d+\?text=Ol%C3%A1%2C/,
  );
});

test('dono também tem Conversas e Caixa do dia, com o menu em seções', async ({ page }, info) => {
  test.skip(info.project.name === 'celular', 'seções do menu lateral só no computador');
  await entrar(page, 'dono@demo.pentefino.dev');
  const menu = page.getByRole('navigation', { name: 'Menu principal' });
  await expect(menu.getByRole('list', { name: 'WhatsApp' })).toContainText('Conversas do bot');
  await expect(menu.getByRole('list', { name: 'Dia a dia' })).toContainText('Caixa do dia');
  await expect(menu.getByLabel('1 esperando atendente')).toBeVisible();
});

test('recepção assume uma conversa do bot e devolve; avisos ligam e desligam neste aparelho', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'celular', 'muda o estado da demonstração: um projeto basta');
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('recepcao.centro@demo.pentefino.dev');
  await page.getByLabel('Senha').fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/agenda/);
  await page.goto('/conversas');

  const avisos = page.getByRole('group', { name: 'Avisos neste aparelho' });
  const som = avisos.getByLabel('Tocar som');
  await expect(som).toBeChecked();
  await som.uncheck();
  await page.reload();
  await expect(
    page.getByRole('group', { name: 'Avisos neste aparelho' }).getByLabel('Tocar som'),
  ).not.toBeChecked();

  await page.getByRole('region', { name: 'Recentes' }).getByRole('button').first().click();
  const conversa = page.getByRole('region', { name: /^Conversa com / });
  await conversa.getByRole('button', { name: 'Assumir conversa' }).click();
  await expect(conversa.getByText('Com a equipe')).toBeVisible();
  await conversa.getByRole('button', { name: 'Devolver ao bot' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Devolver ao bot' }).click();
  // A demonstração não tem WhatsApp conectado: o selo diz a verdade (painel A6).
  await expect(conversa.getByText('Bot parado: WhatsApp desconectado')).toBeVisible();
});
