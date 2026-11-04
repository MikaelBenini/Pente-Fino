import { ImageResponse } from 'next/og';

export const alt = 'Pente Fino: saiba quanto sobra, não só quanto entrou.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Cartão de compartilhamento (WhatsApp, redes): a promessa e a comanda com a sobra. */
export default function Imagem() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        background: '#0b0b0b',
        color: '#f4f4ef',
        padding: 72,
        justifyContent: 'space-between',
        alignItems: 'center',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 640 }}>
        <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: 4, color: '#f5d33b' }}>
          PENTE FINO
        </div>
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1, textTransform: 'uppercase' }}>
          Saiba quanto sobra, não só quanto entrou.
        </div>
        <div style={{ fontSize: 30, color: '#aaaaa1' }}>Gestão de barbearia com lucro real</div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          width: 380,
          padding: 32,
          background: '#141414',
          border: '1px solid #262624',
          fontSize: 28,
          transform: 'rotate(-2deg)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Corte + Barba</span>
          <span>R$ 70,00</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#aaaaa1' }}>
          <span>Produto</span>
          <span>-R$ 3,50</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#aaaaa1' }}>
          <span>Comissão</span>
          <span>-R$ 31,50</span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            borderTop: '2px dashed #4a4a44',
            paddingTop: 14,
            fontWeight: 800,
          }}
        >
          <span>Sobra</span>
          <span style={{ color: '#f5d33b', fontSize: 40 }}>R$ 35,00</span>
        </div>
      </div>
    </div>,
    size,
  );
}
