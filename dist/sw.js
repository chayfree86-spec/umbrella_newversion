// Bump this version whenever index.html or precached assets change, so the
// new SW re-precaches (old caches are wiped in `activate`). Without a bump,
// the stale-while-revalidate handler keeps serving the OLD index.html.
const CACHE_NAME = 'umbrella-static-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/logo.png',
  '/login-bg.png',
  '/favicon.svg',
  // Precache the icon font on install so it's ready before first paint —
  // stops the raw icon-name text flash ("dashboard", "settings") on cold
  // loads / hard refresh where the 5.3MB woff2 would otherwise still be
  // downloading past font-display:block's timeout.
  '/fonts/material-symbols-rounded.css',
  '/fonts/material-symbols-rounded.woff2'
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
