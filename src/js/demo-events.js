// CraftUtopia demo events.
let scrollFrame = null;
chatFeed.addEventListener('scroll', () => {
  if (isAutoScrolling) return;
  shouldFollowLog = isLogNearBottom();
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = null;
    syncTimelineFromLog();
  });
}, { passive: true });

playbackPrev?.addEventListener('click', () => jumpPlaybackBy(-1));
playbackNext?.addEventListener('click', () => advancePlayback());
playbackAuto?.addEventListener('click', toggleAutoPlay);
playbackSpeedToggle?.addEventListener('click', resetPlaybackSpeed);
playbackSlower?.addEventListener('click', () => stepPlaybackSpeed(-1));
playbackFaster?.addEventListener('click', () => stepPlaybackSpeed(1));
videoOnlyToggle?.addEventListener('click', () => setVideoOnlyMode(!isVideoOnlyMode));
videoOnlyPlay?.addEventListener('click', toggleAutoPlay);
videoOnlySpeed?.addEventListener('click', resetPlaybackSpeed);
videoOnlySlower?.addEventListener('click', () => stepPlaybackSpeed(-1));
videoOnlyFaster?.addEventListener('click', () => stepPlaybackSpeed(1));
blueprintCoverToggle?.addEventListener('click', () => {
  const isExpanded = !blueprintCoverToggle.classList.contains('is-expanded');
  blueprintCoverToggle.classList.toggle('is-expanded', isExpanded);
  blueprintCoverToggle.setAttribute('aria-expanded', String(isExpanded));
  blueprintCoverToggle.setAttribute('aria-label', isExpanded ? 'Collapse blueprint cover preview' : 'Expand blueprint cover preview');
});
buildTimeline?.addEventListener('pointerdown', startTimelineScrub);
buildTimeline?.addEventListener('pointermove', moveTimelineScrub);
buildTimeline?.addEventListener('pointerup', endTimelineScrub);
buildTimeline?.addEventListener('pointercancel', endTimelineScrub);
buildTimeline?.addEventListener('click', handleTimelineClick);
buildTimeline?.addEventListener('keydown', handleTimelineKeydown);
timelineScrubber?.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  event.stopPropagation();
  beginTimelineScrubberInput(event);
});
timelineScrubber?.addEventListener('input', moveTimelineScrubberInput);
timelineScrubber?.addEventListener('change', endTimelineScrubberInput);
timelineScrubber?.addEventListener('pointerup', (event) => {
  event.preventDefault();
  event.stopPropagation();
  endTimelineScrubberInput(event);
});
timelineScrubber?.addEventListener('pointercancel', (event) => {
  event.preventDefault();
  event.stopPropagation();
  endTimelineScrubberInput(event);
});
timelineScrubber?.addEventListener('pointermove', (event) => {
  event.preventDefault();
  event.stopPropagation();
  moveTimelineScrubberInput(event);
});
timelineScrubber?.addEventListener('click', (event) => {
  event.stopPropagation();
});
window.addEventListener('pointermove', moveTimelineScrub);
window.addEventListener('pointerup', endTimelineScrub);
window.addEventListener('pointercancel', endTimelineScrub);
window.addEventListener('pointermove', moveTimelineScrubberInput);
window.addEventListener('pointerup', endTimelineScrubberInput);
window.addEventListener('pointercancel', endTimelineScrubberInput);
['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'click'].forEach((eventName) => {
  timelineControlSlot?.addEventListener(eventName, (event) => {
    event.stopPropagation();
  });
});
worldVideo?.addEventListener('loadedmetadata', () => {
  if (Number.isFinite(worldVideo.duration) && worldVideo.duration > 0) {
    demoVideoSeconds = worldVideo.duration;
    rebuildTimelineAnchors();
    updateVideoForDemoSeconds(getDemoSecondsForEventCount(playbackCursor), { force: true, noSeek: isAutoPlaying });
  }
});
worldVideo?.addEventListener('pointerdown', keepVideoSurfacePassive);
worldVideo?.addEventListener('click', keepVideoSurfacePassive);
worldVideo?.addEventListener('ended', () => {
  if (!isAutoPlaying) return;
  if (isVideoOnlyMode) {
    restartVideoOnlyPlayback();
    return;
  }
  renderPlaybackToDemoSeconds(getPresentationTotalSeconds(), { syncVideo: false });
  setTimelineReadout(getPresentationTotalSeconds());
  stopAutoPlay();
});
worldVideo?.addEventListener('waiting', schedulePauseTimelineForVideoWait);
worldVideo?.addEventListener('stalled', schedulePauseTimelineForVideoWait);
worldVideo?.addEventListener('canplay', scheduleResumeTimelineAfterVideoWait);
worldVideo?.addEventListener('playing', () => {
  scheduleResumeTimelineAfterVideoWait();
  syncTimelineFromVideoPlayback();
});
worldVideo?.addEventListener('seeked', () => {
  scheduleResumeTimelineAfterVideoWait();
  syncTimelineFromVideoPlayback();
});
worldVideo?.addEventListener('timeupdate', () => {
  scheduleResumeTimelineAfterVideoWait();
  syncTimelineFromVideoPlayback();
});
appResizer?.addEventListener('pointerdown', startPanelResize);
appResizer?.addEventListener('pointermove', movePanelResize);
appResizer?.addEventListener('pointerup', endPanelResize);
appResizer?.addEventListener('pointercancel', endPanelResize);
appResizer?.addEventListener('keydown', handlePanelResizeKey);
window.addEventListener('pointermove', movePanelResize);
window.addEventListener('pointerup', endPanelResize);
window.addEventListener('pointercancel', endPanelResize);
frameworkToggle?.addEventListener('click', () => {
  setFrameworkExpanded(!terminalConsole?.classList.contains('is-framework-expanded'));
});
frameworkToggle?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  setFrameworkExpanded(!terminalConsole?.classList.contains('is-framework-expanded'));
});
frameworkOpen?.addEventListener('click', openFrameworkLightbox);
frameworkClose?.addEventListener('click', closeFrameworkLightbox);
frameworkLightbox?.addEventListener('click', (event) => {
  if (event.target === frameworkLightbox) closeFrameworkLightbox();
});
playbackJump?.addEventListener('click', jumpPlaybackToInput);
playbackStep?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') jumpPlaybackToInput();
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeFrameworkLightbox();
});

updateUiScale();
syncPanelWidthToCurrentLayout();
window.addEventListener('resize', updateUiScale, { passive: true });
window.addEventListener('resize', syncPanelWidthToCurrentLayout, { passive: true });
window.visualViewport?.addEventListener('resize', updateUiScale, { passive: true });
window.visualViewport?.addEventListener('resize', syncPanelWidthToCurrentLayout, { passive: true });

refreshLucideIcons();
bootLog();
