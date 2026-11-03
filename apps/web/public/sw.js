// Service worker do Pente Fino. Abre o app sem internet com a última versão das telas;
// dados da API nunca ficam em cache aqui (os lançamentos offline usam o IndexedDB).
const VERSAO = 'pf-v1';
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
