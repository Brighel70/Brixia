// Service Worker per Brixia Rugby App
const CACHE_NAME = 'brixia-rugby-v1';
const urlsToCache = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg'
];

// Installazione del Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache aperta');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - Disabilitato per sviluppo
self.addEventListener('fetch', (event) => {
  // Solo per sviluppo - non fare cache
  if (event.request.url.includes('localhost')) {
    return; // Non gestire richieste localhost
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request).catch(() => {
          // Se fetch fallisce, non fare nulla
          return new Response('Offline', { status: 503 });
        });
      }
    )
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Rimuovo cache vecchia:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
