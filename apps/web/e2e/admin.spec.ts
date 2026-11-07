import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { codigoDoPasso, passoDe } from '../../api/src/admin/totp';

// Etapa 15.1: login da administração com segundo fator e a lista de contas.
test('administração: 1º acesso configura o autenticador, entra e vê as contas', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'celular', 'administração no computador');
  const email = `admin-${Date.now().toString(36)}@pentefino.dev`;
  const saida = execFileSync(
    'pnpm',
    [
      '--silent',
      '--filter',
      '@pente-fino/db',
      'admin:criar',
      '--email',
      email,
      '--nome',
      'Ana Teste',
    ],
    { cwd: path.resolve(__dirname, '../../..'), encoding: 'utf8' },
  );
  const senha = /Senha \(anote agora, não aparece de novo\): (\S+)/.exec(saida)![1]!;

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Entrar na administração' })).toBeVisible();
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('senha-errada');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('E-mail, senha ou código inválidos.')).toBeVisible();

  await page.getByLabel('Senha').fill(senha);
  await page.getByRole('button', { name: 'Continuar' }).click();
  const configurar = page.getByRole('region', { name: 'Configure o segundo fator' });
  await expect(configurar.getByRole('img', { name: /QR code/ })).toBeVisible();
  const segredo = (await configurar.locator('code').textContent())!.trim();
  await page.getByLabel('Código do autenticador').fill(codigoDoPasso(segredo, passoDe(new Date())));
  await page.getByRole('button', { name: 'Confirmar código' }).click();

  await expect(page.getByRole('heading', { name: 'Números do negócio' })).toBeVisible();
  await expect(page.getByText('Receita recorrente (MRR)')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Contas por situação' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Contas', exact: true })).toBeVisible();
  const tabela = page.getByRole('table', { name: 'Contas das barbearias' });
  await expect(
    tabela.getByRole('rowheader', { name: /Barbearia Pente Fino/ }).first(),
  ).toBeVisible();
  // Ficha da conta: busca, abre e estende o teste com motivo (fica no histórico).
  await page.getByLabel('Buscar barbearia').fill('Plano Básico');
  await tabela.getByRole('button', { name: 'Barbearia Plano Básico' }).click();
  const ficha = page.getByRole('dialog', { name: 'Barbearia Plano Básico' });
  await expect(ficha).toContainText('basico@demo.pentefino.dev');
  const estender = ficha.getByRole('form', { name: 'Estender teste ou dar cortesia' });
  await expect(estender.getByRole('button', { name: 'Salvar data' })).toBeDisabled();
  await estender.getByLabel('Motivo').fill('Cortesia do teste de navegador');
  await estender.getByRole('button', { name: 'Salvar data' }).click();
  await expect(estender.getByRole('status')).toHaveText('Feito. Ficou registrado no histórico.');
  await expect(ficha.getByRole('list', { name: 'Histórico da conta' })).toContainText(
    'Cortesia do teste de navegador',
  );
  await ficha.getByRole('button', { name: 'Fechar' }).click();
  // A sessão da barbearia não existe aqui, e a da administração não abre o painel.
  await page.goto('/app');
  await expect(page).toHaveURL(/\/entrar/);
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page.getByRole('heading', { name: 'Entrar na administração' })).toBeVisible();
});
