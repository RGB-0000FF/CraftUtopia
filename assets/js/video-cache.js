// Background video caching for the demo gallery and viewer.
(() => {
  const scriptUrl = new URL(document.currentScript?.src || 'assets/js/video-cache.js', document.baseURI);
  const siteRootUrl = new URL('../../', scriptUrl);
  const manifestUrl = new URL('data/video-cache-manifest.json', siteRootUrl);
  const serviceWorkerUrl = new URL('sw.js', siteRootUrl);
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const shouldPauseAutoWarm = Boolean(connection?.saveData) || /(^|-)2g$/.test(connection?.effectiveType || '');
  const statusNode = document.querySelector('[data-video-cache-status]');
  const messageNode = document.querySelector('[data-video-cache-message]');
  const retryButton = document.querySelector('[data-video-cache-retry]');
  const isHomePage = Boolean(document.querySelector('.demo-grid'));
  let manifestPromise = null;
  let registrationPromise = null;
  let lastVideos = [];
  let isWarming = false;

  function isSupported() {
    return 'serviceWorker' in navigator && 'caches' in window;
  }

  function toAbsoluteUrl(path) {
    return new URL(path, siteRootUrl).href;
  }

  function isSameOrigin(url) {
    return new URL(url, window.location.href).origin === window.location.origin;
  }

  function getLocalVideos(videos = []) {
    return videos.filter((video) => isSameOrigin(video.url));
  }

  function setStatus(message, state = 'idle', canRetry = false) {
    if (!statusNode || !messageNode) return;
    statusNode.hidden = false;
    statusNode.dataset.state = state;
    messageNode.textContent = message;
    if (retryButton) retryButton.hidden = !canRetry;
  }

  function hideStatus() {
    if (statusNode) statusNode.hidden = true;
  }

  function scheduleIdle(task) {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(task, { timeout: 2500 });
      return;
    }
    window.setTimeout(task, 1200);
  }

  async function loadManifest() {
    if (!manifestPromise) {
      manifestPromise = fetch(manifestUrl, { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) throw new Error(`Video cache manifest HTTP ${response.status}`);
          return response.json();
        })
        .then((manifest) => ({
          ...manifest,
          videos: (manifest.videos || []).map((video) => ({
            ...video,
            url: toAbsoluteUrl(video.url)
          }))
        }));
    }
    return manifestPromise;
  }

  async function registerServiceWorker() {
    if (!isSupported()) return null;
    if (!registrationPromise) {
      registrationPromise = navigator.serviceWorker
        .register(serviceWorkerUrl, { scope: siteRootUrl.href })
        .then(() => navigator.serviceWorker.ready);
    }
    return registrationPromise;
  }

  async function postToServiceWorker(message) {
    const registration = await registerServiceWorker();
    const worker = registration?.active || registration?.waiting || registration?.installing || navigator.serviceWorker.controller;
    if (!worker) throw new Error('Video cache worker unavailable');
    worker.postMessage(message);
  }

  function handleWorkerMessage(event) {
    const data = event.data || {};
    if (!data.type?.startsWith?.('VIDEO_CACHE_')) return;

    if (data.type === 'VIDEO_CACHE_STATUS') {
      const cachedCount = (data.videos || []).filter((video) => video.cached).length;
      if (data.videos?.length && cachedCount === data.videos.length) {
        setStatus('Videos ready', 'ready', false);
      }
      return;
    }

    if (data.type === 'VIDEO_CACHE_PROGRESS') {
      if (!data.total) return;
      const done = Math.min(data.cachedCount + data.failedCount, data.total);
      setStatus(`Caching videos ${done}/${data.total}`, data.failedCount ? 'warning' : 'active', Boolean(data.failedCount));
      return;
    }

    if (data.type === 'VIDEO_CACHE_COMPLETE') {
      isWarming = false;
      if (data.failedCount) {
        setStatus(`Cached ${data.cachedCount}/${data.total} videos`, 'warning', true);
      } else {
        setStatus('Videos ready', 'ready', false);
      }
    }
  }

  async function requestCacheStatus(manifest) {
    await postToServiceWorker({
      type: 'CACHE_STATUS',
      version: manifest.version,
      videos: manifest.videos
    });
  }

  async function warmAllVideos() {
    if (!isSupported() || isWarming) return;
    const manifest = await loadManifest();
    lastVideos = manifest.videos || [];
    isWarming = true;
    if (!lastVideos.length) {
      setStatus('Prepare videos', 'paused', true);
      return;
    }
    setStatus(`Caching videos 0/${lastVideos.length}`, 'active', false);
    await postToServiceWorker({
      type: 'CACHE_VIDEOS',
      version: manifest.version,
      videos: lastVideos
    });
  }

  async function cacheCurrentVideo(videoPath) {
    if (!isSupported() || !videoPath) return;
    const url = toAbsoluteUrl(videoPath);
    if (!isSameOrigin(url)) return;
    const manifest = await loadManifest().catch(() => ({ version: undefined }));
    await postToServiceWorker({
      type: 'CACHE_VIDEO',
      version: manifest.version,
      url
    }).catch(() => {});
  }

  async function initHomeCache() {
    if (!isHomePage) return;
    if (!isSupported()) {
      hideStatus();
      return;
    }

    try {
      const manifest = await loadManifest();
      lastVideos = getLocalVideos(manifest.videos || []);
      await registerServiceWorker();
      navigator.serviceWorker.addEventListener('message', handleWorkerMessage);
      await requestCacheStatus(manifest);

      setStatus(shouldPauseAutoWarm ? 'Video cache paused' : 'Prepare videos', 'paused', true);
    } catch (error) {
      setStatus('Video cache paused', 'warning', true);
    }
  }

  async function initWorkerMessages() {
    if (!isSupported() || isHomePage) return;
    await registerServiceWorker().catch(() => null);
    navigator.serviceWorker.addEventListener('message', handleWorkerMessage);
  }

  retryButton?.addEventListener('click', () => {
    setStatus('Caching videos 0/' + lastVideos.length, 'active', false);
    warmAllVideos().catch(() => {
      isWarming = false;
      setStatus('Video cache paused', 'warning', true);
    });
  });

  window.CraftUtopiaVideoCache = {
    cacheCurrentVideo,
    warmAllVideos,
    loadManifest
  };

  initWorkerMessages();
  initHomeCache();
})();
