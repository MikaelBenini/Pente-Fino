import { formatarMoeda, precoInicial } from '@pente-fino/shared';
import { ImageResponse } from 'next/og';
import { unidadePublica } from '@/lib/servidor/pagina-publica';

// Painel P1: a prévia do link no WhatsApp e no Instagram mostra a barbearia, não o Pente Fino.
export const alt = 'Agende online';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Imagem({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const u = await unidadePublica(slug);
  const preco = u ? precoInicial(u) : null;
  const unidade = u && u.nome.toLowerCase() !== u.barbearia.toLowerCase() ? u.nome : null;
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: '#0b0b0b',
        color: '#f4f4ef',
        padding: 72,
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {unidade && (
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: 3, color: '#f5d33b' }}>
            {unidade.toUpperCase()}
          </div>
        )}
        <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1, textTransform: 'uppercase' }}>
          {u?.barbearia ?? 'Agende seu horário'}
        </div>
        {u?.endereco && <div style={{ fontSize: 30, color: '#aaaaa1' }}>{u.endereco}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{
            display: 'flex',
            padding: '20px 36px',
            borderRadius: 14,
            background: '#a3e635',
            color: '#0b0b0b',
            fontSize: 40,
            fontWeight: 800,
          }}
        >
          Agende online
        </div>
        {preco !== null && (
          <div style={{ display: 'flex', fontSize: 36, color: '#f4f4ef' }}>
            {`a partir de ${formatarMoeda(preco)}`}
          </div>
        )}
      </div>
    </div>,
    size,
  );
}
