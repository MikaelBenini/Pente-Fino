import { expect, test } from '@playwright/test';

// App do barbeiro sem internet: lança, reconecta, envia (Etapa 7).
const SENHA = 'pentefino123';

function proximoDiaUtil(): string {
  const hojeSp = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
    new Date(),
  );
  const d = new Date(`${hojeSp}T12:00:00Z`);
  for (;;) {
    d.setUTCDate(d.getUTCDate() + 1);
    const iso = d.toISOString().slice(0, 10);
    if (d.getUTCDay() !== 0 && !/-11-(02|15)$/.test(iso)) return iso;
  }
}

test('barbeiro lança um extra sem internet e ele sobe quando o sinal volta', async ({
  browser,
}, info) => {
  test.skip(info.project.name !== 'celular', 'cenário do celular do barbeiro');

  // A recepção agenda um cliente para o Rafael pela API (mesma ponte /api da tela).
  const base = info.project.use.baseURL!;
  // Pedidos diretos precisam do Origin do próprio site: a ponte /api recusa alteração sem origem (CSRF).
  const recepcao = await browser.newContext({ baseURL: base, extraHTTPHeaders: { origin: base } });
  const r = recepcao.request;
  await r.post('/api/auth/login', {
    data: { email: 'recepcao.centro@demo.pentefino.dev', senha: SENHA },
  });
  const profissionais = (await (await r.get('/api/profissionais')).json()) as {
    id: string;
    nome: string;
    unidadeId: string;
  }[];
  const rafael = profissionais.find((p) => p.nome === 'Rafael Moura')!;
  const servicos = (await (await r.get('/api/servicos')).json()) as { id: string; nome: string }[];
  const corte = servicos.find((s) => s.nome === 'Corte')!;
  const dia = proximoDiaUtil();
  const livres = (await (
    await r.get(
      `/api/agenda/horarios-livres?unidadeId=${rafael.unidadeId}&data=${dia}&duracaoMin=30&profissionalId=${rafael.id}`,
    )
  ).json()) as { inicios: string[] }[];
  const agendado = await r.post('/api/agendamentos', {
    data: {
      unidadeId: rafael.unidadeId,
      profissionalId: rafael.id,
      clienteNovo: { nome: `Sem Sinal ${Date.now().toString(36)}` },
      inicio: livres[0]!.inicios.at(-1),
      servicoIds: [corte.id],
    },
  });
  expect(agendado.status()).toBe(201);
  const { id: comandaId } = (await agendado.json()) as { id: string };
  await recepcao.close();

  // O barbeiro abre a comanda no celular.
  const contexto = await browser.newContext({
    ...info.project.use,
    baseURL: info.project.use.baseURL,
  });
  const page = await contexto.newPage();
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('rafael@demo.pentefino.dev');
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/hoje/);
  await page.goto(`/comandas?id=${comandaId}`);
  await expect(page.getByRole('button', { name: 'Sobrancelha' })).toBeVisible();

  // Sem sinal: o lançamento fica no aparelho.
  await contexto.setOffline(true);
  await page.getByRole('button', { name: 'Sobrancelha' }).click();
  await expect(
    page.getByText('Sobrancelha guardado neste aparelho. Sobe quando a internet voltar.'),
  ).toBeVisible();
  await expect(page.getByText(/Sem internet\. 1 lançamento aguarda envio/)).toBeVisible();
  await expect(page.getByRole('list').getByText('Sobrancelha')).toHaveCount(0);

  // O sinal volta: envia sozinho e a comanda mostra o extra.
  await contexto.setOffline(false);
  await expect(page.getByRole('listitem').filter({ hasText: 'Sobrancelha' })).toContainText(
    'Extra',
    { timeout: 15_000 },
  );
  await expect(page.getByText(/Sem internet/)).toHaveCount(0);
  await contexto.close();
});
