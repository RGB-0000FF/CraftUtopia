const VIDEO_CACHE_PREFIX = 'craftutopia-video-cache-';

async function cleanupLegacyVideoCaches() {
  if (!self.caches?.keys) return;
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((cacheName) => (
    cacheName.startsWith(VIDEO_CACHE_PREFIX) ? caches.delete(cacheName) : Promise.resolve(false)
  )));
}

async function unregisterLegacyWorker() {
  if (!self.registration?.unregister) return;
  await self.registration.unregister();
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await cleanupLegacyVideoCaches();
    await self.clients.claim();
    await unregisterLegacyWorker();
  })());
});
