const CACHE_NAME = 'shopee-ofertas-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/worker.js',
  '/js/pwa.js',
  '/img/favicon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css'
];

// Instalação: Cacheia ativos estáticos críticos
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Ativação: Limpa caches antigos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => {
        if (k !== CACHE_NAME) {
          console.log('[SW] Removing old cache:', k);
          return caches.delete(k);
        }
      }))
    )
  );
  self.clients.claim();
});

// Fetch: Estratégias diferenciadas por tipo de recurso
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // 1. Imagens e Fontes: Cache-First (Performance máxima para assets que mudam pouco)
  if (e.request.destination === 'image' || e.request.destination === 'font' || url.hostname.includes('shopee.com.br')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        return cached || fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // 2. JS/CSS: Stale-While-Revalidate with long cache headers
  e.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(e.request).then(cached => {
        const fetched = fetch(e.request).then(res => {
          // Only cache successful responses
          if (res.ok) {
            const cloned = res.clone();
            const headers = new Headers(cloned.headers);
            // Instruct browser to cache JS/CSS for 1 week
            if (url.pathname.match(/\.(js|css)$/)) {
              headers.set('Cache-Control', 'public, max-age=604800');
            }
            cache.put(e.request, new Response(cloned.body, {
              status: cloned.status,
              statusText: cloned.statusText,
              headers,
            }));
          }
          return res;
        }).catch(() => null);
        return cached || fetched;
      });
    })
  );
});
