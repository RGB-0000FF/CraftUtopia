// CraftUtopia demo playback.
function stopAutoPlay(update = true) {
  const wasHolding = isKeyframeHolding;
  clearTimeout(autoPlayTimer);
  clearTimeout(videoWaitPauseTimer);
  clearTimeout(videoWaitResumeTimer);
  cancelAnimationFrame(autoPlayFrame);
  clearTimeout(keyframeHoldTimer);
  autoPlayTimer = null;
  autoPlayFrame = null;
  keyframeHoldTimer = null;
  videoWaitPauseTimer = null;
  videoWaitResumeTimer = null;
  isTimelineWaitingForVideo = false;
  videoSyncBlockedUntil = 0;
  isAutoPlaying = false;
  isKeyframeHolding = false;
  worldVideo?.pause();
  if (wasHolding) collapseFrameworkAfterHold();
  if (update) updatePlaybackControls();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getPanelResizeBounds() {
  if (!appShell) return { min: LOG_BOARD_MIN_WIDTH, max: LOG_BOARD_MAX_WIDTH };
  const style = getComputedStyle(appShell);
  const gap = Number.parseFloat(style.columnGap || style.gap || '0') || 0;
  const paddingLeft = Number.parseFloat(style.paddingLeft || '0') || 0;
  const paddingRight = Number.parseFloat(style.paddingRight || '0') || 0;
  const resizerWidth = appResizer?.getBoundingClientRect().width || 0;
  const contentWidth = appShell.clientWidth - paddingLeft - paddingRight;
  const availableMax = contentWidth - (gap * 2) - resizerWidth - STATUS_MIN_WIDTH;
  const max = Math.max(LOG_BOARD_MIN_WIDTH, Math.min(LOG_BOARD_MAX_WIDTH, availableMax));
  return { min: LOG_BOARD_MIN_WIDTH, max };
}

function setLogBoardWidth(width) {
  if (!appShell || !appResizer || window.innerWidth <= COMPACT_BREAKPOINT) return;
  const bounds = getPanelResizeBounds();
  const next = Math.round(clamp(width, bounds.min, bounds.max));
  appShell.style.setProperty('--log-board-width', `${next}px`);
  appResizer.setAttribute('aria-valuemin', String(bounds.min));
  appResizer.setAttribute('aria-valuemax', String(Math.round(bounds.max)));
  appResizer.setAttribute('aria-valuenow', String(next));
}

function syncPanelWidthToCurrentLayout() {
  if (!logBoard || window.innerWidth <= COMPACT_BREAKPOINT) return;
  setLogBoardWidth(logBoard.getBoundingClientRect().width);
}

function getRightPanelWidthFromPointer(event) {
  if (!appShell) return logBoard?.getBoundingClientRect().width || LOG_BOARD_MIN_WIDTH;
  const style = getComputedStyle(appShell);
  const gap = Number.parseFloat(style.columnGap || style.gap || '0') || 0;
  const paddingRight = Number.parseFloat(style.paddingRight || '0') || 0;
  const appRect = appShell.getBoundingClientRect();
  const contentRight = appRect.right - paddingRight;
  return contentRight - event.clientX - gap;
}

function startPanelResize(event) {
  if (!appResizer || event.button !== 0 || window.innerWidth <= COMPACT_BREAKPOINT) return;
  event.preventDefault();
  appShell?.classList.add('is-resizing');
  appResizer.setPointerCapture?.(event.pointerId);
  setLogBoardWidth(getRightPanelWidthFromPointer(event));
}

function movePanelResize(event) {
  if (!appShell?.classList.contains('is-resizing')) return;
  event.preventDefault();
  setLogBoardWidth(getRightPanelWidthFromPointer(event));
}

function endPanelResize(event) {
  if (!appShell?.classList.contains('is-resizing')) return;
  appShell.classList.remove('is-resizing');
  appResizer?.releasePointerCapture?.(event.pointerId);
}

function handlePanelResizeKey(event) {
  if (!appResizer || !logBoard || window.innerWidth <= COMPACT_BREAKPOINT) return;
  const direction = event.key === 'ArrowLeft' ? 1 : (event.key === 'ArrowRight' ? -1 : 0);
  if (!direction) return;
  event.preventDefault();
  setLogBoardWidth(logBoard.getBoundingClientRect().width + (direction * 24));
}

function getReadableText(message = {}) {
  return String(message.text || message.systemLog || message.note || '');
}

function countReadingUnits(text = '') {
  const latinWords = text.match(/[A-Za-z0-9_./-]+/g) || [];
  const cjkChars = text.match(/[\u3400-\u9FFF\uF900-\uFAFF]/g) || [];
  const otherChars = text
    .replace(/[A-Za-z0-9_./-]+/g, '')
    .replace(/[\u3400-\u9FFF\uF900-\uFAFF]/g, '')
    .replace(/\s/g, '').length;

  return latinWords.length + Math.ceil(cjkChars.length / 2) + Math.ceil(otherChars / 6);
}

function getAutoPlayDelay(event) {
  const units = countReadingUnits(getReadableText(event?.message));
  return clamp(520 + (units * AUTO_PLAY_MS_PER_WORD), AUTO_PLAY_MIN_DELAY, AUTO_PLAY_MAX_DELAY) / playbackSpeed;
}

function getVideoTimelineEndSeconds() {
  return introArchitectureSeconds + Math.max(demoVideoSeconds, 0);
}

function isVideoClockRange(seconds = autoPlayClockStartSeconds) {
  return Boolean(worldVideo)
    && Number(seconds) >= introArchitectureSeconds
    && Number(seconds) < getVideoTimelineEndSeconds() - 0.08;
}

function getVideoDemoSeconds() {
  if (!worldVideo) return null;
  const videoSeconds = Number(worldVideo.currentTime);
  if (!Number.isFinite(videoSeconds)) return null;
  return clamp(introArchitectureSeconds + videoSeconds, 0, getPresentationTotalSeconds());
}

function getInternalAutoDemoSeconds(now = performance.now()) {
  const elapsed = Math.min(Math.max((now - autoPlayClockStartedAt) / 1000, 0), 0.16) * playbackSpeed;
  return clamp(autoPlayClockStartSeconds + elapsed, 0, getPresentationTotalSeconds());
}

function getCurrentAutoDemoSeconds(now = performance.now()) {
  if (!isAutoPlaying) return getDemoSecondsForEventCount(playbackCursor);
  const internalSeconds = getInternalAutoDemoSeconds(now);
  if (isVideoClockRange(internalSeconds) || isVideoClockRange(autoPlayClockStartSeconds)) {
    if (performance.now() < videoSyncBlockedUntil) return internalSeconds;
    const videoSeconds = getVideoDemoSeconds();
    if (videoSeconds !== null) return videoSeconds;
  }
  return internalSeconds;
}

function setAutoPlayClock(seconds = getDemoSecondsForEventCount(playbackCursor), now = performance.now()) {
  autoPlayClockStartSeconds = clamp(Number(seconds) || 0, 0, getPresentationTotalSeconds());
  autoPlayClockStartedAt = now;
}

function shouldGateTimelineForVideo(demoSeconds = getDemoSecondsForEventCount(playbackCursor)) {
  return worldVideo
    && isAutoPlaying
    && !isKeyframeHolding
    && !isScrubbingTimeline
    && isVideoClockRange(Number(demoSeconds) || 0)
    && playbackCursor < playbackEvents.length;
}

function clearVideoWaitState() {
  clearTimeout(videoWaitPauseTimer);
  clearTimeout(videoWaitResumeTimer);
  videoWaitPauseTimer = null;
  videoWaitResumeTimer = null;
  isTimelineWaitingForVideo = false;
}

function blockVideoTimelineSync(durationMs = 1800) {
  videoSyncBlockedUntil = Math.max(videoSyncBlockedUntil, performance.now() + durationMs);
}

function resumeTimelineAfterVideoWait() {
  if (!isTimelineWaitingForVideo) return;
  clearTimeout(videoWaitResumeTimer);
  videoWaitResumeTimer = null;
  const waitSeconds = getVideoDemoSeconds() ?? autoPlayClockStartSeconds;
  if (!shouldGateTimelineForVideo(waitSeconds)) {
    clearVideoWaitState();
    return;
  }
  if (worldVideo?.paused && !worldVideo.ended) {
    worldVideo.play?.().catch(() => {});
  }
  if (isVideoWaitingForDemoSeconds(waitSeconds)) {
    scheduleResumeTimelineAfterVideoWait();
    return;
  }
  clearVideoWaitState();
  startAutoPlayLoop(waitSeconds);
}

function scheduleResumeTimelineAfterVideoWait() {
  if (!isTimelineWaitingForVideo) return;
  clearTimeout(videoWaitResumeTimer);
  videoWaitResumeTimer = setTimeout(resumeTimelineAfterVideoWait, 120);
}

function pauseTimelineForVideoWait(demoSeconds = getDemoSecondsForEventCount(playbackCursor)) {
  if (!shouldGateTimelineForVideo(demoSeconds)) return;
  clearTimeout(autoPlayTimer);
  cancelAnimationFrame(autoPlayFrame);
  clearTimeout(videoWaitPauseTimer);
  autoPlayTimer = null;
  autoPlayFrame = null;
  videoWaitPauseTimer = null;
  isTimelineWaitingForVideo = true;
  setAutoPlayClock(demoSeconds);
  if (worldVideo?.paused && !worldVideo.ended) {
    worldVideo.play?.().catch(() => {});
  }
  renderPlaybackToDemoSeconds(autoPlayClockStartSeconds, { noSeek: true });
  updatePlaybackControls();
  scheduleResumeTimelineAfterVideoWait();
}

function schedulePauseTimelineForVideoWait() {
  if (!isAutoPlaying || isKeyframeHolding || isScrubbingTimeline) return;
  clearTimeout(videoWaitPauseTimer);
  videoWaitPauseTimer = setTimeout(() => {
    videoWaitPauseTimer = null;
    const demoSeconds = getCurrentAutoDemoSeconds();
    if (isVideoWaitingForDemoSeconds(demoSeconds)) {
      pauseTimelineForVideoWait(demoSeconds);
    }
  }, 80);
}

function isVideoWaitingForDemoSeconds(demoSeconds = 0) {
  if (!shouldGateTimelineForVideo(demoSeconds)) return false;
  if (worldVideo.seeking) return true;
  if (worldVideo.paused || worldVideo.ended) return true;
  if (worldVideo.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) return true;
  const targetVideoTime = clamp(Number(demoSeconds) - introArchitectureSeconds, 0, Math.max(demoVideoSeconds, 0));
  if (Math.abs((worldVideo.currentTime || 0) - targetVideoTime) > 0.85) return true;
  return false;
}

function formatPlaybackSpeed(speed = playbackSpeed) {
  return `${Number(speed).toFixed(1).replace(/\.0$/, '')}x`;
}

function refreshLucideIcons(root = document) {
  if (!window.lucide?.createIcons) return;
  window.lucide.createIcons({
    attrs: {
      'stroke-width': 2.25,
      'aria-hidden': 'true'
    },
    root
  });
}

function setLucideButtonIcon(button, iconName) {
  if (!button) return;
  const currentIcon = button.querySelector('.lucide, [data-lucide]');
  const currentName = currentIcon?.getAttribute('data-lucide') || currentIcon?.getAttribute('data-icon');
  if (currentName === iconName) return;
  button.innerHTML = `<i data-lucide="${iconName}" data-icon="${iconName}" aria-hidden="true"></i>`;
  refreshLucideIcons(button);
}

function setActionButtonLabel(button, label, iconName) {
  if (!button) return;
  const currentLabel = button.dataset.label || '';
  const currentIcon = button.dataset.icon || '';
  if (currentLabel === label && currentIcon === iconName) return;
  button.dataset.label = label;
  button.dataset.icon = iconName;
  button.innerHTML = `<i data-lucide="${iconName}" aria-hidden="true"></i><span>${label}</span>`;
  refreshLucideIcons(button);
}

function setTimelineReadout(seconds = 0) {
  const safeSeconds = clamp(Number(seconds) || 0, 0, getPresentationTotalSeconds());
  currentDemoSeconds = safeSeconds;
  const total = getPresentationTotalSeconds();
  const ratio = total > 0 ? clamp(safeSeconds / total, 0, 1) : 0;
  const progressValue = `${Math.round(ratio * 100)}%`;
  const elapsedTime = formatTimelineTime(safeSeconds);
  if (consoleProgressValue) consoleProgressValue.textContent = progressValue;
  if (consoleElapsedValue) consoleElapsedValue.textContent = elapsedTime;
  if (consoleProgressBar) consoleProgressBar.style.width = progressValue;
  if (consoleElapsedBar) consoleElapsedBar.style.width = progressValue;
  if (timelineScrubber) timelineScrubber.value = String(Math.round(ratio * 1000));
  consoleMeters.forEach((node) => { node.style.setProperty('--value', progressValue); });
  buildTimeline?.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
  buildTimeline?.setAttribute('aria-valuetext', elapsedTime);
  updateTimelineMarkerState(safeSeconds);
  renderTopMilestones(undefined, safeSeconds);
}

function renderPlaybackUntilLive(targetCount) {
  const total = playbackEvents.length;
  const requestedCount = clamp(Math.round(Number(targetCount) || 0), 0, total);
  const count = clamp(Math.min(requestedCount, playbackCursor + 1), 0, total);
  isLiveLogRevealLimited = requestedCount > count;
  if (count <= playbackCursor) {
    updatePlaybackControls();
    return;
  }

  chatFeed.querySelector('.chat-placeholder')?.remove();
  const shouldStickToBottom = shouldFollowLog || isLogNearBottom();
  let last = null;
  for (let index = playbackCursor; index < count; index += 1) {
    last = appendEventInstantly(playbackEvents[index], index, { animateEntry: true }) || last;
  }

  chatMessages = [...document.querySelectorAll('.event-row[data-chat-stage]')];
  playbackCursor = count;
  applyRoomVisibility();
  if (last) {
    setStage(last.stageId, last.node, last.event);
    shouldFollowLog = shouldStickToBottom;
    scrollChatToBottom(count, { instant: true });
  }
  updatePlaybackControls();
}

function renderPlaybackToDemoSeconds(seconds = 0, options = {}) {
  const safeSeconds = clamp(Number(seconds) || 0, 0, getPresentationTotalSeconds());
  renderPlaybackUntilLive(getEventCountForDemoSeconds(safeSeconds));
  setTimelineReadout(safeSeconds);
  if (options.syncVideo !== false) {
    updateVideoForDemoSeconds(safeSeconds, { noSeek: options.noSeek === true });
  }
}

function getNextPendingKeyframeBySeconds(seconds = 0) {
  return timelineKeyframes.find((keyframe) => !heldKeyframes.has(keyframe.id) && Number(seconds) >= Number(keyframe.demoSeconds) - 0.015);
}

function restartVideoOnlyPlayback() {
  if (!isVideoOnlyMode || !playbackEvents.length) return;
  clearTimeout(autoPlayTimer);
  cancelAnimationFrame(autoPlayFrame);
  clearTimeout(keyframeHoldTimer);
  autoPlayTimer = null;
  autoPlayFrame = null;
  keyframeHoldTimer = null;
  isKeyframeHolding = false;
  setFrameworkExpanded(false);
  playbackCursor = 0;
  isMessagePending = false;
  renderedStageIds = new Set();
  progressRows = new Map();
  activeLogGroupNode = null;
  milestoneRenderKey = '';
  topMilestoneRenderKey = '';
  heldKeyframes = new Set();
  resetSkillState();
  chatFeed.replaceChildren();
  chatMessages = [];
  chatFeed.insertAdjacentHTML('beforeend', '<div class="chat-placeholder"><strong>Console armed</strong>Press <span class="mono">Play</span> to stream the run log.</div>');
  applyRoomVisibility();
  renderMilestones(stages[0]?.id ?? 0);
  isAutoPlaying = true;
  updateVideoForDemoSeconds(0, { force: true });
  updatePlaybackControls();
  startAutoPlayLoop(0);
  [120, 600, 1600, 3200].forEach((delay) => {
    setTimeout(() => {
      if (!isVideoOnlyMode || isAutoPlaying || isMessagePending) return;
      isAutoPlaying = true;
      updatePlaybackControls();
      startAutoPlayLoop(getDemoSecondsForEventCount(playbackCursor));
    }, delay);
  });
}

function runAutoPlayFrame(now = performance.now()) {
  autoPlayFrame = null;
  autoPlayTimer = null;
  if (!isAutoPlaying || isKeyframeHolding) return;
  let demoSeconds = getCurrentAutoDemoSeconds(now);
  setAutoPlayClock(demoSeconds, now);
  updateVideoForDemoSeconds(demoSeconds, { noSeek: true });

  if (isVideoWaitingForDemoSeconds(demoSeconds)) {
    pauseTimelineForVideoWait(demoSeconds);
    return;
  }

  const keyframe = isVideoOnlyMode ? null : getNextPendingKeyframeBySeconds(demoSeconds);
  if (keyframe) {
    demoSeconds = keyframe.demoSeconds;
    setAutoPlayClock(demoSeconds, now);
  }
  if (isVideoWaitingForDemoSeconds(demoSeconds)) {
    pauseTimelineForVideoWait(demoSeconds);
    return;
  }

  renderPlaybackToDemoSeconds(demoSeconds, { noSeek: true });

  if (keyframe && playbackCursor >= (keyframe.targetCount || Infinity) && beginKeyframeHold(keyframe)) return;
  if (demoSeconds >= getPresentationTotalSeconds()) {
    if (isVideoOnlyMode) {
      restartVideoOnlyPlayback();
      return;
    }
    renderPlaybackToDemoSeconds(getPresentationTotalSeconds(), { noSeek: true });
    stopAutoPlay();
    return;
  }

  autoPlayTimer = setTimeout(() => runAutoPlayFrame(performance.now()), isLiveLogRevealLimited ? 360 : 80);
}

function startAutoPlayLoop(startSeconds = getDemoSecondsForEventCount(playbackCursor)) {
  cancelAnimationFrame(autoPlayFrame);
  clearTimeout(autoPlayTimer);
  autoPlayTimer = null;
  setAutoPlayClock(startSeconds);
  autoPlayTimer = setTimeout(() => runAutoPlayFrame(performance.now()), 0);
}

const MAX_MILESTONES = 10;
const MILESTONE_EVENT_LABELS = {
  0: 'Minecraft environment started',
  1: 'Input image became a blueprint',
  2: 'Blueprint split into five build regions',
  3: 'Region A build began',
  4: 'Region B build began',
  5: 'Region C build began',
  6: 'Region D build began',
  7: 'Region E build began',
  8: 'Build verified and cleaned up'
};

function formatMilestoneRange(metrics = []) {
  const start = metrics[0] || '';
  const end = metrics[1] || '';
  const detail = metrics[2] || '';
  const range = start && end ? `${start}-${end}` : (start || end);
  return [range, detail].filter(Boolean).join(' · ');
}

function buildMilestoneNodes() {
  const stageNodes = stages.map((stage) => {
    const stageId = Number(stage.id);
    return {
      id: `phase-${stage.id}`,
      startStage: stageId,
      endStage: stageId,
      code: `[${String(stage.id).padStart(2, '0')}]`,
      label: MILESTONE_EVENT_LABELS[stageId],
      role: formatMilestoneRange(stage.metrics || []),
      summary: stage.summary || stage.system || '',
      prefix: 'event'
    };
  });
  return [
    {
      id: 'run-started',
      startStage: stages[0]?.id ?? 0,
      endStage: stages[0]?.id ?? 0,
      code: '[RUN]',
      label: 'Project run started',
      role: 'ProjectManager · Designer · 5 Foremen · 100 Workers',
      summary: 'The run opens with the full build team online.',
      prefix: 'event'
    },
    ...stageNodes
  ].slice(0, MAX_MILESTONES);
}

function getMilestoneState(node, currentId, isComplete) {
  if (isComplete || currentId > Number(node.endStage)) return 'complete';
  if (currentId >= Number(node.startStage) && currentId <= Number(node.endStage)) return 'running';
  return 'pending';
}

function normalizeTopMilestone(node = {}) {
  const segmentStages = Array.isArray(node.segments)
    ? node.segments.map((segment) => Number(segment.stageId)).filter(Number.isFinite)
    : [];
  const stageStart = Number.isFinite(Number(node.stageStart))
    ? Number(node.stageStart)
    : (Number.isFinite(Number(node.stageId)) ? Number(node.stageId) : Math.min(...segmentStages));
  const stageEnd = Number.isFinite(Number(node.stageEnd))
    ? Number(node.stageEnd)
    : (Number.isFinite(Number(node.stageId)) ? Number(node.stageId) : Math.max(...segmentStages));
  return {
    ...node,
    stageStart,
    stageEnd
  };
}

function parseTopMilestoneSeconds(value) {
  if (Number.isFinite(Number(value))) return Math.max(0, Number(value));
  const parts = String(value || '').split(':').map(Number);
  if (parts.length === 1) return Number.isFinite(parts[0]) ? Math.max(0, parts[0]) : null;
  const seconds = parts.reduce((total, part) => (total * 60) + (Number.isFinite(part) ? part : 0), 0);
  return Number.isFinite(seconds) ? Math.max(0, seconds) : null;
}

function getExplicitTopMilestoneRange(node = {}) {
  const range = Array.isArray(node.timeRange) ? node.timeRange : null;
  const startValue = node.startSeconds ?? node.timeStart ?? node.start ?? range?.[0];
  const endValue = node.endSeconds ?? node.timeEnd ?? node.end ?? range?.[1];
  const start = parseTopMilestoneSeconds(startValue);
  const end = parseTopMilestoneSeconds(endValue);
  if (start === null || end === null) return null;
  return { start, end: Math.max(end, start + 0.001) };
}

function getTopMilestoneState(node, currentId, isComplete) {
  if (isComplete || currentId > Number(node.stageEnd)) return 'complete';
  if (currentId >= Number(node.stageStart) && currentId <= Number(node.stageEnd)) return 'running';
  return 'pending';
}

function getStageSecondsRange(stageStart, stageEnd = stageStart) {
  const startId = Number(stageStart);
  const endId = Number(stageEnd);
  if (!Number.isFinite(startId) || !Number.isFinite(endId) || !playbackEvents.length) {
    return { start: 0, end: getPresentationTotalSeconds() };
  }

  const startEvent = playbackEvents.find((event) => Number(event.stageId) >= startId);
  const endEvent = playbackEvents.find((event) => Number(event.stageId) > endId);
  const offset = activeDemoProfile.topMilestoneStartAtVideoStart && Number.isFinite(Number(playbackEvents[0]?.seconds))
    ? Number(playbackEvents[0].seconds)
    : 0;
  const start = Number.isFinite(Number(startEvent?.seconds)) ? Math.max(Number(startEvent.seconds) - offset, 0) : 0;
  const end = Number.isFinite(Number(endEvent?.seconds))
    ? Math.max(Number(endEvent.seconds) - offset, 0)
    : getPresentationTotalSeconds();
  return { start, end: Math.max(end, start + 0.001) };
}

function getTopMilestoneSecondsRange(node = {}) {
  return getExplicitTopMilestoneRange(node) || getStageSecondsRange(node.stageStart, node.stageEnd);
}

function getRangeProgress(seconds = 0, range = {}) {
  const start = Number(range.start) || 0;
  const end = Number(range.end) || start + 0.001;
  return clamp(((Number(seconds) || 0) - start) / Math.max(end - start, 0.001), 0, 1);
}

function formatTopMilestoneLabel(label = '') {
  return String(label || '').replace(/^\s*\d+\.\s*/, '');
}

function getTopMilestoneStateBySeconds(node, seconds, isComplete) {
  if (isComplete) return 'complete';
  const range = getTopMilestoneSecondsRange(node);
  if (node.noProgress && seconds >= range.start) return 'complete';
  if (seconds >= range.end) return 'complete';
  if (seconds >= range.start) return 'running';
  return 'pending';
}

function createTopMilestoneItem(node, state, currentSeconds, isComplete) {
  const item = document.createElement('article');
  const noProgress = Boolean(node.noProgress);
  item.className = `top-milestone-item is-${state}${noProgress ? ' is-no-progress' : ''}`;
  item.dataset.milestoneId = node.id || node.label || '';
  item.dataset.stageStart = String(node.stageStart);
  item.dataset.stageEnd = String(node.stageEnd);
  const itemRange = getTopMilestoneSecondsRange(node);
  item.dataset.rangeStart = String(itemRange.start);
  item.dataset.rangeEnd = String(itemRange.end);
  item.style.setProperty('--milestone-progress', noProgress || state !== 'complete' ? '0%' : '100%');
  item.style.setProperty('--milestone-ratio', noProgress || state !== 'complete' ? '0' : '1');

  const visibleSegments = Array.isArray(node.segments)
    ? node.segments.filter((segment) => {
      const range = getExplicitTopMilestoneRange(segment) || getStageSecondsRange(segment.stageId, segment.stageId);
      return isComplete || currentSeconds >= range.start;
    })
    : [];
  const segmentMarkup = visibleSegments.length ? `
    <div class="top-milestone-segments" aria-label="${escapeHtml(formatTopMilestoneLabel(node.label) || 'Region milestones')} regions">
      ${visibleSegments.map((segment) => {
        const segmentStage = Number(segment.stageId);
        const segmentNoProgress = Boolean(segment.noProgress);
        const segmentRange = getExplicitTopMilestoneRange(segment) || getStageSecondsRange(segmentStage, segmentStage);
        const segmentState = isComplete || currentSeconds >= segmentRange.end ? 'complete' : (currentSeconds >= segmentRange.start ? 'running' : 'pending');
        const segmentProgress = segmentNoProgress || segmentState !== 'complete' ? '0%' : '100%';
        const segmentRatio = segmentNoProgress || segmentState !== 'complete' ? '0' : '1';
        return `<span class="top-milestone-segment is-${segmentState}${segmentNoProgress ? ' is-no-progress' : ''}" data-stage-start="${segmentStage}" data-stage-end="${segmentStage}" data-range-start="${segmentRange.start}" data-range-end="${segmentRange.end}" style="--milestone-progress: ${segmentProgress}; --milestone-ratio: ${segmentRatio}">${escapeHtml(segment.label || '')}</span>`;
      }).join('')}
    </div>
  ` : '';

  item.innerHTML = `
    <span class="top-milestone-label">${escapeHtml(formatTopMilestoneLabel(node.label))}</span>
    ${segmentMarkup}
  `;
  return item;
}

function updateTopMilestoneProgress(seconds = getDemoSecondsForEventCount(playbackCursor)) {
  if (!topMilestoneStrip || !activeDemoProfile.topMilestoneMode) return;
  topMilestoneStrip
    .querySelectorAll('.top-milestone-item.is-running, .top-milestone-segment.is-running')
    .forEach((node) => {
      if (node.classList.contains('is-no-progress')) return;
      const explicitStart = parseTopMilestoneSeconds(node.dataset.rangeStart);
      const explicitEnd = parseTopMilestoneSeconds(node.dataset.rangeEnd);
      const range = explicitStart !== null && explicitEnd !== null
        ? { start: explicitStart, end: Math.max(explicitEnd, explicitStart + 0.001) }
        : getStageSecondsRange(node.dataset.stageStart, node.dataset.stageEnd);
      const progress = getRangeProgress(seconds, range);
      node.style.setProperty('--milestone-progress', `${Math.round(progress * 1000) / 10}%`);
      node.style.setProperty('--milestone-ratio', String(Math.round(progress * 1000) / 1000));
    });
}

function renderTopMilestones(currentStageId = stages[0]?.id ?? 0, currentSecondsOverride) {
  if (!topMilestoneStrip) return;
  const milestones = Array.isArray(activeDemoProfile.topMilestones)
    ? activeDemoProfile.topMilestones.map(normalizeTopMilestone)
    : [];
  const isEnabled = Boolean(activeDemoProfile.topMilestoneMode && milestones.length);
  if (!isEnabled) {
    if (topMilestoneRenderKey !== 'off') {
      topMilestoneStrip.replaceChildren();
      topMilestoneRenderKey = 'off';
    }
    return;
  }

  const total = playbackEvents.length;
  const currentSeconds = Number.isFinite(Number(currentSecondsOverride))
    ? Number(currentSecondsOverride)
    : getDemoSecondsForEventCount(playbackCursor);
  const finalMilestoneRange = milestones.length ? getTopMilestoneSecondsRange(milestones.at(-1)) : null;
  const isComplete = (total > 0 && playbackCursor >= total)
    || (finalMilestoneRange && currentSeconds >= finalMilestoneRange.start);
  const currentId = Number(currentStageId);
  const visibleMilestones = milestones.filter((node) => {
    const range = getTopMilestoneSecondsRange(node);
    return isComplete || currentSeconds >= range.start;
  });
  const renderKey = `${currentId}:${isComplete}:${visibleMilestones.map((node) => {
    const visibleSegments = Array.isArray(node.segments)
      ? node.segments
        .filter((segment) => {
          const range = getExplicitTopMilestoneRange(segment) || getStageSecondsRange(segment.stageId, segment.stageId);
          return isComplete || currentSeconds >= range.start;
        })
        .map((segment) => segment.label)
        .join(',')
      : '';
    return `${node.id || node.label}:${getTopMilestoneStateBySeconds(node, currentSeconds, isComplete)}:${visibleSegments}`;
  }).join('|')}`;
  if (renderKey === topMilestoneRenderKey) {
    updateTopMilestoneProgress(currentSeconds);
    return;
  }
  topMilestoneRenderKey = renderKey;

  topMilestoneStrip.replaceChildren(...visibleMilestones.map((node) => {
    const state = getTopMilestoneStateBySeconds(node, currentSeconds, isComplete);
    return createTopMilestoneItem(node, state, currentSeconds, isComplete);
  }));
  updateTopMilestoneProgress(currentSeconds);
  const focusedMilestone = topMilestoneStrip.querySelector('.top-milestone-item.is-running, .top-milestone-segment.is-running')
    || topMilestoneStrip.querySelector('.top-milestone-item:last-child');
  focusedMilestone?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
}

function createMilestoneItem(node, state, options = {}) {
  const item = document.createElement('li');
  const stateLabel = state === 'running' ? 'executing' : (state === 'complete' ? 'complete' : 'pending');
  item.className = `milestone-item is-${state}${options.worker ? ' is-worker' : ''}`;
  item.dataset.stage = String(node.startStage);
  item.dataset.milestoneId = node.id;
  const loadMarkup = options.load ? `<span class="milestone-load" style="--worker-load: ${options.load || 70}%" aria-hidden="true"></span>` : '';
  item.innerHTML = `
    <span class="milestone-body">
      <span class="milestone-branch" aria-hidden="true">${escapeHtml(node.prefix || 'sub')}</span>
      <span class="milestone-line">
        <strong data-code="${escapeHtml(node.code || '')}">${escapeHtml(node.label)}</strong>
        <span class="milestone-status-light" title="${escapeHtml(stateLabel)}" aria-label="${escapeHtml(stateLabel)}"></span>
      </span>
      <span class="milestone-role">${escapeHtml(node.role || '')}</span>
      ${loadMarkup}
      <span class="milestone-summary">${escapeHtml(node.summary || '')}</span>
    </span>
  `;
  return item;
}

function createMilestoneChildTree(parentNode, state) {
  if (!parentNode.children?.length) return null;
  const childTree = document.createElement('ol');
  childTree.className = 'milestone-children milestone-worker-tree';
  parentNode.children.forEach((child) => {
    childTree.append(createMilestoneItem(child, state, { worker: true }));
  });
  return childTree;
}

function renderMilestones(currentStageId = stages[0]?.id ?? 0) {
  renderTopMilestones(currentStageId);
  if (!milestoneList) return;
  const total = playbackEvents.length;
  const isComplete = total > 0 && playbackCursor >= total;
  const currentId = Number(currentStageId);
  const sourceNodes = buildMilestoneNodes();
  const visibleNodes = sourceNodes.filter((node) => isComplete || Number(node.startStage) <= currentId);
  const visibleCount = visibleNodes.length;
  const renderKey = `${currentId}:${isComplete}:${visibleCount}:${sourceNodes.length}`;
  if (renderKey === milestoneRenderKey && milestoneList.children.length) {
    return;
  }
  milestoneRenderKey = renderKey;
  milestoneList.replaceChildren();
  if (milestoneCount) milestoneCount.textContent = `${visibleCount}/${sourceNodes.length} events`;

  visibleNodes.forEach((node) => {
    const state = getMilestoneState(node, currentId, isComplete);
    milestoneList.append(createMilestoneItem(node, state));
  });

  const runningItem = milestoneList.querySelector('.milestone-item.is-running');
  runningItem?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function scheduleAutoPlay() {
  if (!isAutoPlaying || isKeyframeHolding) return;
  startAutoPlayLoop(currentDemoSeconds);
}

function updatePlaybackControls() {
  const total = playbackEvents.length;
  const shown = Math.min(playbackCursor, total);
  const timelineSeconds = Number.isFinite(Number(currentDemoSeconds))
    ? Number(currentDemoSeconds)
    : getDemoSecondsForEventCount(playbackCursor);
  const isComplete = total > 0 && timelineSeconds >= getPresentationTotalSeconds() - 0.08;

  renderMilestones(playbackEvents[Math.max(shown - 1, 0)]?.stageId ?? stages[0]?.id ?? 0);

  if (playbackPrev) playbackPrev.disabled = isMessagePending || isAutoPlaying || shown <= 0;
  if (playbackAuto) {
    playbackAuto.disabled = total === 0;
    const label = isKeyframeHolding ? 'Hold' : (isAutoPlaying ? 'Pause' : (isComplete ? 'Replay' : 'Play'));
    const icon = isKeyframeHolding ? 'hourglass' : (isAutoPlaying ? 'pause' : (isComplete ? 'rotate-ccw' : 'play'));
    setActionButtonLabel(playbackAuto, label, icon);
  }
  if (videoOnlyPlay) {
    videoOnlyPlay.disabled = total === 0;
    const label = isAutoPlaying ? 'Pause' : (isComplete ? 'Replay' : 'Play');
    const icon = isAutoPlaying ? 'pause' : (isComplete ? 'rotate-ccw' : 'play');
    setActionButtonLabel(videoOnlyPlay, label, icon);
  }
  if (playbackSpeedToggle) {
    playbackSpeedToggle.textContent = formatPlaybackSpeed();
    playbackSpeedToggle.setAttribute('aria-label', `Playback speed: ${formatPlaybackSpeed()}. Click to reset to 1x.`);
    playbackSpeedToggle.setAttribute('aria-pressed', String(playbackSpeed !== 1));
    playbackSpeedToggle.classList.toggle('is-fast', playbackSpeed > 1);
    playbackSpeedToggle.classList.toggle('is-slow', playbackSpeed < 1);
  }
  if (videoOnlySpeed) {
    videoOnlySpeed.textContent = formatPlaybackSpeed();
    videoOnlySpeed.setAttribute('aria-label', `Playback speed: ${formatPlaybackSpeed()}. Click to reset to 1x.`);
    videoOnlySpeed.setAttribute('aria-pressed', String(playbackSpeed !== 1));
    videoOnlySpeed.classList.toggle('is-fast', playbackSpeed > 1);
    videoOnlySpeed.classList.toggle('is-slow', playbackSpeed < 1);
  }
  if (playbackSlower) {
    playbackSlower.disabled = playbackSpeed <= PLAYBACK_SPEED_STEPS[0];
    playbackSlower.setAttribute('aria-label', `Slow down playback from ${formatPlaybackSpeed()}`);
  }
  if (videoOnlySlower) {
    videoOnlySlower.disabled = playbackSpeed <= PLAYBACK_SPEED_STEPS[0];
    videoOnlySlower.setAttribute('aria-label', `Slow down playback from ${formatPlaybackSpeed()}`);
  }
  if (playbackFaster) {
    playbackFaster.disabled = playbackSpeed >= PLAYBACK_SPEED_STEPS.at(-1);
    playbackFaster.setAttribute('aria-label', `Speed up playback from ${formatPlaybackSpeed()}`);
  }
  if (videoOnlyFaster) {
    videoOnlyFaster.disabled = playbackSpeed >= PLAYBACK_SPEED_STEPS.at(-1);
    videoOnlyFaster.setAttribute('aria-label', `Speed up playback from ${formatPlaybackSpeed()}`);
  }
  if (playbackStep) {
    playbackStep.max = String(total);
    playbackStep.disabled = isMessagePending || isAutoPlaying || total === 0;
    if (document.activeElement !== playbackStep) playbackStep.value = String(shown);
  }
  if (playbackJump) playbackJump.disabled = isMessagePending || isAutoPlaying || total === 0;
  if (playbackCounter) playbackCounter.textContent = `Event ${shown}/${total}`;

  if (!playbackNext) return;

  playbackNext.disabled = isMessagePending || isAutoPlaying || shown >= total || total === 0;
  if (isMessagePending) {
    playbackNext.textContent = 'Revealing...';
  } else if (shown >= total && total > 0) {
    playbackNext.textContent = 'Complete';
  } else if (shown === 0) {
    playbackNext.textContent = 'Start Run';
  } else {
    playbackNext.textContent = 'Next Event';
  }
}

function advancePlayback(options = {}) {
  if (!options.fromAuto) stopAutoPlay(false);
  if (isMessagePending || playbackCursor >= playbackEvents.length) return;
  chatFeed.querySelector('.chat-placeholder')?.remove();
  isMessagePending = true;
  updatePlaybackControls();
  revealChatMessage(playbackCursor);
}

function findStructuredLogGroupNode(event) {
  const groupKey = getStructuredLogGroupKey(event);
  if (!groupKey) return null;
  return [...chatFeed.querySelectorAll('.event-row.is-structured[data-log-group-key]')]
    .find((article) => article.dataset.logGroupKey === groupKey) || null;
}

function revealChatMessage(index = 0) {
  const event = playbackEvents[index];
  if (!event) {
    isMessagePending = false;
    updatePlaybackControls();
    return;
  }

  const progressKey = getProgressRowKey(event);
  const shouldStickToBottom = shouldFollowLog || isLogNearBottom();
  let article = progressKey ? progressRows.get(progressKey) : null;
  appendStageDividerIfNeeded(event);
  const existingLogGroupNode = !article && !progressKey
    ? (canAppendToStructuredLogGroup(activeLogGroupNode, event) ? activeLogGroupNode : findStructuredLogGroupNode(event))
    : null;
  if (article) {
    populateChatMessage(article, event, index, { entering: false });
    if (shouldStickToBottom) chatFeed.append(article);
    article.classList.add('active');
  } else if (existingLogGroupNode) {
    article = appendStructuredEventToChatMessage(existingLogGroupNode, event, index, { animate: true });
    if (shouldStickToBottom) chatFeed.append(article);
    article.classList.add('active');
  } else {
    article = createChatMessage(event, index);
    chatFeed.append(article);
    if (progressKey) progressRows.set(progressKey, article);
  }
  activeLogGroupNode = progressKey ? null : article;

  if (event.skill) updateSkillStateFromEvent(event, index);
  chatMessages = [...document.querySelectorAll('.event-row[data-chat-stage]')];
  applyRoomVisibility();
  setStage(event.stageId, article, event);
  shouldFollowLog = shouldStickToBottom;
  scrollChatToBottom(index);
  playbackCursor = index + 1;
  if (!isAutoPlaying) {
    const elapsedSeconds = getDemoSecondsForEventCount(playbackCursor);
    setTimelineReadout(elapsedSeconds);
    updateVideoForDemoSeconds(elapsedSeconds, { force: true });
  }
  isMessagePending = false;
  updatePlaybackControls();
  if (!isVideoOnlyMode && isAutoPlaying && beginKeyframeHold(getNextPendingKeyframe())) return;
  scheduleAutoPlay();
}

function renderChat(events) {
  stopAutoPlay(false);
  clearTimeout(logRevealTimer);
  clearTimeout(autoScrollRelease);
  clearTimeout(autoPlayTimer);
  clearTimeout(frameworkCollapseTimer);
  autoPlayTimer = null;
  frameworkCollapseTimer = null;
  logRevealTimer = null;
  isAutoScrolling = false;
  isUserScrollingLog = false;
  clearTimeout(logUserScrollTimer);
  shouldFollowLog = true;
  playbackCursor = 0;
  isMessagePending = false;
  heldKeyframes = new Set();
  isKeyframeHolding = false;
  renderedStageIds = new Set();
  progressRows = new Map();
  activeLogGroupNode = null;
  milestoneRenderKey = '';
  topMilestoneRenderKey = '';
  resetSkillState();
  skillLibrary?.classList.add('is-visible');
  setFrameworkExpanded(false);
  updateVideoForDemoSeconds(0, { force: true });
  chatFeed.replaceChildren();
  chatMessages = [];

  if (!events?.length) {
    chatFeed.insertAdjacentHTML('beforeend', '<div class="log-error">No run events found in <code>data/demo-log/manifest.json</code>.</div>');
    applyRoomVisibility();
    updatePlaybackControls();
    return;
  }

  chatFeed.insertAdjacentHTML('beforeend', '<div class="chat-placeholder"><strong>Console armed</strong>Run log will stream automatically; press <span class="mono">Pause</span> to hold the feed.</div>');
  applyRoomVisibility();
  updatePlaybackControls();
}

function appendEventInstantly(event, index, options = {}) {
  const progressKey = getProgressRowKey(event);
  let node = progressKey ? progressRows.get(progressKey) : null;
  appendStageDividerIfNeeded(event);
  const existingLogGroupNode = !node && !progressKey
    ? (canAppendToStructuredLogGroup(activeLogGroupNode, event) ? activeLogGroupNode : findStructuredLogGroupNode(event))
    : null;
  if (node) {
    populateChatMessage(node, event, index, { entering: false });
    chatFeed.append(node);
  } else if (existingLogGroupNode) {
    node = appendStructuredEventToChatMessage(existingLogGroupNode, event, index, { animate: options.animateEntry === true });
    chatFeed.append(node);
  } else {
    node = createChatMessage(event, index);
    node.classList.remove('is-entering');
    chatFeed.append(node);
    if (progressKey) progressRows.set(progressKey, node);
  }
  activeLogGroupNode = progressKey ? null : node;
  if (event.skill) updateSkillStateFromEvent(event, index);
  node.classList.remove('is-entering');
  return { node, stageId: event.stageId, event };
}

function renderPlaybackUntil(targetCount) {
  stopAutoPlay(false);
  clearTimeout(logRevealTimer);
  clearTimeout(autoScrollRelease);
  logRevealTimer = null;
  isAutoScrolling = false;
  isUserScrollingLog = false;
  clearTimeout(logUserScrollTimer);
  shouldFollowLog = true;
  isMessagePending = false;
  renderedStageIds = new Set();
  progressRows = new Map();
  activeLogGroupNode = null;
  milestoneRenderKey = '';
  topMilestoneRenderKey = '';
  resetSkillState();
  skillLibrary?.classList.add('is-visible');

  const total = playbackEvents.length;
  const count = Math.min(Math.max(Number(targetCount) || 0, 0), total);
  if (count === 0) heldKeyframes = new Set();
  chatFeed.replaceChildren();
  chatMessages = [];

  let last = null;
  for (let index = 0; index < count; index += 1) {
    last = appendEventInstantly(playbackEvents[index], index) || last;
  }

  chatMessages = [...document.querySelectorAll('.event-row[data-chat-stage]')];
  playbackCursor = count;

  if (last) {
    applyRoomVisibility();
    setStage(last.stageId, last.node, last.event);
    scrollChatToBottom(count, { force: true, instant: true });
  } else {
    chatFeed.insertAdjacentHTML('beforeend', '<div class="chat-placeholder"><strong>Console armed</strong>Press <span class="mono">Play</span> to stream the run log.</div>');
    applyRoomVisibility();
    setStage(stages[0]?.id ?? 0, chatMessages[0]);
  }

  const elapsedSeconds = getDemoSecondsForEventCount(count);
  setTimelineReadout(elapsedSeconds);
  updateVideoForDemoSeconds(elapsedSeconds, { force: true });
  updatePlaybackControls();
}

function jumpPlaybackBy(delta) {
  if (isMessagePending || isAutoPlaying) return;
  renderPlaybackUntil(playbackCursor + delta);
}

function jumpPlaybackToInput() {
  if (isMessagePending || isAutoPlaying) return;
  const target = Number.parseInt(playbackStep?.value || '0', 10);
  renderPlaybackUntil(Number.isFinite(target) ? target : playbackCursor);
}

function toggleAutoPlay() {
  if (isAutoPlaying) {
    stopAutoPlay();
    return;
  }
  if (!playbackEvents.length) return;
  const shouldReplay = currentDemoSeconds >= getPresentationTotalSeconds() - 0.08;
  if (shouldReplay) renderPlaybackUntil(0);
  isAutoPlaying = true;
  updatePlaybackControls();
  startAutoPlayLoop(shouldReplay ? 0 : currentDemoSeconds);
}

function setPlaybackSpeed(nextSpeed) {
  const currentSeconds = getCurrentAutoDemoSeconds();
  const closest = PLAYBACK_SPEED_STEPS.reduce((best, speed) => (
    Math.abs(speed - nextSpeed) < Math.abs(best - nextSpeed) ? speed : best
  ), PLAYBACK_SPEED_STEPS[0]);
  playbackSpeed = closest;
  if (worldVideo) worldVideo.playbackRate = playbackSpeed;
  updatePlaybackControls();
  if (isAutoPlaying && !isKeyframeHolding) startAutoPlayLoop(currentSeconds);
}

function stepPlaybackSpeed(direction = 1) {
  const currentIndex = Math.max(0, PLAYBACK_SPEED_STEPS.indexOf(playbackSpeed));
  const nextIndex = clamp(currentIndex + Math.sign(direction), 0, PLAYBACK_SPEED_STEPS.length - 1);
  setPlaybackSpeed(PLAYBACK_SPEED_STEPS[nextIndex]);
}

function resetPlaybackSpeed() {
  setPlaybackSpeed(1);
}

function formatTimelineTime(seconds = 0) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds - (minutes * 60);
  return `${String(minutes).padStart(2, '0')}:${remaining.toFixed(1).padStart(4, '0')}`;
}

function getPresentationTotalSeconds() {
  return Math.max(introArchitectureSeconds + demoVideoSeconds, timelineKeyframes.at(-1)?.demoSeconds || 1, 1);
}

function findEventCountForKeyframe(keyframe, previousCount = 0) {
  if (!playbackEvents.length) return 0;
  const minCount = Math.max(0, Number(previousCount) || 0);
  let index = -1;
  if (keyframe.skill) {
    index = playbackEvents.findIndex((event, eventIndex) => eventIndex + 1 > minCount && event.skill === keyframe.skill);
  } else if (Number.isFinite(Number(keyframe.stageId))) {
    for (let eventIndex = playbackEvents.length - 1; eventIndex >= 0; eventIndex -= 1) {
      if (Number(playbackEvents[eventIndex].stageId) === Number(keyframe.stageId)) {
        index = eventIndex;
        break;
      }
    }
  }
  return clamp((index < 0 ? playbackEvents.length : index + 1), minCount, playbackEvents.length);
}

function rebuildTimelineAnchors() {
  let previousCount = 0;
  const anchors = [{ count: 0, seconds: 0, id: 'start' }];
  timelineKeyframes.forEach((keyframe) => {
    const count = findEventCountForKeyframe(keyframe, previousCount);
    keyframe.targetCount = count;
    anchors.push({ count, seconds: keyframe.demoSeconds, id: keyframe.id });
    previousCount = count;
  });
  anchors.push({ count: playbackEvents.length, seconds: getPresentationTotalSeconds(), id: 'complete' });
  timelineAnchors = anchors
    .sort((a, b) => a.seconds - b.seconds || a.count - b.count)
    .filter((anchor, index, list) => index === 0 || anchor.seconds > list[index - 1].seconds || anchor.count > list[index - 1].count);
  renderTimelineMarkers();
}

function getTimelineAnchorPairByCount(count = 0) {
  const safeCount = clamp(Number(count) || 0, 0, playbackEvents.length);
  const anchors = timelineAnchors.length ? timelineAnchors : [{ count: 0, seconds: 0 }, { count: playbackEvents.length, seconds: getPresentationTotalSeconds() }];
  for (let index = 1; index < anchors.length; index += 1) {
    if (safeCount <= anchors[index].count) return [anchors[index - 1], anchors[index]];
  }
  return [anchors[Math.max(0, anchors.length - 2)], anchors[anchors.length - 1]];
}

function getTimelineAnchorPairBySeconds(seconds = 0) {
  const safeSeconds = clamp(Number(seconds) || 0, 0, getPresentationTotalSeconds());
  const anchors = timelineAnchors.length ? timelineAnchors : [{ count: 0, seconds: 0 }, { count: playbackEvents.length, seconds: getPresentationTotalSeconds() }];
  for (let index = 1; index < anchors.length; index += 1) {
    if (safeSeconds <= anchors[index].seconds) return [anchors[index - 1], anchors[index]];
  }
  return [anchors[Math.max(0, anchors.length - 2)], anchors[anchors.length - 1]];
}

function shouldAlignTimelineToLogTime() {
  return Boolean(activeDemoProfile.alignTimelineToLogTime);
}

function getEventSecondsAtCount(count = playbackCursor) {
  if (!playbackEvents.length) return 0;
  const safeCount = clamp(Math.round(Number(count) || 0), 0, playbackEvents.length);
  if (safeCount <= 0) return 0;
  if (safeCount >= playbackEvents.length) return getPresentationTotalSeconds();
  const eventSeconds = Number(playbackEvents[safeCount - 1]?.seconds);
  return clamp(Number.isFinite(eventSeconds) ? eventSeconds : 0, 0, getPresentationTotalSeconds());
}

function syncHeldKeyframesForSeconds(seconds = 0) {
  const safeSeconds = Number(seconds) || 0;
  heldKeyframes = new Set(
    timelineKeyframes
      .filter((keyframe) => Number(keyframe.demoSeconds) <= safeSeconds + 0.015)
      .map((keyframe) => keyframe.id)
  );
}

function getDemoSecondsForEventCount(count = playbackCursor) {
  if (shouldAlignTimelineToLogTime()) return getEventSecondsAtCount(count);
  const [start, end] = getTimelineAnchorPairByCount(count);
  const span = Math.max(1, end.count - start.count);
  const ratio = clamp(((Number(count) || 0) - start.count) / span, 0, 1);
  return start.seconds + ((end.seconds - start.seconds) * ratio);
}

function getEventCountForDemoSeconds(seconds = 0) {
  if (shouldAlignTimelineToLogTime()) {
    const safeSeconds = clamp(Number(seconds) || 0, 0, getPresentationTotalSeconds());
    let count = 0;
    while (
      count < playbackEvents.length
      && Number(playbackEvents[count]?.seconds) <= safeSeconds + 0.015
    ) {
      count += 1;
    }
    return count;
  }
  const [start, end] = getTimelineAnchorPairBySeconds(seconds);
  const span = Math.max(0.001, end.seconds - start.seconds);
  const ratio = clamp(((Number(seconds) || 0) - start.seconds) / span, 0, 1);
  return Math.round(start.count + ((end.count - start.count) * ratio));
}

function getPlaybackTotalSeconds() {
  return getPresentationTotalSeconds();
}

function getEventCountForTimelineRatio(ratio = 0) {
  if (!playbackEvents.length) return 0;
  const targetSeconds = clamp(ratio, 0, 1) * getPresentationTotalSeconds();
  return getEventCountForDemoSeconds(targetSeconds);
}

function updateVideoForDemoSeconds(seconds = 0, options = {}) {
  if (!worldVideo) return;
  if (worldVideo.playbackRate !== playbackSpeed) worldVideo.playbackRate = playbackSpeed;
  const safeSeconds = clamp(Number(seconds) || 0, 0, getPresentationTotalSeconds());
  const isIntro = safeSeconds < introArchitectureSeconds;
  timelineIntro?.classList.toggle('is-visible', isIntro);
  const targetVideoTime = clamp(safeSeconds - introArchitectureSeconds, 0, Math.max(demoVideoSeconds, 0));
  const duration = Number.isFinite(worldVideo.duration) && worldVideo.duration > 0 ? worldVideo.duration : demoVideoSeconds;
  const clampedVideoTime = clamp(targetVideoTime, 0, duration);
  const isVideoTargetComplete = !isIntro && duration > 0 && clampedVideoTime >= duration - 0.08;
  const shouldSeek = !options.noSeek && (options.force || !isAutoPlaying || isKeyframeHolding || isIntro);
  try {
    if (options.force && !options.noSeek && !isAutoPlaying && clampedVideoTime <= 0.05) {
      worldVideo.pause();
      if (Math.abs((worldVideo.currentTime || 0) - clampedVideoTime) > 0.08) {
        worldVideo.currentTime = clampedVideoTime;
      }
      return;
    }
    if (shouldSeek && Math.abs((worldVideo.currentTime || 0) - clampedVideoTime) > 0.08) {
      try {
        worldVideo.currentTime = clampedVideoTime;
      } catch (seekError) {
        worldVideo.fastSeek?.(clampedVideoTime);
      }
    }
  } catch (error) {
    // Some browsers can briefly reject seeking while metadata is loading.
  }
  if (isIntro || !isAutoPlaying || isKeyframeHolding || isVideoTargetComplete) {
    if (!worldVideo.paused) worldVideo.pause();
  } else if (worldVideo.paused && !worldVideo.ended) {
    worldVideo.play?.().catch(() => {});
  }
}

function syncTimelineFromVideoPlayback() {
  if (!worldVideo || !isAutoPlaying || isKeyframeHolding || isScrubbingTimeline || !isTimelineWaitingForVideo) return;
  if (performance.now() < videoSyncBlockedUntil) return;
  videoSyncBlockedUntil = 0;
  const demoSeconds = getVideoDemoSeconds();
  if (demoSeconds === null || isVideoWaitingForDemoSeconds(demoSeconds)) return;

  clearVideoWaitState();
  renderPlaybackToDemoSeconds(demoSeconds, { syncVideo: false });
  startAutoPlayLoop(demoSeconds);
}

function keepVideoSurfacePassive(event) {
  event.preventDefault();
  event.stopPropagation();
  if (isAutoPlaying && worldVideo?.paused && !worldVideo.ended && !isKeyframeHolding) {
    worldVideo.play?.().catch(() => {});
  }
}

function updateVideoForTimelineRatio(ratio = 0, options = {}) {
  updateVideoForDemoSeconds(clamp(ratio, 0, 1) * getPresentationTotalSeconds(), options);
}

function pauseVideoAtCurrentFrame() {
  if (!worldVideo) return;
  frozenVideoTime = Number.isFinite(worldVideo.currentTime) ? worldVideo.currentTime : 0;
  if (!worldVideo.paused) worldVideo.pause();
}

function resumeVideoFromCurrentFrame() {
  if (!worldVideo) return;
  const demoSeconds = currentDemoSeconds;
  timelineIntro?.classList.toggle('is-visible', demoSeconds < introArchitectureSeconds);
  if (demoSeconds >= introArchitectureSeconds) {
    const playFromFrozenFrame = () => worldVideo.play?.().catch(() => {});
    playFromFrozenFrame();
    setTimeout(() => {
      if (isAutoPlaying && !isKeyframeHolding && worldVideo.paused) playFromFrozenFrame();
    }, 120);
  }
}

function syncTimelineOverlayOnly(seconds = 0) {
  timelineIntro?.classList.toggle('is-visible', Number(seconds) < introArchitectureSeconds);
}

function previewTimelineRatio(ratio = 0) {
  const safeRatio = clamp(ratio, 0, 1);
  const elapsedSeconds = safeRatio * getPresentationTotalSeconds();
  setTimelineReadout(elapsedSeconds);
  updateVideoForDemoSeconds(elapsedSeconds, { force: true });
  updatePlaybackControls();
}

function renderTimelineMarkers() {
  if (!timelineMarkers) return;
  const total = getPresentationTotalSeconds();
  timelineMarkers.replaceChildren(...timelineKeyframes.map((keyframe) => {
    const marker = document.createElement('button');
    marker.className = 'timeline-marker';
    marker.type = 'button';
    marker.dataset.keyframeId = keyframe.id;
    marker.dataset.targetCount = String(keyframe.targetCount || 0);
    marker.style.setProperty('--marker-left', `${clamp((keyframe.demoSeconds / total) * 100, 0, 100)}%`);
    marker.setAttribute('aria-label', keyframe.label);
    marker.title = `${keyframe.label} · ${formatTimelineTime(keyframe.demoSeconds)}`;
    marker.addEventListener('click', (event) => {
      event.stopPropagation();
      if (suppressNextTimelineClick) {
        event.preventDefault();
        suppressNextTimelineClick = false;
        return;
      }
      if (isVideoOnlyMode) {
        seekTimelineToKeyframe(keyframe, { expandFramework: false });
        return;
      }
      holdTimelineAtKeyframe(keyframe, { resumeAfterHold: isAutoPlaying });
    });
    return marker;
  }));
  updateTimelineMarkerState(getDemoSecondsForEventCount(playbackCursor));
}

function updateTimelineMarkerState(seconds = 0) {
  if (!timelineMarkers) return;
  const active = [...timelineKeyframes]
    .filter((keyframe) => Number(keyframe.demoSeconds) <= Number(seconds) + 0.35)
    .at(-1);
  timelineMarkers.querySelectorAll('.timeline-marker').forEach((marker) => {
    marker.classList.toggle('is-active', marker.dataset.keyframeId === active?.id);
  });
}

function seekTimelineToKeyframe(keyframe, options = {}) {
  if (!keyframe) return;
  const count = clamp(keyframe.targetCount || getEventCountForDemoSeconds(keyframe.demoSeconds), 0, playbackEvents.length);
  syncHeldKeyframesForSeconds(keyframe.demoSeconds);
  renderPlaybackUntil(count);
  previewTimelineRatio(keyframe.demoSeconds / getPresentationTotalSeconds());
  updateVideoForDemoSeconds(keyframe.demoSeconds, { force: true });
  if (options.expandFramework) {
    setFrameworkExpanded(true);
    collapseFrameworkAfterHold();
  }
}

function holdTimelineAtKeyframe(keyframe, options = {}) {
  if (!keyframe) return false;
  if (isVideoOnlyMode) {
    seekTimelineToKeyframe(keyframe, { expandFramework: false });
    return false;
  }

  clearTimeout(keyframeHoldTimer);
  clearTimeout(frameworkCollapseTimer);
  keyframeHoldTimer = null;
  frameworkCollapseTimer = null;

  seekTimelineToKeyframe(keyframe, { expandFramework: false });
  isKeyframeHolding = false;
  setFrameworkExpanded(true);
  timelineIntro?.classList.toggle('is-visible', keyframe.demoSeconds < introArchitectureSeconds);
  updatePlaybackControls();

  frameworkCollapseTimer = setTimeout(() => {
    frameworkCollapseTimer = null;
    setFrameworkExpanded(false);
    updatePlaybackControls();
  }, KEYFRAME_HOLD_MS);

  return false;
}

function getNextPendingKeyframe() {
  return timelineKeyframes.find((keyframe) => !heldKeyframes.has(keyframe.id) && playbackCursor >= (keyframe.targetCount || Infinity));
}

function beginKeyframeHold(keyframe) {
  if (isVideoOnlyMode) return false;
  if (!keyframe || heldKeyframes.has(keyframe.id)) return false;
  heldKeyframes.add(keyframe.id);
  isKeyframeHolding = false;
  setFrameworkExpanded(true);
  timelineIntro?.classList.toggle('is-visible', keyframe.demoSeconds < introArchitectureSeconds);
  updatePlaybackControls();
  clearTimeout(keyframeHoldTimer);
  clearTimeout(frameworkCollapseTimer);
  keyframeHoldTimer = null;
  frameworkCollapseTimer = null;
  frameworkCollapseTimer = setTimeout(() => {
    frameworkCollapseTimer = null;
    setFrameworkExpanded(false);
    updatePlaybackControls();
  }, KEYFRAME_HOLD_MS);
  return false;
}

function setVideoOnlyMode(isEnabled) {
  isVideoOnlyMode = Boolean(isEnabled);
  appShell?.classList.toggle('is-video-only', isVideoOnlyMode);
  videoOnlyToggle?.setAttribute('aria-pressed', String(isVideoOnlyMode));
  videoOnlyToggle?.setAttribute('aria-label', isVideoOnlyMode ? 'Show full demo console' : 'Show video only');
  setLucideButtonIcon(videoOnlyToggle, isVideoOnlyMode ? 'panel-right-open' : 'panel-right-close');

  if (isVideoOnlyMode) {
    clearTimeout(keyframeHoldTimer);
    clearTimeout(frameworkCollapseTimer);
    keyframeHoldTimer = null;
    frameworkCollapseTimer = null;
    isKeyframeHolding = false;
    setFrameworkExpanded(false);
    closeFrameworkLightbox();
    syncHeldKeyframesForSeconds(getDemoSecondsForEventCount(playbackCursor));
    if (isAutoPlaying) startAutoPlayLoop(getDemoSecondsForEventCount(playbackCursor));
  }

  updatePlaybackControls();
}

function getTimelineRatioFromPointer(event) {
  const rect = buildTimelineRail?.getBoundingClientRect();
  if (!rect?.width) return 0;
  return clamp((event.clientX - rect.left) / rect.width, 0, 1);
}

function isPassiveTimelineTarget(event) {
  return Boolean(event?.target?.closest?.('.build-timeline-head, .timeline-control-slot'));
}

function seekTimelineToRatio(ratio = 0, options = {}) {
  const safeRatio = clamp(ratio, 0, 1);
  const seconds = safeRatio * getPresentationTotalSeconds();
  const count = getEventCountForTimelineRatio(safeRatio);
  const shouldResume = options.resume === true && seconds < getPresentationTotalSeconds() - 0.08;
  syncHeldKeyframesForSeconds(seconds);
  renderPlaybackUntil(count);
  previewTimelineRatio(safeRatio);
  if (!shouldResume) return;
  isAutoPlaying = true;
  isKeyframeHolding = false;
  blockVideoTimelineSync();
  updateVideoForDemoSeconds(seconds, { force: true });
  updatePlaybackControls();
  startAutoPlayLoop(seconds);
}

function getTimelineRatioFromScrubber() {
  return clamp((Number(timelineScrubber?.value) || 0) / 1000, 0, 1);
}

function setTimelineScrubberValueFromPointer(event) {
  const rect = timelineScrubber?.getBoundingClientRect();
  if (!rect?.width || !Number.isFinite(Number(event?.clientX))) return getTimelineRatioFromScrubber();
  const ratio = clamp((Number(event.clientX) - rect.left) / rect.width, 0, 1);
  timelineScrubber.value = String(Math.round(ratio * 1000));
  return ratio;
}

function beginTimelineScrubberInput(event) {
  if (!timelineScrubber || isScrubbingTimeline || !playbackEvents.length) return;
  shouldResumeAfterTimelineSeek = isAutoPlaying;
  stopAutoPlay(!shouldResumeAfterTimelineSeek);
  isScrubbingTimeline = true;
  isTimelineScrubberActive = true;
  shouldFollowLog = true;
  buildTimeline?.classList.add('is-scrubbing');
  setTimelineScrubberValueFromPointer(event);
  seekTimelineToRatio(getTimelineRatioFromScrubber(), { keepPaused: true, resume: false });
}

function moveTimelineScrubberInput(event) {
  if (!timelineScrubber || !playbackEvents.length) return;
  if (!isTimelineScrubberActive && event?.type !== 'input') return;
  if (!isTimelineScrubberActive) beginTimelineScrubberInput(event);
  setTimelineScrubberValueFromPointer(event);
  seekTimelineToRatio(getTimelineRatioFromScrubber(), { keepPaused: true, resume: false });
}

function endTimelineScrubberInput(event) {
  if (!timelineScrubber || !isTimelineScrubberActive) return;
  setTimelineScrubberValueFromPointer(event);
  const shouldResume = shouldResumeAfterTimelineSeek;
  shouldResumeAfterTimelineSeek = false;
  isScrubbingTimeline = false;
  isTimelineScrubberActive = false;
  buildTimeline?.classList.remove('is-scrubbing');
  seekTimelineToRatio(getTimelineRatioFromScrubber(), { keepPaused: true, resume: shouldResume });
}

function queueTimelineSeek(event, commit = false, options = {}) {
  const ratio = getTimelineRatioFromPointer(event);
  previewTimelineRatio(ratio);
  if (!commit) {
    cancelAnimationFrame(scrubFrame);
    scrubFrame = null;
    return;
  }
  cancelAnimationFrame(scrubFrame);
  scrubFrame = null;
  seekTimelineToRatio(ratio, { keepPaused: true, resume: options.resume === true });
}

function startTimelineScrub(event) {
  if (!buildTimelineRail || !playbackEvents.length) return;
  if (isPassiveTimelineTarget(event)) return;
  event.preventDefault();
  shouldResumeAfterTimelineSeek = isAutoPlaying;
  stopAutoPlay(!shouldResumeAfterTimelineSeek);
  isScrubbingTimeline = true;
  timelineScrubStartX = Number(event.clientX) || 0;
  timelineScrubStartY = Number(event.clientY) || 0;
  timelineDidDrag = false;
  shouldFollowLog = true;
  buildTimeline?.classList.add('is-scrubbing');
  buildTimeline?.setPointerCapture?.(event.pointerId);
  queueTimelineSeek(event);
}

function moveTimelineScrub(event) {
  if (isTimelineScrubberActive) return;
  if (!isScrubbingTimeline) return;
  event.preventDefault();
  const deltaX = (Number(event.clientX) || 0) - timelineScrubStartX;
  const deltaY = (Number(event.clientY) || 0) - timelineScrubStartY;
  if (Math.hypot(deltaX, deltaY) > 4) timelineDidDrag = true;
  queueTimelineSeek(event);
}

function endTimelineScrub(event) {
  if (isTimelineScrubberActive) return;
  if (!isScrubbingTimeline) return;
  event.preventDefault();
  isScrubbingTimeline = false;
  buildTimeline?.classList.remove('is-scrubbing');
  buildTimeline?.releasePointerCapture?.(event.pointerId);
  queueTimelineSeek(event, true, { resume: shouldResumeAfterTimelineSeek });
  shouldResumeAfterTimelineSeek = false;
  if (timelineDidDrag) {
    suppressNextTimelineClick = true;
    setTimeout(() => { suppressNextTimelineClick = false; }, 0);
  }
}

function handleTimelineKeydown(event) {
  if (!playbackEvents.length) return;
  const total = getPresentationTotalSeconds();
  const currentRatio = clamp(currentDemoSeconds / total, 0, 1);
  const smallStep = 8 / Math.max(total, 1);
  const largeStep = 40 / Math.max(total, 1);
  let nextRatio = currentRatio;
  if (event.key === 'ArrowLeft') nextRatio -= smallStep;
  else if (event.key === 'ArrowRight') nextRatio += smallStep;
  else if (event.key === 'PageUp') nextRatio += largeStep;
  else if (event.key === 'PageDown') nextRatio -= largeStep;
  else if (event.key === 'Home') nextRatio = 0;
  else if (event.key === 'End') nextRatio = 1;
  else return;
  event.preventDefault();
  const shouldResume = isAutoPlaying;
  stopAutoPlay();
  shouldFollowLog = true;
  seekTimelineToRatio(clamp(nextRatio, 0, 1), { keepPaused: true, resume: shouldResume });
}

function handleTimelineClick(event) {
  if (suppressNextTimelineClick) {
    event.preventDefault();
    suppressNextTimelineClick = false;
    return;
  }
  if (!playbackEvents.length || isScrubbingTimeline) return;
  if (isPassiveTimelineTarget(event)) return;
  event.preventDefault();
  const shouldResume = isAutoPlaying;
  stopAutoPlay();
  shouldFollowLog = true;
  seekTimelineToRatio(getTimelineRatioFromPointer(event), { keepPaused: true, resume: shouldResume });
}
