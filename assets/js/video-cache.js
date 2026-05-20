// Silent background range support for the demo viewer.
(() => {
  const scriptUrl = new URL(document.currentScript?.src || 'assets/js/video-cache.js', document.baseURI);
  const siteRootUrl = new URL('../../', scriptUrl);
  const manifestUrl = new URL('data/video-cache-manifest.json', siteRootUrl);
  const serviceWorkerUrl = new URL('sw.js', siteRootUrl);
  let manifestPromise = null;
  let registrationPromise = null;

  function isSupported() {
    return 'serviceWorker' in navigator && 'caches' in window;
  }

  function toAbsoluteUrl(path) {
    return new URL(path, siteRootUrl).href;
  }

  function isSameOrigin(url) {
    return new URL(url, window.location.href).origin === window.location.origin;
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

  window.CraftUtopiaVideoCache = {
    cacheCurrentVideo,
    loadManifest
  };

  registerServiceWorker().catch(() => {});
})();
