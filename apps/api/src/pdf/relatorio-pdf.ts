// PDF do relatório do mês (Etapa 23.1): título, aviso do período e cada tabela de
// relatorioEmArquivo (packages/shared), com quebra de linha nas células, quebra de página
// repetindo o cabeçalho da tabela e rodapé com a página. A4 em pé, fontes padrão.
import type { RelatorioEmArquivo, TabelaExportada } from '@pente-fino/shared';
import { rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { A4, LINHA, novoDocumento, seguro, SUAVE, texto } from './pdf.js';

const MARGEM = 48;
const LARGURA = A4.largura - 2 * MARGEM;
const TOPO = A4.altura - 56;
const RODAPE = 56;
const CORPO = 8.5;
const ALTURA_LINHA = 11;
const PREENCHIMENTO = 4;
const ESPACO_COLUNA = 6;
const FUNDO_CABECALHO = rgb(0.95, 0.95, 0.93);

/** Quebra o texto em linhas que cabem na largura (palavra longa demais é cortada com ".."). */
export function quebrar(t: string, fonte: PDFFont, tamanho: number, largura: number): string[] {
  const palavras = seguro(t).split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return [''];
  const linhas: string[] = [];
  let atual = '';
  const caber = (p: string) => {
    let x = p;
    while (x.length > 1 && fonte.widthOfTextAtSize(x, tamanho) > largura) x = x.slice(0, -1);
    return x === p ? p : `${x.slice(0, -2)}..`;
  };
  for (const bruta of palavras) {
    const p = caber(bruta);
    const tentativa = atual ? `${atual} ${p}` : p;
    if (fonte.widthOfTextAtSize(tentativa, tamanho) <= largura) atual = tentativa;
    else {
      if (atual) linhas.push(atual);
      atual = p;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

export async function relatorioEmPdf(a: RelatorioEmArquivo, geradoEm: Date): Promise<Uint8Array> {
  const { doc, fonte, negrito } = await novoDocumento(a.subtitulo);
  let pagina: PDFPage = doc.addPage([A4.largura, A4.altura]);
  let y = TOPO;

  const novaPagina = () => {
    pagina = doc.addPage([A4.largura, A4.altura]);
    y = TOPO;
  };
  const cabe = (altura: number) => y - altura >= RODAPE;

  // Cabeçalho do documento.
  texto(pagina, a.titulo, MARGEM, y, negrito, 18, { largura: LARGURA });
  y -= 20;
  for (const l of quebrar(a.subtitulo, fonte, 10, LARGURA)) {
    texto(pagina, l, MARGEM, y, fonte, 10, { cor: SUAVE });
    y -= 13;
  }
  if (a.aviso) {
    y -= 2;
    for (const l of quebrar(a.aviso, fonte, 9, LARGURA)) {
      texto(pagina, l, MARGEM, y, fonte, 9, { cor: SUAVE });
      y -= 12;
    }
  }
  y -= 10;

  for (const t of a.tabelas) desenharTabela(t);

  // Rodapé com a página, depois que se sabe quantas são.
  const paginas = doc.getPages();
  const quando = geradoEm.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  });
  paginas.forEach((p, i) => {
    texto(p, `Gerado pelo Pente Fino em ${quando}`, MARGEM, 32, fonte, 7.5, { cor: SUAVE });
    texto(p, `Página ${i + 1} de ${paginas.length}`, A4.largura - MARGEM, 32, fonte, 7.5, {
      cor: SUAVE,
      direita: true,
    });
  });
  return doc.save();

  function desenharTabela(t: TabelaExportada) {
    const indices = t.colunas.map((c, i) => (c.noPdf ? -1 : i)).filter((i) => i >= 0);
    const colunas = indices.map((i) => t.colunas[i]!);
    const pesoTotal = colunas.reduce((s, c) => s + (c.peso ?? 1), 0);
    const util = LARGURA - ESPACO_COLUNA * (colunas.length - 1);
    const larguras = colunas.map((c) => ((c.peso ?? 1) / pesoTotal) * util);
    const xs: number[] = [];
    larguras.reduce((x, w, i) => ((xs[i] = x), x + w + ESPACO_COLUNA), MARGEM);

    const celulas = (valores: string[], f: PDFFont) =>
      valores.map((v, i) => quebrar(v, f, CORPO, larguras[i]!));
    const alturaDe = (c: string[][]) =>
      Math.max(...c.map((l) => l.length)) * ALTURA_LINHA + 2 * PREENCHIMENTO;

    const cabecalho = celulas(
      colunas.map((c) => c.titulo),
      negrito,
    );
    const alturaCabecalho = alturaDe(cabecalho);
    const linhas = t.linhas.map((l) =>
      celulas(
        indices.map((i) => l[i] ?? ''),
        fonte,
      ),
    );

    const desenharLinha = (c: string[][], f: PDFFont, fundo = false) => {
      const altura = alturaDe(c);
      if (fundo)
        pagina.drawRectangle({
          x: MARGEM - 2,
          y: y - altura,
          width: LARGURA + 4,
          height: altura,
          color: FUNDO_CABECALHO,
        });
      c.forEach((partes, i) => {
        const numero = colunas[i]!.numero;
        partes.forEach((p, k) => {
          const base = y - PREENCHIMENTO - (k + 1) * ALTURA_LINHA + 2.5;
          texto(pagina, p, numero ? xs[i]! + larguras[i]! : xs[i]!, base, f, CORPO, {
            direita: numero,
          });
        });
      });
      y -= altura;
      pagina.drawLine({
        start: { x: MARGEM - 2, y },
        end: { x: MARGEM + LARGURA + 2, y },
        thickness: 0.4,
        color: LINHA,
      });
    };
    const titulo = () => {
      texto(pagina, t.titulo, MARGEM, y - 11, negrito, 11);
      y -= 18;
    };

    // Título, cabeçalho e ao menos uma linha juntos na mesma página.
    const primeira = linhas[0] ? alturaDe(linhas[0]) : ALTURA_LINHA + 2 * PREENCHIMENTO;
    if (!cabe(18 + alturaCabecalho + primeira)) novaPagina();
    titulo();
    desenharLinha(cabecalho, negrito, true);
    if (linhas.length === 0) {
      texto(pagina, t.vazio ?? 'Sem dados.', MARGEM, y - 12, fonte, CORPO, { cor: SUAVE });
      y -= 18;
    }
    for (const l of linhas) {
      if (!cabe(alturaDe(l))) {
        novaPagina();
        texto(pagina, `${t.titulo} (continuação)`, MARGEM, y - 11, negrito, 11);
        y -= 18;
        desenharLinha(cabecalho, negrito, true);
      }
      desenharLinha(l, fonte);
    }
    y -= 20;
  }
}
