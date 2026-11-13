// Fotos do site da barbearia (seção 7, lote 7c). A imagem já chega reduzida do navegador; aqui
// ela é refeita do zero (sem os dados da câmera, como a localização), girada pela orientação da
// foto e guardada em dois tamanhos WebP: FOTOS_DIR/<id>-640.webp e <id>-1600.webp.
import { MAXIMO_BYTES_FOTO, NOME_ARQUIVO_FOTO, TAMANHOS_FOTO } from '@pente-fino/shared';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { Erros } from '../comum/erros.js';

export interface FotoProcessada {
  largura: number;
  altura: number;
  bytes: number;
  arquivos: { tamanho: number; dados: Buffer }[];
}

/** Lê, limpa e reduz a foto. Erro de requisição quando não é uma imagem que dá para abrir. */
export async function processarFoto(base64: string): Promise<FotoProcessada> {
  const original = Buffer.from(base64, 'base64');
  if (original.length === 0 || original.length > MAXIMO_BYTES_FOTO)
    throw Erros.requisicaoInvalida('foto_invalida', 'Foto grande demais. Tente outra.');
  try {
    // rotate() sem ângulo aplica a orientação da câmera; sem withMetadata(), nada da câmera fica.
    const base = sharp(original, { limitInputPixels: 40_000_000 }).rotate();
    const arquivos = await Promise.all(
      TAMANHOS_FOTO.map(async (tamanho) => ({
        tamanho,
        dados: await base
          .clone()
          .resize({ width: tamanho, withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer(),
      })),
    );
    const maior = await sharp(arquivos[arquivos.length - 1]!.dados).metadata();
    return {
      largura: maior.width ?? 0,
      altura: maior.height ?? 0,
      bytes: arquivos.reduce((s, a) => s + a.dados.length, 0),
      arquivos,
    };
  } catch {
    throw Erros.requisicaoInvalida(
      'foto_invalida',
      'Não deu para abrir essa imagem. Use uma foto JPG, PNG ou WebP.',
    );
  }
}

export async function gravarFoto(pasta: string, id: string, foto: FotoProcessada): Promise<void> {
  await mkdir(pasta, { recursive: true });
  await Promise.all(
    foto.arquivos.map((a) => writeFile(join(pasta, `${id}-${a.tamanho}.webp`), a.dados)),
  );
}

export async function apagarFoto(pasta: string, id: string): Promise<void> {
  await Promise.all(TAMANHOS_FOTO.map((t) => rm(join(pasta, `${id}-${t}.webp`), { force: true })));
}

/** Arquivo pedido em /publico/fotos/:arquivo; null quando o nome não vale ou não existe. */
export async function lerFoto(pasta: string, arquivo: string): Promise<Buffer | null> {
  if (!NOME_ARQUIVO_FOTO.test(arquivo)) return null;
  try {
    return await readFile(join(pasta, arquivo));
  } catch {
    return null;
  }
}
