// ===== SERVICE WORKER ATUALIZÁVEL - "NETWORK FIRST" =====
// NÃO precisa mudar a versão manualmente para atualizações de código!

const APP_VERSION = 'v2026.02.10.01'; // Apenas para controle interno
const CACHE_NAME = `placar-fut-cache-${APP_VERSION}`;
const DYNAMIC_CACHE_NAME = `placar-fut-dynamic-${APP_VERSION}`;

// Arquivos ESSENCIAIS para funcionamento offline (cacheados na instalação)
const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './sw.js' // Importante: cachear a si mesmo!
];

// URLs de terceiros que podem ser cacheadas
const EXTERNAL_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// ===== INSTALAÇÃO =====
self.addEventListener('install', event => {
  console.log(`[SW ${APP_VERSION}] Instalando...`);
  
  // Força ativação imediata, mesmo se houver SW antigo rodando
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cacheando arquivos essenciais...');
        // Cacheia apenas os CORE_ASSETS (são pequenos e essenciais)
        return cache.addAll(CORE_ASSETS);
      })
      .then(() => {
        console.log('[SW] Todos os arquivos essenciais foram cacheados.');
      })
      .catch(err => {
        console.warn('[SW] Algum arquivo essencial falhou no cache:', err);
      })
  );
});

// ===== ATIVAÇÃO =====
self.addEventListener('activate', event => {
  console.log(`[SW ${APP_VERSION}] Ativando e limpando caches antigos...`);
  
  event.waitUntil(
    Promise.all([
      // Limpa caches antigos
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // Remove TODOS os caches que não são os atuais
            if (cacheName !== CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME && 
                cacheName.startsWith('placar-fut-')) {
              console.log(`[SW] Removendo cache antigo: ${cacheName}`);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Assume controle imediato de todas as abas/páginas
      self.clients.claim()
    ])
    .then(() => {
      console.log(`[SW ${APP_VERSION}] Pronto para interceptar requisições!`);
      // Opcional: Notifica todas as abas sobre a nova versão
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: APP_VERSION
          });
        });
      });
    })
  );
});

// ===== ESTRATÉGIA "NETWORK FIRST" PARA ARQUIVOS DA APLICAÇÃO =====
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Ignora requisições não-GET e de extensões
  if (event.request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;
  
  // 1. PARA ARQUIVOS DA NOSSA APLICAÇÃO (html, css, js, json)
  if (url.origin === self.location.origin) {
    // Estratégia: NETWORK FIRST (Rede Primeiro)
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          // Se conseguiu da rede: ATUALIZA o cache e retorna
          const responseClone = networkResponse.clone();
          caches.open(DYNAMIC_CACHE_NAME)
            .then(cache => cache.put(event.request, responseClone))
            .catch(err => console.log('[SW] Erro ao atualizar cache:', err));
          
          return networkResponse;
        })
        .catch(() => {
          // Se a rede FALHOU (offline): tenta do cache
          console.log('[SW] Offline, buscando do cache:', event.request.url);
          return caches.match(event.request)
            .then(cachedResponse => {
              // Se encontrou no cache, retorna
              if (cachedResponse) return cachedResponse;
              
              // Se não tem no cache dinâmico, tenta no cache de assets essenciais
              return caches.open(CACHE_NAME)
                .then(cache => cache.match(event.request));
            });
        })
    );
    return; // Interrompe aqui para esta requisição
  }
  
  // 2. PARA RECURSOS EXTERNOS (Font Awesome, APIs, etc.)
  if (EXTERNAL_ASSETS.some(assetUrl => event.request.url.startsWith(assetUrl))) {
    // Estratégia: CACHE FIRST com atualização em background
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          // Sempre faz a requisição de rede PARA ATUALIZAR o cache
          const fetchPromise = fetch(event.request)
            .then(networkResponse => {
              // Atualiza o cache com a nova versão
              const responseClone = networkResponse.clone();
              caches.open(DYNAMIC_CACHE_NAME)
                .then(cache => cache.put(event.request, responseClone));
              return networkResponse;
            })
            .catch(err => {
              console.log('[SW] Falha ao buscar recurso externo:', err);
            });
          
          // Retorna do cache imediatamente (se tiver), mas atualiza em background
          return cachedResponse || fetchPromise;
        })
    );
    return;
  }
  
  // 3. PARA OUTRAS REQUISIÇÕES (imagens, dados, etc.) - Estratégia padrão
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Tenta da rede primeiro para conteúdo dinâmico
        return fetch(event.request)
          .then(networkResponse => networkResponse)
          .catch(() => cachedResponse || fetch(event.request));
      })
  );
});

// ===== RECEBE MENSAGENS (para controle manual) =====
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  if (event.data === 'clearCache') {
    caches.keys().then(cacheNames => {
      cacheNames.forEach(cacheName => {
        caches.delete(cacheName);
      });
    });
  }
});
