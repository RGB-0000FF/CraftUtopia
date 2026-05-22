(function () {
  'use strict';

  const scriptUrl = new URL(document.currentScript?.src || document.baseURI, document.baseURI);
  const assetVersion = scriptUrl.searchParams.get('v') || '20260522-github-pages-cleanup';
  const MANIFEST_URL = `data/video-cache-manifest.json?v=${encodeURIComponent(assetVersion)}`;
  const SEGMENTS_PER_INTENT = 2;
  const INITIAL_VIEWER_SEGMENTS = 8;
  const MAX_CONCURRENT_PRELOADS = 2;
  const VIEWER_BATCH_DELAY_MS = 250;
  const DEFAULT_PAUSE_MS = 4000;
  const CARD_SELECTOR = 'a.demo-card[href*="?demo="]';
  const CARD_IMAGE_SELECTOR = `${CARD_SELECTOR} img[src]`;

  const videoManifestById = new Map();
  const playlistCache = new Map();
  const preloadPromises = new Map();
  const fetchedUrls = new Set();
  const intentWarmedDemos = new Set();
  const viewerWarmups = new Map();
  const queue = [];

  let activeCount = 0;
  let manifestReady = null;
  let preloadPausedUntil = 0;
  let preloadResumeTimer = null;

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

  function shouldSkipExtraPreload() {
    return shouldSkipSegmentPreload();
  }

  function createFetchOptions() {
    return {
      mode: 'cors',
      priority: 'low'
    };
  }

  function resolveUrl(url) {
    try {
      return new URL(url, document.baseURI || window.location.href).href;
    } catch (error) {
      return null;
    }
  }

  function isHlsManifestUrl(url) {
    return /\.m3u8(?:[?#]|$)/i.test(String(url || ''));
  }

  function isPageHidden() {
    return document.visibilityState === 'hidden';
  }

  function isPreloadPaused() {
    return Date.now() < preloadPausedUntil;
  }

  function schedulePreloadResume() {
    if (preloadResumeTimer) {
      window.clearTimeout(preloadResumeTimer);
      preloadResumeTimer = null;
    }

    const delayMs = Math.max(0, preloadPausedUntil - Date.now());
    if (delayMs <= 0) {
      pumpQueue();
      return;
    }

    preloadResumeTimer = window.setTimeout(() => {
      preloadResumeTimer = null;
      pumpQueue();
    }, delayMs);
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
    if (isPageHidden() || isPreloadPaused()) {
      if (isPreloadPaused()) {
        schedulePreloadResume();
      }
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

    const manifestUrl = resolveUrl(MANIFEST_URL) || MANIFEST_URL;

    manifestReady = fetch(manifestUrl)
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
            const playlistUrl = resolveUrl(video.url);
            if (playlistUrl && isHlsManifestUrl(playlistUrl)) {
              videoManifestById.set(video.id, playlistUrl);
            }
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

  async function getPlaylistDataForUrl(playlistUrl) {
    if (!playlistUrl || !isHlsManifestUrl(playlistUrl)) {
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

  function normalizeUrl(url) {
    if (!url) {
      return null;
    }

    try {
      return new URL(url, window.location.href).href;
    } catch (error) {
      return null;
    }
  }

  async function warmImageUrls(urls = []) {
    if (shouldSkipExtraPreload()) {
      return [];
    }

    const uniqueUrls = [...new Set(urls.map(normalizeUrl).filter(Boolean))];
    return Promise.all(uniqueUrls.map((url) => enqueueUrl(url, 'arrayBuffer')));
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function pausePreloading(durationMs = DEFAULT_PAUSE_MS) {
    const safeDuration = Number.isFinite(Number(durationMs)) ? Math.max(0, Number(durationMs)) : DEFAULT_PAUSE_MS;
    preloadPausedUntil = Math.max(preloadPausedUntil, Date.now() + safeDuration);
    schedulePreloadResume();
  }

  function resumePreloading() {
    preloadPausedUntil = 0;
    if (preloadResumeTimer) {
      window.clearTimeout(preloadResumeTimer);
      preloadResumeTimer = null;
    }
    pumpQueue();
  }

  async function warmSegmentList(urls, state, delayMs) {
    const pending = [];

    for (const url of urls) {
      if (state.cancelled) {
        break;
      }

      if (isPageHidden()) {
        await new Promise((resolve) => {
          const resume = () => {
            if (!isPageHidden()) {
              document.removeEventListener('visibilitychange', resume);
              resolve();
            }
          };
          document.addEventListener('visibilitychange', resume);
        });
      }

      if (state.cancelled) {
        break;
      }

      if (isPreloadPaused()) {
        await new Promise((resolve) => {
          const waitMs = Math.max(0, preloadPausedUntil - Date.now());
          window.setTimeout(resolve, waitMs);
        });
      }

      if (state.cancelled) {
        break;
      }

      pending.push(enqueueUrl(url, 'arrayBuffer'));
      if (delayMs > 0) {
        await delay(delayMs);
      }
    }

    await Promise.all(pending);
  }

  async function warmCurrentDemo(playlistUrl, options = {}) {
    if (!playlistUrl || shouldSkipSegmentPreload()) {
      return null;
    }

    const absolutePlaylistUrl = new URL(playlistUrl, window.location.href).href;
    const existing = viewerWarmups.get(absolutePlaylistUrl);
    if (existing) {
      return existing.promise;
    }

    const state = { cancelled: false };
    const initialSegmentCount = Number.isFinite(Number(options.initialSegmentCount))
      ? Math.max(0, Number(options.initialSegmentCount))
      : INITIAL_VIEWER_SEGMENTS;
    const delayMs = Number.isFinite(Number(options.delayMs))
      ? Math.max(0, Number(options.delayMs))
      : VIEWER_BATCH_DELAY_MS;

    const promise = (async () => {
      const playlistData = await getPlaylistDataForUrl(absolutePlaylistUrl);
      if (!playlistData || state.cancelled) {
        return null;
      }

      if (playlistData.initUrl) {
        await enqueueUrl(playlistData.initUrl, 'arrayBuffer');
      }

      const initialUrls = playlistData.segmentUrls.slice(0, initialSegmentCount);
      const remainingUrls = playlistData.segmentUrls.slice(initialSegmentCount);
      await warmSegmentList(initialUrls, state, 0);
      await warmSegmentList(remainingUrls, state, delayMs);
      return {
        playlistUrl: absolutePlaylistUrl,
        segmentCount: playlistData.segmentUrls.length
      };
    })().finally(() => {
      viewerWarmups.delete(absolutePlaylistUrl);
    });

    viewerWarmups.set(absolutePlaylistUrl, {
      promise,
      cancel: () => {
        state.cancelled = true;
      }
    });

    return promise;
  }

  function cancelCurrentDemoWarmup(playlistUrl) {
    if (!playlistUrl) {
      for (const warmup of viewerWarmups.values()) {
        warmup.cancel();
      }
      viewerWarmups.clear();
      return;
    }

    const absolutePlaylistUrl = new URL(playlistUrl, window.location.href).href;
    viewerWarmups.get(absolutePlaylistUrl)?.cancel();
    viewerWarmups.delete(absolutePlaylistUrl);
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
    if (!cards.length) {
      return false;
    }

    for (const card of cards) {
      const warmCard = () => warmIntentSegments(getDemoIdFromCard(card));

      card.addEventListener('pointerenter', warmCard, { passive: true });
      card.addEventListener('focusin', warmCard);
      card.addEventListener('touchstart', warmCard, { passive: true });
      card.addEventListener('mousedown', warmCard, { passive: true });
    }

    return true;
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

  function warmHomeCardImages() {
    const urls = [...document.querySelectorAll(CARD_IMAGE_SELECTOR)]
      .map((image) => image.currentSrc || image.getAttribute('src'));
    warmImageUrls(urls);
  }

  function start() {
    if (bindIntentPreload()) {
      scheduleIdle(warmAllPlaylistsAndInit);
      scheduleIdle(warmHomeCardImages);
    }
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
    warmIntentSegments,
    warmImageUrls,
    warmCurrentDemo,
    cancelCurrentDemoWarmup,
    pausePreloading,
    resumePreloading
  };
})();
