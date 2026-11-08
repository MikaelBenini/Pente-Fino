// Grava as cenas do vídeo de apresentação com a conta de demonstração (docs: apps/web/video/LEIAME.md).
//   VIDEO_BASE=http://localhost:3200 node video/gravar.mjs
// Saída: video-tmp/cenas/*.webm e video-tmp/cenas/manifesto.json, que o editar.mjs junta.
import { chromium, devices } from '@playwright/test';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abertura, encerramento, fundoCelular } from './cartoes.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SAIDA = path.resolve(AQUI, '../video-tmp/cenas');
const B = process.env.VIDEO_BASE ?? 'http://localhost:3200';
const SENHA = 'pentefino123';
const DESKTOP = { width: 1280, height: 720 };
const CELULAR = { width: 390, height: 844 };
const estudio = await readFile(path.join(AQUI, 'estudio.js'), 'utf8');

await rm(SAIDA, { recursive: true, force: true });
await mkdir(SAIDA, { recursive: true });
const navegador = await chromium.launch();
const manifesto = [];
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** Sessão salva (sem gravar o login). */
async function sessao(email, opcoes) {
  const ctx = await navegador.newContext(opcoes);
  const p = await ctx.newPage();
  await p.goto(`${B}/entrar`);
  await p.getByLabel('E-mail').fill(email);
  await p.getByLabel('Senha').fill(SENHA);
  await p.getByRole('button', { name: 'Entrar' }).click();
  await p.waitForURL(/inicio|agenda|hoje|dia/);
  const estado = await ctx.storageState();
  await ctx.close();
  return estado;
}

/** Uma cena: contexto gravando, a ação e o recorte (do marcar() até o fim). */
async function cena(nome, { tamanho = DESKTOP, contexto = {}, extra = {} }, acao) {
  const ctx = await navegador.newContext({
    viewport: tamanho,
    colorScheme: 'dark',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    recordVideo: { dir: SAIDA, size: tamanho },
    ...contexto,
  });
  await ctx.addInitScript(estudio);
  const page = await ctx.newPage();
  const t0 = Date.now();
  let inicio = 0;
  const marcar = () => {
    inicio = (Date.now() - t0) / 1000;
  };
  await acao(page, marcar);
  const fim = (Date.now() - t0) / 1000;
  const video = page.video();
  await ctx.close();
  const arquivo = path.join(SAIDA, `${nome}.webm`);
  await rename(await video.path(), arquivo);
  manifesto.push({ nome, arquivo, inicio, duracao: +(fim - inicio).toFixed(2), ...extra });
  console.log(`cena ${nome}: ${(fim - inicio).toFixed(1)} s`);
}

// ─── Ajudantes de direção ─────────────────────────────────────────────────

async function mover(page, alvo, passos = 28) {
  await alvo.scrollIntoViewIfNeeded();
  const c = await alvo.boundingBox();
  if (!c) return;
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: passos });
  await espera(250);
}
async function clicar(page, alvo, pausa = 600) {
  await mover(page, alvo);
  await alvo.click();
  await espera(pausa);
}
const legenda = (page, titulo, sub, compacta = false, topo = false) =>
  page.evaluate(
    ([t, s, c, o]) => window.__estudio.legenda(t, s, c, o),
    [titulo, sub, compacta, topo],
  );
const limpar = (page) => page.evaluate(() => window.__estudio.limpar());
async function focar(page, alvo) {
  const c = await alvo.boundingBox();
  if (c) await page.evaluate((r) => window.__estudio.focar(r.x, r.y, r.width, r.height), c);
}
const desfocar = (page) => page.evaluate(() => window.__estudio.desfocar());
async function rolarSuave(page, px, passos = 20) {
  for (let i = 0; i < passos; i++) {
    await page.mouse.wheel(0, px / passos);
    await espera(25);
  }
}

// ─── Dados da gravação: um horário de amanhã com o Rafael, para lançar e fechar ──

const dono = await sessao('dono@demo.pentefino.dev', { viewport: DESKTOP });
const barbeiro = await sessao('rafael@demo.pentefino.dev', { ...devices['iPhone 13'] });
const ctxApi = await navegador.newContext({ storageState: dono });
async function api(metodo, url, corpo) {
  const r = await ctxApi.request.fetch(`${B}/api/${url}`, {
    method: metodo,
    data: corpo,
    headers: { origin: B, 'content-type': 'application/json' },
  });
  if (!r.ok()) throw new Error(`${metodo} ${url}: ${r.status()} ${await r.text()}`);
  return r.json();
}
const unidades = await api('GET', 'unidades');
const centro = unidades.find((u) => u.nome === 'Centro') ?? unidades[0];
const profs = await api('GET', `profissionais?unidadeId=${centro.id}`);
const rafael = (Array.isArray(profs) ? profs : profs.profissionais).find((p) =>
  /Rafael/.test(p.nome),
);
const servicos = await api('GET', 'servicos');
const corte = (Array.isArray(servicos) ? servicos : servicos.servicos).find(
  (s) => s.nome === 'Corte',
);
let dia = new Date(Date.now() + 86_400_000);
let inicio = null;
for (let i = 0; i < 6 && !inicio; i++, dia = new Date(dia.getTime() + 86_400_000)) {
  const livres = await api(
    'GET',
    `agenda/horarios-livres?unidadeId=${centro.id}&data=${dia.toISOString().slice(0, 10)}&duracaoMin=30&profissionalId=${rafael.id}`,
  );
  inicio = livres[0]?.inicios?.[3] ?? null;
}
const comanda = await api('POST', 'agendamentos', {
  unidadeId: centro.id,
  profissionalId: rafael.id,
  clienteNovo: { nome: 'Lucas Andrade', telefone: '11987654321' },
  inicio,
  servicoIds: [corte.id],
});
await ctxApi.close();
const diaDoHorario = inicio.slice(0, 10);

// ─── Cenas ────────────────────────────────────────────────────────────────

await cena('01-abertura', {}, async (page, marcar) => {
  await page.setContent(abertura(), { waitUntil: 'networkidle' });
  await page.evaluate(() => window.__estudio.esconderCursor());
  marcar();
  await espera(4800);
});

await cena('02-agenda', { contexto: { storageState: dono } }, async (page, marcar) => {
  await page.goto(`${B}/agenda`);
  await page
    .getByRole('combobox', { name: 'Unidade' })
    .last()
    .selectOption({ label: 'Centro' })
    .catch(() => {});
  // Vai até o dia do horário do Lucas.
  for (let i = 0; i < 7; i++) {
    if (await page.getByRole('button', { name: /Lucas Andrade/ }).count()) break;
    await page.getByRole('button', { name: 'Próximo' }).first().click();
    await espera(700);
  }
  await page.mouse.move(700, 300);
  await espera(600);
  marcar();
  await legenda(
    page,
    'A agenda de toda a equipe',
    'Cada horário marcado já vira uma comanda prevista.',
  );
  await espera(1600);
  const horario = page.getByRole('button', { name: /Lucas Andrade/ }).first();
  await mover(page, horario, 40);
  await focar(page, horario);
  await espera(2200);
  await desfocar(page);
  await clicar(page, page.getByRole('radio', { name: /semana/i }), 1500);
  await clicar(page, page.getByRole('radio', { name: /^dia$/i }), 900);
  await limpar(page);
  await espera(500);
});

await cena(
  '03-celular',
  {
    tamanho: CELULAR,
    contexto: { ...devices['iPhone 13'], viewport: CELULAR, storageState: barbeiro },
    extra: {
      celular: true,
      fundo: fundoCelular({
        titulo: 'Lançou na hora, está na comanda',
        itens: [
          'Abre o atendimento do cliente',
          'Toca no extra que fez',
          'Confirma: a recepção já vê',
        ],
      }),
    },
  },
  async (page, marcar) => {
    await page.goto(`${B}/comandas?id=${comanda.id}`);
    await page.getByText('Lucas Andrade').first().waitFor();
    await page.mouse.move(195, 420);
    await espera(800);
    marcar();
    await espera(1400);
    const extra = page.getByRole('button', { name: /Pezinho/ }).first();
    await clicar(page, extra, 1600);
    await rolarSuave(page, -900);
    await espera(1300);
    await clicar(page, page.getByRole('button', { name: 'Confirmar atendimento' }), 2200);
    await espera(1200);
  },
);

await cena('04-recepcao', { contexto: { storageState: dono } }, async (page, marcar) => {
  await page.goto(`${B}/comandas?id=${comanda.id}`);
  await page.getByText('Lucas Andrade').first().waitFor();
  await page.mouse.move(640, 400);
  await espera(800);
  marcar();
  await legenda(
    page,
    'A recepção recebe e fecha',
    'Lançou uma vez: entra no caixa, na comissão e no lucro.',
  );
  await espera(1200);
  await clicar(page, page.getByRole('button', { name: 'Receber e fechar' }), 1400);
  const dialogo = page.getByRole('dialog', { name: 'Receber e fechar' });
  await mover(page, dialogo.getByRole('button', { name: 'Continuar' }));
  await espera(700);
  await dialogo.getByRole('button', { name: 'Continuar' }).click();
  await espera(1200);
  await clicar(page, page.getByRole('button', { name: 'Fechar comanda' }), 2200);
  await limpar(page);
  await espera(400);
});

await cena('05-lucro', { contexto: { storageState: dono } }, async (page, marcar) => {
  await page.goto(`${B}/financeiro`);
  await page.getByText('Resultado do mês').first().waitFor();
  await page.getByRole('button', { name: 'Mês anterior' }).first().click();
  await page
    .getByText(/Outubro|outubro/)
    .first()
    .waitFor();
  await espera(800);
  await page.mouse.move(520, 420);
  marcar();
  await legenda(
    page,
    'Saiba quanto sobra',
    'Não só quanto entrou: comissões e despesas já descontadas.',
    false,
    true,
  );
  await espera(1500);
  const lucro = page.getByText('Lucro do mês').first().locator('..');
  await mover(page, lucro, 36);
  await focar(page, lucro);
  await espera(3200);
  await desfocar(page);
  await limpar(page);
  await espera(400);
});

await cena('06-metricas', { contexto: { storageState: dono } }, async (page, marcar) => {
  await page.goto(`${B}/metricas`);
  await page.getByRole('button', { name: 'Mês anterior' }).first().click();
  await espera(1500);
  const produtos = page.getByText('Mais lucro', { exact: true }).filter({ visible: true }).first();
  await produtos.scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, -120);
  await espera(800);
  await page.mouse.move(640, 300);
  marcar();
  await legenda(
    page,
    'O que dá mais lucro',
    'Cada produto com lucro, margem e o que fazer.',
    true,
    true,
  );
  await espera(1200);
  await mover(
    page,
    page.getByText('Investir', { exact: true }).filter({ visible: true }).first(),
    34,
  );
  await espera(1500);
  await mover(
    page,
    page.getByText('Rever preço', { exact: true }).filter({ visible: true }).first(),
    30,
  );
  await espera(1300);
  await limpar(page);
  await rolarSuave(page, 520, 30);
  await legenda(
    page,
    'Onde a agenda tem buraco',
    'O mapa da semana mostra a hora para promoção ou folga.',
    true,
    true,
  );
  await page.mouse.move(820, 520, { steps: 30 });
  await espera(2600);
  await limpar(page);
  await espera(400);
});

await cena('07-whatsapp', { contexto: { storageState: dono } }, async (page, marcar) => {
  await page.goto(`${B}/bot`);
  await page.getByRole('tab', { name: 'Testar' }).click();
  const campo = page.getByRole('textbox').last();
  await campo.waitFor();
  await page
    .getByRole('button', { name: 'Recomeçar conversa' })
    .click()
    .catch(() => {});
  await espera(800);
  await page.mouse.move(900, 600);
  marcar();
  await legenda(
    page,
    'O cliente marca sozinho',
    'Pelo WhatsApp, a qualquer hora, e já pode somar serviços.',
    true,
    true,
  );
  for (const [texto, pausa] of [
    ['oi', 1500],
    ['1', 1300],
    ['1', 1300],
    ['2', 1700],
    ['1', 1500],
    ['1', 1300],
    ['1', 1300],
    ['1', 2200],
  ]) {
    await mover(page, campo, 12);
    await campo.pressSequentially(texto, { delay: 90 });
    await campo.press('Enter');
    await espera(pausa);
  }
  await limpar(page);
  await espera(500);
});

await cena('08-encerramento', {}, async (page, marcar) => {
  await page.setContent(encerramento(), { waitUntil: 'networkidle' });
  await page.evaluate(() => window.__estudio.esconderCursor());
  marcar();
  await espera(5200);
});

// Fundo da cena do celular, com a mesma duração da gravação do aparelho.
const cel = manifesto.find((c) => c.celular);
if (cel) {
  await cena('03-celular-fundo', {}, async (page, marcar) => {
    await page.setContent(cel.fundo, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.__estudio.esconderCursor());
    marcar();
    await espera(cel.duracao * 1000);
  });
  const fundo = manifesto.pop();
  cel.fundoArquivo = fundo.arquivo;
  cel.fundoInicio = fundo.inicio;
  delete cel.fundo;
}

await writeFile(
  path.join(SAIDA, 'manifesto.json'),
  JSON.stringify({ dia: diaDoHorario, cenas: manifesto }, null, 2),
);
await navegador.close();
console.log('manifesto pronto');
