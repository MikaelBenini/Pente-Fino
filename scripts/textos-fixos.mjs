#!/usr/bin/env node
// S6 do plano multissegmento (27/11/2026): acha "barbeiro" ou "barbearia" fixos em texto que a
// pessoa vê (telas do painel, link público, site da barbearia, bot, e-mails, PDFs). O texto tem de
// vir do vocabulário do segmento (vocabulario(), useVocabulario()). Ignora comentários, nomes de
// variável e o que é de barbearia de propósito (lista PERMITIDO). Usado pelo regras:conferir.
//   node scripts/textos-fixos.mjs        lista o que achou (sai com 1 se achar algo)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));

/** Onde há texto visível que depende do segmento. */
const PASTAS = [
  'apps/web/src/componentes',
  'apps/web/src/app/(app)',
  'apps/web/src/app/b',
  'apps/web/src/app/s',
  'apps/web/src/app/horario',
  'apps/web/src/app/agendar',
  'apps/web/src/lib',
  'apps/api/src',
  'apps/worker/src',
  'packages/db/src',
  'packages/shared/src',
];

/**
 * Fica de fora (com o motivo):
 * - site de vendas do Pente Fino: fala com barbearias até a Fase 5 (landing por segmento);
 * - administração da plataforma: a equipe do Pente Fino, não o cliente;
 * - o próprio vocabulário, que é onde as palavras moram;
 * - textos jurídicos e de marketing do site.
 */
const PERMITIDO = [
  /^apps\/web\/src\/componentes\/site\//,
  /^apps\/web\/src\/componentes\/admin\//,
  /^apps\/api\/src\/admin\//,
  /^packages\/shared\/src\/vocabulario\.ts$/,
  /^apps\/web\/src\/conteudo\//,
  // Cadastro público: vem do site de vendas (barbearias) até a Fase 1b pôr a escolha do segmento.
  /^apps\/web\/src\/componentes\/telas\/cadastro\.tsx$/,
  // Alertas da equipe do Pente Fino (cadastro novo, WhatsApp caído): falam das contas clientes.
  /^packages\/shared\/src\/alertas-equipe\.ts$/,
  // Plataforma (funil de vendas, revenda, configurações do sistema, cobrança do Pente Fino, chat do
  // suporte): fala da conta cliente para a equipe do Pente Fino.
  /^packages\/shared\/src\/(plataforma|plataforma-gestao|funil|etapa-parada|revenda-agenda|configuracao-sistema|chat-suporte|metricas-[\w-]+|ficha-admin|cobranca-manual|situacao-conta|relatorio-cupons|nota-fiscal|modelos-email)\.ts$/,
  /^apps\/api\/src\/(cobranca|chat|saude|suporte)\//,
  /^packages\/db\/src\/(plataforma|cobranca-manual|alertas-plataforma)\.ts$/,
];

const ehTeste = (p) => /\.(test|spec)\.tsx?$/.test(p);

function arquivos() {
  const saida = [];
  const andar = (d) => {
    for (const nome of readdirSync(d).sort()) {
      const p = join(d, nome);
      if (statSync(p).isDirectory()) {
        if (['node_modules', 'generated', 'dist', '.next'].includes(nome)) continue;
        andar(p);
      } else if (/\.tsx?$/.test(p) && !ehTeste(p)) saida.push(p);
    }
  };
  for (const d of PASTAS) andar(join(RAIZ, d));
  return saida;
}

/** A palavra como texto (não pedaço de identificador como barbeirosSemCadastro ou BarbeiroDoMes). */
const PALAVRA = /(^|[^A-Za-z0-9_$.])(barbeir[oa]s?|barbearias?)(?![A-Za-z0-9_$])/gi;

export function textosFixos() {
  const achados = [];
  for (const p of arquivos()) {
    const rel = relative(RAIZ, p).replace(/\\/g, '/');
    if (PERMITIDO.some((r) => r.test(rel))) continue;
    let emComentario = false;
    readFileSync(p, 'utf8')
      .split('\n')
      .forEach((bruta, i) => {
        let linha = bruta;
        if (emComentario) {
          const fim = linha.indexOf('*/');
          if (fim < 0) return;
          linha = linha.slice(fim + 2);
          emComentario = false;
        }
        linha = linha.replace(/\/\*.*?\*\//g, '');
        const abre = linha.indexOf('/*');
        if (abre >= 0) {
          emComentario = true;
          linha = linha.slice(0, abre);
        }
        if (/^\s*(\/\/|\*)/.test(linha)) return;
        // Swagger (summary/description): documentação para desenvolvedor, não para o cliente.
        if (/\b(summary|description):|@ApiTags\(/.test(linha)) return;
        linha = linha.replace(/\s\/\/.*$/, '');
        // {barbearia} das mensagens do bot é o nome do negócio, não a palavra; case 'barbeiros': é chave.
        linha = linha
          .replace(/\{'?\{barbearia\}'?\}|\{barbearia\}/g, '')
          .replace(/case ['"][\w-]+['"]:/g, '');
        // Só o que está dentro de aspas, crase ou entre tags JSX (texto), não código.
        const textos = [...linha.matchAll(/'([^'\\]|\\.)*'|"([^"\\]|\\.)*"|`([^`\\]|\\.)*`/g)].map(
          (m) => m[0],
        );
        // Texto entre tags e também depois de uma expressão ({n} barbeiros.), até a próxima.
        const jsx = [
          ...(linha.match(/>([^<>{}]+)</g) ?? []),
          ...(linha.match(/\}([^<>{}=;()]+)(?=[{<]|$)/g) ?? []),
        ];
        // Texto solto entre tags JSX numa linha só (sem aspas, sem chave de objeto como `barbearia:`).
        const soltoJsx =
          /^\s*[^<>{}=;()'"`]*[A-Za-zÀ-ú][^<>{}=;()'"`]*$/.test(linha) &&
          !/[;=,]\s*$/.test(linha) &&
          !/^\s*[\w$]+\s*[:,]/.test(linha)
            ? [linha]
            : [];
        for (const t of [...textos, ...jsx, ...soltoJsx]) {
          // Chave de rota/arquivo e nomes técnicos: "barbearia" em slug, import ou caminho.
          if (/^['"`]@?[\w./-]*['"`]$/.test(t) && !/\s/.test(t)) continue;
          // Rota com parâmetros (/resultados?aba=barbeiros): sem espaço e com ? ou =.
          if (!/\s/.test(t) && /[?=]/.test(t)) continue;
          if (PALAVRA.test(t)) {
            achados.push({ arquivo: rel, linha: i + 1, texto: bruta.trim().slice(0, 140) });
            PALAVRA.lastIndex = 0;
            break;
          }
          PALAVRA.lastIndex = 0;
        }
      });
  }
  return achados;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const achados = textosFixos();
  const porArquivo = new Map();
  for (const a of achados) porArquivo.set(a.arquivo, [...(porArquivo.get(a.arquivo) ?? []), a]);
  for (const [arq, lista] of [...porArquivo].sort((x, y) => y[1].length - x[1].length)) {
    console.log(`${arq} (${lista.length})`);
    if (process.argv.includes('--detalhe'))
      for (const a of lista) console.log(`  ${a.linha}: ${a.texto}`);
  }
  console.log(
    `\n${achados.length} texto(s) com "barbeiro/barbearia" fixo em ${porArquivo.size} arquivo(s).`,
  );
  process.exit(achados.length ? 1 : 0);
}
