import { expect, test } from '@playwright/test';

// Cookie de sessão que a API não aceita mais (revogado, vencido, de outro ambiente):
// a tela vai ao login e fica lá, sem vai-e-volta com /app.
test('sessão recusada pela API leva ao login e não volta para o app', async ({
  page,
  context,
  baseURL,
}) => {
  const { hostname } = new URL(baseURL!);
  await context.addCookies([
    { name: 'pf_sessao', value: 'token-que-nao-existe', domain: hostname, path: '/' },
  ]);
  await page.goto('/agenda');
  await expect(page).toHaveURL(/\/entrar\?voltar=%2Fagenda&motivo=sessao$/);
  await expect(page.getByLabel('E-mail')).toBeVisible();
  // O cookie velho foi apagado: recarregar continua no login.
  await page.reload();
  await expect(page).toHaveURL(/\/entrar/);
  expect((await context.cookies()).some((c) => c.name === 'pf_sessao')).toBe(false);
});
