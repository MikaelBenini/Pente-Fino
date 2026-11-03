// Conecta um número de WhatsApp de teste à Evolution API local.
// Uso: pnpm whatsapp:qr [nome-da-instancia]   (padrão: teste)
//
// 1. Cria a instância (se ainda não existir).
// 2. Salva o QR Code em .whatsapp/qr.png — abra no VS Code e escaneie pelo celular
//    (WhatsApp > Aparelhos conectados > Conectar um aparelho).
// 3. Renova o QR quando ele expira e para quando a conexão fica "open".
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { setTimeout as esperar } from 'node:timers/promises';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const caminhoEnv = join(raiz, '.env');
if (!existsSync(caminhoEnv)) {
  console.error('Arquivo .env não encontrado. Crie com: cp .env.example .env');
  process.exit(1);
}
process.loadEnvFile(caminhoEnv);

const url = (process.env.EVOLUTION_API_URL ?? 'http://localhost:8080').replace(/\/$/, '');
const chave = process.env.EVOLUTION_API_KEY;
const instancia = process.argv[2] ?? 'teste';
const pastaQr = join(raiz, '.whatsapp');
const arquivoQr = join(pastaQr, 'qr.png');
const LIMITE_MS = 5 * 60_000;
const RENOVAR_QR_MS = 30_000;

if (!chave) {
  console.error('EVOLUTION_API_KEY não definida no .env.');
  process.exit(1);
}

/** @param {string} caminho @param {RequestInit} [opcoes] */
async function api(caminho, opcoes = {}) {
  let resposta;
  try {
    resposta = await fetch(`${url}${caminho}`, {
      ...opcoes,
      headers: { apikey: chave, 'Content-Type': 'application/json', ...opcoes.headers },
    });
  } catch {
    console.error(`Evolution API não respondeu em ${url}. Ela está no ar? Rode: pnpm infra:up`);
    process.exit(1);
  }
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    const erro = new Error(`${opcoes.method ?? 'GET'} ${caminho} → ${resposta.status}`);
    erro.corpo = corpo;
    throw erro;
  }
  return corpo;
}

async function estado() {
  const corpo = await api(`/instance/connectionState/${instancia}`);
  return corpo?.instance?.state ?? 'desconhecido';
}

/** @param {string | undefined} base64 */
function salvarQr(base64) {
  if (!base64) return false;
  mkdirSync(pastaQr, { recursive: true });
  writeFileSync(arquivoQr, Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64'));
  return true;
}

const existentes = await api(`/instance/fetchInstances?instanceName=${instancia}`).catch(() => []);
const jaExiste = Array.isArray(existentes) && existentes.some((i) => i?.name === instancia);

if (!jaExiste) {
  console.log(`Criando a instância "${instancia}"...`);
  await api('/instance/create', {
    method: 'POST',
    body: JSON.stringify({
      instanceName: instancia,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
    }),
  });
} else if ((await estado()) === 'open') {
  console.log(`A instância "${instancia}" já está conectada (estado: open).`);
  process.exit(0);
}

const inicio = Date.now();
let ultimoQr = 0;
while (Date.now() - inicio < LIMITE_MS) {
  if (Date.now() - ultimoQr >= RENOVAR_QR_MS) {
    const conexao = await api(`/instance/connect/${instancia}`);
    if (salvarQr(conexao?.base64)) {
      console.log(`QR Code salvo em ${relative(raiz, arquivoQr)} — abra e escaneie pelo celular.`);
      if (process.env.CODESPACE_NAME) {
        console.log(`  Dica: code ${relative(raiz, arquivoQr)}`);
      }
    }
    ultimoQr = Date.now();
  }
  const atual = await estado();
  if (atual === 'open') {
    console.log(`Conectado. A instância "${instancia}" está com estado "open".`);
    process.exit(0);
  }
  await esperar(3_000);
}

console.error('Tempo esgotado (5 min) sem conexão. Rode de novo para gerar outro QR Code.');
process.exit(1);
