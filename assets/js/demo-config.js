// CraftUtopia demo config.
const AGENT_TYPING_DELAY = 2000;
const AUTO_PLAY_MIN_DELAY = 1000;
const AUTO_PLAY_MAX_DELAY = 1000;
const AUTO_PLAY_MS_PER_WORD = 22;
const INTRO_ARCHITECTURE_SECONDS = 10;
const DEMO_FALLBACK_VIDEO_SECONDS = 89.767;
const KEYFRAME_HOLD_MS = 5000;
const PLAYBACK_SPEED_STEPS = [0.5, 1, 1.5, 2, 4];
const DEFAULT_TIMELINE_KEYFRAMES = [
  { id: 'blueprint-ready', label: 'Blueprint Ready', demoSeconds: 10, stageId: 1 },
  { id: 'build-region', label: 'Build Region', demoSeconds: 17, skill: 'build_region' },
  { id: 'scaffold', label: 'Scaffold', demoSeconds: 28, skill: 'scaffold' },
  { id: 'replace-region', label: 'Replace Region', demoSeconds: 38, skill: 'replace_region' },
  { id: 'clean-region', label: 'Clean Region', demoSeconds: 50, skill: 'clean_region' }
];
const DESIGN_WIDTH = 1440;
const DESIGN_HEIGHT = 900;
const COMPACT_BREAKPOINT = 980;
const LOG_FOLLOW_THRESHOLD = 56;
const root = document.documentElement;
let stages = [];
let chatMessages = [];
let groupRooms = [];
let playbackEvents = [];
let renderedStageIds = new Set();
let progressRows = new Map();
let logRevealTimer = null;
let autoScrollRelease = null;
let isAutoScrolling = false;
let shouldFollowLog = true;
let playbackCursor = 0;
let isMessagePending = false;
let autoPlayTimer = null;
let autoPlayFrame = null;
let autoPlayClockStartSeconds = 0;
let autoPlayClockStartedAt = 0;
let isAutoPlaying = false;
let playbackSpeed = 1;
let demoVideoSeconds = DEMO_FALLBACK_VIDEO_SECONDS;
let activeDemoProfile = {};
let timelineKeyframes = DEFAULT_TIMELINE_KEYFRAMES.map((keyframe) => ({ ...keyframe }));
let timelineAnchors = [];
let keyframeHoldTimer = null;
let frameworkCollapseTimer = null;
let isKeyframeHolding = false;
let frozenVideoTime = 0;
let heldKeyframes = new Set();
let activeRoom = '';
let milestoneRenderKey = '';
let skillLibraryUnlocked = false;
let focusedSkillRef = '';
let skillState = new Map();
let mentionRegex = null;
let isScrubbingTimeline = false;
let scrubFrame = null;
let timelineScrubStartX = 0;
let timelineScrubStartY = 0;
let timelineDidDrag = false;
let suppressNextTimelineClick = false;
const mentionAccentByTerm = new Map();
const SKILL_REGISTRY = {
  build_region: {
    name: 'Build Region',
    summary: 'Reusable bounded placement loop learned after many Workers repeat read, script, run, verify, submit.',
    learnedLabel: 'Foreman-A Build',
    sharedTo: 'Foreman-A..Foreman-E',
    accent: '#72ffd1'
  },
  replace_region: {
    name: 'Replace Region',
    summary: 'Wrong-block and missing-block repair pattern learned when mid-build repair pressure increases.',
    learnedLabel: 'Foreman-B Build',
    sharedTo: 'Foreman-A..Foreman-E',
    accent: '#f06f9f'
  },
  scaffold: {
    name: 'Scaffold',
    summary: 'Temporary support placement with cleanup markers learned from awkward high-region builds.',
    learnedLabel: 'Foreman-C Build',
    sharedTo: 'Foreman-A..Foreman-E',
    accent: '#ffd987'
  },
  clean_region: {
    name: 'Clean Region',
    summary: 'Final cleanup pass for scaffold and leftover blocks while preserving valid blueprint blocks.',
    learnedLabel: 'Foreman-E Build',
    sharedTo: 'Foreman-A..Foreman-E',
    accent: '#9dff89'
  }
};

const appShell = document.querySelector('.app');
const appResizer = document.querySelector('#app-resizer');
const logBoard = document.querySelector('.log-board');
const LOG_BOARD_MIN_WIDTH = 420;
const LOG_BOARD_MAX_WIDTH = 720;
const STATUS_MIN_WIDTH = 360;
const roomList = document.querySelector('#room-list');
let roomTabs = [];
const chatFeed = document.querySelector('#chat-feed');
const systemLine = document.querySelector('#system-line');
const skillLibrary = document.querySelector('#skill-library');
const skillList = document.querySelector('#skill-list');
const skillRoute = document.querySelector('#skill-route');
const logKicker = document.querySelector('#log-kicker');
const consoleTaskTitle = document.querySelector('#console-task-title');
const consoleRunId = document.querySelector('#console-run-id');
const milestoneList = document.querySelector('#milestone-list');
const milestoneCount = document.querySelector('#milestone-count');
const consoleProgressValue = document.querySelector('#console-progress-value');
const consoleElapsedValue = document.querySelector('#console-elapsed-value');
const consoleProgressBar = document.querySelector('#console-progress-bar');
const consoleElapsedBar = document.querySelector('#console-elapsed-bar');
const buildTimeline = document.querySelector('.build-timeline');
const buildTimelineRail = document.querySelector('.build-timeline-rail');
const timelineMarkers = document.querySelector('#timeline-markers');
const worldVideo = document.querySelector('.world-video');
const timelineIntro = document.querySelector('#timeline-intro');
const consoleMeters = document.querySelectorAll('.console-meter');
const terminalConsole = document.querySelector('.terminal-console');
const consoleFramework = document.querySelector('.console-framework');
const frameworkToggle = document.querySelector('#framework-toggle');
const frameworkOpen = document.querySelector('#framework-open');
const frameworkLightbox = document.querySelector('#framework-lightbox');
const frameworkClose = document.querySelector('#framework-close');
const playbackPrev = document.querySelector('#playback-prev');
const playbackNext = document.querySelector('#playback-next');
const playbackAuto = document.querySelector('#playback-auto');
const playbackSpeedToggle = document.querySelector('#playback-speed');
const playbackSlower = document.querySelector('#playback-slower');
const playbackFaster = document.querySelector('#playback-faster');
const playbackStep = document.querySelector('#playback-step');
const playbackJump = document.querySelector('#playback-jump');
const playbackCounter = document.querySelector('#playback-counter');
