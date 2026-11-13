// Fotos do site da barbearia (lote 7c): /f/<id>-640.webp e /f/<id>-1600.webp. Vêm da API e
// ficam guardadas no navegador por um ano (o arquivo de um id nunca muda).
import { NOME_ARQUIVO_FOTO } from '@pente-fino/shared';
import { urlDaApi } from '@/lib/servidor/sessao';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ arquivo: string }> },
): Promise<Response> {
  const { arquivo } = await ctx.params;
  if (!NOME_ARQUIVO_FOTO.test(arquivo))
    return new Response('Foto não encontrada.', { status: 404 });
  const r = await fetch(`${urlDaApi()}/publico/fotos/${arquivo}`).catch(() => null);
  if (!r?.ok || !r.body) return new Response('Foto não encontrada.', { status: 404 });
  return new Response(r.body, {
    headers: {
      'content-type': 'image/webp',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
