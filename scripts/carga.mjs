// Teste de carga simples na agenda e nos indicadores (Etapa 7), com a conta de demonstração.
//   pnpm carga                      (API em http://localhost:3001)
//   CARGA_API=http://localhost:3101 CARGA_PEDIDOS=400 CARGA_SIMULTANEOS=20 pnpm carga
// Falha (código 1) se houver erro ou se o p95 passar de CARGA_P95_MS (padrão 1500 ms).
const API = (process.env.CARGA_API ?? 'http://localhost:3001').replace(/\/$/, '');
const PEDIDOS = Number(process.env.CARGA_PEDIDOS ?? 300);
const SIMULTANEOS = Number(process.env.CARGA_SIMULTANEOS ?? 20);
const P95_MAX = Number(process.env.CARGA_P95_MS ?? 1500);

async function json(url, opcoes = {}) {
  const r = await fetch(url, opcoes);
  if (!r.ok) throw new Error(`${opcoes.method ?? 'GET'} ${url} → ${r.status} ${await r.text()}`);
  return r.json();
}

const sessao = await json(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'dono@demo.pentefino.dev', senha: 'pentefino123' }),
});
const auth = { authorization: `Bearer ${sessao.accessToken}` };
const unidades = await json(`${API}/unidades`, { headers: auth });
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const domingo = (() => {
  const d = new Date(`${hoje}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
})();
const sabado = (() => {
  const d = new Date(`${domingo}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
})();
const inicioMes = `${hoje.slice(0, 7)}-01`;

const rotas = {
  'agenda da semana': (i) =>
    `/agenda?unidadeId=${unidades[i % unidades.length].id}&de=${domingo}&ate=${sabado}`,
  'indicadores do mês': () => `/indicadores?de=${inicioMes}&ate=${hoje}`,
  'comandas do dia': (i) => `/comandas?unidadeId=${unidades[i % unidades.length].id}&data=${hoje}`,
};

const pct = (v, p) => v[Math.min(v.length - 1, Math.floor((p / 100) * v.length))];
let falhou = false;
for (const [nome, rota] of Object.entries(rotas)) {
  const tempos = [];
  let erros = 0;
  let proximo = 0;
  const inicio = performance.now();
  await Promise.all(
    Array.from({ length: SIMULTANEOS }, async () => {
      while (proximo < PEDIDOS) {
        const i = proximo++;
        const t = performance.now();
        const r = await fetch(`${API}${rota(i)}`, { headers: auth }).catch(() => null);
        if (!r?.ok) erros += 1;
        else await r.arrayBuffer();
        tempos.push(performance.now() - t);
      }
    }),
  );
  const total = (performance.now() - inicio) / 1000;
  tempos.sort((a, b) => a - b);
  const p95 = pct(tempos, 95);
  console.log(
    `${nome.padEnd(20)} ${PEDIDOS} pedidos, ${SIMULTANEOS} simultâneos: ${(PEDIDOS / total).toFixed(0)}/s · p50 ${pct(tempos, 50).toFixed(0)} ms · p95 ${p95.toFixed(0)} ms · máx ${tempos.at(-1).toFixed(0)} ms · erros ${erros}`,
  );
  if (erros > 0 || p95 > P95_MAX) falhou = true;
}
if (falhou) {
  console.error(`Falhou: houve erro ou o p95 passou de ${P95_MAX} ms.`);
  process.exit(1);
}
console.log('Carga ok.');
