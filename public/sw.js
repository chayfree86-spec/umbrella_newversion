const CACHE_NAME = 'umbrella-static-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/logo.png',
  '/login-bg.png',
  '/favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Strictly bypass caching for API calls, print templates, and non-GET requests
  if (
    url.pathname.includes('/api/') || 
    url.pathname.includes('/print_') || 
    event.request.method !== 'GET'
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Stale-While-Revalidate caching for static resources (CSS, JS, Fonts, Images)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh copy in the background to update the cache
        fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => { /* Ignore background fetch failures */ });
        
        return cachedResponse;
      }

      // Fallback to network
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      });
    })
  );
});
