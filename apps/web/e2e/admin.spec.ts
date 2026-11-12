import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { codigoDoPasso, passoDe } from './totp';

// Etapa 15.1: login da administração com segundo fator e a lista de contas.
test('administração: 1º acesso configura o autenticador, entra e vê as contas', async ({
  page,
  browser,
}, info) => {
  test.skip(info.project.name === 'celular', 'administração no computador');
  // Percorre todas as abas da administração: mais que os 30 s padrão quando roda junto.
  test.setTimeout(120_000);
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

  // Início: o que precisa de atenção e os números do negócio.
  await expect(page.getByRole('heading', { name: 'Precisa de atenção' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Números do negócio' })).toBeVisible();
  await expect(page.getByText('Receita recorrente (MRR)')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Contas por situação' })).toBeVisible();
  // Admin U1: período e números que levam à lista filtrada.
  await page.getByLabel('Período').selectOption('30dias');
  await expect(page.getByText('Contas novas por dia · últimos 30 dias')).toBeVisible();
  await page.getByRole('list', { name: 'Contas por situação' }).getByRole('button').first().click();
  await expect(page).toHaveURL(/#contas\?situacao=\w+$/);
  await expect(page.getByLabel('Situação')).not.toHaveValue('');
  await page.getByRole('tab', { name: 'Início' }).click();
  await page.getByRole('tab', { name: 'Contas' }).click();
  await expect(page).toHaveURL(/#contas$/);
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
  const estender = ficha.getByRole('form', { name: 'Estender teste' });
  await expect(estender.getByRole('button', { name: 'Salvar data' })).toBeDisabled();
  // O campo já vem dentro do limite de 60 dias (admin R6) e explica a cortesia.
  await expect(estender.getByText(/No máximo 60 dias a partir de hoje/)).toBeVisible();
  await estender.getByLabel('Motivo').fill('Cortesia do teste de navegador');
  await estender.getByRole('button', { name: 'Salvar data' }).click();
  await expect(estender.getByRole('status')).toHaveText('Feito. Ficou registrado no histórico.');
  await expect(ficha.getByRole('list', { name: 'Histórico da conta' })).toContainText(
    'Cortesia do teste de navegador',
  );
  await ficha.getByRole('button', { name: 'Fechar' }).click();
  // Venda presencial: cria a conta, abre a ficha e registra o Pix na hora.
  const sufixoVenda = Date.now().toString(36);
  await page.getByRole('button', { name: 'Nova venda' }).click();
  const venda = page.getByRole('dialog', { name: 'Nova venda' });
  await venda.getByLabel('Nome da barbearia').fill(`Barbearia da Feira ${sufixoVenda}`);
  await venda.getByLabel('Nome do dono').fill('Fábio Feira');
  await venda.getByLabel('E-mail do dono').fill(`feira-${sufixoVenda}@e2e.pentefino.dev`);
  await venda.getByLabel('WhatsApp do dono').fill('11966665555');
  await venda.getByLabel('Dias de teste').fill('0');
  // Admin U4: máscara, CPF conferido no campo e resumo antes de criar.
  await expect(venda.getByLabel('WhatsApp do dono')).toHaveValue('(11) 96666-5555');
  await venda.getByLabel('CPF ou CNPJ de quem paga').fill('11111111111');
  await venda.getByRole('button', { name: 'Criar conta e mandar convite' }).click();
  await expect(venda.getByText('CPF ou CNPJ inválido.')).toBeVisible();
  await venda.getByLabel('CPF ou CNPJ de quem paga').fill('52998224725');
  await expect(venda.getByLabel('CPF ou CNPJ de quem paga')).toHaveValue('529.982.247-25');
  await expect(venda.getByRole('region', { name: 'Resumo' })).toContainText(
    'Sem teste: registre o pagamento logo depois de criar.',
  );
  await venda.getByRole('button', { name: 'Criar conta e mandar convite' }).click();
  await expect(venda.getByRole('link', { name: 'Mandar convite pelo WhatsApp' })).toHaveAttribute(
    'href',
    /^https:\/\/wa\.me\/5511966665555/,
  );
  await venda.getByRole('button', { name: 'Registrar pagamento agora' }).click();
  const fichaVenda = page.getByRole('dialog', { name: `Barbearia da Feira ${sufixoVenda}` });
  const pagar = fichaVenda.getByRole('form', { name: 'Registrar pagamento' });
  await pagar.getByRole('button', { name: 'Registrar pagamento' }).click();
  await expect(pagar.getByRole('status')).toHaveText('Feito. Ficou registrado no histórico.');
  await expect(fichaVenda.getByRole('table', { name: 'Cobranças da conta' })).toContainText(
    'Manual',
  );
  // Admin U3: próxima cobrança, ativação e notas da equipe.
  await expect(fichaVenda.getByText('Próxima cobrança')).toBeVisible();
  await expect(fichaVenda.getByText(/de \d primeiros passos/)).toBeVisible();
  await fichaVenda
    .getByLabel('Nova nota')
    .fill('Combinado: ligar na sexta para ajudar com a agenda.');
  await fichaVenda.getByRole('button', { name: 'Salvar nota' }).click();
  await expect(fichaVenda.getByRole('list', { name: 'Notas da conta' })).toContainText(
    'Combinado: ligar na sexta',
  );
  await fichaVenda.getByRole('button', { name: 'Fechar' }).click();
  await page.getByRole('tab', { name: 'Vendas' }).click();
  await expect(page.getByRole('table', { name: 'Vendas por vendedor' })).toContainText('Ana Teste');
  await expect(page.getByRole('table', { name: 'Vendas por origem' })).toBeVisible();
  await page.getByRole('tab', { name: 'Cobrança' }).click();
  await expect(page.getByRole('heading', { name: 'Cobrança', exact: true })).toBeVisible();
  await page.getByLabel('Ver', { exact: true }).selectOption('recebidas');
  await expect(page.getByRole('table', { name: 'Cobranças recebidas' })).toContainText(
    `Barbearia da Feira ${sufixoVenda}`,
  );

  // Equipe: dá acesso a um vendedor (senha aparece uma vez) e a auditoria registra.
  await page.getByRole('tab', { name: 'Equipe' }).click();
  const darAcesso = page.getByRole('form', { name: 'Dar acesso' });
  await darAcesso.getByLabel('Nome').fill('Vítor Vendas');
  await darAcesso.getByLabel('E-mail').fill(`vitor-${sufixoVenda}@pentefino.dev`);
  await darAcesso.getByRole('button', { name: 'Criar acesso' }).click();
  const pronto = page.getByRole('dialog', { name: 'Acesso pronto' });
  await expect(pronto).toContainText(`vitor-${sufixoVenda}@pentefino.dev`);
  await pronto.getByRole('button', { name: 'Fechar' }).click();
  const equipe = page.getByRole('table', { name: 'Equipe da plataforma' });
  await expect(
    equipe.getByRole('row', { name: new RegExp(`vitor-${sufixoVenda}@`) }),
  ).toContainText('Falta configurar');
  await equipe
    .getByRole('row', { name: new RegExp(`vitor-${sufixoVenda}@`) })
    .getByRole('button', { name: 'Desativar' })
    .click();
  // Admin U6: desativar pede o motivo.
  const desativar = page.getByRole('dialog', { name: /^Desativar / });
  await desativar.getByLabel('Motivo').fill('Teste da equipe');
  await desativar.getByRole('button', { name: 'Desativar' }).click();
  await expect(
    equipe.getByRole('row', { name: new RegExp(`vitor-${sufixoVenda}@`) }),
  ).toContainText('Desativado');
  await page.getByRole('tab', { name: 'Auditoria' }).click();
  await page.getByRole('combobox', { name: 'Ação', exact: true }).selectOption('criar_membro');
  await expect(page.getByRole('table', { name: 'Auditoria da plataforma' })).toContainText(
    `vitor-${sufixoVenda}@pentefino.dev`,
  );
  // Admin U7: detalhe legível (sem JSON) e exportação em CSV.
  await expect(page.getByRole('table', { name: 'Auditoria da plataforma' })).not.toContainText(
    '{"',
  );
  const [csv] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar CSV' }).click(),
  ]);
  expect(csv.suggestedFilename()).toMatch(/^auditoria-pente-fino-\d{4}-\d{2}-\d{2}\.csv$/);

  // Configurações: aviso geral (vale 15 min) aparece para a barbearia; saúde do sistema.
  await page.getByRole('tab', { name: 'Configurações' }).click();
  const avisoGeral = page.getByRole('region', { name: 'Aviso geral' });
  const local = (ms: number) => new Date(ms - 3 * 3_600_000).toISOString().slice(0, 16);
  await avisoGeral.getByLabel('Texto').fill(`Novidade do teste ${sufixoVenda}`);
  await avisoGeral.getByLabel('De').fill(local(Date.now() - 60_000));
  await avisoGeral.getByLabel('Até').fill(local(Date.now() + 15 * 60_000));
  await avisoGeral.getByRole('button', { name: 'Publicar aviso' }).click();
  await expect(avisoGeral.getByRole('status')).toHaveText('Salvo.');
  const outroNavegador = await browser.newContext();
  const barbearia = await outroNavegador.newPage();
  await barbearia.goto('/entrar');
  await barbearia.getByLabel('E-mail').fill('gestor@demo.pentefino.dev');
  await barbearia.getByLabel('Senha').fill('pentefino123');
  await barbearia.getByRole('button', { name: 'Entrar' }).click();
  await expect(barbearia.getByText(`Novidade do teste ${sufixoVenda}`)).toBeVisible();
  await outroNavegador.close();
  await avisoGeral.getByRole('button', { name: 'Tirar o aviso' }).click();
  await expect(avisoGeral.getByRole('button', { name: 'Tirar o aviso' })).toHaveCount(0);
  const smtp = page.getByRole('region', { name: 'E-mail (SMTP)' });
  await expect(smtp).toContainText('SMTP do .env');
  await smtp.getByRole('button', { name: 'Mandar e-mail de teste' }).click();
  await expect(smtp.getByText(/O servidor aceitou o e-mail/)).toBeVisible({ timeout: 15_000 });
  await expect(smtp.getByText(/Resposta do servidor: 250/)).toBeVisible();
  // Testar conexão usa o que está nos campos, antes de salvar.
  await smtp.getByLabel('Servidor', { exact: true }).fill('127.0.0.1');
  await smtp.getByLabel('Porta', { exact: true }).fill('1');
  await smtp.getByRole('button', { name: 'Testar conexão' }).click();
  await expect(smtp.getByRole('alert')).toContainText('porta 1', { timeout: 15_000 });
  const precos = page.getByRole('region', { name: 'Planos e preços' });
  await expect(precos.getByRole('table', { name: 'Tabelas de preço' })).toContainText('Em vigor');
  await expect(precos.getByRole('form', { name: 'Nova tabela de preços' })).toBeVisible();
  // Cupom: cria, vê o desconto no cadastro do site e desativa.
  const cupons = page.getByRole('region', { name: 'Cupons' });
  const codigoCupom = `PW${sufixoVenda.toUpperCase()}`.slice(0, 20);
  const novoCupom = cupons.getByRole('form', { name: 'Novo cupom' });
  await novoCupom.getByLabel('Código').fill(codigoCupom);
  await novoCupom.getByLabel('Desconto (%)').fill('25');
  await novoCupom.getByRole('button', { name: 'Salvar cupom' }).click();
  await expect(cupons.getByRole('table', { name: 'Cupons' })).toContainText(codigoCupom);
  const site = await browser.newContext();
  const cadastro = await site.newPage();
  await cadastro.goto(`/cadastro?cupom=${codigoCupom.toLowerCase()}`);
  await cadastro.getByLabel('Cupom de desconto (opcional)').focus();
  await cadastro.getByLabel('Cupom de desconto (opcional)').blur();
  await expect(cadastro.getByText(/^25% de desconto para sempre aplicado/)).toBeVisible();
  await site.close();
  await cupons
    .getByRole('row', { name: new RegExp(codigoCupom) })
    .getByRole('button', { name: 'Desativar' })
    .click();
  await expect(cupons.getByRole('row', { name: new RegExp(codigoCupom) })).toContainText(
    'Desativado',
  );
  // Nota fiscal (admin R2): o Asaas de teste tem os dados fiscais completos.
  const nota = page.getByRole('region', { name: 'Nota fiscal das mensalidades' });
  await expect(nota.getByText('Tudo conferido: a emissão pode ser ligada.')).toBeVisible();
  await expect(nota.getByRole('button', { name: 'Conferir de novo no Asaas' })).toBeVisible();
  const modelos = page.getByRole('region', { name: 'Modelos de e-mail' });
  await modelos.getByLabel('E-mail', { exact: true }).selectOption('pagamento_recebido');
  await modelos.getByLabel('Assunto').fill('Pagamento da {{conta}} recebido');
  await expect(modelos.getByRole('figure', { name: 'Pré-visualização' })).toContainText(
    'Pagamento da Barbearia do Carlos recebido',
  );
  await page.getByRole('tab', { name: 'Saúde do sistema' }).click();
  await expect(page.getByRole('table', { name: 'Filas' })).toContainText('E-mails');
  await expect(page.getByRole('heading', { name: 'E-mails que não saíram' })).toBeVisible();
  // Admin R10: mudar o endereço com a página aberta troca a aba (antes ficava em Saúde).
  await page.evaluate(() => {
    window.location.hash = 'contas';
  });
  await expect(page.getByRole('heading', { name: 'Contas', level: 1 })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('table', { name: 'Filas' })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Nota fiscal das mensalidades' }).getByText(/Emissão/),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Início' }).click();

  // A sessão da barbearia não existe aqui, e a da administração não abre o painel.
  await page.goto('/app');
  await expect(page).toHaveURL(/\/entrar/);
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page.getByRole('heading', { name: 'Entrar na administração' })).toBeVisible();
});
