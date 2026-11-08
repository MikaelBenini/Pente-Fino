// Junta as cenas gravadas (video-tmp/cenas) num vídeo só, com transições, e gera a capa.
//   node video/editar.mjs
// Saída: public/video/apresentacao.mp4 e public/video/apresentacao.jpg (precisa do ffmpeg).
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TELA_CELULAR } from './cartoes.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const CENAS = path.resolve(AQUI, '../video-tmp/cenas');
const DESTINO = path.resolve(AQUI, '../public/video');
const TMP = path.resolve(AQUI, '../video-tmp/edicao');
const FPS = 30;
const TRANSICAO = 0.6;
// Transição na entrada de cada cena (a primeira não tem).
const EFEITOS = ['fade', 'smoothleft', 'smoothup', 'fade', 'smoothleft', 'smoothup', 'fade'];

await mkdir(DESTINO, { recursive: true });
await mkdir(TMP, { recursive: true });
const { cenas } = JSON.parse(await readFile(path.join(CENAS, 'manifesto.json'), 'utf8'));
const ffmpeg = (args) =>
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });

// Máscara de cantos arredondados para a tela do celular.
const mascara = path.join(TMP, 'mascara.png');
{
  const b = await chromium.launch();
  const p = await b.newPage({
    viewport: { width: TELA_CELULAR.largura, height: TELA_CELULAR.altura },
  });
  await p.setContent(
    `<body style="margin:0;background:transparent"><div style="width:100vw;height:100vh;background:#fff;border-radius:${TELA_CELULAR.raio}px"></div></body>`,
  );
  await p.screenshot({ path: mascara, omitBackground: true });
  await b.close();
}

// 1) Cada cena recortada, em 1280×720 a 30 quadros.
const partes = [];
for (const c of cenas) {
  const saida = path.join(TMP, `${c.nome}.mp4`);
  const corte = ['-ss', String(c.inicio), '-t', String(c.duracao)];
  if (c.celular) {
    const t = TELA_CELULAR;
    ffmpeg([
      ...['-ss', String(c.fundoInicio), '-t', String(c.duracao), '-i', c.fundoArquivo],
      ...corte,
      ...['-i', c.arquivo],
      ...['-i', mascara],
      '-filter_complex',
      [
        `[0:v]fps=${FPS},scale=1280:720,setsar=1[fundo]`,
        `[1:v]fps=${FPS},scale=${t.largura}:${t.altura}:flags=lanczos,format=rgba[tela]`,
        `[2:v]format=gray,scale=${t.largura}:${t.altura}[m]`,
        `[tela][m]alphamerge[telar]`,
        `[fundo][telar]overlay=${t.x}:${t.y}:shortest=1,format=yuv420p[v]`,
      ].join(';'),
      ...['-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', saida],
    ]);
  } else {
    ffmpeg([
      ...corte,
      ...['-i', c.arquivo],
      '-vf',
      `fps=${FPS},scale=1280:720:flags=lanczos,setsar=1,format=yuv420p`,
      ...['-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', saida],
    ]);
  }
  partes.push({ arquivo: saida, duracao: c.duracao });
}

// 2) Tudo junto, com transição na troca de cena.
const entradas = partes.flatMap((p) => ['-i', p.arquivo]);
const filtros = [];
let anterior = '[0:v]';
let acumulado = partes[0].duracao;
for (let i = 1; i < partes.length; i++) {
  const offset = (acumulado - TRANSICAO).toFixed(3);
  const rotulo = i === partes.length - 1 ? '[junto]' : `[x${i}]`;
  filtros.push(
    `${anterior}[${i}:v]xfade=transition=${EFEITOS[(i - 1) % EFEITOS.length]}:duration=${TRANSICAO}:offset=${offset}${rotulo}`,
  );
  anterior = rotulo;
  acumulado += partes[i].duracao - TRANSICAO;
}
// Entrada e saída do preto.
filtros.push(
  `[junto]fade=t=in:st=0:d=0.5,fade=t=out:st=${(acumulado - 0.6).toFixed(2)}:d=0.6,format=yuv420p[v]`,
);
const mp4 = path.join(DESTINO, 'apresentacao.mp4');
ffmpeg([
  ...entradas,
  '-filter_complex',
  filtros.join(';'),
  ...[
    '-map',
    '[v]',
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '27',
    '-profile:v',
    'high',
  ],
  ...['-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4],
]);

// WebM (VP9) para os navegadores sem H.264 (Chromium livre, alguns Linux).
ffmpeg([
  ...['-i', mp4, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '40', '-row-mt', '1'],
  ...['-deadline', 'good', '-cpu-used', '4', '-an', path.join(DESTINO, 'apresentacao.webm')],
]);

// 3) Capa: um quadro da abertura com o título já na tela.
ffmpeg([
  '-ss',
  '3.2',
  '-i',
  mp4,
  '-frames:v',
  '1',
  '-q:v',
  '3',
  path.join(DESTINO, 'apresentacao.jpg'),
]);

const tamanho = (await stat(mp4)).size / 1024 / 1024;
console.log(`apresentacao.mp4: ${acumulado.toFixed(1)} s, ${tamanho.toFixed(1)} MB`);
