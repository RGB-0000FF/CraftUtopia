// CraftUtopia demo playback.
function stopAutoPlay(update = true) {
  const wasHolding = isKeyframeHolding;
  clearTimeout(autoPlayTimer);
  cancelAnimationFrame(autoPlayFrame);
  clearTimeout(keyframeHoldTimer);
  autoPlayTimer = null;
  autoPlayFrame = null;
  keyframeHoldTimer = null;
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

function getCurrentAutoDemoSeconds(now = performance.now()) {
  if (!isAutoPlaying) return getDemoSecondsForEventCount(playbackCursor);
  const elapsed = Math.max((now - autoPlayClockStartedAt) / 1000, 0) * playbackSpeed;
  return clamp(autoPlayClockStartSeconds + elapsed, 0, getPresentationTotalSeconds());
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
  const total = getPresentationTotalSeconds();
  const ratio = total > 0 ? clamp(safeSeconds / total, 0, 1) : 0;
  const progressValue = `${Math.round(ratio * 100)}%`;
  const elapsedTime = formatTimelineTime(safeSeconds);
  if (consoleProgressValue) consoleProgressValue.textContent = progressValue;
  if (consoleElapsedValue) consoleElapsedValue.textContent = elapsedTime;
  if (consoleProgressBar) consoleProgressBar.style.width = progressValue;
  if (consoleElapsedBar) consoleElapsedBar.style.width = progressValue;
  consoleMeters.forEach((node) => { node.style.setProperty('--value', progressValue); });
  buildTimeline?.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
  buildTimeline?.setAttribute('aria-valuetext', elapsedTime);
  updateTimelineMarkerState(safeSeconds);
}

function renderPlaybackUntilLive(targetCount) {
  const total = playbackEvents.length;
  const count = clamp(Math.round(Number(targetCount) || 0), 0, total);
  if (count <= playbackCursor) {
    updatePlaybackControls();
    return;
  }

  chatFeed.querySelector('.chat-placeholder')?.remove();
  const shouldStickToBottom = shouldFollowLog || isLogNearBottom();
  let last = null;
  for (let index = playbackCursor; index < count; index += 1) {
    last = appendEventInstantly(playbackEvents[index], index) || last;
  }

  chatMessages = [...document.querySelectorAll('.event-row[data-chat-stage]')];
  playbackCursor = count;
  applyRoomVisibility();
  if (last) {
    setStage(last.stageId, last.node, last.event);
    shouldFollowLog = shouldStickToBottom;
    scrollChatToBottom(count, { instant: true });
  }
  if (playbackCursor >= total && !isVideoOnlyMode) stopAutoPlay(false);
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
  milestoneRenderKey = '';
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

  const tickSeconds = Math.min(Math.max((now - autoPlayClockStartedAt) / 1000, 0), 0.16) * playbackSpeed;
  autoPlayClockStartedAt = now;
  autoPlayClockStartSeconds = clamp(autoPlayClockStartSeconds + tickSeconds, 0, getPresentationTotalSeconds());
  let demoSeconds = autoPlayClockStartSeconds;
  const keyframe = isVideoOnlyMode ? null : getNextPendingKeyframeBySeconds(demoSeconds);
  if (keyframe) {
    demoSeconds = keyframe.demoSeconds;
    autoPlayClockStartSeconds = demoSeconds;
  }

  renderPlaybackToDemoSeconds(demoSeconds, { noSeek: true });

  if (keyframe && beginKeyframeHold(keyframe)) return;
  if (demoSeconds >= getPresentationTotalSeconds() || playbackCursor >= playbackEvents.length) {
    if (isVideoOnlyMode) {
      restartVideoOnlyPlayback();
      return;
    }
    renderPlaybackToDemoSeconds(getPresentationTotalSeconds(), { noSeek: true });
    stopAutoPlay();
    return;
  }

  autoPlayTimer = setTimeout(() => runAutoPlayFrame(performance.now()), 80);
}

function startAutoPlayLoop(startSeconds = getDemoSecondsForEventCount(playbackCursor)) {
  cancelAnimationFrame(autoPlayFrame);
  clearTimeout(autoPlayTimer);
  autoPlayTimer = null;
  autoPlayClockStartSeconds = clamp(Number(startSeconds) || 0, 0, getPresentationTotalSeconds());
  autoPlayClockStartedAt = performance.now();
  autoPlayTimer = setTimeout(() => runAutoPlayFrame(performance.now()), 0);
}

function buildMilestoneNodes() {
  const stageNodes = stages.map((stage, index) => {
    const label = String(stage.label || `Phase ${stage.id}`).replace(/^\d+\s+/, '');
    return {
      id: `phase-${stage.id}`,
      startStage: Number(stage.id),
      endStage: Number(stage.id),
      code: `[${String(stage.id).padStart(2, '0')}]`,
      label,
      role: stage.metrics?.[2] || 'phase milestone',
      summary: stage.summary || stage.system || '',
      prefix: index <= 3 ? 'prep' : (index <= 6 ? 'run' : 'done'),
      parallel: index >= 3 && index <= 6,
      children: (stage.children || []).map((child) => ({
        id: `phase-${stage.id}-${child.id}`,
        startStage: Number(stage.id),
        endStage: Number(stage.id),
        code: String(child.id || '').replace(/^\d+\./, ''),
        label: child.label || child.id || 'substep',
        role: 'child milestone',
        summary: child.summary || '',
        prefix: 'sub'
      }))
    };
  });
  return [
    {
      id: 'pm-terminal',
      startStage: stages[0]?.id ?? 0,
      endStage: stages.at(-1)?.id ?? 0,
      code: '[PM]',
      label: 'ProjectManager Control',
      role: '1 PM · 5 logical Foremen · 100 Workers',
      summary: 'Runtime evolves from tool-heavy execution into shared Skills during the build.',
      prefix: 'pm',
      root: true
    },
    ...stageNodes
  ];
}

function getMilestoneState(node, currentId, isComplete) {
  if (isComplete || currentId > Number(node.endStage)) return 'complete';
  if (currentId >= Number(node.startStage) && currentId <= Number(node.endStage)) return 'running';
  return 'pending';
}

function createMilestoneItem(node, state, options = {}) {
  const item = document.createElement('li');
  const stateLabel = state === 'running' ? 'executing' : (state === 'complete' ? 'complete' : 'pending');
  item.className = `milestone-item is-${state}${node.root ? ' is-root' : ''}${node.parallel ? ' is-parallel' : ''}${options.worker ? ' is-worker' : ''}`;
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
  if (!milestoneList) return;
  const total = playbackEvents.length;
  const isComplete = total > 0 && playbackCursor >= total;
  const currentId = Number(currentStageId);
  const sourceNodes = buildMilestoneNodes();
  const rootNode = sourceNodes.find((node) => node.root) || sourceNodes[0];
  const childNodes = sourceNodes.filter((node) => node !== rootNode);
  const visibleChildren = childNodes.filter((node) => isComplete || Number(node.startStage) <= currentId);
  const visibleCount = (rootNode ? 1 : 0) + visibleChildren.length;
  const renderKey = `${currentId}:${isComplete}:${visibleCount}:${sourceNodes.length}`;
  if (renderKey === milestoneRenderKey && milestoneList.children.length) {
    return;
  }
  milestoneRenderKey = renderKey;
  milestoneList.replaceChildren();
  if (milestoneCount) milestoneCount.textContent = `${visibleCount}/${sourceNodes.length} shown`;

  if (!rootNode) return;
  const rootState = getMilestoneState(rootNode, currentId, isComplete);
  const rootItem = createMilestoneItem(rootNode, rootState);
  const childTree = document.createElement('ol');
  childTree.className = 'milestone-children';

  visibleChildren.forEach((node) => {
    const state = getMilestoneState(node, currentId, isComplete);
    const item = createMilestoneItem(node, state);
    const childTreeForNode = createMilestoneChildTree(node, state);
    if (childTreeForNode) item.append(childTreeForNode);
    childTree.append(item);
  });

  if (visibleChildren.length) rootItem.append(childTree);
  milestoneList.append(rootItem);
  const runningItem = milestoneList.querySelector('.milestone-children > .milestone-item.is-running');
  runningItem?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function scheduleAutoPlay() {
  if (!isAutoPlaying || isKeyframeHolding) return;
  startAutoPlayLoop(getDemoSecondsForEventCount(playbackCursor));
}

function updatePlaybackControls() {
  const total = playbackEvents.length;
  const shown = Math.min(playbackCursor, total);
  const isComplete = shown >= total && total > 0;

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
  if (article) {
    populateChatMessage(article, event, index, { entering: false });
    if (shouldStickToBottom) chatFeed.append(article);
    article.classList.add('active');
  } else {
    article = createChatMessage(event, index);
    chatFeed.append(article);
    if (progressKey) progressRows.set(progressKey, article);
  }

  if (event.skill) updateSkillStateFromEvent(event, index);
  chatMessages = [...document.querySelectorAll('.event-row[data-chat-stage]')];
  applyRoomVisibility();
  setStage(event.stageId, article, event);
  shouldFollowLog = shouldStickToBottom;
  scrollChatToBottom(index);
  playbackCursor = index + 1;
  isMessagePending = false;
  if (playbackCursor >= playbackEvents.length && !isVideoOnlyMode) stopAutoPlay(false);
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
  shouldFollowLog = true;
  playbackCursor = 0;
  isMessagePending = false;
  heldKeyframes = new Set();
  isKeyframeHolding = false;
  renderedStageIds = new Set();
  progressRows = new Map();
  milestoneRenderKey = '';
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

function appendEventInstantly(event, index) {
  const progressKey = getProgressRowKey(event);
  let node = progressKey ? progressRows.get(progressKey) : null;
  appendStageDividerIfNeeded(event);
  if (node) {
    populateChatMessage(node, event, index, { entering: false });
    chatFeed.append(node);
  } else {
    node = createChatMessage(event, index);
    node.classList.remove('is-entering');
    chatFeed.append(node);
    if (progressKey) progressRows.set(progressKey, node);
  }
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
  shouldFollowLog = true;
  isMessagePending = false;
  renderedStageIds = new Set();
  progressRows = new Map();
  milestoneRenderKey = '';
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
  if (playbackCursor >= playbackEvents.length) renderPlaybackUntil(0);
  isAutoPlaying = true;
  updatePlaybackControls();
  startAutoPlayLoop(getDemoSecondsForEventCount(playbackCursor));
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
  if (index < 0) {
    const fallbackSeconds = keyframe.demoSeconds / getPresentationTotalSeconds() * getPlaybackTotalSeconds();
    index = playbackEvents.findIndex((event) => event.seconds >= fallbackSeconds);
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

function syncHeldKeyframesForSeconds(seconds = 0) {
  const safeSeconds = Number(seconds) || 0;
  heldKeyframes = new Set(
    timelineKeyframes
      .filter((keyframe) => Number(keyframe.demoSeconds) <= safeSeconds + 0.015)
      .map((keyframe) => keyframe.id)
  );
}

function getDemoSecondsForEventCount(count = playbackCursor) {
  const [start, end] = getTimelineAnchorPairByCount(count);
  const span = Math.max(1, end.count - start.count);
  const ratio = clamp(((Number(count) || 0) - start.count) / span, 0, 1);
  return start.seconds + ((end.seconds - start.seconds) * ratio);
}

function getEventCountForDemoSeconds(seconds = 0) {
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
  const shouldSeek = !options.noSeek && (options.force || !isAutoPlaying || isKeyframeHolding || playbackCursor >= playbackEvents.length || isIntro);
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
  if (isIntro || !isAutoPlaying || isKeyframeHolding || playbackCursor >= playbackEvents.length || isVideoTargetComplete) {
    if (!worldVideo.paused) worldVideo.pause();
  } else if (worldVideo.paused && !worldVideo.ended) {
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
  if (playbackCursor >= playbackEvents.length) return;
  const demoSeconds = getDemoSecondsForEventCount(playbackCursor);
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
  const progressValue = `${Math.round(safeRatio * 100)}%`;
  const elapsedSeconds = safeRatio * getPresentationTotalSeconds();
  const elapsedTime = formatTimelineTime(elapsedSeconds);
  if (consoleProgressValue) consoleProgressValue.textContent = progressValue;
  if (consoleElapsedValue) consoleElapsedValue.textContent = elapsedTime;
  if (consoleProgressBar) consoleProgressBar.style.width = progressValue;
  if (consoleElapsedBar) consoleElapsedBar.style.width = progressValue;
  consoleMeters.forEach((node) => { node.style.setProperty('--value', progressValue); });
  buildTimeline?.setAttribute('aria-valuenow', String(Math.round(safeRatio * 100)));
  buildTimeline?.setAttribute('aria-valuetext', elapsedTime);
  updateVideoForDemoSeconds(elapsedSeconds, { force: true });
  updateTimelineMarkerState(elapsedSeconds);
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
  const shouldResume = options.resumeAfterHold === true;

  clearTimeout(autoPlayTimer);
  cancelAnimationFrame(autoPlayFrame);
  clearTimeout(keyframeHoldTimer);
  clearTimeout(frameworkCollapseTimer);
  autoPlayTimer = null;
  autoPlayFrame = null;
  keyframeHoldTimer = null;
  frameworkCollapseTimer = null;

  seekTimelineToKeyframe(keyframe, { expandFramework: false });
  isAutoPlaying = shouldResume;
  isKeyframeHolding = true;
  setFrameworkExpanded(true);
  timelineIntro?.classList.toggle('is-visible', keyframe.demoSeconds < introArchitectureSeconds);
  pauseVideoAtCurrentFrame();
  updatePlaybackControls();

  keyframeHoldTimer = setTimeout(() => {
    keyframeHoldTimer = null;
    isKeyframeHolding = false;
    setFrameworkExpanded(false);
    updatePlaybackControls();
    if (!shouldResume) return;
    resumeVideoFromCurrentFrame();
    startAutoPlayLoop(keyframe.demoSeconds);
  }, KEYFRAME_HOLD_MS);

  return true;
}

function getNextPendingKeyframe() {
  return timelineKeyframes.find((keyframe) => !heldKeyframes.has(keyframe.id) && playbackCursor >= (keyframe.targetCount || Infinity));
}

function beginKeyframeHold(keyframe) {
  if (isVideoOnlyMode) return false;
  if (!keyframe || heldKeyframes.has(keyframe.id)) return false;
  heldKeyframes.add(keyframe.id);
  isKeyframeHolding = true;
  setFrameworkExpanded(true);
  timelineIntro?.classList.toggle('is-visible', keyframe.demoSeconds < introArchitectureSeconds);
  pauseVideoAtCurrentFrame();
  updatePlaybackControls();
  clearTimeout(keyframeHoldTimer);
  clearTimeout(frameworkCollapseTimer);
  frameworkCollapseTimer = null;
  keyframeHoldTimer = setTimeout(() => {
    keyframeHoldTimer = null;
    if (!isAutoPlaying) {
      isKeyframeHolding = false;
      setFrameworkExpanded(false);
      updatePlaybackControls();
      return;
    }
    isKeyframeHolding = false;
    setFrameworkExpanded(false);
    resumeVideoFromCurrentFrame();
    updatePlaybackControls();
    startAutoPlayLoop(keyframe.demoSeconds);
  }, KEYFRAME_HOLD_MS);
  return true;
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

function seekTimelineToRatio(ratio = 0, options = {}) {
  const safeRatio = clamp(ratio, 0, 1);
  const seconds = safeRatio * getPresentationTotalSeconds();
  const count = getEventCountForTimelineRatio(safeRatio);
  const shouldResume = options.resume === true && count < playbackEvents.length;
  syncHeldKeyframesForSeconds(seconds);
  renderPlaybackUntil(count);
  previewTimelineRatio(safeRatio);
  if (!shouldResume) return;
  isAutoPlaying = true;
  isKeyframeHolding = false;
  updateVideoForDemoSeconds(seconds, { force: true });
  updatePlaybackControls();
  startAutoPlayLoop(seconds);
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
  if (!isScrubbingTimeline) return;
  event.preventDefault();
  const deltaX = (Number(event.clientX) || 0) - timelineScrubStartX;
  const deltaY = (Number(event.clientY) || 0) - timelineScrubStartY;
  if (Math.hypot(deltaX, deltaY) > 4) timelineDidDrag = true;
  queueTimelineSeek(event);
}

function endTimelineScrub(event) {
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
  const currentRatio = clamp(getDemoSecondsForEventCount(playbackCursor) / total, 0, 1);
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
  event.preventDefault();
  const shouldResume = isAutoPlaying;
  stopAutoPlay();
  shouldFollowLog = true;
  seekTimelineToRatio(getTimelineRatioFromPointer(event), { keepPaused: true, resume: shouldResume });
}
