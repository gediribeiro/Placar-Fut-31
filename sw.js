const CACHE_NAME = 'placar-v3';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './app.js?v=2',
  './style.css?v=2'
];

// Instalação
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache v3 instalado');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
      .catch(err => {
        console.log('Erro ao cachear:', err);
      })
  );
});

// Ativação - REMOVER caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - ESTRATÉGIA: Network First, depois Cache
self.addEventListener('fetch', event => {
  // Para arquivos de dados/API, usar network first
  if (event.request.url.includes('api.') || 
      event.request.method !== 'GET') {
    return fetch(event.request);
  }
  
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Se a rede funcionou, atualizar cache
        const responseClone = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => {
            cache.put(event.request, responseClone);
          });
        return response;
      })
      .catch(() => {
        // Se offline, buscar do cache
        return caches.match(event.request)
          .then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Fallback para index.html
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
          });
      })
  );
});
