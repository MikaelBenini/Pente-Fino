'use client';

// Campo de foto do painel "Minha página" (lote 7c). A foto é reduzida aqui mesmo, no navegador
// (até 1600 px, em WebP): o envio fica pequeno no 4G e a imagem refeita já sai sem os dados da
// câmera. A API refaz de novo e guarda em dois tamanhos.
import { MAXIMO_BYTES_FOTO, urlDaFoto, type FotoEnviada } from '@pente-fino/shared';
import { Botao } from '@pente-fino/ui';
import { ImagePlus } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { api, ErroApi } from '@/lib/api';

const LADO_MAXIMO = 1600;

async function paraBlob(canvas: HTMLCanvasElement, tipo: string, qualidade: number) {
  return new Promise<Blob | null>((ok) => canvas.toBlob(ok, tipo, qualidade));
}

/** Reduz e reencoda a foto. Devolve o tipo e o conteúdo em base64. */
export async function reduzirFoto(
  arquivo: File,
): Promise<{ tipo: 'image/webp' | 'image/jpeg'; dados: string }> {
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  for (const [lado, qualidade] of [
    [LADO_MAXIMO, 0.82],
    [LADO_MAXIMO, 0.68],
    [1200, 0.7],
  ] as const) {
    const escala = Math.min(1, lado / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    // Navegador sem WebP no canvas devolve PNG: aí vai em JPEG.
    let blob = await paraBlob(canvas, 'image/webp', qualidade);
    if (!blob || blob.type !== 'image/webp') blob = await paraBlob(canvas, 'image/jpeg', qualidade);
    if (blob && blob.size <= MAXIMO_BYTES_FOTO) {
      const dados = await new Promise<string>((ok, falha) => {
        const leitor = new FileReader();
        leitor.onload = () => ok(String(leitor.result).split(',')[1] ?? '');
        leitor.onerror = () => falha(leitor.error);
        leitor.readAsDataURL(blob);
      });
      bitmap.close();
      return { tipo: blob.type === 'image/webp' ? 'image/webp' : 'image/jpeg', dados };
    }
  }
  bitmap.close();
  throw new Error('grande');
}

export function CampoFoto({
  rotulo,
  unidadeId,
  valor,
  onMudar,
  dica,
}: {
  rotulo: string;
  unidadeId: string;
  valor: string | undefined;
  onMudar: (foto: FotoEnviada | null) => void;
  dica?: string;
}) {
  const id = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro(null);
    setEnviando(true);
    try {
      const reduzida = await reduzirFoto(arquivo).catch(() => {
        throw new ErroApi(
          400,
          'foto_invalida',
          'Não deu para abrir essa imagem. Use uma foto JPG, PNG ou WebP.',
        );
      });
      onMudar(await api<FotoEnviada>(`unidades/${unidadeId}/site/fotos`, { corpo: reduzida }));
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não deu para enviar a foto. Tente de novo.');
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p id={`${id}-rotulo`} className="text-sm font-medium">
        {rotulo}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {valor ? (
          // eslint-disable-next-line @next/next/no-img-element -- miniatura da foto já enviada
          <img
            src={urlDaFoto(valor, 640)}
            alt=""
            className="h-16 w-24 rounded-md border border-borda object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="grid h-16 w-24 place-items-center rounded-md border border-dashed border-borda-forte text-tinta-suave"
          >
            <ImagePlus className="size-5" />
          </span>
        )}
        <input
          ref={entrada}
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-labelledby={`${id}-rotulo`}
          className="sr-only"
          onChange={(e) => void escolher(e.target.files?.[0])}
        />
        <Botao variante="secundario" carregando={enviando} onClick={() => entrada.current?.click()}>
          {valor ? 'Trocar foto' : 'Escolher foto'}
        </Botao>
        {valor && !enviando && (
          <Botao variante="fantasma" onClick={() => onMudar(null)}>
            Tirar foto
          </Botao>
        )}
      </div>
      {dica && <p className="text-sm text-tinta-suave">{dica}</p>}
      {erro && (
        <p role="alert" className="text-sm text-perigo-texto">
          {erro}
        </p>
      )}
    </div>
  );
}
