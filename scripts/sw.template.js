/* MapDispenser service worker — hand-rolled (no bundler integration needed).
   scripts/build-sw.mjs stamps __BUILD_VERSION__ on every `npm run build`, so
   each deploy produces a byte-different sw.js and installed apps see an update. */

const VERSION = '__BUILD_VERSION__';
const PREFIX = 'md-';
const CACHES = {
    shell: `${PREFIX}shell-${VERSION}`,
    assets: `${PREFIX}assets-${VERSION}`,
    tiles: `${PREFIX}tiles-v1`, // tiles survive app updates — they are expensive on mobile data
    api: `${PREFIX}api-${VERSION}`,
    pages: `${PREFIX}pages-${VERSION}`,
};
const KEEP = new Set(Object.values(CACHES));

const PRECACHE = [
    '/offline',
    '/manifest.webmanifest',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
];

const TILE_HOSTS = ['tile.openstreetmap.org', 'server.arcgisonline.com'];
const MAX_TILES = 600;

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHES.shell).then((cache) => cache.addAll(PRECACHE)).catch(() => {})
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names
            .filter((name) => name.startsWith(PREFIX) && !KEEP.has(name))
            .map((name) => caches.delete(name)));
        await self.clients.claim();
    })());
});

// The update flow: the page shows "Update available" and posts this when tapped.
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Push notifications: territory assigned, requests, approvals.
self.addEventListener('push', (event) => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch { /* not json */ }
    event.waitUntil(
        self.registration.showNotification(data.title || 'MapDispenser', {
            body: data.body || '',
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-96x96.png',
            data: { url: data.url || '/' },
            tag: data.url || 'mapdispenser', // same-topic notifications replace, not stack
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = (event.notification.data && event.notification.data.url) || '/';
    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of windows) {
            if ('focus' in client) {
                await client.focus();
                if ('navigate' in client) await client.navigate(url).catch(() => {});
                return;
            }
        }
        await self.clients.openWindow(url);
    })());
});

async function cacheFirst(request, cacheName, trimTo) {
    const cache = await caches.open(cacheName);
    const hit = await cache.match(request);
    if (hit) return hit;
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') {
        cache.put(request, response.clone()).then(async () => {
            if (trimTo) {
                const keys = await cache.keys();
                if (keys.length > trimTo) await Promise.all(keys.slice(0, keys.length - trimTo).map((key) => cache.delete(key)));
            }
        }).catch(() => {});
    }
    return response;
}

async function networkFirst(request, cacheName, fallbackUrl) {
    const cache = await caches.open(cacheName);
    try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone()).catch(() => {});
        return response;
    } catch {
        const hit = await cache.match(request);
        if (hit) return hit;
        if (fallbackUrl) {
            const fallback = await caches.match(fallbackUrl);
            if (fallback) return fallback;
        }
        throw new Error('offline');
    }
}

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Map tiles from either basemap: cache-first, capped
    if (TILE_HOSTS.some((host) => url.hostname.endsWith(host))) {
        event.respondWith(cacheFirst(request, CACHES.tiles, MAX_TILES));
        return;
    }
    if (url.origin !== self.location.origin) return;

    // Hashed build assets, map card images, icons, fonts: cache-first
    if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/_next/image')
        || url.pathname.startsWith('/maps/') || url.pathname.startsWith('/icons/')
        || /\.(?:png|jpg|jpeg|webp|svg|ico|woff2?)$/.test(url.pathname)) {
        event.respondWith(cacheFirst(request, CACHES.assets, 256));
        return;
    }

    // App data: fresh when online, last-seen copy when offline
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirst(request, CACHES.api));
        return;
    }

    // Page navigations: network, then cached copy, then the offline page
    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request, CACHES.pages, '/offline'));
    }
});
