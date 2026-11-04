// Importação da planilha (CSV): leitura, modelos e conversão linha a linha.
import { z } from 'zod';
import { lerMoeda } from './formatacao.js';

export const TIPOS_IMPORTACAO = ['clientes', 'servicos', 'precos', 'profissionais'] as const;
export type TipoImportacao = (typeof TIPOS_IMPORTACAO)[number];

/** Cabeçalho e uma linha de exemplo de cada modelo (separador ";", como o Excel em português). */
export const MODELOS_CSV: Record<
  TipoImportacao,
  { colunas: string[]; exemplo: string[]; descricao: string }
> = {
  clientes: {
    colunas: ['nome', 'telefone', 'email', 'aniversario'],
    exemplo: ['João da Silva', '(11) 98888-7777', 'joao@email.com', '25/12/1990'],
    descricao: 'Um cliente por linha. Telefone com DDD; aniversário em DD/MM/AAAA.',
  },
  servicos: {
    colunas: ['nome', 'categoria', 'duracao_min', 'custo_produto', 'extra', 'peso'],
    exemplo: ['Corte', 'Cabelo', '30', '1,50', 'não', '1'],
    descricao:
      'Extra: sim ou não. Peso em atendimentos: principal 1, extra 0, combo soma os inclusos.',
  },
  precos: {
    colunas: ['servico', 'unidade', 'valor'],
    exemplo: ['Corte', 'Centro', '45,00'],
    descricao: 'Nome do serviço e da unidade como estão cadastrados. Valem a partir de hoje.',
  },
  profissionais: {
    colunas: [
      'nome',
      'email',
      'telefone',
      'unidade',
      'data_entrada',
      'comissao_servico',
      'comissao_produto',
    ],
    exemplo: [
      'Rafael Moura',
      'rafael@email.com',
      '(11) 97777-6666',
      'Centro',
      '01/03/2024',
      '45',
      '10',
    ],
    descricao: 'Cada profissional recebe um convite por e-mail. Comissão em %.',
  },
};

export function modeloCsv(tipo: TipoImportacao): string {
  const m = MODELOS_CSV[tipo];
  return `${m.colunas.join(';')}\n${m.exemplo.join(';')}\n`;
}

/** "Duração (min)" → "duracao_min". */
function normalizarCabecalho(c: string): string {
  return c
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/** Lê CSV com ";" ou "," (detecta pelo cabeçalho), aspas e quebras dentro de aspas. */
export function lerCsv(texto: string): { colunas: string[]; linhas: Record<string, string>[] } {
  const limpo = texto.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const primeira = limpo.split('\n', 1)[0] ?? '';
  const sep =
    (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) ? ';' : ',';
  const registros: string[][] = [];
  let campo = '';
  let registro: string[] = [];
  let aspas = false;
  for (let i = 0; i < limpo.length; i++) {
    const ch = limpo[i]!;
    if (aspas) {
      if (ch === '"' && limpo[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (ch === '"') aspas = false;
      else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) {
      registro.push(campo);
      campo = '';
    } else if (ch === '\n') {
      registro.push(campo);
      registros.push(registro);
      registro = [];
      campo = '';
    } else campo += ch;
  }
  if (campo !== '' || registro.length) {
    registro.push(campo);
    registros.push(registro);
  }
  const [cabecalho = [], ...resto] = registros.filter((r) => r.some((c) => c.trim() !== ''));
  const colunas = cabecalho.map(normalizarCabecalho);
  return {
    colunas,
    linhas: resto.map((r) => Object.fromEntries(colunas.map((c, i) => [c, (r[i] ?? '').trim()]))),
  };
}

/** "25/12/1990" ou "1990-12-25" → "1990-12-25"; inválida → null. */
export function lerData(texto: string): string | null {
  const t = texto.trim();
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  const [a, m, d] = br ? [br[3], br[2], br[1]] : iso ? [iso[1], iso[2], iso[3]] : [];
  if (!a || !m || !d) return null;
  const data = `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const x = new Date(`${data}T12:00:00Z`);
  return !Number.isNaN(x.getTime()) && x.toISOString().slice(0, 10) === data ? data : null;
}

const telefone = (t: string) => {
  const d = t.replace(/\D/g, '');
  if (!d) return null;
  const c = d.length === 10 || d.length === 11 ? `55${d}` : d;
  return /^\d{12,13}$/.test(c) ? c : undefined;
};

const percentual = (t: string) => {
  const n = Number(t.replace('%', '').replace(',', '.').trim());
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) : null;
};

export type LinhaConvertida =
  | {
      tipo: 'clientes';
      nome: string;
      telefone: string | null;
      email: string | null;
      aniversario: string | null;
    }
  | {
      tipo: 'servicos';
      nome: string;
      categoria: string | null;
      duracaoMin: number;
      custoProduto: number;
      ehExtra: boolean;
      pesoAtendimento: number;
    }
  | { tipo: 'precos'; servico: string; unidade: string; valor: number }
  | {
      tipo: 'profissionais';
      nome: string;
      email: string;
      telefone: string | null;
      unidade: string;
      dataEntrada: string;
      comissaoServicoBp: number;
      comissaoProdutoBp: number;
    };

/** Converte uma linha do CSV ou explica o problema em português. */
export function converterLinha(
  tipo: TipoImportacao,
  l: Record<string, string>,
): { ok: true; valor: LinhaConvertida } | { ok: false; erro: string } {
  const erro = (e: string) => ({ ok: false as const, erro: e });
  const nome = (l.nome ?? '').trim();
  if (tipo === 'clientes') {
    if (nome.length < 2) return erro('Nome vazio ou curto demais.');
    const tel = telefone(l.telefone ?? '');
    if (tel === undefined) return erro(`Telefone inválido: "${l.telefone}". Use DDD e número.`);
    const email = (l.email ?? '').trim().toLowerCase() || null;
    if (email && !z.email().safeParse(email).success) return erro(`E-mail inválido: "${email}".`);
    const aniv = (l.aniversario ?? '').trim();
    const aniversario = aniv ? lerData(aniv) : null;
    if (aniv && !aniversario) return erro(`Aniversário inválido: "${aniv}". Use DD/MM/AAAA.`);
    return { ok: true, valor: { tipo, nome, telefone: tel, email, aniversario } };
  }
  if (tipo === 'servicos') {
    if (nome.length < 2) return erro('Nome do serviço vazio.');
    const duracao = Number(l.duracao_min ?? l.duracao);
    if (!Number.isInteger(duracao) || duracao < 5 || duracao > 600)
      return erro(`Duração inválida: "${l.duracao_min ?? ''}". Use minutos (5 a 600).`);
    const custo = (l.custo_produto ?? '').trim() ? lerMoeda(l.custo_produto!) : 0;
    if (custo === null || custo < 0) return erro(`Custo inválido: "${l.custo_produto}". Ex.: 1,50`);
    const extra = /^(s|sim|x|1|true|yes)$/i.test((l.extra ?? '').trim());
    const peso = (l.peso ?? '').trim() === '' ? (extra ? 0 : 1) : Number(l.peso);
    if (!Number.isInteger(peso) || peso < 0 || peso > 10)
      return erro(`Peso inválido: "${l.peso}".`);
    return {
      ok: true,
      valor: {
        tipo,
        nome,
        categoria: (l.categoria ?? '').trim() || null,
        duracaoMin: duracao,
        custoProduto: custo,
        ehExtra: extra,
        pesoAtendimento: peso,
      },
    };
  }
  if (tipo === 'precos') {
    const servico = (l.servico ?? '').trim();
    const unidade = (l.unidade ?? '').trim();
    if (!servico || !unidade) return erro('Informe serviço e unidade.');
    const valor = lerMoeda(l.valor ?? '');
    if (valor === null || valor < 0) return erro(`Valor inválido: "${l.valor}". Ex.: 45,00`);
    return { ok: true, valor: { tipo, servico, unidade, valor } };
  }
  if (nome.length < 2) return erro('Nome vazio.');
  const email = (l.email ?? '').trim().toLowerCase();
  if (!z.email().safeParse(email).success)
    return erro(`E-mail inválido: "${l.email ?? ''}". Ele recebe o convite.`);
  const tel = telefone(l.telefone ?? '');
  if (tel === undefined) return erro(`Telefone inválido: "${l.telefone}".`);
  const unidade = (l.unidade ?? '').trim();
  if (!unidade) return erro('Informe a unidade.');
  const dataEntrada = lerData(l.data_entrada ?? '');
  if (!dataEntrada)
    return erro(`Data de entrada inválida: "${l.data_entrada ?? ''}". Use DD/MM/AAAA.`);
  const cs = percentual(l.comissao_servico ?? '');
  const cp = (l.comissao_produto ?? '').trim() ? percentual(l.comissao_produto!) : 0;
  if (cs === null || cp === null) return erro('Comissão inválida: use um número entre 0 e 100.');
  return {
    ok: true,
    valor: {
      tipo,
      nome,
      email,
      telefone: tel,
      unidade,
      dataEntrada,
      comissaoServicoBp: cs,
      comissaoProdutoBp: cp,
    },
  };
}

export const importacaoSchema = z.object({
  linhas: z
    .array(z.record(z.string(), z.string().max(500)))
    .min(1, { error: 'O arquivo não tem linhas.' })
    .max(2000, { error: 'Até 2.000 linhas por vez.' }),
  /** true = só confere e devolve o relatório, sem gravar. */
  simular: z.boolean().default(true),
});

export interface RelatorioImportacao {
  total: number;
  validas: number;
  gravadas: number;
  erros: { linha: number; mensagem: string }[];
}

/** "Unidade Centro – Shopping" → "unidade-centro-shopping". */
export function gerarSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}
