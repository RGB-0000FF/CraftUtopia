// CraftUtopia demo config.
const AGENT_TYPING_DELAY = 2000;
const AUTO_PLAY_MIN_DELAY = 1000;
const AUTO_PLAY_MAX_DELAY = 1000;
const AUTO_PLAY_MS_PER_WORD = 22;
const INTRO_ARCHITECTURE_SECONDS = 10;
const DEFAULT_VIDEO_DURATION_SECONDS = 89.767;
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
let activeLogGroupNode = null;
let logRevealTimer = null;
let autoScrollRelease = null;
let isAutoScrolling = false;
let shouldFollowLog = true;
let isUserScrollingLog = false;
let logUserScrollTimer = null;
let playbackCursor = 0;
let isMessagePending = false;
let isLiveLogRevealLimited = false;
let autoPlayTimer = null;
let autoPlayFrame = null;
let autoPlayClockStartSeconds = 0;
let autoPlayClockStartedAt = 0;
let currentDemoSeconds = 0;
let isAutoPlaying = false;
let playbackSpeed = 1;
let demoVideoSeconds = DEFAULT_VIDEO_DURATION_SECONDS;
let introArchitectureSeconds = INTRO_ARCHITECTURE_SECONDS;
let activeDemoProfile = {};
let activeHlsController = null;
let timelineKeyframes = DEFAULT_TIMELINE_KEYFRAMES.map((keyframe) => ({ ...keyframe }));
let timelineAnchors = [];
let keyframeHoldTimer = null;
let frameworkCollapseTimer = null;
let isKeyframeHolding = false;
let frozenVideoTime = 0;
let heldKeyframes = new Set();
let activeRoom = '';
let milestoneRenderKey = '';
let topMilestoneRenderKey = '';
let skillLibraryUnlocked = false;
let focusedSkillRef = '';
let skillState = new Map();
let mentionRegex = null;
let isScrubbingTimeline = false;
let isTimelineScrubberActive = false;
let scrubFrame = null;
let timelineScrubStartX = 0;
let timelineScrubStartY = 0;
let timelineDidDrag = false;
let suppressNextTimelineClick = false;
let shouldResumeAfterTimelineSeek = false;
let isTimelineWaitingForVideo = false;
let videoSyncBlockedUntil = 0;
let videoWaitPauseTimer = null;
let videoWaitResumeTimer = null;
let isVideoOnlyMode = false;
const mentionAccentByTerm = new Map();
const SKILL_REGISTRY = {
  build_region: {
    name: 'Learned Region Placement',
    icon: 'assets/icons/skills/learned-region-placement.png',
    notificationDescription: 'Places blueprint blocks inside a target region.',
    summary: 'Reusable bounded placement loop learned after many Workers repeat read, script, run, verify, submit.',
    learnedLabel: 'Foreman-A Build',
    sharedTo: 'Foreman-A..Foreman-E',
    accent: '#35c9ff',
    trace: {
      source: 'Worker-001',
      note: 'Same tools trace repeats across Worker-001..020 placement subplans.',
      steps: [
        'Read Subplan: Load the blocks and target positions for A-01.',
        'Check Inventory: Confirm the required blocks for A-01.',
        'Go To Region: Move to the target position for A-01.',
        'Place Blocks: Place the blocks for A-01 in target positions.'
      ]
    }
  },
  replace_region: {
    name: 'Learned Region Replacement',
    icon: 'assets/icons/skills/learned-region-replacement.png',
    notificationDescription: 'Fixes wrong or missing blocks in a region.',
    summary: 'Wrong-block and missing-block repair pattern learned when mid-build repair pressure increases.',
    learnedLabel: 'Foreman-B Build',
    sharedTo: 'Foreman-A..Foreman-E',
    accent: '#ff5c8a',
    trace: {
      source: 'Worker-045',
      note: 'Same tools trace repeats across mismatch repair subplans.',
      steps: [
        'Read Subplan: Load the target block list for the repair area.',
        'Scan Region: Compare placed blocks with the blueprint target.',
        'Remove Wrong Blocks: Clear blocks that do not match the target.',
        'Place Missing Blocks: Restore the required blocks.',
        'Verify Region: Confirm the repaired region matches the blueprint.'
      ]
    }
  },
  scaffold: {
    name: 'Learned Scaffold Construction',
    icon: 'assets/icons/skills/learned-scaffold-construction.png',
    notificationDescription: 'Builds temporary supports for hard-to-reach areas.',
    summary: 'Temporary support placement with cleanup markers learned from awkward high-region builds.',
    learnedLabel: 'Foreman-C Build',
    sharedTo: 'Foreman-A..Foreman-E',
    accent: '#ffd166',
    trace: {
      source: 'Worker-027',
      note: 'Same tools trace repeats across high roof-rib access subplans.',
      steps: [
        'Read Subplan: Load the elevated roof-rib target area.',
        'Check Access: Detect that the target is out of normal reach.',
        'Place Temporary Support: Build a support path to the target.',
        'Reach Target: Move onto the temporary support.',
        'Remove Temporary Support: Clear support blocks after placement.'
      ]
    }
  },
  clean_region: {
    name: 'Learned Region Cleaning',
    icon: 'assets/icons/skills/learned-region-cleaning.png',
    notificationDescription: 'Removes leftover blocks after construction.',
    summary: 'Final cleanup pass for scaffold and leftover blocks while preserving valid blueprint blocks.',
    learnedLabel: 'Foreman-E Build',
    sharedTo: 'Foreman-A..Foreman-E',
    accent: '#6ee75f',
    trace: {
      source: 'Worker-083',
      note: 'Same tools trace repeats across final cleanup subplans.',
      steps: [
        'Read Cleanup Subplan: Load the scan volume for CL-03.',
        'Scan Region: Find leftover scaffold or stray blocks.',
        'Validate Blueprint: Keep blocks that belong to the final build.',
        'Remove Leftovers: Clear only non-blueprint blocks.',
        'Report Clean: Submit the cleaned volume to the foreman.'
      ]
    }
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
const skillNotificationStack = document.querySelector('#skill-notification-stack');
const systemLine = document.querySelector('#system-line');
const skillLibrary = document.querySelector('#skill-library');
const skillList = document.querySelector('#skill-list');
const skillRoute = document.querySelector('#skill-route');
const logKicker = document.querySelector('#log-kicker');
const consoleTaskTitle = document.querySelector('#console-task-title');
const consoleRunId = document.querySelector('#console-run-id');
const milestoneList = document.querySelector('#milestone-list');
const milestoneCount = document.querySelector('#milestone-count');
const topMilestoneStrip = document.querySelector('#top-milestone-strip');
const consoleProgressValue = document.querySelector('#console-progress-value');
const consoleElapsedValue = document.querySelector('#console-elapsed-value');
const consoleProgressBar = document.querySelector('#console-progress-bar');
const consoleElapsedBar = document.querySelector('#console-elapsed-bar');
const buildTimeline = document.querySelector('.build-timeline');
const buildTimelineRail = document.querySelector('.build-timeline-rail');
const timelineScrubber = document.querySelector('#timeline-scrubber');
const timelineControlSlot = document.querySelector('#timeline-control-slot');
const consoleControlAnchor = document.querySelector('#console-control-anchor');
const consoleControlGroup = document.querySelector('.console-control-group');
const timelineMarkers = document.querySelector('#timeline-markers');
const worldVideo = document.querySelector('.world-video');
const timelineIntro = document.querySelector('#timeline-intro');
const blueprintCoverToggle = document.querySelector('#blueprint-cover-toggle');
const blueprintCoverImage = document.querySelector('#blueprint-cover-image');
const blueprintBlockCount = document.querySelector('#blueprint-block-count');
const blueprintBlockCountValue = document.querySelector('#blueprint-block-count-value');
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
const videoOnlyToggle = document.querySelector('#video-only-toggle');
const videoOnlyPlay = document.querySelector('#video-only-play');
const videoOnlySpeed = document.querySelector('#video-only-speed');
const videoOnlySlower = document.querySelector('#video-only-slower');
const videoOnlyFaster = document.querySelector('#video-only-faster');
const playbackStep = document.querySelector('#playback-step');
const playbackJump = document.querySelector('#playback-jump');
const playbackCounter = document.querySelector('#playback-counter');
const demoProfileStylesheet = document.querySelector('#demo-profile-stylesheet');
