// Fotos das telas para o site (public/site/*.webp), tiradas da conta de demonstração.
//   ./video/banco.sh && ./video/servidores.sh   (em outro terminal)
//   node video/telas.mjs
import { chromium, devices } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { gerarVariantes } from './variantes.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DESTINO = path.resolve(AQUI, '../public/site');
const B = process.env.VIDEO_BASE ?? 'http://localhost:3200';
await mkdir(DESTINO, { recursive: true });
const navegador = await chromium.launch();
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function entrar(email, opcoes) {
  const ctx = await navegador.newContext({ colorScheme: 'dark', locale: 'pt-BR', ...opcoes });
  const p = await ctx.newPage();
  await p.goto(`${B}/entrar`);
  await p.getByLabel('E-mail').fill(email);
  await p.getByLabel('Senha').fill('pentefino123');
  await p.getByRole('button', { name: 'Entrar' }).click();
  await p.waitForURL(/inicio|agenda|hoje|dia/);
  return { ctx, p };
}

/** Salva a foto em WebP, na largura pedida (o PNG vem em 2x). */
async function salvar(p, nome, largura, recorte) {
  // Sem as faixas do topo (cliente esperando atendente, aviso de e-mail) nas fotos.
  await p.evaluate(() => {
    for (const el of document.querySelectorAll('[role="status"]'))
      if (/esperando atendente|Confirme seu e-mail|WhatsApp caiu/.test(el.textContent ?? ''))
        el.remove();
  });
  await espera(600);
  const png = await p.screenshot(recorte ? { clip: recorte } : {});
  await sharp(png)
    .resize({ width: largura })
    .webp({ quality: 84 })
    .toFile(path.join(DESTINO, `${nome}.webp`));
  console.log(`site/${nome}.webp`);
}

const desktop = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 };

{
  const { ctx, p } = await entrar('dono@demo.pentefino.dev', desktop);
  await p.goto(`${B}/financeiro`);
  await p.getByRole('button', { name: 'Mês anterior' }).first().click();
  await p
    .getByText(/outubro/i)
    .first()
    .waitFor();
  await salvar(p, 'financeiro', 1600, { x: 0, y: 0, width: 1440, height: 760 });

  await p.goto(`${B}/metricas`);
  await p.getByRole('button', { name: 'Mês anterior' }).first().click();
  await espera(1500);
  const produtos = p.getByText('Mais lucro', { exact: true }).filter({ visible: true }).first();
  await produtos.scrollIntoViewIfNeeded();
  await p.mouse.wheel(0, -160);
  await salvar(p, 'lucro-produtos', 1600);

  // Último dia útil com atendimentos (volta até achar comandas na agenda).
  await p.goto(`${B}/agenda`);
  await espera(1200);
  for (let i = 0; i < 7; i++) {
    if ((await p.getByText('Fechada', { exact: true }).count()) > 3) break;
    await p.getByRole('button', { name: 'Anterior' }).first().click();
    await espera(900);
  }
  await salvar(p, 'agenda', 1600);

  // Caixa do mesmo dia: usa a data que a agenda mostrou.
  const dia = await p.evaluate(() => {
    const t = document.querySelector('main h2, main p.font-semibold')?.textContent ?? '';
    return t;
  });
  console.log('dia da agenda:', dia);

  await p.goto(`${B}/metricas`);
  await p.getByRole('button', { name: 'Mês anterior' }).first().click();
  await espera(1800);
  await salvar(p, 'metas', 1600, { x: 0, y: 0, width: 1440, height: 760 });
  await ctx.close();
}

{
  // Um horário de amanhã com o Rafael, para a foto da comanda com os extras para lançar.
  const { ctx: ctxDono } = await entrar('dono@demo.pentefino.dev', desktop);
  const api = async (metodo, url, corpo) => {
    const r = await ctxDono.request.fetch(`${B}/api/${url}`, {
      method: metodo,
      data: corpo,
      headers: { origin: B, 'content-type': 'application/json' },
    });
    if (!r.ok()) throw new Error(`${metodo} ${url}: ${r.status()}`);
    return r.json();
  };
  const centro = (await api('GET', 'unidades')).find((u) => u.nome === 'Centro');
  const profs = await api('GET', `profissionais?unidadeId=${centro.id}`);
  const rafael = (Array.isArray(profs) ? profs : profs.profissionais).find((x) =>
    /Rafael/.test(x.nome),
  );
  const servicos = await api('GET', 'servicos');
  const lista = Array.isArray(servicos) ? servicos : servicos.servicos;
  const ids = ['Corte', 'Barba'].map((n) => lista.find((x) => x.nome === n).id);
  let inicio = null;
  for (let i = 1; i < 7 && !inicio; i++) {
    const dia = new Date(Date.now() + i * 86_400_000).toISOString().slice(0, 10);
    const livres = await api(
      'GET',
      `agenda/horarios-livres?unidadeId=${centro.id}&data=${dia}&duracaoMin=60&profissionalId=${rafael.id}`,
    );
    inicio = livres[0]?.inicios?.[4] ?? null;
  }
  const comanda = await api('POST', 'agendamentos', {
    unidadeId: centro.id,
    profissionalId: rafael.id,
    clienteNovo: { nome: 'Gustavo Lima', telefone: '11976543210' },
    inicio,
    servicoIds: ids,
  });
  await ctxDono.close();

  const celular = { ...devices['iPhone 13'], deviceScaleFactor: 3 };
  const { ctx, p } = await entrar('rafael@demo.pentefino.dev', celular);
  await p.goto(`${B}/comandas?id=${comanda.id}`);
  await p.getByText('Gustavo Lima').first().waitFor();
  await p
    .getByRole('button', { name: /Pezinho/ })
    .first()
    .click();
  await espera(1500);
  await salvar(p, 'celular-comanda', 780);
  await p.goto(`${B}/desempenho`);
  await espera(2000);
  await salvar(p, 'celular-desempenho', 780);
  await ctx.close();
}

await navegador.close();
// Site D1: a versão menor de cada foto, para o celular.
await gerarVariantes();
