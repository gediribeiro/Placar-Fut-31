// sw.js - Service Worker para Placar Fut 31 - VERSÃO CORRIGIDA

const CACHE_NAME = 'placar-fut-31-v3';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];

// Instalação do Service Worker
self.addEventListener('install', event => {
  console.log('[Service Worker] Instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Cacheando arquivos essenciais...');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[Service Worker] Instalação concluída');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[Service Worker] Erro na instalação:', error);
      })
  );
});

// Ativação do Service Worker
self.addEventListener('activate', event => {
  console.log('[Service Worker] Ativando...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Ativação concluída');
      return self.clients.claim();
    })
  );
});

// Interceptação de requisições - VERSÃO SEGURA
self.addEventListener('fetch', event => {
  // Apenas cachear requisições GET
  if (event.request.method !== 'GET') return;
  
  const requestUrl = new URL(event.request.url);
  
  // Estratégia: Cache First, fallback para Network
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Se encontrou no cache, retorna
        if (cachedResponse) {
          console.log('[Service Worker] Retornando do cache:', requestUrl.pathname);
          return cachedResponse;
        }
        
        // Se não tem no cache, busca na rede
        console.log('[Service Worker] Buscando na rede:', requestUrl.pathname);
        return fetch(event.request)
          .then(networkResponse => {
            // Se a resposta é válida, adiciona ao cache
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                  console.log('[Service Worker] Adicionado ao cache:', requestUrl.pathname);
                });
            }
            return networkResponse;
          })
          .catch(error => {
            console.error('[Service Worker] Erro na rede:', error);
            
            // Fallback para páginas HTML
            if (event.request.headers.get('accept') && 
                event.request.headers.get('accept').includes('text/html')) {
              return caches.match('./index.html');
            }
            
            // Para outros recursos, retorna null (o app vai tratar)
            return null;
          });
      })
  );
});

// Mensagens do Service Worker
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'skipWaiting') {
    console.log('[Service Worker] Skipping waiting...');
    self.skipWaiting();
  }
  
  if (event.data && event.data.action === 'clearCache') {
    console.log('[Service Worker] Limpando cache...');
    caches.delete(CACHE_NAME);
  }
});

// Sincronização em background
self.addEventListener('sync', event => {
  console.log('[Service Worker] Sync event:', event.tag);
  
  if (event.tag === 'update-data') {
    event.waitUntil(
      syncData()
    );
  }
});

function syncData() {
  console.log('[Service Worker] Sincronizando dados...');
  return Promise.resolve();
}

// Notificações push (opcional - só funciona se configurar)
self.addEventListener('push', event => {
  console.log('[Service Worker] Push event recebido');
  
  let options = {
    body: 'Nova notificação do Placar Fut 31',
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyIiBoZWlnaHQ9IjE5MiIgdmlld0JveD0iMCAwIDE5MiAxOTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iOTYiIGN5PSI5NiIgcj0iOTYiIGZpbGw9IiMwZmI4NTgiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjQ4IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+MzE8L3RleHQ+PC9zdmc+',
    badge: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOTYiIGhlaWdodD0iOTYiIHZpZXdCb3g9IjAgMCA5NiA5NiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSI0OCIgY3k9IjQ4IiByPSI0OCIgZmlsbD0iIzBmYjg1OCIvPjwvc3ZnPg==',
    vibrate: [100, 50, 100],
    data: {
      url: './index.html',
      timestamp: Date.now()
    }
  };
  
  if (event.data) {
    try {
      const data = event.data.json();
      if (data.body) options.body = data.body;
      if (data.title) options.title = data.title;
    } catch (e) {
      options.body = event.data.text();
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(options.title || 'Placar Fut 31', options)
  );
});

self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notificação clicada');
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ 
      type: 'window',
      includeUncontrolled: true 
    })
    .then(clientList => {
      // Tenta focar em uma janela existente
      for (const client of clientList) {
        if (client.url.includes('index.html') && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Se não encontrou, abre nova janela
      if (clients.openWindow) {
        return clients.openWindow('./index.html');
      }
    })
  );
});

// Controle de versão
self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-check') {
    console.log('[Service Worker] Verificando atualizações...');
    event.waitUntil(checkForUpdates());
  }
});

function checkForUpdates() {
  return fetch('./?v=' + Date.now(), { cache: 'no-store' })
    .then(response => {
      if (response.status === 200) {
        console.log('[Service Worker] App está atualizado');
      }
      return response;
    })
    .catch(error => {
      console.error('[Service Worker] Erro ao verificar atualizações:', error);
    });
}

// Log para debugging
self.addEventListener('error', event => {
  console.error('[Service Worker] Erro:', event.error);
});
