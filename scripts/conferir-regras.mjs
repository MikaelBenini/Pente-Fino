#!/usr/bin/env node
// Regras do docs/CLAUDE.md conferidas no código, para não depender de alguém lembrar (sugestão
// aprovada pelo dono em 27/11/2026). Roda no CI (pnpm regras:conferir). Cada regra diz o que está
// errado, onde e como corrigir. Exceção legítima: some na lista PERMITIDO da regra, com o motivo.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));

function arquivos(dirs, filtro) {
  const saida = [];
  const andar = (d) => {
    for (const nome of readdirSync(d).sort()) {
      const p = join(d, nome);
      if (statSync(p).isDirectory()) {
        if (['node_modules', 'generated', 'dist', '.next', 'test-results'].includes(nome)) continue;
        andar(p);
      } else if (filtro(p)) saida.push(p);
    }
  };
  for (const d of dirs) andar(join(RAIZ, d));
  return saida;
}

const ehTeste = (p) => /\.(test|spec)\.tsx?$|\/test\/|\/e2e\//.test(p);
const fontes = arquivos(
  ['apps/api/src', 'apps/web/src', 'apps/worker/src', 'packages/db/src', 'packages/shared/src'],
  (p) => /\.tsx?$/.test(p) && !ehTeste(p),
);
const ler = (p) => readFileSync(p, 'utf8');
const rel = (p) => relative(RAIZ, p);
const falhas = [];
const falhar = (regra, onde, como) => falhas.push({ regra, onde, como });

// 1. WhatsApp nos botões do cliente: nunca wa.me com o telefone da unidade (testes de 19/11/2026:
//    os três botões levavam a números diferentes). Use whatsappDaUnidade / numeroWhatsappDaUnidade.
for (const p of fontes) {
  ler(p)
    .split('\n')
    .forEach((linha, i) => {
      if (/wa\.me/.test(linha) && /\b(u|unidade|ag\.unidade|unidadeAtual)\.telefone\b/.test(linha))
        falhar(
          'WhatsApp do cliente com o telefone da unidade',
          `${rel(p)}:${i + 1}`,
          'use whatsappDaUnidade(tx, unidade) e linkWaMe(numero, mensagem)',
        );
      if (/linkWhatsapp(DaUnidade)?\(\s*(u|unidade)\.telefone\b/.test(linha))
        falhar(
          'WhatsApp do cliente com o telefone da unidade',
          `${rel(p)}:${i + 1}`,
          'use o campo whatsapp que a API entrega (numeroWhatsappDaUnidade)',
        );
    });
}

// 2. Um telefone, um cliente: buscar cliente por telefone sempre com variantesTelefone (com e sem o
//    nono dígito), nunca pelo valor exato.
for (const p of fontes.filter((f) => /apps\/api|packages\/db/.test(f))) {
  const fonte = ler(p);
  for (const m of fonte.matchAll(
    /cliente\.(findFirst|findUnique|findMany|count)\(\s*\{\s*where:\s*\{\s*telefone(\s*:\s*([^,}\n]+))?/g,
  )) {
    const valor = (m[3] ?? '').trim();
    if (valor.startsWith('{')) continue; // { in: variantesTelefone(...) }
    const linha = fonte.slice(0, m.index).split('\n').length;
    falhar(
      'Cliente buscado pelo telefone exato',
      `${rel(p)}:${linha}`,
      'use where: { telefone: { in: variantesTelefone(telefone) } }',
    );
  }
}

// 3. Multiempresa: toda tabela criada com conta_id precisa de habilitar_isolamento_conta (RLS).
{
  const migracoes = arquivos(['packages/db/prisma/migrations'], (p) => p.endsWith('.sql'));
  const todas = migracoes.map(ler).join('\n');
  const PERMITIDO = new Set([
    // Tabelas criadas antes da função: a migração de RLS liga o isolamento em todas de uma vez.
  ]);
  const antesDaFuncao = todas.indexOf('CREATE FUNCTION habilitar_isolamento_conta');
  for (const m of todas.matchAll(/CREATE TABLE "(\w+)" \(([\s\S]*?)\n\);/g)) {
    const [, tabela, corpo] = m;
    if (!/"conta_id"/.test(corpo) || PERMITIDO.has(tabela)) continue;
    if (m.index < antesDaFuncao) continue; // cobertas pelo laço da migração de RLS
    if (!todas.includes(`habilitar_isolamento_conta('${tabela}')`))
      falhar(
        'Tabela com conta_id sem isolamento por conta (RLS)',
        tabela,
        `acrescente SELECT habilitar_isolamento_conta('${tabela}'); na migração`,
      );
  }
}

// 4. Nada de IA no produto (ADR 0007), até a ADR que a substitui na Fase 4 ser aceita: nenhum SDK
//    de provedor de IA nas dependências.
{
  const adrSubstituida = /Status:\*\*\s*Substituída/.test(
    ler(join(RAIZ, 'docs/decisoes/0007-bot-sem-ia.md')),
  );
  const pacotes = arquivos(
    ['apps', 'packages'],
    (p) => p.endsWith('package.json') && !p.includes('node_modules'),
  );
  const sdk =
    /"(openai|@anthropic-ai\/[\w-]+|@google\/(genai|generative-ai)|ai|@ai-sdk\/[\w-]+)"\s*:/;
  if (!adrSubstituida)
    for (const p of pacotes)
      if (sdk.test(ler(p)))
        falhar(
          'SDK de IA com a ADR 0007 (bot sem IA) em vigor',
          rel(p),
          'a IA entra na Fase 4: aceite a ADR nova (que substitui a 0007) antes',
        );
}

// 5. Dinheiro em centavos: nada de parseFloat/toFixed sobre valores monetários nas regras e na API.
for (const p of fontes.filter((f) => /packages\/shared|apps\/api/.test(f))) {
  ler(p)
    .split('\n')
    .forEach((linha, i) => {
      if (/parseFloat\(/.test(linha) && /(valor|preco|preço|total|centavos|reais)/i.test(linha))
        falhar(
          'Dinheiro com ponto flutuante',
          `${rel(p)}:${i + 1}`,
          'trabalhe em centavos (inteiro); para ler o que o usuário digita, use lerMoeda',
        );
    });
}

if (falhas.length) {
  console.error(`\n${falhas.length} regra(s) do docs/CLAUDE.md quebrada(s):\n`);
  for (const f of falhas)
    console.error(`- ${f.regra}\n  onde: ${f.onde}\n  como corrigir: ${f.como}\n`);
  process.exit(1);
}
console.log(
  'Regras do docs/CLAUDE.md: tudo certo (WhatsApp do cliente, telefone, RLS, IA, centavos).',
);
