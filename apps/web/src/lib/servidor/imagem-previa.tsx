import 'server-only';
import type { PreviaDoLink } from '@pente-fino/shared';
import { ImageResponse } from 'next/og';
import sharp from 'sharp';
import { urlDaApi } from './sessao';

// Prévia do link (pedido do dono em 20/11/2026): a imagem que o WhatsApp, o Instagram e o Facebook
// mostram quando o link da barbearia é enviado, com o logotipo, o nome e a cor dela. A mesma
// arte serve ao link de agendamento (/b) e ao site (/s).

export const TAMANHO_PREVIA = { width: 1200, height: 630 };

/** A foto vem em WebP; a imagem da prévia só aceita PNG ou JPEG. null se não der para ler. */
async function fotoComoDado(id: string | null, largura: number): Promise<string | null> {
  if (!id) return null;
  try {
    const r = await fetch(`${urlDaApi()}/publico/fotos/${id}-${largura >= 640 ? 1600 : 640}.webp`);
    if (!r.ok) return null;
    const png = await sharp(Buffer.from(await r.arrayBuffer()))
      .resize({ width: largura, withoutEnlargement: true })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function imagemDaPrevia(d: {
  previa: PreviaDoLink | null;
  barbearia: string;
  unidade: string | null;
  linha: string | null;
  botao: string;
}): Promise<ImageResponse> {
  const previa = d.previa;
  const [logo, capa] = await Promise.all([
    fotoComoDado(previa?.logo ?? null, 320),
    fotoComoDado(previa?.capa ?? null, 1200),
  ]);
  const cor = previa?.cor ?? '#C8A55C';
  const titulo = previa?.titulo ?? d.barbearia;
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        background: '#0b0b0b',
        color: '#f4f4ef',
        fontFamily: 'sans-serif',
      }}
    >
      {capa && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={capa}
          alt=""
          width={1200}
          height={630}
          style={{ position: 'absolute', inset: 0, objectFit: 'cover', opacity: 0.45 }}
        />
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: 72,
          borderLeft: `18px solid ${cor}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt=""
              width={180}
              height={180}
              style={{ borderRadius: 24, objectFit: 'contain', background: '#ffffff' }}
            />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
            {d.unidade && (
              <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: 3, color: cor }}>
                {d.unidade.toUpperCase()}
              </div>
            )}
            <div
              style={{
                fontSize: titulo.length > 28 ? 64 : 84,
                fontWeight: 800,
                lineHeight: 1.02,
              }}
            >
              {titulo}
            </div>
          </div>
        </div>
        {d.linha && <div style={{ fontSize: 32, color: '#d6d6cf', maxWidth: 1000 }}>{d.linha}</div>}
        <div style={{ display: 'flex' }}>
          <div
            style={{
              display: 'flex',
              padding: '20px 36px',
              borderRadius: 14,
              background: cor,
              color: '#0b0b0b',
              fontSize: 40,
              fontWeight: 800,
            }}
          >
            {d.botao}
          </div>
        </div>
      </div>
    </div>,
    TAMANHO_PREVIA,
  );
}
