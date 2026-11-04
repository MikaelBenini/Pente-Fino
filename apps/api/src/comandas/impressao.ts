import { formatarDiaPorExtenso, formatarHora, formatarMoeda } from '@pente-fino/shared';
import { A4, LINHA, novoDocumento, qr, SUAVE, texto } from '../pdf/pdf.js';

export interface ComandaParaImprimir {
  id: string;
  numero: number;
  unidade: string;
  inicio: Date | null;
  cliente: string;
  profissional: string;
  itens: { descricao: string; valor: number }[];
  total: number;
}

/**
 * Comandas em A4, 4 (2×2) ou 6 (2×3) por folha, com linhas de corte e um QR code
 * que abre a comanda no sistema. Espaço em branco para anotar extras à mão.
 */
export async function pdfComandas(
  comandas: ComandaParaImprimir[],
  porFolha: 4 | 6,
  urlComanda: (id: string) => string,
  titulo: string,
): Promise<Uint8Array> {
  const { doc, fonte, negrito } = await novoDocumento(titulo);
  const colunas = 2;
  const linhas = porFolha / colunas;
  const margem = 18;
  const w = (A4.largura - margem * 2) / colunas;
  const h = (A4.altura - margem * 2) / linhas;
  const corpo = porFolha === 4 ? 10 : 9;

  for (let i = 0; i < Math.max(comandas.length, 1); i += porFolha) {
    const pagina = doc.addPage([A4.largura, A4.altura]);
    // Linhas de corte.
    for (let c = 1; c < colunas; c++)
      pagina.drawLine({
        start: { x: margem + c * w, y: margem },
        end: { x: margem + c * w, y: A4.altura - margem },
        thickness: 0.5,
        color: LINHA,
        dashArray: [4, 3],
      });
    for (let l = 1; l < linhas; l++)
      pagina.drawLine({
        start: { x: margem, y: margem + l * h },
        end: { x: A4.largura - margem, y: margem + l * h },
        thickness: 0.5,
        color: LINHA,
        dashArray: [4, 3],
      });
    if (comandas.length === 0) {
      texto(pagina, 'Nenhuma comanda neste dia.', margem + 16, A4.altura - margem - 30, fonte, 12);
      break;
    }
    comandas.slice(i, i + porFolha).forEach((c, k) => {
      const x = margem + (k % colunas) * w + 14;
      const topo = A4.altura - margem - Math.floor(k / colunas) * h - 14;
      const largura = w - 28;
      let y = topo - 10;
      texto(
        pagina,
        `COMANDA ${String(c.numero).padStart(3, '0')} · ${c.unidade.toUpperCase()}`,
        x,
        y,
        negrito,
        8,
        { cor: SUAVE, largura },
      );
      y -= 18;
      texto(
        pagina,
        c.inicio ? `${formatarDiaPorExtenso(c.inicio)}, ${formatarHora(c.inicio)}` : 'Sem horário',
        x,
        y,
        fonte,
        corpo,
        { cor: SUAVE, largura },
      );
      y -= 20;
      texto(pagina, c.cliente, x, y, negrito, corpo + 6, { largura });
      y -= 16;
      texto(pagina, `Barbeiro: ${c.profissional}`, x, y, fonte, corpo, { largura });
      y -= 18;
      for (const item of c.itens.slice(0, porFolha === 4 ? 6 : 4)) {
        texto(pagina, item.descricao, x, y, fonte, corpo, { largura: largura - 70 });
        texto(pagina, formatarMoeda(item.valor), x + largura, y, fonte, corpo, { direita: true });
        y -= corpo + 5;
      }
      y -= 4;
      texto(pagina, 'Extras e produtos:', x, y, negrito, corpo - 1, { cor: SUAVE });
      const linhasAnotar = porFolha === 4 ? 4 : 2;
      for (let a = 0; a < linhasAnotar; a++) {
        y -= corpo + 9;
        pagina.drawLine({
          start: { x, y },
          end: { x: x + largura - 80, y },
          thickness: 0.5,
          color: LINHA,
        });
      }
      const base = A4.altura - margem - (Math.floor(k / colunas) + 1) * h + 14;
      texto(pagina, 'Total previsto', x, base + 18, fonte, corpo - 1, { cor: SUAVE });
      texto(pagina, formatarMoeda(c.total), x, base, negrito, corpo + 4);
      const tq = porFolha === 4 ? 70 : 58;
      qr(pagina, urlComanda(c.id), x + largura - tq, base - 4, tq);
      texto(
        pagina,
        'Abrir no sistema',
        x + largura - tq / 2 - fonte.widthOfTextAtSize('Abrir no sistema', 6) / 2,
        base - 12,
        fonte,
        6,
        { cor: SUAVE },
      );
    });
  }
  return doc.save();
}
