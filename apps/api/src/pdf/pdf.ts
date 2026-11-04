// Utilitários de PDF (pdf-lib, fontes padrão). As fontes padrão usam WinAnsi:
// acentos do português funcionam; símbolos fora dele viram "?" em vez de quebrar.
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import QRCode from 'qrcode';

export const A4 = { largura: 595.28, altura: 841.89 };
export const TINTA = rgb(0.07, 0.07, 0.07);
export const SUAVE = rgb(0.38, 0.38, 0.36);
export const LINHA = rgb(0.75, 0.75, 0.72);

/** Deixa o texto dentro do que a fonte padrão consegue desenhar. */
export function seguro(texto: string): string {
  return texto
    .replace(/[‒-―−]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/[^ -~¡-ÿ]/g, '?');
}

export async function novoDocumento(titulo: string) {
  const doc = await PDFDocument.create();
  doc.setTitle(seguro(titulo));
  doc.setProducer('Pente Fino');
  doc.setCreator('Pente Fino');
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  return { doc, fonte, negrito };
}

/** Escreve cortando com "..." o que não cabe na largura. */
export function texto(
  pagina: PDFPage,
  t: string,
  x: number,
  y: number,
  fonte: PDFFont,
  tamanho: number,
  opcoes: { largura?: number; cor?: ReturnType<typeof rgb>; direita?: boolean } = {},
) {
  let s = seguro(t);
  if (opcoes.largura) {
    while (s.length > 1 && fonte.widthOfTextAtSize(s, tamanho) > opcoes.largura)
      s = `${s.slice(0, -2)}…`.replace('…', '...');
  }
  const w = fonte.widthOfTextAtSize(s, tamanho);
  pagina.drawText(s, {
    x: opcoes.direita ? x - w : x,
    y,
    size: tamanho,
    font: fonte,
    color: opcoes.cor ?? TINTA,
  });
}

/** QR code desenhado em vetor (nítido em qualquer impressora). */
export function qr(pagina: PDFPage, conteudo: string, x: number, y: number, tamanho: number) {
  const { modules } = QRCode.create(conteudo, { errorCorrectionLevel: 'M' });
  const n = modules.size;
  const passo = tamanho / n;
  for (let lin = 0; lin < n; lin++) {
    for (let col = 0; col < n; col++) {
      if (modules.get(lin, col))
        pagina.drawRectangle({
          x: x + col * passo,
          y: y + tamanho - (lin + 1) * passo,
          width: passo + 0.05,
          height: passo + 0.05,
          color: TINTA,
        });
    }
  }
}
