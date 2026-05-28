// CraftUtopia demo data.
function setStage(stageId, activeMessage = null) {
  const stage = stages.find((item) => Number(item.id) === Number(stageId)) || stages[0];
  if (!stage) return;

  if (systemLine) appendMentionedText(systemLine, stage.system);
  skillLibrary?.classList.add('is-visible');
  if (activeMessage?.dataset.skillRef) renderSkillLibrary(activeMessage.dataset.skillRef);

  renderMilestones(stage.id);

  chatMessages.forEach((node) => node.classList.toggle('active', node === activeMessage));
}

function parseTimelineTime(time = '00:00.0') {
  const parts = String(time).split(':').map(Number);
  if (parts.length === 1) return parts[0] || 0;
  return parts.reduce((total, part) => (total * 60) + (Number.isFinite(part) ? part : 0), 0);
}

function formatManifestTimelineTime(seconds = 0) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds - (minutes * 60);
  return `${String(minutes).padStart(2, '0')}:${remaining.toFixed(1).padStart(4, '0')}`;
}

function getTimedSublineSpan(event = {}, sublineCount = 0) {
  const span = Number(event.sublineSpanSeconds ?? event.spanSeconds ?? 0);
  if (Number.isFinite(span) && span > 0) return span;
  if (event.revealSublines === true && sublineCount > 0) return Math.max(1.2, sublineCount * 0.75);
  return 0;
}

function expandTimedSublineEvent(event = {}, seqRef) {
  const sublines = Array.isArray(event.sublines) ? event.sublines : [];
  const span = getTimedSublineSpan(event, sublines.length);
  if (!span || !sublines.length) return [normalizeRunEvent(event, seqRef.value++)];

  const startSeconds = parseTimelineTime(event.time || event.at || '00:00.0');
  const step = span / Math.max(sublines.length, 1);
  const {
    sublineSpanSeconds,
    spanSeconds,
    revealSublines,
    ...baseEvent
  } = event;
  const events = [
    normalizeRunEvent({
      ...baseEvent,
      sublines: []
    }, seqRef.value++)
  ];

  sublines.forEach((subline, index) => {
    events.push(normalizeRunEvent({
      ...baseEvent,
      action: '',
      text: '',
      lines: undefined,
      sublines: [subline],
      progress: null,
      sublineOnly: true,
      time: formatManifestTimelineTime(startSeconds + (step * (index + 1))),
      groupEntryIndex: (baseEvent.groupEntryIndex ?? 0) + ((index + 1) / 100)
    }, seqRef.value++));
  });
  return events;
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

function hasStructuredSublineType(value, typeNames = []) {
  if (!Array.isArray(value)) return false;
  return value.some((item) => item && typeof item === 'object' && typeNames.some((name) => item[name] !== undefined));
}

function inferSkillRefFromEvent(event = {}, display = {}) {
  if (event.skill || display.skill) return event.skill || display.skill;
  const tool = String(event.tool || display.tool || '').trim().toLowerCase();
  const text = getEventSearchText(event, display).toLowerCase();
  const hasSkillSubline = hasStructuredSublineType(event.sublines, ['skills', 'skill'])
    || hasStructuredSublineType(display.sublines, ['skills', 'skill']);
  if (tool !== 'create skill' && tool !== 'use skill' && !hasSkillSubline && !/\b(?:create|use) skill\b/.test(text)) return '';
  const aliases = [
    { ref: 'build_region', labels: ['region construction', 'learned region construction', 'region placement', 'learned region placement'] },
    { ref: 'replace_region', labels: ['region replacement', 'learned region replacement'] },
    { ref: 'scaffold', labels: ['scaffold construction', 'learned scaffold construction'] },
    { ref: 'clean_region', labels: ['scaffold cleaning', 'learned scaffold cleaning', 'region cleaning', 'learned region cleaning'] }
  ];
  return aliases.find((skill) => skill.labels.some((label) => text.includes(label)))?.ref || '';
}

function isLearningEventGroup(group = {}) {
  return Boolean(group.learningLabel || /^skill-/.test(String(group.groupId || group.logGroup || '')));
}

function getLearningRangeForGroup(group = {}, entries = []) {
  if (!isLearningEventGroup(group)) return null;
  const skill = inferSkillRefFromEvent({
    ...group,
    action: [
      group.action,
      group.learningLabel,
      group.groupId,
      ...entries.map((entry) => entry.action)
    ].filter(Boolean).join(' '),
    sublines: [
      ...(Array.isArray(group.sublines) ? group.sublines : []),
      ...entries.flatMap((entry) => Array.isArray(entry.sublines) ? entry.sublines : [])
    ],
    highlights: [
      ...(Array.isArray(group.highlights) ? group.highlights : []),
      ...entries.flatMap((entry) => Array.isArray(entry.highlights) ? entry.highlights : [])
    ]
  });
  const range = activeDemoProfile.skillLearningRanges?.[skill] || group.learningRange || group.timeRange;
  if (!Array.isArray(range) || range.length < 2) return null;
  const start = parseTimelineTime(range[0]);
  const end = parseTimelineTime(range[1]);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return { start, end };
}

function distributeEntriesAcrossLearningRange(group = {}, entries = []) {
  const range = getLearningRangeForGroup(group, entries);
  if (!range || entries.length <= 1) return entries;
  const span = range.end - range.start;
  return entries.map((entry, index) => {
    const defaultRatio = entries.length <= 1 ? 0 : index / (entries.length - 1);
    const ratio = LEARNING_RANGE_ENTRY_FRACTIONS[index] ?? defaultRatio;
    return {
      ...entry,
      time: formatManifestTimelineTime(range.start + (span * Math.max(0, Math.min(1, ratio))))
    };
  });
}

function inferSkillEventKind(event = {}, display = {}) {
  if (event.skillEvent || display.skillEvent) return event.skillEvent || display.skillEvent;
  const tool = String(event.tool || display.tool || '').trim().toLowerCase();
  if (tool === 'create skill') return 'skill-detection';
  if (tool === 'use skill') return 'skill-use';
  const text = getEventSearchText(event, display).toLowerCase();
  if (/\btool call\s+create skill\b/.test(text) || /\bcreate skill\b/.test(text)) return 'skill-detection';
  if (/\btool call\s+use skill\b/.test(text) || /\buse skill\b/.test(text)) return 'skill-use';
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
const DATA_ASSET_VERSION = '20260528-demo-timestamp-audit';
let runEventsManifestPath = '';
const DEFAULT_DEMO_ID = 'sydney-opera-house';
let hlsPreloadThrottleBound = false;
const LEARNING_RANGE_ENTRY_FRACTIONS = [0, 0.72, 0.92, 1];

function getTopMilestoneLogBoardWidth() {
  const viewportWidth = Number(window.innerWidth) || 0;
  if (viewportWidth >= 1800) return 460;
  if (viewportWidth >= 1440) return 420;
  return 380;
}

function getRequestedDemoParam() {
  const params = new URLSearchParams(window.location.search);
  return params.get('demo');
}

function normalizeDemoId(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
}

function getRequestedDemoId() {
  return normalizeDemoId(getRequestedDemoParam()) || DEFAULT_DEMO_ID;
}

async function loadDemoProfile() {
  const demoId = getRequestedDemoId();
  let profile;
  try {
    profile = await loadJsonAsset(`data/demos/${demoId}/demo.json`);
  } catch (error) {
    const requested = normalizeDemoId(getRequestedDemoParam());
    if (!requested || requested === DEFAULT_DEMO_ID) throw error;
    throw new Error(`Unknown demo "${demoId}". Check data/demos/${demoId}/demo.json on GitHub Pages.`);
  }
  validateDemoProfile(profile, demoId);
  return profile;
}

function validateDemoProfile(profile = {}, demoId = '') {
  const errors = [];
  ['id', 'video', 'logManifest', 'introImage'].forEach((field) => {
    if (!String(profile[field] || '').trim()) errors.push(field);
  });
  if (profile.video && !HLS_MANIFEST_PATTERN.test(String(profile.video))) errors.push('video .m3u8');
  ['introSeconds', 'durationSeconds'].forEach((field) => {
    if (!Number.isFinite(Number(profile[field]))) errors.push(field);
  });
  if (!Array.isArray(profile.timelineKeyframes)) errors.push('timelineKeyframes');
  if (errors.length) {
    throw new Error(`Invalid demo profile "${demoId}": missing ${errors.join(', ')}.`);
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

  if (!isHlsSource) throw new Error(`Demo video must be an HLS manifest: ${videoPath}`);

  window.CraftUtopiaHlsPreload?.warmCurrentDemo?.(sourceUrl, {
    initialSegmentCount: 8,
    delayMs: 250
  });
  bindHlsPreloadThrottle();

  worldVideo.removeAttribute('src');
  if (window.Hls?.isSupported?.()) {
    activeHlsController = new window.Hls(HLS_PLAYBACK_CONFIG);
    activeHlsController.loadSource(sourceUrl);
    activeHlsController.attachMedia(worldVideo);
    return;
  }

  if (worldVideo.canPlayType('application/vnd.apple.mpegurl')) {
    worldVideo.src = sourceUrl;
    worldVideo.load?.();
    return;
  }

  throw new Error('HLS playback is not supported in this browser.');
}

function applyDemoProfile(profile = {}) {
  activeDemoProfile = profile || {};
  document.title = profile.pageTitle || profile.taskTitle || 'CraftUtopia Demo Viewer';
  if (demoProfileStylesheet) {
    if (profile.stylesheet) {
      const stylesheetUrl = new URL(siteAssetUrl(profile.stylesheet));
      stylesheetUrl.searchParams.set('v', DATA_ASSET_VERSION);
      demoProfileStylesheet.href = stylesheetUrl.href;
      demoProfileStylesheet.disabled = false;
    } else {
      demoProfileStylesheet.removeAttribute('href');
      demoProfileStylesheet.disabled = true;
    }
  }
  runEventsManifestPath = profile.logManifest;
  introArchitectureSeconds = Math.max(0, Number(profile.introSeconds));
  demoVideoSeconds = Math.max(0, Number(profile.durationSeconds));
  timelineKeyframes = profile.timelineKeyframes.map((keyframe) => ({ ...keyframe }));
  heldKeyframes.clear();
  if (worldVideo && profile.video) loadWorldVideoSource(profile.video);
  setImageSource('#timeline-intro img', profile.introImage, '');
  setImageSource('.framework-preview img, .framework-lightbox img', profile.frameworkImage, 'CraftUtopia execution framework architecture');
  document.body.classList.toggle('is-cover-hidden', profile.showCover === false);
  document.body.classList.toggle('is-block-count-hidden', profile.showBlockCount === false);
  document.body.classList.toggle('is-video-only-locked', Boolean(profile.lockVideoOnly || profile.videoOnly));
  document.body.classList.toggle('is-video-fit-contain', profile.videoFit === 'contain');
  const useTimelinePlaybackControls = Boolean(profile.topMilestoneMode || profile.videoOnly);
  document.body.classList.toggle('is-top-milestone-layout', Boolean(profile.topMilestoneMode));
  document.body.classList.toggle('is-timeline-playback-controls', useTimelinePlaybackControls);
  if (profile.topMilestoneMode) setLogBoardWidth(getTopMilestoneLogBoardWidth());
  positionPlaybackControls(useTimelinePlaybackControls);
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
  const response = await fetch(assetUrl.href);
  if (!response.ok) throw new Error(`Run events HTTP ${response.status}`);
  return response.json();
}

function normalizeRunEvents(events = [], seqRef) {
  return events.flatMap((event, groupIndex) => {
    if (!Array.isArray(event.entries) || !event.entries.length) {
      return expandTimedSublineEvent(event, seqRef);
    }

    const { entries, ...group } = event;
    const logGroup = group.groupId || `${group.actor || 'log'}-${group.time || seqRef.value}-${groupIndex}`;
    const timedEntries = distributeEntriesAcrossLearningRange(group, entries);
    return timedEntries.flatMap((entry, entryIndex) => expandTimedSublineEvent({
      ...group,
      ...entry,
      actor: entry.actor || group.actor,
      time: entry.time || group.time,
      logGroup: entry.logGroup || logGroup,
      groupEntryIndex: entry.groupEntryIndex ?? entryIndex,
      groupEntryCount: entries.length
    }, seqRef));
  });
}

function createMilestoneStage(milestone = {}, seqRef) {
  const events = normalizeRunEvents(milestone.events || [], seqRef);
  return {
    id: milestone.stageId ?? milestone.id,
    label: milestone.label || String(milestone.id || 'Milestone'),
    summary: milestone.focus || '',
    system: milestone.focus || milestone.label || '',
    metrics: milestone.timeRange || [],
    events
  };
}

function buildMilestoneRunLog(manifest = {}) {
  const seqRef = { value: 1 };
  const stages = (manifest.milestones || []).map((milestone) => createMilestoneStage(milestone, seqRef));
  return {
    title: manifest.title,
    intro: manifest.intro || manifest.title || '',
    meta: {
      ...(manifest.meta || {}),
      runId: manifest.meta?.runId || manifest.version || 'milestone-log',
      taskTitle: manifest.title,
      eventCount: stages.reduce((total, stage) => total + (stage.events?.length || 0), 0),
      phaseCount: stages.length
    },
    stages
  };
}

async function loadRunEvents() {
  const manifest = await loadJsonAsset(runEventsManifestPath);
  if (!Array.isArray(manifest.milestones)) {
    throw new Error(`Run log must use the milestone manifest format: ${runEventsManifestPath}`);
  }
  return buildMilestoneRunLog(manifest);
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
  const action = event.action !== undefined
    ? event.action
    : (display.action !== undefined
      ? display.action
      : String(event.text || '').replace(/^\[T\+[^\]]+\]\s+\[[^\]]+\]\s+\[[^\]]+\]\s*/, ''));
  const sublines = event.sublines !== undefined ? event.sublines : (display.sublines || []);
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
      logGroup: event.logGroup || display.logGroup || '',
      learningLabel: event.learningLabel || display.learningLabel || '',
      sublineOnly: Boolean(event.sublineOnly || display.sublineOnly),
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
    chatFeed.innerHTML = `<div class="log-error">Could not load run event data from <code>${escapeHtml(runEventsManifestPath)}</code>. Check that the demo profile, log manifest, and media paths are published on GitHub Pages. ${escapeHtml(error.message)}</div>`;
    console.error(error);
  }
}
