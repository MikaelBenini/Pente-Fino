import { expect, test } from '@playwright/test';

// Admin F5: o dono libera o acesso do suporte por 24 horas e cancela quando quiser.
test('dono libera e cancela o acesso do suporte nas Configurações', async ({ page }, info) => {
  test.skip(info.project.name === 'celular', 'a mesma conta nos dois aparelhos: um só basta');
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('dono@demo.pentefino.dev');
  await page.getByLabel('Senha').fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio/);
  await page.goto('/configuracoes?aba=suporte');
  const secao = page.getByRole('region', { name: 'Acesso do suporte' });
  await expect(secao).toContainText('só leitura');
  await secao.getByRole('button', { name: 'Liberar por 24 horas' }).click();
  await expect(secao.getByRole('status')).toContainText('Liberado até');
  await secao.getByRole('button', { name: 'Cancelar o acesso agora' }).click();
  await expect(secao.getByRole('button', { name: 'Liberar por 24 horas' })).toBeVisible();
});

// Admin F6: o chat com o suporte na Ajuda, para quem já é cliente (sem nome nem contato).
test('cliente fala com o suporte pelo chat da Ajuda', async ({ page }, info) => {
  test.skip(info.project.name === 'celular', 'a mesma conta nos dois aparelhos: um só basta');
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('gestor@demo.pentefino.dev');
  await page.getByLabel('Senha').fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio|agenda|hoje/);
  await page.goto('/ajuda');
  const contato = page.getByRole('region', { name: 'Falar com o suporte' });
  const texto = `Dúvida do teste ${Date.now()}`;
  await contato.getByLabel('Mensagem para o suporte').fill(texto);
  await contato.getByRole('button', { name: 'Enviar ao suporte' }).click();
  await expect(contato.getByRole('list', { name: 'Mensagens com o suporte' })).toContainText(texto);
  await expect(contato.getByRole('status')).toBeVisible();
});
