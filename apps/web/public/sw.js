// Service worker do Pente Fino. Abre o app sem internet com a última versão das telas;
// dados da API nunca ficam em cache aqui (os lançamentos offline usam o IndexedDB).
const VERSAO = 'pf-v2';
const OFFLINE = '/offline';

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(VERSAO)
      .then((cache) => cache.addAll([OFFLINE, '/icones/icone-192.png']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(chaves.filter((c) => c !== VERSAO).map((c) => caches.delete(c))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const req = evento.request;
  const url = new URL(req.url);
  if (
    req.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/')
  )
    return;

  // Arquivos com hash no nome não mudam: cache primeiro.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icones/')) {
    evento.respondWith(
      caches.match(req).then(
        (salvo) =>
          salvo ||
          fetch(req).then((resposta) => {
            const copia = resposta.clone();
            caches.open(VERSAO).then((cache) => cache.put(req, copia));
            return resposta;
          }),
      ),
    );
    return;
  }

  // Telas: rede primeiro; sem rede, a última versão vista; sem nada, a página offline.
  if (req.mode === 'navigate') {
    evento.respondWith(
      fetch(req)
        .then((resposta) => {
          if (resposta.ok && !resposta.redirected) {
            const copia = resposta.clone();
            caches.open(VERSAO).then((cache) => cache.put(req, copia));
          }
          return resposta;
        })
        .catch(() => caches.match(req).then((salvo) => salvo || caches.match(OFFLINE))),
    );
  }
});

// Notificações no celular (push): mostra o aviso e, ao tocar, abre a tela certa do app.
self.addEventListener('push', (evento) => {
  let d = {};
  try {
    d = evento.data ? evento.data.json() : {};
  } catch {
    d = { corpo: evento.data ? evento.data.text() : '' };
  }
  evento.waitUntil(
    self.registration.showNotification(d.titulo || 'Pente Fino', {
      body: d.corpo || '',
      icon: '/icones/icone-192.png',
      badge: '/icones/icone-192.png',
      tag: d.etiqueta || undefined,
      renotify: !!d.etiqueta,
      data: { url: d.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = new URL(evento.notification.data?.url || '/', self.location.origin).href;
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      const aberta = janelas.find((j) => j.url.startsWith(self.location.origin));
      if (aberta) return aberta.focus().then((j) => j.navigate(destino));
      return self.clients.openWindow(destino);
    }),
  );
});
