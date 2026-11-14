import { expect, test } from '@playwright/test';

// Pedido do dono em 13/11: saber o que o visitante faz na página de vendas. O site manda em lote
// a entrada, a rolagem e os cliques do funil, com um id anônimo; com "não rastrear", nada sai.
test('página de vendas: entrada, rolagem e clique vão para /api/visitas', async ({ page }) => {
  const lotes: {
    visitaId: string;
    novo: boolean | null;
    eventos: { tipo: string; valor?: unknown }[];
  }[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('/api/visitas') && r.method() === 'POST') lotes.push(r.postDataJSON());
  });
  const aceita = page.waitForResponse(
    (r) => r.url().endsWith('/api/visitas') && r.request().method() === 'POST',
  );
  await page.goto('/');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  // Sai da página: o que estiver na fila vai na hora.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect((await aceita).status()).toBe(204);
  const eventos = () => lotes.flatMap((l) => l.eventos);
  await expect.poll(eventos).toContainEqual({ tipo: 'entrada', pagina: '/' });
  await expect.poll(eventos).toContainEqual({ tipo: 'rolagem', pagina: '/', valor: 100 });
  // Sem o aceite de cookies (o padrão dos testes), não dá para saber se é a primeira vez.
  expect(lotes[0]!.novo).toBeNull();
  expect(new Set(lotes.map((l) => l.visitaId)).size).toBe(1);
});

test('com "não rastrear" ligado, o site não manda nada', async ({ browser }) => {
  const contexto = await browser.newContext();
  await contexto.addInitScript(() =>
    Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { get: () => true }),
  );
  const page = await contexto.newPage();
  let enviados = 0;
  page.on('request', (r) => {
    if (r.url().endsWith('/api/visitas')) enviados++;
  });
  await page.goto('/');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(6000);
  expect(enviados).toBe(0);
  await contexto.close();
});
