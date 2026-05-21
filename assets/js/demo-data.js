// CraftUtopia demo data.
function setStage(stageId, activeMessage = null, activeEvent = null) {
  const stage = stages.find((item) => Number(item.id) === Number(stageId)) || stages[0];
  if (!stage) return;

  if (systemLine) appendMentionedText(systemLine, stage.system);
  skillLibrary?.classList.add('is-visible');
  if (activeMessage?.dataset.skillRef) renderSkillLibrary(activeMessage.dataset.skillRef);

  const eventIndex = Number(activeMessage?.dataset.eventIndex);
  const focusedEvent = activeEvent || (Number.isFinite(eventIndex) ? playbackEvents[eventIndex] : null);
  const focusedPlaybackIndex = Number.isFinite(eventIndex) ? eventIndex : (focusedEvent ? playbackEvents.indexOf(focusedEvent) : -1);
  const focusedCount = focusedPlaybackIndex >= 0 ? focusedPlaybackIndex + 1 : playbackCursor;
  const elapsedSeconds = getDemoSecondsForEventCount(focusedCount);
  const elapsedTime = formatTimelineTime(elapsedSeconds);
  const progressValue = `${Math.round(clamp((elapsedSeconds / getPresentationTotalSeconds()) * 100, 0, 100))}%`;

  if (consoleProgressValue) consoleProgressValue.textContent = progressValue;
  if (consoleElapsedValue) consoleElapsedValue.textContent = elapsedTime;
  if (consoleProgressBar) consoleProgressBar.style.width = progressValue;
  if (consoleElapsedBar) consoleElapsedBar.style.width = progressValue;
  consoleMeters.forEach((node) => { node.style.setProperty('--value', progressValue); });
  buildTimeline?.setAttribute('aria-valuenow', String(Math.round(clamp((elapsedSeconds / getPresentationTotalSeconds()) * 100, 0, 100))));
  buildTimeline?.setAttribute('aria-valuetext', elapsedTime);
  if (isAutoPlaying) {
    syncTimelineOverlayOnly(elapsedSeconds);
  } else {
    updateVideoForDemoSeconds(elapsedSeconds);
  }
  updateTimelineMarkerState(elapsedSeconds);
  renderMilestones(stage.id);

  const fallbackMessage = chatMessages.find((node) => Number(node.dataset.chatStage) === Number(stage.id));
  const focusedMessage = activeMessage || fallbackMessage;
  chatMessages.forEach((node) => node.classList.toggle('active', node === focusedMessage));
}

function syncTimelineFromLog() {
  if (!chatMessages.length) return;
  const latestMessage = chatMessages[chatMessages.length - 1];
  if (!latestMessage) return;
  const eventIndex = Number(latestMessage.dataset.eventIndex);
  setStage(Number(latestMessage.dataset.chatStage), latestMessage, playbackEvents[eventIndex]);
}

function parseTimelineTime(time = '00:00.0') {
  const parts = String(time).split(':').map(Number);
  if (parts.length === 1) return parts[0] || 0;
  return parts.reduce((total, part) => (total * 60) + (Number.isFinite(part) ? part : 0), 0);
}

function buildPlaybackEvents(runStages = []) {
  return runStages
    .flatMap((stage, stageIndex) => (stage.events || []).map((event, eventIndex) => ({
      ...event,
      stageId: stage.id,
      stageLabel: stage.label,
      stageSummary: stage.summary,
      stageIndex,
      eventIndex,
      seconds: parseTimelineTime(event.time),
      group: { id: `stage-${stage.id}`, title: stage.label },
      message: {
        text: event.text,
        kind: event.type,
        skillRef: event.skill
      }
    })))
    .sort((a, b) => a.seconds - b.seconds || a.stageIndex - b.stageIndex || a.eventIndex - b.eventIndex);
}

function renderConsoleTitle(title = 'CraftUtopia Build with 100 Agents') {
  if (!consoleTaskTitle) return;
  const safeTitle = String(title || 'CraftUtopia Build with 100 Agents');
  const marker = ' with ';
  const breakIndex = safeTitle.indexOf(marker);
  if (breakIndex < 0) {
    consoleTaskTitle.textContent = safeTitle;
    return;
  }

  const secondLine = Object.assign(document.createElement('span'), { className: 'console-title-break' });
  const secondText = safeTitle.slice(breakIndex + 1);
  const scaleMatch = secondText.match(/\b100\b/);
  if (!scaleMatch) {
    secondLine.textContent = secondText;
  } else {
    secondLine.append(
      document.createTextNode(secondText.slice(0, scaleMatch.index)),
      Object.assign(document.createElement('span'), {
        className: 'console-title-scale',
        textContent: scaleMatch[0]
      }),
      document.createTextNode(secondText.slice((scaleMatch.index || 0) + scaleMatch[0].length))
    );
  }

  consoleTaskTitle.replaceChildren(
    document.createTextNode(safeTitle.slice(0, breakIndex)),
    secondLine
  );
}

function setFrameworkExpanded(isExpanded) {
  terminalConsole?.classList.toggle('is-framework-expanded', isExpanded);
  consoleFramework?.classList.toggle('is-expanded', isExpanded);
  frameworkToggle?.setAttribute('aria-expanded', String(isExpanded));
}

function collapseFrameworkAfterHold() {
  clearTimeout(frameworkCollapseTimer);
  frameworkCollapseTimer = setTimeout(() => {
    frameworkCollapseTimer = null;
    setFrameworkExpanded(false);
  }, KEYFRAME_HOLD_MS);
}

function openFrameworkLightbox() {
  if (!frameworkLightbox) return;
  frameworkLightbox.hidden = false;
  document.body.style.overflow = 'hidden';
  frameworkClose?.focus();
}

function closeFrameworkLightbox() {
  if (!frameworkLightbox || frameworkLightbox.hidden) return;
  frameworkLightbox.hidden = true;
  document.body.style.overflow = '';
  frameworkOpen?.focus();
}

const pageBaseUrl = new URL(document.baseURI || window.location.href);
pageBaseUrl.search = '';
pageBaseUrl.hash = '';
const siteAssetUrl = (path) => new URL(path, pageBaseUrl).toString();
const HLS_MANIFEST_PATTERN = /\.m3u8(?:[?#]|$)/i;
const HLS_PLAYBACK_CONFIG = {
  startFragPrefetch: true,
  maxBufferLength: 45,
  maxMaxBufferLength: 90,
  backBufferLength: 30
};

let RUN_EVENTS_MANIFEST_PATH = 'data/demo-log/manifest.json';
const DEFAULT_DEMO_ID = 'sydney-opera-house';

function getRequestedDemoId() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('demo') || DEFAULT_DEMO_ID;
  return String(requested).trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || DEFAULT_DEMO_ID;
}

async function loadDemoProfile() {
  const demoId = getRequestedDemoId();
  try {
    return await loadJsonAsset(`data/demos/${demoId}/demo.json`);
  } catch (error) {
    if (demoId === DEFAULT_DEMO_ID) throw error;
    return loadJsonAsset(`data/demos/${DEFAULT_DEMO_ID}/demo.json`);
  }
}

function setImageSource(selector, source, alt = '') {
  if (!source) return;
  document.querySelectorAll(selector).forEach((image) => {
    image.src = siteAssetUrl(source);
    if (alt) image.alt = alt;
  });
}

function formatBlockCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value || '95,151');
  return new Intl.NumberFormat('en-US').format(number);
}

function destroyActiveHlsController() {
  if (!activeHlsController) return;
  activeHlsController.destroy();
  activeHlsController = null;
  window.CraftUtopiaHlsPreload?.cancelCurrentDemoWarmup?.();
}

function loadWorldVideoSource(videoPath) {
  if (!worldVideo || !videoPath) return;
  const sourceUrl = siteAssetUrl(videoPath);
  const isHlsSource = HLS_MANIFEST_PATTERN.test(sourceUrl);
  const isCrossOrigin = new URL(sourceUrl).origin !== window.location.origin;

  destroyActiveHlsController();
  if (isCrossOrigin) {
    worldVideo.crossOrigin = 'anonymous';
  } else {
    worldVideo.removeAttribute('crossorigin');
  }

  if (!isHlsSource) {
    worldVideo.src = sourceUrl;
    worldVideo.load?.();
    return;
  }

  window.CraftUtopiaHlsPreload?.warmCurrentDemo?.(sourceUrl, {
    initialSegmentCount: 8,
    delayMs: 250
  });

  worldVideo.removeAttribute('src');
  if (worldVideo.canPlayType('application/vnd.apple.mpegurl')) {
    worldVideo.src = sourceUrl;
    worldVideo.load?.();
    return;
  }

  if (window.Hls?.isSupported?.()) {
    activeHlsController = new window.Hls(HLS_PLAYBACK_CONFIG);
    activeHlsController.loadSource(sourceUrl);
    activeHlsController.attachMedia(worldVideo);
    return;
  }

  worldVideo.src = sourceUrl;
  worldVideo.load?.();
}

function applyDemoProfile(profile = {}) {
  activeDemoProfile = profile || {};
  document.title = profile.pageTitle || profile.taskTitle || 'CraftUtopia Demo Viewer';
  if (profile.logManifest) RUN_EVENTS_MANIFEST_PATH = profile.logManifest;
  introArchitectureSeconds = Number.isFinite(Number(profile.introSeconds)) ? Math.max(0, Number(profile.introSeconds)) : INTRO_ARCHITECTURE_SECONDS;
  if (Number.isFinite(Number(profile.fallbackVideoSeconds))) {
    demoVideoSeconds = Number(profile.fallbackVideoSeconds);
  }
  if (Array.isArray(profile.timelineKeyframes)) {
    timelineKeyframes = profile.timelineKeyframes.map((keyframe) => ({ ...keyframe }));
    heldKeyframes.clear();
  } else {
    timelineKeyframes = DEFAULT_TIMELINE_KEYFRAMES.map((keyframe) => ({ ...keyframe }));
  }
  if (worldVideo && profile.video) loadWorldVideoSource(profile.video);
  setImageSource('#timeline-intro img', profile.introImage, '');
  setImageSource('.framework-preview img, .framework-lightbox img', profile.frameworkImage, 'CraftUtopia execution framework architecture');
  document.body.classList.toggle('is-cover-hidden', profile.showCover === false);
  document.body.classList.toggle('is-block-count-hidden', profile.showBlockCount === false);
  document.body.classList.toggle('is-video-only-locked', Boolean(profile.lockVideoOnly || profile.videoOnly));
  document.body.classList.toggle('is-video-fit-contain', profile.videoFit === 'contain');
  if (profile.showCover !== false) setImageSource('#blueprint-cover-image', profile.coverImage || profile.introImage, `${profile.taskTitle || 'Blueprint'} cover preview`);
  window.CraftUtopiaHlsPreload?.warmImageUrls?.([
    profile.coverImage || profile.introImage,
    profile.introImage,
    profile.frameworkImage
  ].map((source) => source ? siteAssetUrl(source) : null));
  if (blueprintBlockCountValue) blueprintBlockCountValue.textContent = formatBlockCount(profile.blockCount || '95,151');
  if (blueprintBlockCount) blueprintBlockCount.setAttribute('aria-label', `Blueprint block count: ${blueprintBlockCountValue?.textContent || '95,151'} blocks`);
  if (profile.videoOnly) setVideoOnlyMode(true);
}

async function loadJsonAsset(path) {
  const response = await fetch(siteAssetUrl(path), { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Run events HTTP ${response.status}`);
  return response.json();
}

async function loadSplitRunEvents() {
  const manifest = await loadJsonAsset(RUN_EVENTS_MANIFEST_PATH);
  const manifestBasePath = RUN_EVENTS_MANIFEST_PATH.split('/').slice(0, -1).join('/');
  const phaseLogs = await Promise.all((manifest.timeline || []).map(async (phase) => {
    const phaseFile = phase.file || '';
    const phasePath = phaseFile.startsWith('/') || phaseFile.startsWith('http')
      ? phaseFile
      : `${manifestBasePath}/${phaseFile}`.replace(/^\//, '');
    const phaseLog = await loadJsonAsset(phasePath);
    return { phase, phaseLog };
  }));
  let seq = 1;
  const stages = phaseLogs.map(({ phase, phaseLog }) => {
    const stage = phaseLog.stage || {};
    const events = (phaseLog.events || []).map((event) => normalizeRunEvent(event, seq++));
    return {
      ...stage,
      id: stage.id ?? phase.id,
      label: stage.label || phase.label,
      summary: stage.summary || phase.summary || '',
      system: stage.system || stage.summary || phase.summary || '',
      metrics: stage.metrics || phase.metrics || [],
      events
    };
  });
  return {
    title: manifest.title,
    intro: manifest.intro,
    meta: {
      ...manifest.meta,
      eventCount: stages.reduce((total, stage) => total + (stage.events?.length || 0), 0)
    },
    stages
  };
}

async function loadRunEvents() {
  return loadSplitRunEvents();
}

function formatRunTimecode(time = '00:00.0') {
  const seconds = parseTimelineTime(time);
  return `T+${seconds.toFixed(2).padStart(6, '0')}`;
}

function normalizeRunEvent(event = {}, seq = 0) {
  const display = event.display || {};
  const time = event.time || event.at || '00:00.0';
  const actor = event.actor || display.actor || 'System';
  const kind = String(event.kind || event.type || display.kind || 'LOG').replace(/▶/g, '');
  const action = event.action || display.action || String(event.text || '').replace(/^\[T\+[^\]]+\]\s+\[[^\]]+\]\s+\[[^\]]+\]\s*/, '');
  const sublines = event.sublines || display.sublines || [];
  const timecode = event.timecode || display.timecode || formatRunTimecode(time);
  const line = event.line || `[${timecode}] [${actor}] [${kind}] ${action}`;
  return {
    ...event,
    time,
    type: kind,
    text: event.text || line,
    line,
    lines: event.lines || [line],
    seq: event.seq || seq,
    display: {
      ...display,
      timecode,
      actor,
      kind,
      action,
      sublines
    }
  };
}

async function bootLog() {
  try {
    const profile = await loadDemoProfile();
    applyDemoProfile(profile);
    const runLog = await loadRunEvents();
    stages = runLog.stages || [];
    groupRooms = runLog.stages || [];
    buildMentionIndex([]);
    playbackEvents = buildPlaybackEvents(groupRooms);
    rebuildTimelineAnchors();
    activeRoom = 'all';

    const runId = runLog.meta?.runId || (runLog.intro || runLog.meta?.systemIntro || '').match(/tiantan_build_\d+/)?.[0] || 'run-current';
    renderConsoleTitle(profile.taskTitle || runLog.meta?.taskTitle || 'CraftUtopia Build with 100 Agents');
    if (consoleRunId) consoleRunId.textContent = `run ${runId}`;
    if (logKicker) logKicker.textContent = runLog.title || runLog.meta?.kicker || logKicker.textContent;
    if (systemLine) appendMentionedText(systemLine, runLog.intro || runLog.meta?.systemIntro || systemLine.textContent);

    renderRoomList(groupRooms, activeRoom);
    renderChat(playbackEvents);
    setStage(stages[0]?.id ?? 0, chatMessages[0]);
    toggleAutoPlay();
  } catch (error) {
    chatFeed.innerHTML = `<div class="log-error">Could not load run event data from <code>${escapeHtml(RUN_EVENTS_MANIFEST_PATH)}</code>. Serve this folder with <code>python main.py</code> or another static server. ${escapeHtml(error.message)}</div>`;
    console.error(error);
  }
}
