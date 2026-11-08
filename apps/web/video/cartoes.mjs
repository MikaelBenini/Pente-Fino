// Cartões animados do vídeo (abertura, fundo da cena do celular, encerramento), em HTML com as
// cores e a fonte do Pente Fino. A gravação abre cada um numa aba e grava como as outras cenas.

const FONTES =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@700;800&display=swap" rel="stylesheet">';

const PENTE = `<svg viewBox="0 0 32 32" fill="#f5d33b" aria-hidden="true"><rect x="3" y="7" width="26" height="6" rx="1.5"/>${Array.from(
  { length: 9 },
  (_, i) =>
    `<rect class="dente" style="animation-delay:${0.35 + i * 0.05}s" x="${(4 + i * 2.85).toFixed(2)}" y="13" width="1.6" height="${i % 2 === 0 ? 12 : 9}" rx="0.6"/>`,
).join('')}</svg>`;

const BASE = `
*{box-sizing:border-box;margin:0}
html,body{width:1280px;height:720px;overflow:hidden;background:#0b0b0b;color:#fff;font-family:'Barlow',system-ui,sans-serif}
body{position:relative}
.brilho{position:absolute;inset:-20%;background:radial-gradient(60% 60% at 70% 30%,rgba(245,211,59,.16),transparent 60%),radial-gradient(50% 50% at 15% 85%,rgba(163,230,53,.10),transparent 60%);animation:respira 6s ease-in-out infinite alternate}
.grade{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:48px 48px;mask-image:radial-gradient(70% 70% at 50% 50%,#000,transparent)}
@keyframes respira{to{transform:scale(1.08) translate(-2%,2%)}}
@keyframes sobe{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:none}}
@keyframes cresce{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes linha{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.dente{transform-origin:top;transform-box:fill-box;animation:cresce .5s cubic-bezier(.2,.8,.2,1) both}
.sobe{opacity:0;animation:sobe .8s cubic-bezier(.2,.8,.2,1) forwards}
.marca{font:800 64px/1 'Barlow Condensed',sans-serif;letter-spacing:4px;text-transform:uppercase}
.amarelo{color:#f5d33b}
`;

const pagina = (corpo, css = '') =>
  `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">${FONTES}<style>${BASE}${css}</style></head><body><div class="brilho"></div><div class="grade"></div>${corpo}</body></html>`;

export function abertura() {
  return pagina(
    `<main>
      <div class="logo sobe" style="animation-delay:.1s">${PENTE}<span class="marca">Pente Fino</span></div>
      <div class="traco"></div>
      <h1 class="sobe" style="animation-delay:1.1s">Saiba quanto <span class="amarelo">sobra</span>,<br>não só quanto entrou.</h1>
      <p class="sobe" style="animation-delay:1.9s">Gestão de barbearia com agenda, comanda, caixa e WhatsApp num lugar só.</p>
    </main>`,
    `main{position:relative;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:22px}
     .logo{display:flex;align-items:center;gap:18px}.logo svg{width:84px;height:84px}
     .traco{width:120px;height:4px;border-radius:2px;background:#f5d33b;transform-origin:center;animation:linha .7s .8s cubic-bezier(.2,.8,.2,1) both}
     h1{font:800 76px/1.02 'Barlow Condensed',sans-serif;text-transform:uppercase;letter-spacing:1px}
     p{font-size:24px;color:#d4d4d8;max-width:760px}`,
  );
}

export function encerramento() {
  return pagina(
    `<main>
      <div class="logo sobe" style="animation-delay:.1s">${PENTE}<span class="marca">Pente Fino</span></div>
      <h1 class="sobe" style="animation-delay:.6s">Teste grátis por <span class="amarelo">14 dias</span></h1>
      <ul class="sobe" style="animation-delay:1.1s"><li>Sem cartão de crédito</li><li>Configuração guiada em minutos</li><li>Cancela quando quiser</li></ul>
      <div class="botao sobe" style="animation-delay:1.7s">seupentefino.com.br</div>
    </main>`,
    `main{position:relative;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:26px}
     .logo{display:flex;align-items:center;gap:14px}.logo svg{width:56px;height:56px}.logo .marca{font-size:44px}
     h1{font:800 84px/1 'Barlow Condensed',sans-serif;text-transform:uppercase}
     ul{list-style:none;padding:0;display:flex;gap:28px;font-size:24px;color:#e4e4e7}
     li::before{content:'✓ ';color:#a3e635;font-weight:600}
     .botao{margin-top:8px;background:#f5d33b;color:#0b0b0b;font:800 40px/1 'Barlow Condensed',sans-serif;letter-spacing:1px;padding:20px 40px;border-radius:14px;box-shadow:0 18px 60px rgba(245,211,59,.25)}`,
  );
}

/**
 * Fundo da cena do celular: texto à esquerda e o aparelho à direita; a gravação do celular é
 * colada dentro da tela (TELA_CELULAR) na edição.
 */
export const TELA_CELULAR = { x: 812, y: 62, largura: 276, altura: 598, raio: 34 };

export function fundoCelular({ titulo, itens }) {
  const t = TELA_CELULAR;
  return pagina(
    `<main>
      <section>
        <div class="selo sobe" style="animation-delay:.1s">No celular do barbeiro</div>
        <h1 class="sobe" style="animation-delay:.35s">${titulo}</h1>
        <ul>${itens.map((i, n) => `<li class="sobe" style="animation-delay:${0.9 + n * 1.4}s"><span>${n + 1}</span>${i}</li>`).join('')}</ul>
      </section>
      <div class="aparelho"></div>
    </main>`,
    `main{position:relative;height:100%}
     section{position:absolute;left:96px;top:0;bottom:0;width:620px;display:flex;flex-direction:column;justify-content:center;gap:26px}
     .selo{align-self:flex-start;border:1px solid rgba(245,211,59,.5);color:#f5d33b;font-weight:600;letter-spacing:2px;text-transform:uppercase;font-size:16px;padding:6px 12px;border-radius:8px}
     h1{font:800 64px/1.02 'Barlow Condensed',sans-serif;text-transform:uppercase}
     ul{list-style:none;padding:0;display:flex;flex-direction:column;gap:18px}
     li{display:flex;align-items:center;gap:16px;font-size:26px;color:#e4e4e7}
     li span{flex:none;display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:#f5d33b;color:#0b0b0b;font:800 24px 'Barlow Condensed',sans-serif}
     .aparelho{position:absolute;left:${t.x - 14}px;top:${t.y - 14}px;width:${t.largura + 28}px;height:${t.altura + 28}px;border-radius:${t.raio + 12}px;background:#1c1c1f;border:2px solid #3f3f46;box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 0 1px #000 inset}`,
  );
}
