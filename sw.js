const VIDEO_CACHE_PREFIX = 'craftutopia-video-cache-';
const DEFAULT_VIDEO_CACHE_VERSION = '20260520-video-cache-v1';
let activeVideoCacheName = `${VIDEO_CACHE_PREFIX}${DEFAULT_VIDEO_CACHE_VERSION}`;

function getVideoCacheName(version = DEFAULT_VIDEO_CACHE_VERSION) {
  return `${VIDEO_CACHE_PREFIX}${String(version || DEFAULT_VIDEO_CACHE_VERSION).replace(/[^a-z0-9._-]/gi, '-')}`;
}

function isVideoRequest(request) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  return url.origin === self.location.origin && url.pathname.endsWith('.mp4');
}

function getCacheRequest(url) {
  return new Request(url, { credentials: 'same-origin' });
}

async function cleanupVideoCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((cacheName) => {
    if (cacheName.startsWith(VIDEO_CACHE_PREFIX) && cacheName !== activeVideoCacheName) {
      return caches.delete(cacheName);
    }
    return Promise.resolve();
  }));
}

async function getCachedVideo(request) {
  const cache = await caches.open(activeVideoCacheName);
  const url = new URL(request.url);
  return cache.match(getCacheRequest(url.href), { ignoreVary: true });
}

async function cacheVideo(url) {
  const cache = await caches.open(activeVideoCacheName);
  const cacheRequest = getCacheRequest(url);
  const cached = await cache.match(cacheRequest, { ignoreVary: true });
  if (cached) return { url, status: 'cached' };

  const response = await fetch(cacheRequest);
  if (!response.ok || response.status === 206) {
    throw new Error(`Video HTTP ${response.status}`);
  }
  await cache.put(cacheRequest, response.clone());
  return { url, status: 'stored' };
}

function parseRange(rangeHeader, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader || '');
  if (!match) return null;

  let start = match[1] === '' ? null : Number(match[1]);
  let end = match[2] === '' ? null : Number(match[2]);
  if (start === null && end === null) return null;

  if (start === null) {
    const suffixLength = end;
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  } else {
    end = end === null ? size - 1 : Math.min(end, size - 1);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= size) {
    return null;
  }
  return { start, end };
}

async function handleVideoRangeRequest(request) {
  const cached = await getCachedVideo(request);
  if (!cached) return fetch(request);

  const buffer = await cached.arrayBuffer();
  const range = parseRange(request.headers.get('range'), buffer.byteLength);
  if (!range) {
    return new Response(null, {
      status: 416,
      statusText: 'Range Not Satisfiable',
      headers: {
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes */${buffer.byteLength}`
      }
    });
  }

  const chunk = buffer.slice(range.start, range.end + 1);
  return new Response(chunk, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Accept-Ranges': 'bytes',
      'Content-Length': String(chunk.byteLength),
      'Content-Range': `bytes ${range.start}-${range.end}/${buffer.byteLength}`,
      'Content-Type': cached.headers.get('Content-Type') || 'video/mp4',
      'Cache-Control': cached.headers.get('Cache-Control') || 'public, max-age=31536000'
    }
  });
}

async function handleVideoRequest(request) {
  if (request.headers.has('range')) return handleVideoRangeRequest(request);
  const cached = await getCachedVideo(request);
  return cached || fetch(request);
}

function postToClient(client, message) {
  if (client && typeof client.postMessage === 'function') client.postMessage(message);
}

async function getVideoStatuses(videos = []) {
  const cache = await caches.open(activeVideoCacheName);
  return Promise.all(videos.map(async (video) => {
    const url = video.url;
    const cached = await cache.match(getCacheRequest(url), { ignoreVary: true });
    return { ...video, cached: Boolean(cached) };
  }));
}

async function handleCacheVideos(client, payload = {}) {
  activeVideoCacheName = getVideoCacheName(payload.version);
  await cleanupVideoCaches();

  const videos = Array.isArray(payload.videos) ? payload.videos : [];
  let cachedCount = 0;
  let failedCount = 0;
  for (const video of videos) {
    if (!video?.url) continue;
    postToClient(client, {
      type: 'VIDEO_CACHE_PROGRESS',
      phase: 'active',
      total: videos.length,
      cachedCount,
      failedCount,
      activeUrl: video.url
    });

    try {
      await cacheVideo(video.url);
      cachedCount += 1;
    } catch (error) {
      failedCount += 1;
      postToClient(client, {
        type: 'VIDEO_CACHE_ERROR',
        url: video.url,
        message: error?.message || 'Video cache failed'
      });
    }

    postToClient(client, {
      type: 'VIDEO_CACHE_PROGRESS',
      phase: 'progress',
      total: videos.length,
      cachedCount,
      failedCount,
      activeUrl: video.url
    });
  }

  postToClient(client, {
    type: 'VIDEO_CACHE_COMPLETE',
    total: videos.length,
    cachedCount,
    failedCount
  });
}

async function handleCacheVideo(client, payload = {}) {
  if (payload.version) {
    activeVideoCacheName = getVideoCacheName(payload.version);
    await cleanupVideoCaches();
  }
  if (!payload.url) return;

  try {
    const result = await cacheVideo(payload.url);
    postToClient(client, { type: 'VIDEO_CACHE_ONE_COMPLETE', ...result });
  } catch (error) {
    postToClient(client, {
      type: 'VIDEO_CACHE_ERROR',
      url: payload.url,
      message: error?.message || 'Video cache failed'
    });
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await cleanupVideoCaches();
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (!isVideoRequest(event.request)) return;
  event.respondWith(handleVideoRequest(event.request));
});

self.addEventListener('message', (event) => {
  const payload = event.data || {};
  const client = event.source;

  if (payload.type === 'CACHE_VIDEOS') {
    event.waitUntil(handleCacheVideos(client, payload));
  } else if (payload.type === 'CACHE_VIDEO') {
    event.waitUntil(handleCacheVideo(client, payload));
  } else if (payload.type === 'CACHE_STATUS') {
    event.waitUntil((async () => {
      if (payload.version) activeVideoCacheName = getVideoCacheName(payload.version);
      postToClient(client, {
        type: 'VIDEO_CACHE_STATUS',
        videos: await getVideoStatuses(payload.videos || [])
      });
    })());
  }
});
