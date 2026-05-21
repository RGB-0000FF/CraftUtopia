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
  if (timelineScrubber) timelineScrubber.value = String(Math.round(clamp((elapsedSeconds / getPresentationTotalSeconds()) * 1000, 0, 1000)));
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
        kind: event.skillEvent || event.type,
        skillRef: event.skill
      }
    })))
    .sort((a, b) => a.seconds - b.seconds || a.stageIndex - b.stageIndex || a.eventIndex - b.eventIndex);
}

function getSearchTextValues(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [String(item || '')];
    return Object.values(item).flatMap((entry) => Array.isArray(entry) ? entry.map((line) => String(line)) : [String(entry || '')]);
  }).filter(Boolean);
}

function getEventSearchText(event = {}, display = {}) {
  return [
    event.skill,
    event.action,
    event.text,
    event.line,
    event.tool,
    ...(Array.isArray(event.tools) ? event.tools : []),
    ...(Array.isArray(display.tools) ? display.tools : []),
    ...(Array.isArray(event.messages) ? event.messages : []),
    ...(Array.isArray(display.messages) ? display.messages : []),
    ...(Array.isArray(event.skills) ? event.skills : []),
    ...(Array.isArray(display.skills) ? display.skills : []),
    ...(Array.isArray(event.results) ? event.results : []),
    ...(Array.isArray(display.results) ? display.results : []),
    ...(Array.isArray(event.notes) ? event.notes : []),
    ...(Array.isArray(display.notes) ? display.notes : []),
    display.action,
    display.text,
    ...getSearchTextValues(event.sublines),
    ...getSearchTextValues(display.sublines),
    ...(Array.isArray(event.highlights) ? event.highlights : []),
    ...(Array.isArray(display.highlights) ? display.highlights : [])
  ].filter(Boolean).join(' ');
}

function inferSkillRefFromEvent(event = {}, display = {}) {
  if (event.skill || display.skill) return event.skill || display.skill;
  const tool = String(event.tool || display.tool || '').trim().toLowerCase();
  if (tool !== 'create skill' && tool !== 'use skill') return '';
  const text = getEventSearchText(event, display).toLowerCase();
  const aliases = [
    { ref: 'build_region', labels: ['learned region placement', 'region placement'] },
    { ref: 'replace_region', labels: ['learned region replacement', 'region replacement'] },
    { ref: 'scaffold', labels: ['learned scaffold construction', 'scaffold construction'] },
    { ref: 'clean_region', labels: ['learned region cleaning', 'region cleaning'] }
  ];
  return aliases.find((skill) => skill.labels.some((label) => text.includes(label)))?.ref || '';
}

function inferSkillEventKind(event = {}, display = {}) {
  if (event.skillEvent || display.skillEvent) return event.skillEvent || display.skillEvent;
  const tool = String(event.tool || display.tool || '').trim().toLowerCase();
  if (tool === 'create skill') return 'skill-detection';
  if (tool === 'use skill') return 'skill-use';
  return '';
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
    document.createTextNode(' '),
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
const DATA_ASSET_VERSION = '20260522-hls-root-fix2';

let RUN_EVENTS_MANIFEST_PATH = 'data/demo-log/manifest.json';
const DEFAULT_DEMO_ID = 'sydney-opera-house';
let hlsPreloadThrottleBound = false;

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

function bindHlsPreloadThrottle() {
  if (!worldVideo || hlsPreloadThrottleBound) return;
  hlsPreloadThrottleBound = true;

  const pauseBackgroundPreload = () => {
    window.CraftUtopiaHlsPreload?.pausePreloading?.(4000);
  };
  const resumeBackgroundPreload = () => {
    window.CraftUtopiaHlsPreload?.resumePreloading?.();
  };

  worldVideo.addEventListener('waiting', pauseBackgroundPreload);
  worldVideo.addEventListener('stalled', pauseBackgroundPreload);
  worldVideo.addEventListener('canplay', resumeBackgroundPreload);
  worldVideo.addEventListener('playing', resumeBackgroundPreload);
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
  bindHlsPreloadThrottle();

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
  if (demoProfileStylesheet) {
    if (profile.stylesheet) {
      demoProfileStylesheet.href = siteAssetUrl(profile.stylesheet);
      demoProfileStylesheet.disabled = false;
    } else {
      demoProfileStylesheet.removeAttribute('href');
      demoProfileStylesheet.disabled = true;
    }
  }
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
  document.body.classList.toggle('is-sydney-top-milestones', Boolean(profile.topMilestoneMode));
  document.body.classList.toggle('is-timeline-playback-controls', Boolean(profile.topMilestoneMode));
  positionPlaybackControls(Boolean(profile.topMilestoneMode));
  topMilestoneRenderKey = '';
  renderTopMilestones(stages[0]?.id ?? 0);
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

function positionPlaybackControls(useTimelineSlot = false) {
  if (!consoleControlGroup) return;
  if (useTimelineSlot && timelineControlSlot) {
    if (consoleControlGroup.parentNode !== timelineControlSlot) {
      timelineControlSlot.append(consoleControlGroup);
    }
    return;
  }
  if (consoleControlAnchor?.parentNode && consoleControlGroup.parentNode !== consoleControlAnchor.parentNode) {
    consoleControlAnchor.after(consoleControlGroup);
  }
}

async function loadJsonAsset(path) {
  const assetUrl = new URL(siteAssetUrl(path));
  assetUrl.searchParams.set('v', DATA_ASSET_VERSION);
  const response = await fetch(assetUrl.href, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Run events HTTP ${response.status}`);
  return response.json();
}

function createMilestoneStage(milestone = {}, seqRef) {
  const events = (milestone.events || []).map((event) => normalizeRunEvent(event, seqRef.value++));
  return {
    id: milestone.stageId ?? milestone.id,
    label: milestone.label || String(milestone.id || 'Milestone'),
    summary: milestone.focus || '',
    system: milestone.focus || milestone.label || '',
    metrics: milestone.timeRange || [],
    events
  };
}

function createRegionStage(region = {}, milestone = {}, seqRef) {
  const events = (region.events || []).map((event) => normalizeRunEvent(event, seqRef.value++));
  const regionLabel = region.id ? `Region ${region.id}` : 'Region build';
  return {
    id: region.stageId ?? region.id,
    label: `${regionLabel} build`,
    summary: milestone.focus || '',
    system: `${regionLabel}: ${milestone.focus || 'Build region'}`,
    metrics: region.timeRange || milestone.timeRange || [],
    events
  };
}

function buildMilestoneRunLog(manifest = {}) {
  const seqRef = { value: 1 };
  const stages = (manifest.milestones || []).flatMap((milestone) => {
    if (Array.isArray(milestone.regions) && milestone.regions.length) {
      return milestone.regions.map((region) => createRegionStage(region, milestone, seqRef));
    }
    return [createMilestoneStage(milestone, seqRef)];
  });
  return {
    title: manifest.title,
    intro: manifest.intro || manifest.title || '',
    meta: {
      ...(manifest.meta || {}),
      runId: manifest.meta?.runId || manifest.version || 'sydney-milestone-log',
      taskTitle: manifest.title,
      eventCount: stages.reduce((total, stage) => total + (stage.events?.length || 0), 0),
      phaseCount: stages.length
    },
    stages
  };
}

async function loadSplitRunEvents() {
  const manifest = await loadJsonAsset(RUN_EVENTS_MANIFEST_PATH);
  if (Array.isArray(manifest.milestones)) {
    return buildMilestoneRunLog(manifest);
  }

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
  const tools = event.tools || display.tools || [];
  const messages = event.messages || display.messages || [];
  const skills = event.skills || display.skills || [];
  const results = event.results || display.results || [];
  const notes = event.notes || display.notes || [];
  const highlights = Array.isArray(event.highlights)
    ? event.highlights
    : (Array.isArray(display.highlights) ? display.highlights : []);
  const timecode = event.timecode || display.timecode || formatRunTimecode(time);
  const line = event.line || `[${timecode}] [${actor}] [${kind}] ${action}`;
  const skill = inferSkillRefFromEvent({ ...event, action, sublines, highlights, line }, display);
  const skillEvent = skill ? inferSkillEventKind(event, display) : '';
  const normalized = {
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
      sublines,
      tools,
      messages,
      skills,
      results,
      notes,
      highlights: highlights.map((highlight) => String(highlight)).filter(Boolean)
    }
  };
  if (skill) normalized.skill = skill;
  if (skillEvent) normalized.skillEvent = skillEvent;
  return normalized;
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
