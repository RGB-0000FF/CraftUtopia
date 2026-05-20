(function () {
  'use strict';

  const MANIFEST_URL = 'data/video-cache-manifest.json';
  const SEGMENTS_PER_INTENT = 2;
  const MAX_CONCURRENT_PRELOADS = 2;
  const CARD_SELECTOR = 'a.demo-card[href*="?demo="]';

  const videoManifestById = new Map();
  const playlistCache = new Map();
  const preloadPromises = new Map();
  const fetchedUrls = new Set();
  const intentWarmedDemos = new Set();
  const queue = [];

  let activeCount = 0;
  let manifestReady = null;

  function getConnectionInfo() {
    return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
  }

  function shouldSkipSegmentPreload() {
    const connection = getConnectionInfo();
    if (!connection) {
      return false;
    }

    return connection.saveData === true || connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g';
  }

  function createFetchOptions() {
    return {
      mode: 'cors',
      cache: 'force-cache',
      priority: 'low'
    };
  }

  function isPageHidden() {
    return document.visibilityState === 'hidden';
  }

  function enqueueUrl(url, responseType) {
    if (!url || isPageHidden()) {
      return Promise.resolve(null);
    }

    if (preloadPromises.has(url)) {
      return preloadPromises.get(url);
    }

    if (fetchedUrls.has(url)) {
      return Promise.resolve(null);
    }

    const promise = new Promise((resolve) => {
      queue.push({ url, responseType, resolve });
      pumpQueue();
    });

    preloadPromises.set(url, promise);
    promise.finally(() => preloadPromises.delete(url));

    return promise;
  }

  function pumpQueue() {
    if (isPageHidden()) {
      return;
    }

    while (activeCount < MAX_CONCURRENT_PRELOADS && queue.length > 0) {
      const task = queue.shift();
      activeCount += 1;

      fetch(task.url, createFetchOptions())
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Preload failed: ${response.status}`);
          }

          fetchedUrls.add(task.url);
          return task.responseType === 'text' ? response.text() : response.arrayBuffer();
        })
        .then(task.resolve)
        .catch(() => task.resolve(null))
        .finally(() => {
          activeCount -= 1;
          pumpQueue();
        });
    }
  }

  function scheduleIdle(callback) {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(callback, { timeout: 2500 });
      return;
    }

    window.setTimeout(callback, 1200);
  }

  function parsePlaylist(text, playlistUrl) {
    const initMatch = text.match(/#EXT-X-MAP:.*?URI="([^"]+)"/);
    const segmentUrls = [];
    const lines = text.split(/\r?\n/);
    let nextMediaLineIsSegment = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      if (nextMediaLineIsSegment && !line.startsWith('#')) {
        segmentUrls.push(new URL(line, playlistUrl).href);
        nextMediaLineIsSegment = false;
        continue;
      }

      if (line.startsWith('#EXTINF')) {
        nextMediaLineIsSegment = true;
      }
    }

    return {
      initUrl: initMatch ? new URL(initMatch[1], playlistUrl).href : null,
      segmentUrls
    };
  }

  async function loadPreloadManifest() {
    if (manifestReady) {
      return manifestReady;
    }

    manifestReady = fetch(MANIFEST_URL, { cache: 'force-cache' })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Video manifest failed: ${response.status}`);
        }
        return response.json();
      })
      .then((manifest) => {
        if (!Array.isArray(manifest.videos)) {
          return videoManifestById;
        }

        for (const video of manifest.videos) {
          if (video && video.id && video.url) {
            videoManifestById.set(video.id, video.url);
          }
        }

        return videoManifestById;
      })
      .catch(() => videoManifestById);

    return manifestReady;
  }

  async function getPlaylistData(demoId) {
    await loadPreloadManifest();

    const playlistUrl = videoManifestById.get(demoId);
    if (!playlistUrl) {
      return null;
    }

    if (playlistCache.has(playlistUrl)) {
      return playlistCache.get(playlistUrl);
    }

    const text = await enqueueUrl(playlistUrl, 'text');
    if (!text) {
      return null;
    }

    const playlistData = parsePlaylist(text, playlistUrl);
    playlistCache.set(playlistUrl, playlistData);
    return playlistData;
  }

  async function warmPlaylistAndInit(demoId) {
    const playlistData = await getPlaylistData(demoId);
    if (playlistData && playlistData.initUrl) {
      await enqueueUrl(playlistData.initUrl, 'arrayBuffer');
    }
  }

  async function warmIntentSegments(demoId) {
    if (!demoId || intentWarmedDemos.has(demoId) || shouldSkipSegmentPreload()) {
      return;
    }

    intentWarmedDemos.add(demoId);

    const playlistData = await getPlaylistData(demoId);
    if (!playlistData) {
      return;
    }

    const urls = playlistData.segmentUrls.slice(0, SEGMENTS_PER_INTENT);
    for (const url of urls) {
      enqueueUrl(url, 'arrayBuffer');
    }
  }

  function getDemoIdFromCard(card) {
    try {
      const url = new URL(card.getAttribute('href'), window.location.href);
      return url.searchParams.get('demo');
    } catch (error) {
      return null;
    }
  }

  function bindIntentPreload() {
    const cards = document.querySelectorAll(CARD_SELECTOR);

    for (const card of cards) {
      const warmCard = () => warmIntentSegments(getDemoIdFromCard(card));

      card.addEventListener('pointerenter', warmCard, { passive: true });
      card.addEventListener('focusin', warmCard);
      card.addEventListener('touchstart', warmCard, { passive: true });
      card.addEventListener('mousedown', warmCard, { passive: true });
    }
  }

  async function warmAllPlaylistsAndInit() {
    await loadPreloadManifest();

    for (const demoId of videoManifestById.keys()) {
      if (isPageHidden()) {
        return;
      }

      warmPlaylistAndInit(demoId);
    }
  }

  function start() {
    bindIntentPreload();
    scheduleIdle(warmAllPlaylistsAndInit);
  }

  document.addEventListener('visibilitychange', () => {
    if (!isPageHidden()) {
      pumpQueue();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  window.CraftUtopiaHlsPreload = {
    warmPlaylistAndInit,
    warmIntentSegments
  };
})();
