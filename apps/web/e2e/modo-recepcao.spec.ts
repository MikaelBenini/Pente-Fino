import { expect, test, type Page } from '@playwright/test';

// Seção 7: modo recepção. A tela de Comandas em letra grande para o monitor do balcão: o próximo
// cliente em destaque e as colunas chegando, na cadeira e para receber.
async function entrar(page: Page) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('recepcao.centro@demo.pentefino.dev');
  await page.getByLabel('Senha').fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio|agenda|hoje|comandas/);
}

test('modo recepção: a comanda anda de "na cadeira" para "receber"', async ({ page }) => {
  await entrar(page);
  // Uma comanda na hora (cliente sem horário), aberta pela API do painel.
  const unidades = (await (await page.request.get('/api/unidades')).json()) as {
    id: string;
    nome: string;
  }[];
  const centro = unidades.find((u) => u.nome === 'Centro')!;
  const profissionais = (await (await page.request.get('/api/profissionais')).json()) as {
    id: string;
    nome: string;
  }[];
  const rafael = profissionais.find((p) => p.nome === 'Rafael Moura')!;
  const servicos = (await (await page.request.get('/api/servicos')).json()) as {
    id: string;
    nome: string;
    unidadeIds: string[];
  }[];
  const corte = servicos.find((s) => s.nome === 'Corte' && s.unidadeIds.includes(centro.id))!;
  const cliente = `Recepção ${Date.now().toString(36)}`;
  const aberta = await page.request.post('/api/comandas', {
    data: {
      unidadeId: centro.id,
      profissionalId: rafael.id,
      clienteNovo: { nome: cliente },
      servicoIds: [corte.id],
    },
    headers: { origin: new URL(page.url()).origin },
  });
  expect(aberta.status()).toBe(201);
  const { id } = (await aberta.json()) as { id: string };

  await page.goto('/comandas');
  await page.getByRole('link', { name: 'Modo recepção' }).click();
  await expect(page).toHaveURL(/modo=recepcao/);
  await expect(page.getByRole('heading', { name: 'Próximo' })).toBeVisible();
  const naCadeira = page.getByRole('region', { name: 'Na cadeira' });
  await expect(naCadeira.getByText(cliente)).toBeVisible();

  // O barbeiro confirma; em até 30 s (ou ao voltar à tela) a comanda passa para "Para receber".
  const confirmada = await page.request.post(`/api/comandas/${id}/confirmar`, {
    data: {},
    headers: { origin: new URL(page.url()).origin },
  });
  expect(confirmada.ok()).toBe(true);
  await page.reload();
  const receber = page.getByRole('region', { name: 'Para receber' });
  await expect(receber.getByText(cliente)).toBeVisible();
  await expect(naCadeira.getByText(cliente)).toHaveCount(0);
  await receber
    .getByRole('listitem')
    .filter({ hasText: cliente })
    .getByRole('link', { name: 'Receber' })
    .click();
  await expect(page).toHaveURL(new RegExp(`/comandas\\?id=${id}`));
  await expect(page.getByRole('heading', { name: cliente })).toBeVisible();
});
