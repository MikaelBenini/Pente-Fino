import { expect, test, type Page } from '@playwright/test';

// Pedido do dono em 13/11: horário de funcionamento da unidade, em Configurações, Unidades.
async function entrar(page: Page) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('dono@demo.pentefino.dev');
  await page.getByLabel('Senha').fill('pentefino123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio|agenda|hoje/);
}

test('horário de funcionamento: definir, conferir e voltar ao expediente da equipe', async ({
  page,
}) => {
  await entrar(page);
  await page.goto('/configuracoes');
  await page.getByRole('tab', { name: 'Unidades' }).filter({ visible: true }).click();
  const jardins = page
    .getByRole('listitem')
    .filter({ hasText: 'Jardins' })
    .filter({
      has: page.getByRole('button', { name: 'Horário de funcionamento' }),
    });
  await jardins.getByRole('button', { name: 'Horário de funcionamento' }).click();
  const dialogo = page.getByRole('dialog', { name: /Horário de funcionamento: Jardins/ });
  // A unidade de demonstração abre de terça a sábado: o horário mantém esses dias.
  for (const dia of ['Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'])
    await dialogo.getByRole('checkbox', { name: dia, exact: true }).check();
  const terca = dialogo.getByRole('listitem').filter({ hasText: 'Terça' });
  await terca.getByLabel('Abre').fill('10:00');
  await terca.getByLabel('Fecha', { exact: true }).fill('19:00');
  await terca.getByRole('button', { name: 'Usar este horário nos outros dias abertos' }).click();
  await dialogo.getByRole('button', { name: 'Salvar horário' }).click();
  await expect(dialogo).toBeHidden();

  await jardins.getByRole('button', { name: 'Horário de funcionamento' }).click();
  await expect(terca.getByLabel('Abre')).toHaveValue('10:00');

  // Volta como estava: sem horário, vale o expediente da equipe.
  await dialogo.getByRole('button', { name: 'Sem horário: usar o expediente da equipe' }).click();
  await expect(dialogo).toBeHidden();
});
