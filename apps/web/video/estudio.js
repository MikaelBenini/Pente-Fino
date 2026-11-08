// Injetado em cada página gravada: cursor visível, legenda animada e destaque de um elemento.
// Roda no navegador (addInitScript); a gravação chama window.__estudio.* pelo page.evaluate.
(() => {
  if (window.__estudio) return;
  const css = `
  #pf-cursor{position:fixed;left:-40px;top:-40px;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;
    border:3px solid #f5d33b;background:rgba(245,211,59,.18);box-shadow:0 0 0 2px rgba(0,0,0,.55);z-index:2147483647;
    pointer-events:none;transition:transform .12s ease}
  #pf-cursor.clique{transform:scale(.7);background:rgba(245,211,59,.55)}
  #pf-onda{position:fixed;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;border:3px solid #f5d33b;
    z-index:2147483646;pointer-events:none;opacity:0}
  #pf-onda.ativa{animation:pf-onda .55s ease-out}
  @keyframes pf-onda{from{opacity:.9;transform:scale(1)}to{opacity:0;transform:scale(3.2)}}
  #pf-legenda{position:fixed;left:50%;bottom:34px;transform:translate(-50%,24px);opacity:0;z-index:2147483645;
    pointer-events:none;max-width:min(980px,92vw);display:flex;gap:16px;align-items:stretch;
    background:rgba(11,11,11,.92);border:1px solid rgba(245,211,59,.35);border-radius:16px;padding:16px 26px 16px 18px;
    box-shadow:0 18px 50px rgba(0,0,0,.55);transition:opacity .45s ease,transform .45s cubic-bezier(.2,.8,.2,1)}
  #pf-legenda.on{opacity:1;transform:translate(-50%,0)}
  #pf-legenda .barra{width:6px;border-radius:4px;background:#f5d33b;flex:none}
  #pf-legenda .t{font:800 30px/1.1 'Barlow Condensed','Barlow',system-ui,sans-serif;letter-spacing:.5px;color:#fff;text-transform:uppercase}
  #pf-legenda .s{font:500 19px/1.35 'Barlow',system-ui,sans-serif;color:#d4d4d8;margin-top:6px}
  #pf-legenda.topo{bottom:auto !important;top:24px;transform:translate(-50%,-24px)}
  #pf-legenda.topo.on{transform:translate(-50%,0)}
  #pf-legenda.compacta{bottom:18px;padding:10px 16px 10px 12px;border-radius:12px}
  #pf-legenda.compacta.topo{bottom:auto !important;top:16px}
  #pf-legenda.compacta .t{font-size:22px}#pf-legenda.compacta .s{font-size:15px}
  #pf-foco{position:fixed;z-index:2147483640;pointer-events:none;border-radius:14px;opacity:0;
    box-shadow:0 0 0 4px #f5d33b,0 0 0 9999px rgba(0,0,0,.55);transition:all .5s cubic-bezier(.2,.8,.2,1)}
  #pf-foco.on{opacity:1}`;
  function montar() {
    if (document.getElementById('pf-cursor')) return;
    const st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
    for (const id of ['pf-cursor', 'pf-onda', 'pf-foco']) {
      const d = document.createElement('div');
      d.id = id;
      document.body.appendChild(d);
    }
    const l = document.createElement('div');
    l.id = 'pf-legenda';
    l.innerHTML = '<div class="barra"></div><div><div class="t"></div><div class="s"></div></div>';
    document.body.appendChild(l);
    const pos = window.__pfPos;
    if (pos) Object.assign(document.getElementById('pf-cursor').style, pos);
  }
  document.addEventListener(
    'mousemove',
    (e) => {
      const c = document.getElementById('pf-cursor');
      window.__pfPos = { left: `${e.clientX}px`, top: `${e.clientY}px` };
      if (c) Object.assign(c.style, window.__pfPos);
    },
    true,
  );
  document.addEventListener(
    'mousedown',
    (e) => {
      const c = document.getElementById('pf-cursor');
      const o = document.getElementById('pf-onda');
      c?.classList.add('clique');
      if (o) {
        Object.assign(o.style, { left: `${e.clientX}px`, top: `${e.clientY}px` });
        o.classList.remove('ativa');
        void o.offsetWidth;
        o.classList.add('ativa');
      }
    },
    true,
  );
  document.addEventListener(
    'mouseup',
    () => document.getElementById('pf-cursor')?.classList.remove('clique'),
    true,
  );
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();
  window.__estudio = {
    legenda(titulo, sub, compacta, topo) {
      montar();
      const l = document.getElementById('pf-legenda');
      l.classList.toggle('compacta', !!compacta);
      l.classList.toggle('topo', !!topo);
      l.querySelector('.t').textContent = titulo;
      l.querySelector('.s').textContent = sub || '';
      l.querySelector('.s').style.display = sub ? '' : 'none';
      l.classList.add('on');
    },
    limpar() {
      document.getElementById('pf-legenda')?.classList.remove('on');
      document.getElementById('pf-foco')?.classList.remove('on');
    },
    focar(x, y, w, h) {
      montar();
      const f = document.getElementById('pf-foco');
      Object.assign(f.style, {
        left: `${x - 8}px`,
        top: `${y - 8}px`,
        width: `${w + 16}px`,
        height: `${h + 16}px`,
      });
      f.classList.add('on');
    },
    desfocar() {
      document.getElementById('pf-foco')?.classList.remove('on');
    },
    esconderCursor() {
      const c = document.getElementById('pf-cursor');
      if (c) c.style.display = 'none';
    },
  };
})();
