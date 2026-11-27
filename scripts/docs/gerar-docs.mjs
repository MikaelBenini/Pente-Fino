#!/usr/bin/env node
// Gera a parte da documentação que sai direto do código (docs/gerado/), para ela nunca ficar
// desatualizada: modelo de dados (schema.prisma), rotas da API (controllers), telas (páginas do
// Next) e planos e menu por papel (packages/shared). Fase 0 do plano multissegmento (27/11/2026).
//   pnpm docs:gerar      reescreve docs/gerado/
//   pnpm docs:conferir   falha se docs/gerado/ não bate com o código (usado no CI)
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = fileURLToPath(new URL('../..', import.meta.url));
const SAIDA = join(RAIZ, 'docs/gerado');
const AVISO =
  '<!-- Gerado por scripts/docs/gerar-docs.mjs (pnpm docs:gerar). Não edite à mão: mude o código e gere de novo. -->\n\n';

const ler = (p) => readFileSync(join(RAIZ, p), 'utf8');
const celula = (t) => String(t ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();

function arquivos(dir, filtro) {
  const saida = [];
  const andar = (d) => {
    for (const nome of readdirSync(d).sort()) {
      const p = join(d, nome);
      if (statSync(p).isDirectory()) {
        if (nome === 'node_modules' || nome === 'generated' || nome === 'dist') continue;
        andar(p);
      } else if (filtro(p)) saida.push(p);
    }
  };
  andar(join(RAIZ, dir));
  return saida;
}

// ─── Modelo de dados ──────────────────────────────────────────────────────────

function lerSchema() {
  const linhas = ler('packages/db/prisma/schema.prisma').split('\n');
  const modelos = [];
  const enums = [];
  let doc = [];
  let atual = null;
  for (const bruta of linhas) {
    const l = bruta.trim();
    if (!atual) {
      if (l.startsWith('///')) {
        doc.push(l.slice(3).trim());
        continue;
      }
      const m = /^(model|enum)\s+(\w+)\s*\{/.exec(l);
      if (m) {
        atual = { tipo: m[1], nome: m[2], doc: doc.join(' '), campos: [], valores: [], mapa: null };
        doc = [];
        continue;
      }
      if (l && !l.startsWith('//')) doc = [];
      continue;
    }
    if (l === '}') {
      (atual.tipo === 'model' ? modelos : enums).push(atual);
      atual = null;
      doc = [];
      continue;
    }
    if (l.startsWith('///')) {
      doc.push(l.slice(3).trim());
      continue;
    }
    if (!l || l.startsWith('//')) continue;
    if (atual.tipo === 'enum') {
      atual.valores.push(l.split(/\s+/)[0]);
      continue;
    }
    const mapa = /^@@map\("([^"]+)"\)/.exec(l);
    if (mapa) {
      atual.mapa = mapa[1];
      continue;
    }
    if (l.startsWith('@@')) {
      const u = /^@@(unique|index)\(\[([^\]]+)\]/.exec(l);
      if (u) atual.campos.push({ indice: `${u[1] === 'unique' ? 'único' : 'índice'} (${u[2]})` });
      continue;
    }
    const c = /^(\w+)\s+([\w]+)(\[\])?(\?)?\s*(.*)$/.exec(l);
    if (!c) continue;
    atual.campos.push({
      nome: c[1],
      tipo: c[2] + (c[3] ?? ''),
      opcional: !!c[4],
      lista: !!c[3],
      atributos: c[5],
      doc: doc.join(' '),
    });
    doc = [];
  }
  return { modelos, enums };
}

function gerarModelo() {
  const { modelos, enums } = lerSchema();
  const nomes = new Set(modelos.map((m) => m.nome));
  const nomesEnum = new Set(enums.map((e) => e.nome));
  const tabela = (m) => m.mapa ?? m.nome;
  let s = `${AVISO}# Modelo de dados\n\n`;
  s += `${modelos.length} entidades e ${enums.length} enums em \`packages/db/prisma/schema.prisma\`. `;
  s +=
    'Toda tabela de negócio tem `conta_id` com RLS (`app.conta_id`); dinheiro em centavos (inteiro); datas em UTC. ';
  s += 'Nomes em camelCase são os do Prisma; a coluna no banco é o `@map` (snake_case).\n\n';
  s += '## Entidades\n\n| Entidade (Prisma) | Tabela | Campos | Isolada por conta | Para que serve |\n| --- | --- | --- | --- | --- |\n';
  for (const m of modelos) {
    const campos = m.campos.filter((c) => c.nome && !nomes.has(c.tipo.replace('[]', '')));
    const porConta = m.campos.some((c) => c.nome === 'contaId');
    s += `| [${m.nome}](#${m.nome.toLowerCase()}) | \`${tabela(m)}\` | ${campos.length} | ${porConta ? 'sim' : 'não'} | ${celula(m.doc)} |\n`;
  }
  s += '\n## Relações\n\n```mermaid\nerDiagram\n';
  const vistas = new Set();
  for (const m of modelos)
    for (const c of m.campos) {
      if (!c.nome || !nomes.has(c.tipo.replace('[]', '')) || c.lista) continue;
      if (!/@relation\(/.test(c.atributos) || !/fields:/.test(c.atributos)) continue;
      const chave = `${c.tipo}-${m.nome}-${c.nome}`;
      if (vistas.has(chave)) continue;
      vistas.add(chave);
      s += `  ${c.tipo} ${c.opcional ? '|o' : '||'}--o{ ${m.nome} : "${c.nome}"\n`;
    }
  s += '```\n\n## Campos por entidade\n';
  for (const m of modelos) {
    s += `\n### ${m.nome}\n\nTabela \`${tabela(m)}\`.${m.doc ? ` ${m.doc}` : ''}\n\n`;
    s += '| Campo | Tipo | Obrigatório | Observação |\n| --- | --- | --- | --- |\n';
    const indices = [];
    for (const c of m.campos) {
      if (c.indice) {
        indices.push(c.indice);
        continue;
      }
      const base = c.tipo.replace('[]', '');
      const ehRelacao = nomes.has(base);
      const coluna = /@map\("([^"]+)"\)/.exec(c.atributos)?.[1];
      const obs = [
        c.doc,
        /@id\b/.test(c.atributos) ? 'chave' : '',
        /@unique\b/.test(c.atributos) ? 'único' : '',
        ehRelacao ? (c.lista ? `lista de ${base}` : `relação com ${base}`) : '',
        nomesEnum.has(base) ? `enum ${base}` : '',
        /@default\(([^)]*\)?)\)/.exec(c.atributos)?.[1] ? `padrão ${/@default\(([^)]*\)?)\)/.exec(c.atributos)[1]}` : '',
        coluna && coluna !== c.nome ? `coluna \`${coluna}\`` : '',
      ]
        .filter(Boolean)
        .join('; ');
      s += `| ${c.nome} | ${c.tipo} | ${c.opcional || c.lista ? 'não' : 'sim'} | ${celula(obs)} |\n`;
    }
    if (indices.length) s += `\nRestrições: ${indices.join(' · ')}.\n`;
  }
  s += '\n## Enums\n\n| Enum | Valores |\n| --- | --- |\n';
  for (const e of enums) s += `| ${e.nome} | ${e.valores.join(', ')} |\n`;
  return s;
}

// ─── Rotas da API ─────────────────────────────────────────────────────────────

function gerarApi() {
  const controllers = arquivos('apps/api/src', (p) => p.endsWith('.controller.ts'));
  let total = 0;
  const modulos = new Map();
  for (const arq of controllers) {
    const fonte = readFileSync(arq, 'utf8');
    const modulo = relative(join(RAIZ, 'apps/api/src'), arq).split(sep)[0];
    const prefixo = /@Controller\(\s*'([^']*)'\s*\)/.exec(fonte)?.[1] ?? '';
    const papeisClasse = /@Papeis\(([^)]*)\)\s*(?:@\w+\([^)]*\)\s*)*export class/.exec(fonte)?.[1];
    const rotas = [];
    const re = /@(Get|Post|Put|Patch|Delete)\(\s*(?:'([^']*)')?\s*\)([\s\S]*?)\n\s+(?:async\s+)?(\w+)\(/g;
    for (const m of fonte.matchAll(re)) {
      const bloco = m[3];
      const caminho = `/${[prefixo, m[2] ?? ''].filter(Boolean).join('/')}`.replace(/\/+/g, '/');
      const papeis = /@Papeis\(([^)]*)\)/.exec(bloco)?.[1] ?? papeisClasse ?? '';
      // Administração da plataforma: AdminGuard + @PapeisPlataforma (o @Publico só pula o login
      // das barbearias).
      const plataforma =
        /@PapeisPlataforma\(([^)]*)\)/.exec(bloco)?.[1] ??
        (/@UseGuards\(AdminGuard\)/.test(fonte)
          ? (/@PapeisPlataforma\(([^)]*)\)\s*export class/.exec(fonte)?.[1] ?? 'equipe')
          : null);
      const publico =
        !plataforma &&
        (/@Publico\(\)/.test(bloco) || /@Publico\(\)\s*(?:@\w+\([^)]*\)\s*)*export class/.test(fonte));
      const resumo = /summary:\s*'([^']*)'/.exec(bloco)?.[1] ?? /summary:\s*\n?\s*'([^']*)'/.exec(bloco)?.[1] ?? '';
      rotas.push({
        metodo: m[1].toUpperCase(),
        caminho,
        quem: plataforma
          ? `plataforma: ${plataforma.replace(/['\s]/g, '')}`
          : publico
            ? 'público'
            : papeis.replace(/['\s]/g, '').replace(/\.\.\./g, '') || 'logado',
        resumo,
      });
    }
    total += rotas.length;
    const lista = modulos.get(modulo) ?? [];
    lista.push({ arquivo: relative(RAIZ, arq), rotas });
    modulos.set(modulo, lista);
  }
  let s = `${AVISO}# Rotas da API\n\n${total} rotas em ${controllers.length} controllers (\`apps/api/src\`), por módulo. `;
  s +=
    '"Quem" vem do `@Papeis` (constantes como `QUEM_CONVERSA` são listas definidas no próprio módulo) ou `@Publico`. ';
  s += 'A documentação interativa fica em `/docs` (Swagger) com a API rodando.\n';
  for (const [modulo, lista] of [...modulos].sort()) {
    s += `\n## ${modulo}\n`;
    for (const { arquivo, rotas } of lista) {
      s += `\n\`${arquivo}\`\n\n| Método | Rota | Quem | O que faz |\n| --- | --- | --- | --- |\n`;
      for (const r of rotas) s += `| ${r.metodo} | \`${r.caminho}\` | ${celula(r.quem)} | ${celula(r.resumo)} |\n`;
    }
  }
  return s;
}

// ─── Telas ────────────────────────────────────────────────────────────────────

function gerarTelas() {
  const paginas = arquivos('apps/web/src/app', (p) => p.endsWith(`${sep}page.tsx`));
  const area = (rota) =>
    rota.startsWith('/admin') ? 'Administração da plataforma' : rota.includes('(app)') ? 'Painel (logado)' : rota.includes('(site)') ? 'Site de vendas' : 'Páginas públicas';
  const linhas = paginas.map((p) => {
    const rel = relative(join(RAIZ, 'apps/web/src/app'), p).replace(/\\/g, '/');
    const rota = `/${rel.replace(/\/?page\.tsx$/, '')}`;
    const limpa = rota.replace(/\/\([^)]+\)/g, '') || '/';
    const fonte = readFileSync(p, 'utf8');
    const tela = /import \{ (Tela\w+)[^}]*\} from '@\/componentes\/telas\/([\w-]+)'/.exec(fonte);
    const outro = /import \{ (\w+)[^}]*\} from '@\/componentes\/([\w/-]+)'/.exec(fonte);
    const comp = tela ? `${tela[1]} (\`componentes/telas/${tela[2]}.tsx\`)` : outro ? `${outro[1]} (\`componentes/${outro[2]}.tsx\`)` : 'na própria página';
    return { area: area(rota), rota: limpa || '/', comp, arquivo: `apps/web/src/app/${rel}` };
  });
  let s = `${AVISO}# Telas\n\n${linhas.length} páginas do Next (\`apps/web/src/app\`). As telas do painel ficam em \`apps/web/src/componentes/telas\`; o menu por papel está em [menu-por-papel.md](menu-por-papel.md).\n`;
  for (const a of ['Painel (logado)', 'Páginas públicas', 'Site de vendas', 'Administração da plataforma']) {
    const daArea = linhas.filter((l) => l.area === a).sort((x, y) => x.rota.localeCompare(y.rota));
    if (!daArea.length) continue;
    s += `\n## ${a}\n\n| Rota | Componente | Arquivo |\n| --- | --- | --- |\n`;
    for (const l of daArea) s += `| \`${l.rota}\` | ${l.comp} | \`${l.arquivo}\` |\n`;
  }
  return s;
}

// ─── Planos e menu (do packages/shared compilado) ────────────────────────────

async function gerarPlanosEMenu() {
  const sh = await import(pathToFileURL(join(RAIZ, 'packages/shared/dist/index.js')).href);
  const reais = (c) => `R$ ${(c / 100).toFixed(2).replace('.', ',')}`;
  let p = `${AVISO}# Planos e recursos\n\nFonte: \`packages/shared/src/planos.ts\` (a API confere com \`temRecurso\` e \`verificarLimite\`; o site e a tela de assinatura leem os mesmos dados).\n\n`;
  p += '| Plano | Mensal | Anual (por mês) | Unidades | Profissionais |\n| --- | --- | --- | --- | --- |\n';
  for (const plano of sh.PLANOS) {
    const l = sh.LIMITES_PLANO[plano];
    const n = (v) => (Number.isFinite(v) ? String(v) : 'ilimitado');
    p += `| ${sh.NOME_PLANO[plano]} | ${reais(sh.PRECOS_PLANO[plano].mensal)} | ${reais(sh.PRECOS_PLANO[plano].anualPorMes)} | ${n(l.unidades)} | ${n(l.profissionais)} |\n`;
  }
  p += `\nUnidade extra (Premium): ${reais(sh.PRECO_UNIDADE_EXTRA.mensal)} por mês (${reais(sh.PRECO_UNIDADE_EXTRA.anualPorMes)} no anual). `;
  p += `Automações à parte nos planos ${sh.PLANOS_COM_AUTOMACOES_A_PARTE.map((x) => sh.NOME_PLANO[x]).join(' e ')}: ${reais(sh.PRECO_AUTOMACOES.mensal)} por mês (${reais(sh.PRECO_AUTOMACOES.anualPorMes)} no anual), destravam ${sh.RECURSOS_DAS_AUTOMACOES.join(', ')}. `;
  p += `Teste grátis: ${sh.DIAS_TESTE} dias.\n\n## Recursos conferidos pela API\n\n| Recurso | O que é | A partir de |\n| --- | --- | --- |\n`;
  for (const [id, r] of Object.entries(sh.RECURSOS)) p += `| \`${id}\` | ${celula(r.nome)} | ${sh.NOME_PLANO[r.desde]} |\n`;

  let m = `${AVISO}# Menu por papel\n\nFonte: \`packages/shared/src/menu.ts\` (\`ITENS_MENU\`, \`menuPara\`). A tela só aparece no menu de quem pode abri-la; o plano pode esconder telas (\`RECURSO_DA_TELA\`).\n\n`;
  const papeis = sh.PAPEIS ?? ['dono', 'gestor', 'recepcao', 'barbeiro'];
  m += `| Tela | Rota | Grupo | ${papeis.join(' | ')} | Recurso do plano |\n| --- | --- | --- | ${papeis.map(() => '---').join(' | ')} | --- |\n`;
  for (const i of sh.ITENS_MENU)
    m += `| ${i.rotulo} | \`${i.rota}\` | ${i.grupo} | ${papeis.map((x) => (i.papeis.includes(x) ? 'sim' : '')).join(' | ')} | ${sh.RECURSO_DA_TELA?.[i.id] ?? ''} |\n`;
  return { planos: p, menu: m };
}

// ─── Saída ────────────────────────────────────────────────────────────────────

mkdirSync(SAIDA, { recursive: true });
const { planos, menu } = await gerarPlanosEMenu();
const saidas = {
  'modelo-de-dados.md': gerarModelo(),
  'api.md': gerarApi(),
  'telas.md': gerarTelas(),
  'planos.md': planos,
  'menu-por-papel.md': menu,
};
for (const [nome, conteudo] of Object.entries(saidas)) writeFileSync(join(SAIDA, nome), conteudo);
console.log(`docs/gerado: ${Object.keys(saidas).join(', ')}`);
