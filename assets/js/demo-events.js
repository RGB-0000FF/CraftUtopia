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
buildTimeline?.addEventListener('pointerdown', startTimelineScrub);
buildTimeline?.addEventListener('pointermove', moveTimelineScrub);
buildTimeline?.addEventListener('pointerup', endTimelineScrub);
buildTimeline?.addEventListener('pointercancel', endTimelineScrub);
buildTimeline?.addEventListener('click', handleTimelineClick);
buildTimeline?.addEventListener('keydown', handleTimelineKeydown);
worldVideo?.addEventListener('loadedmetadata', () => {
  if (Number.isFinite(worldVideo.duration) && worldVideo.duration > 0) {
    demoVideoSeconds = worldVideo.duration;
    rebuildTimelineAnchors();
    updateVideoForDemoSeconds(getDemoSecondsForEventCount(playbackCursor), { force: true, noSeek: isAutoPlaying });
  }
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

bootLog();
