import { expect, test, type Page } from '@playwright/test';

// Etapa 6C nas telas: Início, Financeiro, Resultados do mês e o app do barbeiro.
const SENHA = 'pentefino123';

async function entrar(page: Page, email: string) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio|agenda|hoje/);
}

test('dono: início com metas e indicadores; financeiro e resultados do mês', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'celular', 'painel da gestão no computador');
  await entrar(page, 'dono@demo.pentefino.dev');
  await expect(page.getByRole('heading', { name: 'Início' })).toBeVisible();
  await expect(page.getByRole('meter').first()).toBeVisible();
  for (const rotulo of [
    'Faturamento',
    'Lucro',
    'Clientes',
    'Ticket médio',
    'Atendimentos',
    'Extras',
    'Custos sobre o faturamento',
  ]) {
    await expect(page.getByRole('heading', { name: rotulo, exact: true })).toBeVisible();
  }

  await page.goto('/financeiro');
  await expect(page.getByText('Lucro do mês')).toBeVisible();
  await page.getByRole('tab', { name: 'Despesas' }).click();
  await expect(page.getByRole('row', { name: /Aluguel Centro/ })).toBeVisible();
  await page.getByRole('tab', { name: 'Comissões' }).click();
  const linha = page.getByRole('row', { name: /Rafael Moura/ });
  await expect(linha).toBeVisible();
  await linha.getByRole('button', { name: 'Extrato' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Extrato de Rafael Moura' }).getByRole('table'),
  ).toBeVisible();
  await page
    .getByRole('dialog', { name: 'Extrato de Rafael Moura' })
    .getByRole('button', { name: 'Fechar' })
    .click();

  await page.goto('/resultados');
  await expect(page.getByRole('heading', { name: 'Resultados do mês', level: 1 })).toBeVisible();
  // Visão geral: metas, o mês em números contra o anterior e as frases.
  await expect(page.getByRole('heading', { name: 'O mês em números' })).toBeVisible();
  await expect(page.getByText('Agenda ocupada', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'O que melhorou' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'PDF' })).toHaveAttribute(
    'href',
    /\/api\/relatorio\/mes\/arquivo\?mes=\d{4}-\d{2}&formato=pdf/,
  );

  // Serviços e produtos: uma tabela de cada, com o peso e o lucro.
  await page.getByRole('tab', { name: 'Serviços e produtos' }).click();
  await expect(page).toHaveURL(/aba=itens/);
  const servicos = page.getByRole('table', { name: 'Serviços do mês' }).filter({ visible: true });
  await expect(servicos.getByRole('row', { name: /^Corte\b/ }).first()).toBeVisible();
  await expect(servicos.getByRole('columnheader', { name: 'Margem' })).toBeVisible();
  // Mais feitos: o primeiro é o que mais saiu no mês.
  await page.getByLabel('Ordenar por').filter({ visible: true }).selectOption('quantidade');
  const qtdes = await servicos
    .locator('tbody tr td:nth-child(2)')
    // Só o número da célula (a fatia "x% dos feitos" vem logo abaixo dele).
    .evaluateAll((tds) =>
      tds.map((t) => Number(t.querySelector('span')!.firstChild!.textContent!.replace(/\D/g, ''))),
    );
  expect(qtdes).toEqual([...qtdes].sort((a, b) => b - a));
  await expect(page.getByText('Mais vendido', { exact: true })).toBeVisible();
  const produtos = page.getByRole('table', { name: 'Produtos do mês' }).filter({ visible: true });
  await expect(produtos.getByRole('row').nth(1)).toContainText(
    /Investir|Divulgar|Rever preço|Repensar|Parado/,
  );

  // Canais: a demonstração tem horários do balcão, do WhatsApp e do site.
  await page.getByRole('tab', { name: 'Canais' }).click();
  const canais = page
    .getByRole('table', { name: 'Atendimentos por canal' })
    .filter({ visible: true });
  await expect(canais).toContainText('WhatsApp');
  await expect(canais).toContainText('Balcão');
  await expect(canais.getByRole('columnheader', { name: 'Mês anterior' })).toBeVisible();

  await page.getByRole('tab', { name: 'Agenda e avaliações' }).click();
  // Avaliações dos clientes: notas do atendimento e da barbearia (demonstração tem respostas).
  const avaliacoes = page.getByRole('region', { name: 'Avaliações dos clientes' });
  await expect(avaliacoes.getByRole('list', { name: 'Notas de atendimento' })).toBeVisible();
  await expect(avaliacoes.getByRole('list', { name: 'Notas de barbearia' })).toBeVisible();
  // Nota baixa ainda aberta (a demonstração sorteia algumas): resolver com a anotação.
  const resolver = avaliacoes.getByRole('button', { name: 'Marcar como resolvida' });
  if (info.project.name === 'computador' && (await resolver.count()) > 0) {
    await resolver.first().click();
    await avaliacoes.getByLabel('O que foi feito').fill('Liguei e pedi desculpas.');
    await avaliacoes.getByRole('button', { name: 'Salvar como resolvida' }).click();
    await expect(avaliacoes.getByText(/Liguei e pedi desculpas\./).first()).toBeVisible();
  }
});

test('dono lança uma despesa e ela aparece no mês', async ({ page }, info) => {
  test.skip(info.project.name === 'celular', 'cadastro no computador');
  const descricao = `Conta de gás ${Date.now().toString(36)}`;
  await entrar(page, 'dono@demo.pentefino.dev');
  await page.goto('/financeiro');
  await page.getByRole('tab', { name: 'Despesas' }).click();
  await page.getByRole('button', { name: 'Nova despesa' }).click();
  const d = page.getByRole('dialog', { name: 'Nova despesa' });
  await d.getByLabel('Descrição').fill(descricao);
  await d.getByLabel('Categoria').selectOption({ label: 'Variável · Água' });
  await d.getByLabel('Valor (R$)').fill('123,45');
  await d.getByRole('button', { name: 'Lançar despesa' }).click();
  const linha = page.getByRole('row', { name: new RegExp(descricao) });
  await expect(linha).toContainText('R$ 123,45');
  await expect(linha).toContainText('A pagar');
  await linha.getByRole('button', { name: 'Marcar paga' }).click();
  await expect(linha).toContainText('Paga');
});

test('despesa que repete todo mês e a prévia de "Copiar fixas do mês anterior"', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'celular', 'cadastro no computador');
  const descricao = `Aluguel do depósito ${Date.now().toString(36)}`;
  await entrar(page, 'dono@demo.pentefino.dev');
  await page.goto('/financeiro');
  await page.getByRole('tab', { name: 'Despesas' }).click();
  await page.getByRole('button', { name: 'Nova despesa' }).click();
  const d = page.getByRole('dialog', { name: 'Nova despesa' });
  await d.getByLabel('Descrição').fill(descricao);
  await d.getByLabel('Valor (R$)').fill('900,00');
  await d.getByLabel(/Repetir todo mês/).check();
  await d.getByRole('button', { name: 'Lançar despesa' }).click();
  await expect(page.getByRole('row', { name: new RegExp(descricao) })).toContainText(
    'repete todo mês',
  );
  // A prévia abre sem gravar nada; o que já foi lançado à mão vem desmarcado.
  await page.getByRole('button', { name: 'Copiar fixas do mês anterior' }).click();
  const copia = page.getByRole('dialog', { name: 'Copiar fixas do mês anterior' });
  await expect(copia).toBeVisible();
  await copia
    .getByRole('button', { name: /^(Cancelar|Fechar)$/ })
    .first()
    .click();
  await expect(copia).toBeHidden();
});

test('barbeiro no celular: hoje (com as metas), comissões e desempenho', async ({ page }) => {
  await entrar(page, 'rafael@demo.pentefino.dev');
  await expect(page.getByRole('heading', { name: 'Olá, Rafael' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Comissão hoje' })).toBeVisible();
  await page.goto('/comissoes');
  await expect(page.getByRole('heading', { name: 'A receber' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Extrato de comissões' })).toBeVisible();
  await page.goto('/desempenho');
  await expect(page.getByRole('heading', { name: 'Ticket médio' })).toBeVisible();
  // As metas ficam no Hoje; o endereço antigo leva para lá.
  await page.goto('/metas');
  await page.waitForURL(/\/hoje$/);
  await expect(page.getByRole('meter').first()).toBeVisible();
  // Painel da gestão continua fora do alcance do barbeiro.
  await page.goto('/resultados');
  await expect(
    page.getByRole('heading', { name: 'Esta tela não faz parte do seu acesso' }),
  ).toBeVisible();
  await page.goto('/financeiro');
  await expect(
    page.getByRole('heading', { name: 'Esta tela não faz parte do seu acesso' }),
  ).toBeVisible();
});

test('gestor: agenda ocupada hora a hora no mês escolhido', async ({ page }) => {
  await entrar(page, 'gestor@demo.pentefino.dev');
  await page.goto('/resultados?aba=agenda');
  // Total e por faixa do dia (manhã, tarde, noite), e o mapa hora a hora.
  const card = page.getByRole('region', { name: 'Ocupação da agenda no mês' });
  await expect(card.getByRole('list', { name: 'Ocupação por faixa do dia' })).toContainText(
    /Manhã|Tarde/,
  );
  const mapa = page.getByRole('region', { name: 'Agenda ocupada, hora a hora' });
  await expect(mapa.getByRole('table')).toBeVisible();
  await expect(mapa.getByRole('columnheader', { name: 'Seg' })).toBeVisible();
  await expect(mapa.getByRole('list', { name: 'Mais vazios' })).toBeVisible();
  await expect(mapa.getByRole('list', { name: 'Mais cheios' })).toBeVisible();
  // Mês anterior: o mapa acompanha o mês escolhido.
  await page.getByRole('button', { name: 'Mês anterior' }).click();
  await expect(page).toHaveURL(/mes=\d{4}-\d{2}&aba=agenda/);
  await expect(mapa.getByRole('table')).toBeVisible();
});

test('dono: unidades lado a lado e o total, nos resultados do mês', async ({ page }, info) => {
  await entrar(page, 'dono@demo.pentefino.dev');
  // O endereço antigo do painel da rede leva para Resultados do mês.
  await page.goto('/rede');
  await page.waitForURL(/\/resultados$/);
  await expect(page.getByRole('heading', { name: 'Unidades lado a lado' })).toBeVisible();
  if (info.project.name === 'celular') {
    const cartoes = page.getByRole('list', { name: 'Unidades da rede no mês' });
    await expect(cartoes.getByRole('heading', { name: 'Centro' })).toBeVisible();
    await expect(cartoes.getByRole('heading', { name: 'Rede' })).toBeVisible();
    return;
  }
  const tabela = page.getByRole('table', { name: 'Unidades da rede no mês' });
  await expect(tabela.getByRole('rowheader', { name: 'Centro' })).toBeVisible();
  await expect(tabela.getByRole('rowheader', { name: 'Jardins' })).toBeVisible();
  await expect(tabela.getByRole('rowheader', { name: 'Rede' })).toBeVisible();
  for (const coluna of ['Faturamento', 'Lucro', 'Ticket médio', 'Ocupação', 'Nota média']) {
    await expect(tabela.getByRole('columnheader', { name: coluna })).toBeVisible();
  }
  // A demonstração tem movimento nas duas: alguma unidade leva o destaque de faturamento.
  await expect(tabela.getByLabel('melhor da rede').first()).toBeVisible();
});

test('plano Básico: recursos do Pro e do Premium aparecem com convite, sem quebrar a tela', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'celular', 'mesmas telas no computador');
  await entrar(page, 'basico@demo.pentefino.dev');
  await page.goto('/resultados');
  await expect(page.getByRole('heading', { name: 'Resultados do mês', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'O mês em números' })).toBeVisible();
  // Metas e barbeiros são do Pro; lucro de cada serviço e produto, do Premium.
  await expect(page.getByRole('note', { name: 'Disponível no plano Pro' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Definir meta' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Ver planos e mudar' }).first()).toHaveAttribute(
    'href',
    '/configuracoes?aba=assinatura',
  );
  await page.getByRole('tab', { name: 'Barbeiros' }).click();
  await expect(page.getByRole('note', { name: 'Disponível no plano Pro' })).toBeVisible();
  await page.getByRole('tab', { name: 'Serviços e produtos' }).click();
  await expect(page.getByRole('note', { name: 'Disponível no plano Premium' })).toContainText(
    'Seu plano é o Básico',
  );
  await expect(
    page.getByRole('table', { name: 'Serviços do mês' }).getByRole('columnheader', {
      name: 'Margem',
    }),
  ).toHaveCount(0);
  // Comissões vêm em todos os planos: o Básico abre a aba sem convite.
  await page.goto('/financeiro');
  await page.getByRole('tab', { name: 'Comissões' }).click();
  await expect(page.getByRole('tabpanel')).toBeVisible();
  await expect(page.getByRole('note', { name: /Disponível no plano/ })).toHaveCount(0);
});

test('o dono muda de plano sozinho: sobe na hora e desce confirmando o que perde', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'celular', 'a mesma conta nos dois aparelhos: um só basta');
  await entrar(page, 'basico@demo.pentefino.dev');
  await page.goto('/configuracoes?aba=assinatura');
  const secao = page.getByRole('region', { name: 'Mudar de plano' });
  await secao.getByRole('radio', { name: 'Pro' }).click();
  await expect(secao).toContainText('R$');
  await secao.getByRole('button', { name: 'Mudar para o Pro' }).click();
  await expect(secao.getByText('Pronto: a conta está no plano Pro.')).toBeVisible();
  // Já vale: o convite do Pro some dos resultados (o do Premium continua).
  await page.goto('/resultados?aba=itens');
  await expect(page.getByRole('note', { name: 'Disponível no plano Premium' })).toBeVisible();
  await expect(page.getByRole('note', { name: 'Disponível no plano Pro' })).toHaveCount(0);

  // Voltar ao Básico: mostra o que deixa de usar e pede confirmação.
  await page.goto('/configuracoes?aba=assinatura');
  const de_novo = page.getByRole('region', { name: 'Mudar de plano' });
  await de_novo.getByRole('radio', { name: 'Básico' }).click();
  const perde = de_novo.getByRole('list', { name: 'O que deixa de usar' });
  await expect(perde).toContainText('Metas por unidade');
  await expect(perde).not.toContainText('Comissão automática');
  await de_novo.getByRole('button', { name: 'Mudar para o Básico' }).click();
  await page
    .getByRole('dialog', { name: 'Mudar para o Básico?' })
    .getByRole('button', { name: 'Mudar para o Básico' })
    .click();
  await expect(de_novo.getByText('Pronto: a conta está no plano Básico.')).toBeVisible();
});
