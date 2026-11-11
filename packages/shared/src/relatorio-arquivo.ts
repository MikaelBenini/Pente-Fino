// Relatório do mês em arquivo (Etapa 23.1): o mesmo conteúdo da tela, em tabelas de texto já
// formatadas em pt-BR. A API desenha a planilha (CSV) e o PDF a partir daqui, então os dois
// arquivos e a tela mostram sempre os mesmos números.
import { CANAIS, NOME_CANAL } from './canais.js';
import { formatarFracao, formatarMoeda, formatarNumero, formatarValor } from './formatacao.js';
import {
  compararMeses,
  custoELucroDoBarbeiro,
  frasesDoMes,
  mixDoMes,
  pontosDoBarbeiro,
  type FormatoIndicador,
  type LinhaComparativo,
  type RelatorioDoMes,
} from './relatorio.js';

export interface ColunaExportada {
  titulo: string;
  /** Número: alinhado à direita no PDF. */
  numero?: boolean;
  /** Peso da largura no PDF (padrão 1). */
  peso?: number;
  /** false: só na planilha (a folha do PDF não comporta). */
  noPdf?: boolean;
}

export interface TabelaExportada {
  titulo: string;
  colunas: ColunaExportada[];
  linhas: string[][];
  /** Texto quando não há linha nenhuma. */
  vazio?: string;
  /** Só no PDF: na planilha, o mesmo conteúdo já está em outra tabela. */
  soPdf?: boolean;
}

export interface RelatorioEmArquivo {
  titulo: string;
  subtitulo: string;
  /** Nota sobre o período comparado (mês corrente), ou null. */
  aviso: string | null;
  tabelas: TabelaExportada[];
}

/** "2026-11" → "novembro de 2026". */
export function nomeDoMesPorExtenso(mes: string): string {
  return new Date(`${mes}-15T12:00:00Z`).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

const pctInteiro = (f: number) => formatarFracao(f, 0);
const sinal = (n: number) => (n > 0 ? '+' : '');

function valorIndicador(v: number | null, f: FormatoIndicador): string {
  if (v === null) return '—';
  if (f === 'moeda') return formatarMoeda(v);
  if (f === 'fracao') return pctInteiro(v);
  if (f === 'nota')
    return v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return formatarNumero(v);
}

/**
 * "+12%", "-3 p.p.", "+0,2", "novo", "sem dado", "sem dados ainda": um texto só para a tela, o
 * PDF e a planilha. Os dois meses zerados (conta nova) não são "0% (estável)" (painel M2).
 */
export function textoDaVariacao(l: LinhaComparativo): string {
  if (l.atual === null || l.anterior === null) return 'sem dado';
  if (l.atual === 0 && l.anterior === 0) return 'sem dados ainda';
  if (l.variacao === null) return 'novo';
  if (l.formato === 'fracao') {
    const p = Math.round(l.variacao * 100);
    return `${sinal(p)}${p} p.p.`;
  }
  if (l.formato === 'nota')
    return `${sinal(l.variacao)}${l.variacao.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}`;
  const p = Math.round(l.variacao * 100);
  return `${sinal(p)}${p}%`;
}

const NOME_TENDENCIA = { melhorou: 'Melhorou', piorou: 'Piorou', igual: 'Estável' } as const;

const variacaoRelativa = (atual: number, antes: number): string => {
  if (antes <= 0) return atual > 0 ? 'novo' : '—';
  const p = Math.round(((atual - antes) / antes) * 100);
  return `${sinal(p)}${p}%`;
};

/**
 * Monta o relatório em tabelas. `barbearia` e `unidade` só entram no título ("todas as
 * unidades" quando é a rede).
 */
export function relatorioEmArquivo(
  r: RelatorioDoMes,
  d: { barbearia: string; unidade: string | null; parcial: boolean },
): RelatorioEmArquivo {
  const linhas = compararMeses(r.atual, r.anterior);
  const frases = frasesDoMes(linhas, 6);
  const tabelas: TabelaExportada[] = [];

  tabelas.push({
    titulo: 'O mês em números',
    colunas: [
      { titulo: 'Indicador', peso: 2 },
      { titulo: nomeDoMesPorExtenso(r.mes), numero: true, peso: 1.4 },
      { titulo: nomeDoMesPorExtenso(r.mesAnterior), numero: true, peso: 1.4 },
      { titulo: 'Variação', numero: true },
      { titulo: 'Situação' },
    ],
    linhas: linhas.map((l) => [
      l.rotulo,
      valorIndicador(l.atual, l.formato),
      valorIndicador(l.anterior, l.formato),
      textoDaVariacao(l),
      NOME_TENDENCIA[l.tendencia],
    ]),
  });

  tabelas.push({
    titulo: 'O que melhorou e o que piorou',
    colunas: [{ titulo: 'Lado' }, { titulo: 'O que aconteceu', peso: 5 }],
    linhas: [
      ...frases.melhorou.map((f) => ['Melhorou', f]),
      ...frases.piorou.map((f) => ['Piorou', f]),
    ],
    vazio: 'Nada mudou de forma relevante.',
  });

  tabelas.push({
    titulo: 'Últimos 12 meses',
    colunas: [
      { titulo: 'Mês', peso: 2 },
      { titulo: 'Faturamento (R$)', numero: true, peso: 1.5 },
      ...(r.verLucro ? [{ titulo: 'Lucro (R$)', numero: true, peso: 1.5 }] : []),
    ],
    linhas: r.historico.map((h) => [
      nomeDoMesPorExtenso(h.mes),
      formatarValor(h.faturamento),
      ...(r.verLucro ? [h.lucro !== null ? formatarValor(h.lucro) : '—'] : []),
    ]),
  });

  const canais = CANAIS.filter(
    (c) => (r.atual.porCanal[c] ?? 0) + (r.anterior.porCanal[c] ?? 0) > 0,
  );
  const totalCanais = canais.reduce((s, c) => s + (r.atual.porCanal[c] ?? 0), 0);
  tabelas.push({
    titulo: 'Por onde os clientes chegaram',
    colunas: [
      { titulo: 'Canal', peso: 2 },
      { titulo: 'Atendidos', numero: true },
      { titulo: 'Parte', numero: true },
      { titulo: 'Mês anterior', numero: true },
    ],
    linhas: canais.map((c) => [
      NOME_CANAL[c],
      formatarNumero(r.atual.porCanal[c] ?? 0),
      totalCanais > 0 ? pctInteiro((r.atual.porCanal[c] ?? 0) / totalCanais) : '—',
      formatarNumero(r.anterior.porCanal[c] ?? 0),
    ]),
    vazio: 'Nenhum atendimento no período.',
  });

  const barbeiros = r.barbeiros.filter((b) => b.clientes > 0 || b.faturamentoAnterior > 0);
  if (r.verBarbeiros)
    tabelas.push({
      titulo: 'Barbeiros: quanto custam e quanto rendem',
      colunas: [
        { titulo: 'Barbeiro', peso: 2 },
        { titulo: 'Faturamento (R$)', numero: true, peso: 1.4 },
        { titulo: 'vs. mês anterior', numero: true },
        { titulo: 'Comissão (R$)', numero: true, peso: 1.2, noPdf: true },
        { titulo: 'Valor fixo (R$)', numero: true, peso: 1.2, noPdf: true },
        { titulo: 'Custa no mês (R$)', numero: true, peso: 1.3 },
        ...(r.verLucro ? [{ titulo: 'Lucro que gera (R$)', numero: true, peso: 1.4 }] : []),
        { titulo: 'Atendimentos', numero: true, peso: 1.7 },
        { titulo: 'Ticket (R$)', numero: true },
        { titulo: 'Extras', numero: true, noPdf: true },
        { titulo: 'Retorno', numero: true },
        { titulo: 'Nota', numero: true },
        { titulo: 'Faltas', numero: true, noPdf: true },
        { titulo: 'Agenda ocupada', numero: true, noPdf: true },
        { titulo: 'Confirmou no prazo', numero: true, noPdf: true },
        { titulo: 'Mais faz', noPdf: true },
        { titulo: 'Pontos fortes', noPdf: true },
        { titulo: 'A melhorar', noPdf: true },
      ],
      linhas: barbeiros.map((b) => {
        const { custo, lucro } = custoELucroDoBarbeiro(b);
        const pontos = pontosDoBarbeiro(b, r.barbeiros);
        return [
          b.nome,
          formatarValor(b.faturamento),
          variacaoRelativa(b.faturamento, b.faturamentoAnterior),
          formatarValor(b.comissao),
          formatarValor(b.custoFixo),
          formatarValor(custo),
          ...(r.verLucro ? [formatarValor(lucro)] : []),
          formatarNumero(b.atendimentos),
          formatarValor(b.ticketMedio),
          pctInteiro(b.percentualExtras),
          pctInteiro(b.taxaRetorno),
          b.notaMedia !== null
            ? b.notaMedia.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
            : '—',
          formatarNumero(b.faltas),
          pctInteiro(b.ocupacao),
          pctInteiro(b.percentualNoPrazo),
          b.servicosMaisFeitos.map((s) => `${s.nome} (${s.quantidade})`).join(', '),
          pontos.fortes.join('; '),
          pontos.fracos.join('; '),
        ];
      }),
      vazio: 'Nenhum barbeiro atendeu no período.',
    });

  // No PDF, o que não cabe na tabela de barbeiros vem numa segunda, em texto corrido.
  const detalhes = barbeiros
    .map((b) => {
      const p = pontosDoBarbeiro(b, r.barbeiros);
      return [
        b.nome,
        b.servicosMaisFeitos.map((s) => `${s.nome} (${s.quantidade})`).join(', ') || '—',
        p.fortes.join('; ') || '—',
        p.fracos.join('; ') || '—',
      ];
    })
    .filter((l) => l.slice(1).some((t) => t !== '—'));
  if (r.verBarbeiros && detalhes.length)
    tabelas.push({
      titulo: 'Barbeiros: serviços, pontos fortes e a melhorar',
      colunas: [
        { titulo: 'Barbeiro', peso: 1.4 },
        { titulo: 'Mais faz', peso: 2 },
        { titulo: 'Pontos fortes', peso: 2.2 },
        { titulo: 'A melhorar', peso: 2.2 },
      ],
      linhas: detalhes,
      soPdf: true,
    });

  const mix = mixDoMes(r.mixAtual, r.mixAnterior);
  tabelas.push({
    titulo: 'Serviços e produtos: quanto cada um pesa',
    colunas: [
      { titulo: 'Item', peso: 2.4 },
      { titulo: 'Tipo' },
      { titulo: 'Quantidade', numero: true, peso: 1.3 },
      { titulo: '% da quantidade', numero: true, peso: 1.3 },
      { titulo: 'Receita (R$)', numero: true, peso: 1.3 },
      { titulo: '% da receita', numero: true },
      { titulo: 'vs. mês anterior', numero: true },
      ...(r.verLucro ? [{ titulo: 'Lucro (R$)', numero: true, peso: 1.3 }] : []),
    ],
    linhas: mix.map((l) => [
      l.nome,
      l.tipo === 'servico' ? 'Serviço' : 'Produto',
      formatarNumero(l.quantidade),
      pctInteiro(l.fatiaQuantidade),
      formatarValor(l.receita),
      pctInteiro(l.fatiaReceita),
      l.variacaoReceita === null
        ? 'novo'
        : `${sinal(Math.round(l.variacaoReceita * 100))}${Math.round(l.variacaoReceita * 100)}%`,
      ...(r.verLucro ? [l.lucro !== null ? formatarValor(l.lucro) : '—'] : []),
    ]),
    vazio: 'Nenhum serviço ou produto vendido no período.',
  });

  const dia = Number(r.periodoAnterior.ate.slice(8, 10));
  return {
    titulo: d.barbearia,
    subtitulo: `Relatório de ${nomeDoMesPorExtenso(r.mes)} comparado com ${nomeDoMesPorExtenso(r.mesAnterior)} · ${d.unidade ?? 'todas as unidades'}`,
    aviso: d.parcial
      ? `O mês ainda não acabou: a comparação é com os mesmos dias do mês anterior (1 a ${dia}).`
      : null,
    tabelas,
  };
}

/** Campo CSV seguro: aspas quando precisa e sem fórmula (=, +, -, @ no início viram texto). */
export function campoCsv(v: string): string {
  // "+12%" e "-3 p.p." são variações, não fórmulas: só protege o que o Excel executaria.
  const formula =
    /^[=@\t\r]/.test(v) || (/^[+-]/.test(v) && !/^[+-](R\$\s)?[\d.,]+( ?%| p\.p\.)?$/.test(v));
  const t = formula ? `'${v}` : v;
  return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/**
 * Planilha (CSV com ";" e BOM para o Excel em português): uma seção por tabela, com o título
 * numa linha, o cabeçalho e as linhas, e uma linha em branco entre as seções.
 */
export function relatorioEmCsv(a: RelatorioEmArquivo): string {
  const saida: string[][] = [[a.titulo], [a.subtitulo]];
  if (a.aviso) saida.push([a.aviso]);
  for (const t of a.tabelas) {
    if (t.soPdf) continue;
    saida.push(
      [],
      [t.titulo.toUpperCase()],
      t.colunas.map((c) => c.titulo),
    );
    if (t.linhas.length === 0 && t.vazio) saida.push([t.vazio]);
    for (const l of t.linhas) saida.push(l);
  }
  return `\uFEFF${saida.map((l) => l.map(campoCsv).join(';')).join('\r\n')}\r\n`;
}
