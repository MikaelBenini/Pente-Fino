import { expect, test, type Page } from '@playwright/test';

// Seção 7, lote 7a: o site da barbearia no tema Tradicional. O dono publica (pela API, até o
// painel do lote 7b), o cliente navega por Início, Serviços, Equipe e Contato e chega ao
// agendamento; tirar do ar volta /b/<slug> a ser a página de agendamento.
const SLUG = 'demo-jardins';

async function entrar(page: Page) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('dono@demo.pentefino.dev');
  await page.getByLabel('Senha').fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio|agenda|hoje/);
}

/** Chamada à API pela ponte do Next, com a sessão do navegador. */
async function api(page: Page, caminho: string, metodo = 'GET', corpo?: unknown) {
  return page.evaluate(
    async ([c, m, b]) => {
      const r = await fetch(`/api/${c}`, {
        method: m as string,
        headers: b === undefined ? undefined : { 'content-type': 'application/json' },
        body: b === undefined ? undefined : JSON.stringify(b),
      });
      return { status: r.status, corpo: await r.json().catch(() => null) };
    },
    [caminho, metodo, corpo] as const,
  );
}

test('site da barbearia: Início, páginas internas, agendar e tirar do ar', async ({ page }) => {
  test.setTimeout(150_000);
  await entrar(page);
  const unidades = (await api(page, 'unidades')).corpo as { id: string; slug: string | null }[];
  const id = unidades.find((u) => u.slug === SLUG)!.id;
  const { rascunho } = (await api(page, `unidades/${id}/site`)).corpo;
  rascunho.instagram = 'barbeariademo';
  rascunho.paginas.inicio[0].titulo = 'Corte com hora marcada nos Jardins';
  expect((await api(page, `unidades/${id}/site`, 'PUT', rascunho)).status).toBe(200);
  expect((await api(page, `unidades/${id}/site/publicar`, 'POST')).status).toBe(200);

  try {
    const visitante = await (await page.context().browser()!.newContext()).newPage();
    const titulo = visitante.getByRole('heading', {
      level: 1,
      name: 'Corte com hora marcada nos Jardins',
    });
    // A página guarda o site por até um minuto: espera a versão publicada aparecer.
    await expect(async () => {
      await visitante.goto(`/b/${SLUG}`);
      await expect(titulo).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 90_000 });

    await expect(visitante.getByRole('heading', { name: 'Os mais pedidos' })).toBeVisible();
    await expect(visitante.getByRole('heading', { name: 'Os barbeiros' })).toBeVisible();
    await expect(visitante.getByRole('contentinfo')).toContainText('Site e agenda pelo Pente Fino');

    // No celular os links ficam no "Menu"; no computador, à vista (o outro fica escondido).
    const menu = visitante.locator('summary:visible', { hasText: 'Menu' });
    const irPara = async (nome: string) => {
      if (await menu.isVisible()) await menu.click();
      await visitante
        .getByRole('navigation', { name: 'Principal' })
        .getByRole('link', { name: nome, exact: true })
        .click();
    };

    await irPara('Serviços');
    await expect(visitante).toHaveURL(new RegExp(`/b/${SLUG}/servicos$`));
    await expect(
      visitante.getByRole('heading', { level: 1, name: 'Serviços e preços' }),
    ).toBeVisible();
    await expect(visitante.getByText(/R\$\s?\d/).first()).toBeVisible();

    await irPara('Equipe');
    await expect(visitante.getByRole('heading', { level: 1, name: 'A equipe' })).toBeVisible();
    await expect(visitante.getByRole('link', { name: /^Agendar com / }).first()).toBeVisible();

    await irPara('Contato');
    await expect(visitante.getByRole('heading', { name: 'Onde fica' })).toBeVisible();
    await expect(visitante.getByRole('link', { name: 'Abrir no Google Maps' })).toHaveAttribute(
      'href',
      /google\.com\/maps/,
    );
    await expect(visitante.getByRole('link', { name: /Instagram @barbeariademo/ })).toBeVisible();
    await visitante.getByText('Precisa marcar horário?').click();
    await expect(visitante.getByText(/Recomendamos marcar pelo site/)).toBeVisible();

    await visitante.getByRole('main').getByRole('link', { name: 'Agendar horário' }).click();
    await expect(visitante).toHaveURL(new RegExp(`/b/${SLUG}/agendar$`));
    await expect(visitante.getByRole('heading', { level: 1 })).toBeVisible();

    // Página interna que não existe: a tela de "não encontrada", fora do Google. O código da
    // resposta sai antes (a página chega em partes), então o teste olha a tela e o robots.
    await visitante.goto(`/b/${SLUG}/qualquer`);
    await expect(
      visitante.getByRole('heading', { level: 1, name: 'Página não encontrada' }),
    ).toBeVisible();
    await expect(visitante.locator('meta[name="robots"]').first()).toHaveAttribute(
      'content',
      /noindex/,
    );
    await visitante.close();
  } finally {
    expect((await api(page, `unidades/${id}/site/publicado`, 'DELETE')).status).toBe(200);
  }
});
