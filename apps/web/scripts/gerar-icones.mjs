// Gera os ícones do PWA a partir do desenho do pente (rodar após mudar a marca):
//   node apps/web/scripts/gerar-icones.mjs
import sharp from 'sharp';

const dentes = (x0, passo, topo, comprido, curto, n) =>
  Array.from(
    { length: n },
    (_, i) =>
      `<rect x="${x0 + i * passo}" y="${topo}" width="${passo * 0.56}" height="${i % 2 ? curto : comprido}" rx="${passo * 0.2}"/>`,
  ).join('');

// Área útil menor no "maskable": o sistema recorta em círculo ou gota.
function svg(tamanho, margem, arredondado) {
  const util = tamanho - margem * 2;
  const x = margem + util * 0.08;
  const largura = util * 0.84;
  const topo = margem + util * 0.24;
  const passo = largura / 9;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tamanho}" height="${tamanho}">
<rect width="${tamanho}" height="${tamanho}" rx="${arredondado ? tamanho * 0.22 : 0}" fill="#0b0b0b"/>
<g fill="#f5d33b"><rect x="${x}" y="${topo}" width="${largura}" height="${util * 0.17}" rx="${util * 0.04}"/>
${dentes(x + passo * 0.22, passo, topo + util * 0.17, util * 0.36, util * 0.25, 9)}</g></svg>`;
}

const saidas = [
  ['icone-192.png', 192, 0, true],
  ['icone-512.png', 512, 0, true],
  ['icone-maskable-512.png', 512, 96, false],
  ['apple-touch-icon.png', 180, 18, false],
];
for (const [nome, t, m, r] of saidas) {
  await sharp(Buffer.from(svg(t, m, r)))
    .png()
    .toFile(new URL(`../public/icones/${nome}`, import.meta.url).pathname);
  console.log(`public/icones/${nome}`);
}
