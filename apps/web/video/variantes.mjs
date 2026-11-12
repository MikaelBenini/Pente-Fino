// Site D1: versão com metade da largura de cada foto de tela (public/site/<nome>-<largura>.webp),
// para o celular baixar a menor pelo srcset. Roda sozinho ou no fim do telas.mjs:
//   node video/variantes.mjs
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const PASTA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/site');

export async function gerarVariantes() {
  for (const arquivo of await readdir(PASTA)) {
    if (!arquivo.endsWith('.webp') || /-\d+\.webp$/.test(arquivo)) continue;
    const origem = path.join(PASTA, arquivo);
    const { width } = await sharp(origem).metadata();
    const metade = Math.round(width / 2);
    const destino = path.join(PASTA, arquivo.replace(/\.webp$/, `-${metade}.webp`));
    await sharp(origem).resize({ width: metade }).webp({ quality: 82 }).toFile(destino);
    console.log(`site/${path.basename(destino)}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await gerarVariantes();
