// CraftUtopia demo render.
function createStructuredLogText(event) {
  const display = event.display || null;
  if (display?.timecode && display?.actor && display?.kind) {
    return {
      timecode: String(display.timecode),
      actor: String(display.actor),
      kind: String(display.kind),
      action: String(display.action || ''),
      result: display.result ? String(display.result) : '',
      sublines: Array.isArray(display.sublines) ? display.sublines.map((line) => String(line)) : [],
      followups: createStructuredFollowups(event, display),
      highlights: Array.isArray(display.highlights) ? display.highlights.map((term) => String(term)).filter(Boolean) : [],
      progress: event.progress || display.progress || null
    };
  }

  const lines = Array.isArray(event.lines) && event.lines.length
    ? event.lines.map((line) => String(line))
    : String(event.text || '').split('\n');
  const first = lines[0] || '';
  const bracketMatch = first.match(/^\[(T\+\d+(?:\.\d+)?)\]\s+\[([^\]]+)\]\s+\[([^\]]+)\]\s*(.*)$/);
  if (bracketMatch) {
    const resultMatch = (lines[1] || '').match(/^\[result\]\s*(.*)$/);
    return {
      timecode: bracketMatch[1],
      actor: bracketMatch[2].trim(),
      kind: bracketMatch[3].trim(),
      action: bracketMatch[4].trim(),
      result: resultMatch ? resultMatch[1].trim() : '',
      sublines: Array.isArray(event.sublines) ? event.sublines.map((line) => String(line)) : [],
      followups: createStructuredFollowups(event),
      highlights: Array.isArray(event.highlights) ? event.highlights.map((term) => String(term)).filter(Boolean) : [],
      progress: event.progress || null
    };
  }
  const match = first.match(/^(T\+\d+(?:\.\d+)?)\s*(?:│|\s)\s*(.+?)\s*│\s*(\S+)\s*(.*)$/);
  if (!match) return null;
  const resultMatch = (lines[1] || '').match(/^\s*(?:↳|└─\s*result)\s*(.*)$/);
  return {
    timecode: match[1],
    actor: match[2].trim(),
    kind: match[3].trim(),
    action: match[4].trim(),
    result: resultMatch ? resultMatch[1].trim() : '',
    sublines: Array.isArray(event.sublines) ? event.sublines.map((line) => String(line)) : [],
    followups: createStructuredFollowups(event),
    highlights: Array.isArray(event.highlights) ? event.highlights.map((term) => String(term)).filter(Boolean) : [],
    progress: event.progress || null
  };
}

function normalizeStructuredField(value) {
  if (Array.isArray(value)) return value.filter((item) => item !== undefined && item !== null && item !== '');
  return value ? [value] : [];
}

function createStructuredFollowupsFromSublines(sublines) {
  return normalizeStructuredField(sublines).flatMap((item) => {
    if (!item || typeof item !== 'object') return [{ text: String(item || '') }];
    const key = ['tools', 'tool', 'messages', 'message', 'skills', 'skill', 'results', 'result', 'notes', 'note']
      .find((name) => item[name] !== undefined);
    if (!key) return [];
    const typeMap = {
      tools: 'tool',
      tool: 'tool',
      messages: 'tool',
      message: 'tool',
      skills: 'skill',
      skill: 'skill',
      results: 'result',
      result: 'result',
      notes: 'note',
      note: 'note'
    };
    return normalizeStructuredField(item[key]).map((text) => ({
      type: typeMap[key],
      text: String(text),
      label: typeMap[key] === 'skill' ? 'Skill' : typeMap[key] === 'result' ? 'Result' : typeMap[key] === 'note' ? 'Detail' : 'Tool call'
    }));
  });
}

function createStructuredFollowups(event = {}, display = {}) {
  const sublineFollowups = createStructuredFollowupsFromSublines(event.sublines || display.sublines);
  if (sublineFollowups.length) return sublineFollowups;
  const tools = normalizeStructuredField(event.tools || display.tools)
    .map((text) => ({ type: 'tool', text: String(text), label: 'Tool call' }));
  const messages = normalizeStructuredField(event.messages || display.messages)
    .map((text) => ({ type: 'tool', text: String(text), label: 'Tool call' }));
  const skills = normalizeStructuredField(event.skills || display.skills)
    .map((text) => ({ type: 'skill', text: String(text), label: 'Skill' }));
  const results = normalizeStructuredField(event.results || display.results)
    .map((text) => ({ type: 'result', text: String(text), label: 'Result' }));
  const notes = normalizeStructuredField(event.notes || display.notes)
    .map((text) => ({ type: 'note', text: String(text), label: 'Detail' }));
  const structured = [...tools, ...messages, ...skills, ...results, ...notes];
  if (structured.length) return structured;
  return normalizeStructuredField(event.sublines || display.sublines).map((text) => ({ text }));
}

function appendHighlightedText(node, value = '', highlights = []) {
  const text = String(value || '');
  const terms = [...new Set((highlights || [])
    .map((term) => String(term || '').trim())
    .filter(Boolean))]
    .sort((a, b) => b.length - a.length);
  if (!terms.length) {
    node.textContent = text;
    return;
  }

  const regex = new RegExp(terms.map(escapeRegExp).join('|'), 'gi');
  let cursor = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > cursor) node.append(document.createTextNode(text.slice(cursor, match.index)));
    const mark = document.createElement('span');
    mark.className = 'structured-highlight';
    mark.textContent = match[0];
    node.append(mark);
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) node.append(document.createTextNode(text.slice(cursor)));
}

const ACTOR_COLOR_MAP = {
  ProjectManager: '#ffe04b',
  Designer: '#35c9ff',
  Foreman: '#ff3f7f',
  Worker: '#c084ff',
  System: '#f0fff6'
};

const ACTOR_COLOR_POOL = [
  '#ffe04b',
  '#35c9ff',
  '#ff3f7f',
  '#c084ff',
  '#f0fff6'
];

function getActorColor(actor = '') {
  const actorName = String(actor || '').trim();
  if (ACTOR_COLOR_MAP[actorName]) return ACTOR_COLOR_MAP[actorName];
  if (/^Foreman(?:-|$)/i.test(actorName)) return ACTOR_COLOR_MAP.Foreman;
  if (/^Worker(?:-|$)/i.test(actorName)) return ACTOR_COLOR_MAP.Worker;
  let hash = 0;
  for (let i = 0; i < actorName.length; i += 1) {
    hash = ((hash << 5) - hash) + actorName.charCodeAt(i);
    hash |= 0;
  }
  return ACTOR_COLOR_POOL[Math.abs(hash) % ACTOR_COLOR_POOL.length];
}

function createStructuredProgress(progress) {
  if (!progress) return null;
  const total = Number(progress.total || 0);
  const current = Number(progress.current || 0);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(current)) return null;
  const ratio = Math.max(0, Math.min(1, current / total));
  const cells = 8;
  const filled = Math.max(0, Math.min(cells, Math.round(ratio * cells)));
  const wrap = document.createElement('span');
  wrap.className = 'structured-progress';

  const track = document.createElement('span');
  track.className = 'structured-progress-track';
  for (let i = 0; i < cells; i += 1) {
    const cell = document.createElement('span');
    cell.className = `structured-progress-cell${i < filled ? ' is-filled' : ''}`;
    track.append(cell);
  }

  const label = progress.label ? `${progress.label} ` : '';
  const text = document.createElement('span');
  text.className = 'structured-progress-text';
  text.textContent = `${label}${Math.round(ratio * 100)}%`;
  wrap.append(track, text);
  return wrap;
}

function getSkillRefForStructuredSubline(line = '', event = {}, log = {}) {
  if (event.skill || event.message?.skillRef) return event.skill || event.message?.skillRef;
  const text = [
    line,
    log.action,
    ...(Array.isArray(log.highlights) ? log.highlights : [])
  ].join(' ').toLowerCase();
  return Object.entries(SKILL_REGISTRY)
    .find(([, skill]) => text.includes(String(skill.name || '').toLowerCase()))?.[0] || '';
}

function getStructuredSublineMeta(line = '', event = {}, log = {}) {
  const text = String(line || '');
  if (/^\s*result\b/i.test(text)) {
    return { className: 'is-result', accent: '#8ba0ad', label: 'Result' };
  }
  const skillRef = getSkillRefForStructuredSubline(text, event, log);
  const hasSkillLanguage = /\bskill\b/i.test(text) || (skillRef && text.toLowerCase().includes(String(SKILL_REGISTRY[skillRef]?.name || '').toLowerCase()));
  if (skillRef && (event.skill || event.message?.skillRef || hasSkillLanguage)) {
    return {
      className: 'is-skill',
      accent: SKILL_REGISTRY[skillRef]?.accent || '#72ffd1',
      label: SKILL_REGISTRY[skillRef]?.name || 'Skill'
    };
  }
  if (/^\s*(?:tool call|send message)\b/i.test(text)) {
    return { className: 'is-tool-call', accent: '#9fb0bd', label: 'Tool call' };
  }
  return { className: 'is-note', accent: '#80918b', label: 'Detail' };
}

function getStructuredFollowupMeta(followup = {}, event = {}, log = {}) {
  if (!followup?.type) return getStructuredSublineMeta(followup?.text || '', event, log);
  if (followup.type === 'tool' || followup.type === 'message') {
    return { className: 'is-tool-call', accent: '#9fb0bd', label: followup.label || 'Tool call' };
  }
  if (followup.type === 'skill') {
    const skillRef = getSkillRefForStructuredSubline(followup.text || '', event, log);
    return {
      className: 'is-skill',
      accent: SKILL_REGISTRY[skillRef]?.accent || '#72ffd1',
      label: SKILL_REGISTRY[skillRef]?.name || followup.label || 'Skill'
    };
  }
  if (followup.type === 'result') {
    return { className: 'is-result', accent: '#8ba0ad', label: followup.label || 'Result' };
  }
  return { className: 'is-note', accent: '#80918b', label: followup.label || 'Detail' };
}

function getStructuredLogGroupKey(event = {}) {
  const groupKey = event.logGroup || event.display?.logGroup || '';
  if (!groupKey) return '';
  return `${event.stageId ?? ''}::${groupKey}`;
}

function appendStructuredLogEntry(node, event, options = {}) {
  const log = createStructuredLogText(event);
  if (!log) return false;
  const showHeader = options.showHeader !== false;
  const entry = document.createElement('span');
  entry.className = `structured-entry${showHeader ? '' : ' is-continuation'}`;
  if (options.animate) {
    entry.classList.add('is-entry-entering');
    entry.addEventListener('animationend', () => entry.classList.remove('is-entry-entering'), { once: true });
    setTimeout(() => entry.classList.remove('is-entry-entering'), 320);
  }
  const main = document.createElement('span');
  main.className = 'structured-main';

  if (showHeader) {
    const timecode = document.createElement('span');
    timecode.className = 'structured-time';
    timecode.textContent = `[${log.timecode}]`;

    const actor = document.createElement('span');
    actor.className = 'structured-actor';
    actor.style.setProperty('--actor-color', getActorColor(log.actor));
    actor.textContent = `[${log.actor}]`;
    main.append(timecode, actor);
  }

  const action = document.createElement('span');
  action.className = 'structured-action';
  appendHighlightedText(action, log.action, log.highlights);
  main.append(action);

  if (log.result) {
    const result = document.createElement('span');
    result.className = 'structured-result';
    result.textContent = `→ ${log.result}`;
    main.append(result);
  }

  const progress = createStructuredProgress(log.progress);
  if (progress) {
    main.append(progress);
  }
  entry.append(main);

  if (log.followups?.length) {
    const followups = document.createElement('span');
    followups.className = 'structured-sublines';
    log.followups.forEach((followup) => {
      const line = followup.text || '';
      const meta = getStructuredFollowupMeta(followup, event, log);
      if (meta.className !== 'is-skill' && meta.className !== 'is-tool-call') {
        const detail = document.createElement('span');
        detail.className = `structured-detail ${meta.className}`;
        detail.title = meta.label;
        appendHighlightedText(detail, line, log.highlights);
        followups.append(detail);
        return;
      }
      const subline = document.createElement('span');
      subline.className = `structured-subline ${meta.className}`;
      subline.style.setProperty('--subline-accent', meta.accent);
      subline.title = meta.label;
      const arrow = document.createElement('span');
      arrow.className = 'structured-subline-arrow';
      arrow.textContent = '↳';
      const body = document.createElement('span');
      body.className = 'structured-subline-body';
      appendHighlightedText(body, line, log.highlights);
      subline.classList.add('has-prefix');
      const prefix = document.createElement('span');
      prefix.className = 'structured-subline-prefix';
      prefix.textContent = meta.className === 'is-skill' ? 'SKILL' : 'TOOL';
      subline.append(arrow, prefix, body);
      followups.append(subline);
    });
    if (followups.children.length) entry.append(followups);
  }
  node.append(entry);
  return true;
}

function appendStructuredLog(node, event) {
  const log = createStructuredLogText(event);
  if (!log) return false;
  node.replaceChildren();
  return appendStructuredLogEntry(node, event, { showHeader: true });
}

function canAppendToStructuredLogGroup(article, event) {
  const groupKey = getStructuredLogGroupKey(event);
  if (!groupKey || !article?.classList?.contains('is-structured')) return false;
  return article.dataset.logGroupKey === groupKey && Boolean(article.querySelector('.event-text'));
}

function appendStructuredEventToChatMessage(article, event, index, options = {}) {
  const text = article?.querySelector('.event-text');
  if (!text || !appendStructuredLogEntry(text, event, { showHeader: false, animate: options.animate === true })) return null;
  updateChatMessageMetadata(article, event, index);
  return article;
}

function ensureSkillState(skillRef = '') {
  const ref = String(skillRef || '').trim();
  if (!ref) return null;
  if (!skillState.has(ref)) {
    const fallbackName = ref.replace(/_/g, ' ');
    skillState.set(ref, {
      ref,
      ...(SKILL_REGISTRY[ref] || {
        name: ref,
        summary: `${fallbackName} shared across Foreman groups.`,
        learnedLabel: 'Learned in pool',
        baseRoute: ['learn', 'publish', 'reuse']
      }),
      learned: false,
      published: false,
      learnedRoom: '',
      learnedIndex: Number.POSITIVE_INFINITY,
      usedRooms: new Set(),
      events: []
    });
  }
  return skillState.get(ref);
}

function resetSkillState() {
  skillState = new Map();
  Object.keys(SKILL_REGISTRY).forEach(ensureSkillState);
  focusedSkillRef = Object.keys(SKILL_REGISTRY)[0] || '';
  skillLibraryUnlocked = false;
  renderSkillLibrary();
  renderSkillNotifications();
}

function getSkillEventLabel(kind = '') {
  if (kind === 'skill-detection') return 'Skill learned';
  if (kind === 'skill-broadcast') return 'Skill broadcast';
  if (kind === 'skill-use') return 'Skill reused';
  return 'Skill event';
}

function getSkillSchedule(skillRef) {
  return playbackEvents
    .map((event, index) => ({ ...event, index }))
    .filter((event) => (event.skill || event.message?.skillRef) === skillRef);
}

function updateSkillStateFromEvent(event, index = -1) {
  const skillRef = event?.skill || event?.message?.skillRef;
  const skill = ensureSkillState(skillRef);
  if (!skill) return;

  const kind = event.skillEvent || event.message?.kind || event.type || 'skill-event';
  const stageTitle = event.group?.title || event.stageLabel || 'Build Pools';
  const wasLearned = skill.learned;
  if (kind === 'skill-detection' || String(kind).includes('SKILL◆')) {
    skill.learned = true;
    skill.learnedRoom = stageTitle;
  } else if (kind === 'skill-broadcast' || String(kind).includes('SKILL↗')) {
    skill.learned = true;
    skill.published = true;
    if (!skill.learnedRoom) skill.learnedRoom = stageTitle;
  } else if (kind === 'skill-use' || String(kind).includes('SKILL')) {
    skill.learned = true;
    skill.published = true;
    if (!skill.learnedRoom) skill.learnedRoom = skill.learnedLabel || stageTitle;
    skill.usedRooms.add(stageTitle);
  } else {
    skill.learned = true;
    if (!skill.learnedRoom) skill.learnedRoom = stageTitle;
  }
  if (!wasLearned && skill.learned) skill.learnedIndex = Number.isFinite(index) ? index : skill.events.length;
  focusedSkillRef = skill.ref;
  skill.events.push({ index, kind, room: event.group?.id || `stage-${event.stageId}`, title: stageTitle });
  skillLibraryUnlocked = true;
  renderSkillLibrary(skill.ref);
  renderSkillNotifications(skill.ref);
}

function getSkillStatus(skill) {
  if (skill.published) return 'shared';
  if (skill.learned) return 'learned';
  if (skill.usedRooms.size) return `${skill.usedRooms.size} ${skill.usedRooms.size === 1 ? 'room' : 'rooms'}`;
  return 'locked';
}

function summarizeRooms(rooms, fallback = 'Waiting') {
  const values = [...rooms];
  if (!values.length) return fallback;
  return values
    .map((room) => room
      .replace(' Worker Pool', '')
      .replace('Project Manager and ', 'PM + '))
    .join(', ');
}

function activateSkillCard(skillRef) {
  focusedSkillRef = skillRef;
  renderSkillLibrary(skillRef);
  if (isMessagePending) return;
  const schedule = getSkillSchedule(skillRef);
  if (!schedule.length) return;
  const nextEvent = schedule.find((event) => event.index + 1 > playbackCursor) || schedule[0];
  renderPlaybackUntil(nextEvent.index + 1);
}

function getSkillIconMarkup(skillRef = '') {
  const skill = SKILL_REGISTRY[skillRef] || {};
  const src = skill.icon || 'assets/icons/skills/skill-fallback.svg';
  const alt = skill.name ? `${skill.name} icon` : 'Skill icon';
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">`;
}

function renderSkillLibrary(activeRef = focusedSkillRef) {
  if (!skillList || !skillRoute) return;
  const baseSkills = Object.keys(SKILL_REGISTRY).map(ensureSkillState).filter(Boolean);
  const extraSkills = [...skillState.values()].filter((skill) => !SKILL_REGISTRY[skill.ref]);
  const skills = [...baseSkills, ...extraSkills];
  const unlockedCount = skills.filter((skill) => skill.learned || skill.events.length).length;
  skillLibrary?.classList.toggle('is-empty', unlockedCount === 0);
  const title = skillLibrary?.querySelector('h3');
  if (title) title.textContent = `Skill · ${unlockedCount}/${skills.length}`;
  skillList.replaceChildren();

  skills.forEach((skill) => {
    const isUnlocked = skill.learned || skill.events.length;
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.className = `skill-card${skill.ref === activeRef && isUnlocked ? ' active' : ''}${isUnlocked ? '' : ' is-locked'}`;
    button.type = 'button';
    button.dataset.skillRef = skill.ref;
    button.disabled = !isUnlocked;
    button.setAttribute('aria-pressed', String(skill.ref === activeRef && isUnlocked));
    const learnedFrom = skill.learnedRoom || skill.learnedLabel || 'Waiting';
    const usedBy = summarizeRooms(skill.usedRooms, 'No reuse yet');
    button.title = isUnlocked
      ? `${skill.name}: ${skill.summary} Learned in ${learnedFrom}. Shared to ${skill.sharedTo}. Used by ${usedBy}.`
      : 'Empty skill slot';
    button.innerHTML = isUnlocked ? `
      <span class="skill-icon">${getSkillIconMarkup(skill.ref)}</span>
      <span class="skill-name">${escapeHtml(skill.name)}</span>
      <span class="skill-status">${escapeHtml(getSkillStatus(skill))}</span>
      <span class="skill-detail-grid" aria-label="${escapeHtml(skill.name)} sharing details">
        <span class="skill-detail"><b>Learned in</b><span title="${escapeHtml(learnedFrom)}">${escapeHtml(learnedFrom)}</span></span>
        <span class="skill-detail"><b>Shared to</b><span title="${escapeHtml(skill.sharedTo)}">${escapeHtml(skill.sharedTo)}</span></span>
        <span class="skill-detail"><b>Used by</b><span title="${escapeHtml(usedBy)}">${escapeHtml(usedBy)}</span></span>
      </span>
      <span class="skill-share-line">Shared via global Skill Library, not private to the learning room.</span>
      <span class="skill-jump">Jump to next ${escapeHtml(skill.name)} event -></span>
    ` : `
      <span class="skill-icon" aria-hidden="true"></span>
      <span class="skill-name">Empty</span>
    `;
    if (isUnlocked) button.addEventListener('click', () => activateSkillCard(skill.ref));
    item.append(button);
    skillList.append(item);
  });

  const routeItems = [
    { label: 'Shared scope: Foreman-A', active: true },
    { label: 'Foreman-B', active: true },
    { label: 'Foreman-C', active: true },
    { label: 'Foreman-D', active: true },
    { label: 'Foreman-E', active: true }
  ];
  skillRoute.replaceChildren(...routeItems.map((item) => {
    const node = document.createElement('span');
    node.className = item.active ? 'active' : '';
    node.textContent = item.label;
    node.title = item.label;
    return node;
  }));
}

function renderSkillNotifications(activeRef = focusedSkillRef) {
  if (!skillNotificationStack) return;
  const learnedSkills = [...skillState.values()]
    .filter((skill) => skill.learned)
    .sort((a, b) => (a.learnedIndex || 0) - (b.learnedIndex || 0) || a.name.localeCompare(b.name));

  skillNotificationStack.replaceChildren();
  skillNotificationStack.hidden = learnedSkills.length === 0;
  if (!learnedSkills.length) return;

  learnedSkills.forEach((skill) => {
    const item = document.createElement('article');
    item.className = `skill-notification${skill.ref === activeRef ? ' is-current' : ''}`;
    item.dataset.skillRef = skill.ref;
    item.style.setProperty('--skill-accent', skill.accent || '#72ffd1');
    const learnedFrom = skill.learnedRoom || skill.learnedLabel || 'Build Pools';
    const notificationDescription = skill.notificationDescription || skill.summary || '';
    const notificationName = String(skill.name || 'Skill').replace(/^Learned\s+/i, '');
    item.title = `${notificationName}. ${notificationDescription} ${learnedFrom}`;
    item.innerHTML = `
      <span class="skill-notification-icon">${getSkillIconMarkup(skill.ref)}</span>
      <span class="skill-notification-body">
        <b><span>SKILL:</span> ${escapeHtml(notificationName)}</b>
        <small>${escapeHtml(notificationDescription)}</small>
      </span>
    `;
    skillNotificationStack.append(item);
  });
}

function accessoryMarkup(kind, trim, dark) {
  const items = {
    crown: `<rect x="20" y="4" width="24" height="6" fill="${trim}"/><rect x="16" y="8" width="8" height="8" fill="${trim}"/><rect x="28" y="8" width="8" height="8" fill="#fff2a8"/><rect x="40" y="8" width="8" height="8" fill="${trim}"/>`,
    hardhat: `<rect x="14" y="10" width="36" height="8" fill="${trim}"/><rect x="18" y="6" width="28" height="8" fill="#ffd45f"/><rect x="30" y="6" width="4" height="12" fill="#8b5a13"/>`,
    flag: `<rect x="45" y="9" width="3" height="25" fill="${dark}"/><rect x="48" y="9" width="11" height="8" fill="${trim}"/><rect x="48" y="17" width="7" height="7" fill="#ffd7e6"/>`,
    compass: `<rect x="47" y="36" width="10" height="10" fill="${dark}"/><rect x="50" y="33" width="4" height="16" fill="${trim}"/><rect x="44" y="39" width="16" height="4" fill="${trim}"/>`,
    chest: `<rect x="8" y="41" width="17" height="13" fill="#9a5b25"/><rect x="8" y="45" width="17" height="3" fill="${trim}"/><rect x="15" y="42" width="4" height="6" fill="#ffe08a"/>`,
    pickaxe: `<path d="M42 12 L54 22" stroke="${trim}" stroke-width="5"/><path d="M49 18 L32 45" stroke="${dark}" stroke-width="5"/><rect x="29" y="43" width="8" height="8" fill="${trim}"/>`,
    trowel: `<path d="M43 38 L55 50" stroke="${dark}" stroke-width="4"/><rect x="47" y="34" width="10" height="7" fill="${trim}"/>`,
    torch: `<rect x="50" y="31" width="5" height="20" fill="#6e391c"/><rect x="47" y="24" width="11" height="10" fill="${trim}"/><rect x="50" y="20" width="5" height="6" fill="#fff6a5"/>`,
    book: `<rect x="10" y="38" width="17" height="15" fill="${trim}"/><rect x="27" y="38" width="17" height="15" fill="#0d5c4f"/><rect x="26" y="38" width="2" height="15" fill="#e6fff7"/>`,
    shield: `<rect x="45" y="32" width="12" height="17" fill="${trim}"/><rect x="48" y="35" width="6" height="11" fill="#ffd1d1"/><rect x="49" y="49" width="4" height="4" fill="${trim}"/>`,
    ruler: `<rect x="45" y="34" width="6" height="23" fill="${trim}"/><rect x="51" y="38" width="4" height="2" fill="${dark}"/><rect x="51" y="46" width="4" height="2" fill="${dark}"/><rect x="51" y="54" width="4" height="2" fill="${dark}"/>`,
    goggles: `<rect x="17" y="25" width="12" height="8" fill="${trim}"/><rect x="35" y="25" width="12" height="8" fill="${trim}"/><rect x="29" y="27" width="6" height="3" fill="${dark}"/>`,
    map: `<rect x="43" y="38" width="14" height="16" fill="#e8d9a8"/><rect x="46" y="41" width="4" height="4" fill="${trim}"/><rect x="51" y="47" width="3" height="5" fill="#418a55"/>`
  };
  return items[kind] || '';
}

function avatarSvg(agent) {
  const avatar = agent.avatar || {};
  const skin = avatar.skin || '#c4865c';
  const hair = avatar.hair || '#2a1d15';
  const shirt = avatar.shirt || '#315c5c';
  const trim = avatar.trim || agent.accent || '#ffd987';
  const eyes = avatar.eyes || '#101010';
  const dark = '#070a08';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" shape-rendering="crispEdges">
    <rect width="64" height="64" fill="#08110d"/>
    <rect x="8" y="8" width="48" height="48" fill="#15241c"/>
    <rect x="14" y="42" width="36" height="14" fill="${shirt}"/>
    <rect x="25" y="35" width="14" height="11" fill="${skin}"/>
    <rect x="16" y="16" width="32" height="28" fill="${skin}"/>
    <rect x="16" y="14" width="32" height="9" fill="${hair}"/>
    <rect x="16" y="22" width="7" height="12" fill="${hair}"/>
    <rect x="41" y="22" width="7" height="8" fill="${hair}"/>
    <rect x="24" y="29" width="5" height="5" fill="${eyes}"/>
    <rect x="36" y="29" width="5" height="5" fill="${eyes}"/>
    <rect x="31" y="34" width="3" height="4" fill="#9e6348"/>
    <rect x="27" y="39" width="11" height="3" fill="${dark}"/>
    <rect x="14" y="42" width="36" height="4" fill="${trim}"/>
    <rect x="10" y="10" width="44" height="3" fill="${trim}" opacity="0.52"/>
    <rect x="10" y="54" width="44" height="3" fill="${dark}" opacity="0.62"/>
    ${accessoryMarkup(avatar.accessory, trim, dark)}
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function applyRoomVisibility() {
  if (!roomList) return;
  chatFeed.querySelectorAll('[data-stage-filter]').forEach((node) => {
    node.classList.toggle('room-hidden', activeRoom !== 'all' && node.dataset.stageFilter !== activeRoom);
  });
}

function setRoom(room, scrollBehavior = 'smooth') {
  if (!roomList) return;
  activeRoom = room;
  logBoard.dataset.room = room;
  roomTabs.forEach((tab) => {
    const isActive = tab.dataset.room === room;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-pressed', String(isActive));
  });
  applyRoomVisibility();
  lockAutoScrollSync();
  chatFeed.scrollTo({ top: 0, behavior: scrollBehavior });
}

function renderRoomList(groups, entryGroup = 'all') {
  if (!roomList) return;
  roomList.replaceChildren();
  const allButton = document.createElement('button');
  allButton.className = 'room-tab event-filter-tab';
  allButton.type = 'button';
  allButton.dataset.room = 'all';
  allButton.innerHTML = '<span class="filter-count">ALL</span><span><span class="room-name">All Stages</span></span>';
  allButton.addEventListener('click', () => setRoom('all'));
  roomList.append(allButton);

  groups.forEach((group) => {
    const button = document.createElement('button');
    button.className = 'room-tab event-filter-tab';
    button.type = 'button';
    button.dataset.room = `stage-${group.id}`;
    const count = group.events?.length ?? 0;
    button.classList.toggle('has-skill-event', (group.events || []).some((event) => event.skill));
    button.innerHTML = `<span class="filter-count">${escapeHtml(String(count).padStart(2, '0'))}</span><span><span class="room-name">${escapeHtml(group.label)}</span></span>`;
    button.addEventListener('click', () => setRoom(`stage-${group.id}`));
    roomList.append(button);
  });
  roomTabs = [...roomList.querySelectorAll('.room-tab')];
  setRoom(entryGroup, 'auto');
}

function createStageDivider(event) {
  const divider = document.createElement('div');
  divider.className = 'stage-divider is-entering';
  divider.dataset.stageFilter = `stage-${event.stageId}`;
  divider.dataset.chatStage = String(event.stageId);
  divider.innerHTML = `
    <span>${escapeHtml(event.stageLabel || `Stage ${event.stageId}`)}</span>
    <p>${escapeHtml(event.stageSummary || '')}</p>
  `;
  divider.addEventListener('animationend', () => divider.classList.remove('is-entering'), { once: true });
  return divider;
}

function appendStageDividerIfNeeded(event) {
  const key = String(event.stageId);
  if (renderedStageIds.has(key)) return;
  renderedStageIds.add(key);
}

function getEventProgress(event = {}) {
  return event.progress || event.display?.progress || null;
}

function getProgressRowKey(event = {}) {
  const progress = getEventProgress(event);
  if (!progress?.label) return '';
  return `${event.stageId}:${progress.label}`;
}

function updateChatMessageMetadata(article, event, index) {
  article.dataset.chatStage = String(event.stageId);
  article.dataset.stageFilter = `stage-${event.stageId}`;
  article.dataset.eventKind = event.type || 'EVENT';
  article.dataset.eventIndex = String(index);
  const groupKey = getStructuredLogGroupKey(event);
  if (groupKey) article.dataset.logGroupKey = groupKey;
  else delete article.dataset.logGroupKey;
  const progressKey = getProgressRowKey(event);
  if (progressKey) article.dataset.progressKey = progressKey;
  else delete article.dataset.progressKey;
  if (event.skill) {
    article.dataset.skillRef = event.skill;
    article.title = `Skill event: ${event.skill}`;
  } else {
    delete article.dataset.skillRef;
    article.removeAttribute('title');
  }
}

function populateChatMessage(article, event, index, options = {}) {
  article.className = 'event-row terminal-log-line is-entering';
  if (!options.entering) article.classList.remove('is-entering');
  updateChatMessageMetadata(article, event, index);
  article.replaceChildren();

  const structuredLog = createStructuredLogText(event);

  const time = document.createElement('span');
  time.className = 'event-time';
  time.textContent = `[${event.time || '--:--'}]`;

  const badge = document.createElement('span');
  badge.className = 'event-badge';
  badge.textContent = `[${event.type || 'EVENT'}]`;

  const text = document.createElement('p');
  text.className = 'event-text';
  if (structuredLog) {
    article.classList.add('is-structured');
    appendStructuredLog(text, event);
  } else {
    appendMentionedText(text, event.text || '');
  }

  if (structuredLog) {
    article.append(text);
  } else {
    article.append(time, badge, text);
  }
  return article;
}

function createChatMessage(event, index) {
  const article = document.createElement('article');
  populateChatMessage(article, event, index, { entering: true });
  article.addEventListener('animationend', () => article.classList.remove('is-entering'), { once: true });
  setTimeout(() => article.classList.remove('is-entering'), 320);
  return article;
}

function isLogNearBottom() {
  if (!chatFeed) return true;
  const distance = chatFeed.scrollHeight - chatFeed.clientHeight - chatFeed.scrollTop;
  return distance <= LOG_FOLLOW_THRESHOLD;
}

function scrollChatToBottom(index, options = {}) {
  if (!options.force && !shouldFollowLog) return;
  lockAutoScrollSync();
  shouldFollowLog = true;
  const behavior = index === 0 || options.instant ? 'auto' : 'smooth';
  chatFeed.scrollTo({ top: chatFeed.scrollHeight, behavior });
  if (options.force || options.instant) {
    const pinToBottom = () => {
      chatFeed.style.scrollBehavior = 'auto';
      chatFeed.scrollTop = chatFeed.scrollHeight;
      chatFeed.scrollTo({ top: chatFeed.scrollHeight, behavior: 'auto' });
      requestAnimationFrame(() => {
        chatFeed.style.scrollBehavior = '';
      });
    };
    pinToBottom();
    requestAnimationFrame(pinToBottom);
    setTimeout(pinToBottom, 80);
    setTimeout(pinToBottom, 220);
  }
}

function lockAutoScrollSync() {
  isAutoScrolling = true;
  clearTimeout(autoScrollRelease);
  autoScrollRelease = setTimeout(() => { isAutoScrolling = false; }, 900);
}
