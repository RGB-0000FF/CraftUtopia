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
      label: typeMap[key] === 'skill' ? 'Skill' : typeMap[key] === 'result' ? 'Result' : typeMap[key] === 'note' ? 'Detail' : 'Action'
    }));
  });
}

function createStructuredFollowups(event = {}, display = {}) {
  const sublineFollowups = createStructuredFollowupsFromSublines(event.sublines || display.sublines);
  if (sublineFollowups.length) return sublineFollowups;
  const tools = normalizeStructuredField(event.tools || display.tools)
    .map((text) => ({ type: 'tool', text: String(text), label: 'Action' }));
  const messages = normalizeStructuredField(event.messages || display.messages)
    .map((text) => ({ type: 'tool', text: String(text), label: 'Action' }));
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
  const text = cleanToolLanguageForDisplay(value);
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

function getTraceStepHighlights(value = '') {
  const text = cleanToolLanguageForDisplay(value);
  const traceMatch = text.match(/\btrace:\s*(.+)$/i);
  if (!traceMatch) return [];
  return traceMatch[1]
    .split(/\s*->\s*/g)
    .map((step) => step.replace(/[.;:,]+$/g, '').trim())
    .filter(Boolean);
}

function getSkillUseHighlights(value = '') {
  const text = String(value || '');
  const terms = Object.values(SKILL_REGISTRY)
    .map((skill) => String(skill?.name || '').replace(/^Learned\s+/i, '').trim())
    .filter(Boolean)
    .filter((name) => text.toLowerCase().includes(name.toLowerCase()));
  const match = text.match(/\bUse Skill:\s*([^.:]+?)(?:\s+(?:on|for|with)\b|[.:]|$)/i);
  if (match?.[1]) terms.push(match[1].trim());
  return [...new Set(terms)];
}

function getStructuredLineHighlights(value = '', baseHighlights = []) {
  return [
    ...(Array.isArray(baseHighlights) ? baseHighlights : []),
    ...getTraceStepHighlights(value),
    ...getSkillUseHighlights(value)
  ];
}

function shouldCompactRuntimeLog(event = {}) {
  const stageIndex = Number(event.stageIndex);
  if (Number.isFinite(stageIndex)) return stageIndex >= 2;
  const stageLabel = `${event.stageLabel || ''} ${event.stageId || ''}`;
  return /\b(build|verified|cleanup)\b/i.test(stageLabel);
}

function compactRuntimeSentence(value = '', event = {}) {
  let text = cleanToolLanguageForDisplay(value).trim().replace(/\s+/g, ' ');
  if (!text) return text;
  const shouldJoinSentences = shouldCompactRuntimeLog(event);
  text = text
    .replace(/\bForeman-([A-E]) assigns one cleanup subplan to each worker in (Worker-\d+\.\.\d+)\.\s*Workers [^.]+\./i, 'Foreman-$1 assigns cleanup to $2.')
    .replace(/\bForeman-([A-E]) assigns one subplan to each worker in (Worker-\d+\.\.\d+)\.\s*Workers [^.]+\./i, 'Foreman-$1 assigns work to $2.')
    .replace(/\bForeman assigns one cleanup subplan to each worker in worker batch\.\s*Workers [^.]+\./i, 'Foreman assigns cleanup to a worker batch.')
    .replace(/\bForeman assigns one subplan to each worker in worker batch\.\s*Workers [^.]+\./i, 'Foreman assigns work to a worker batch.')
    .replace(/\bWorker-(\d+\.\.\d+) inspect their assigned placement subplans[.;]\s*No learned skill matches this sequence yet, so they complete the batch with manual steps and leave the Region Construction trace\./i, 'Worker-$1 runs manual placement and leaves Region Construction trace.')
    .replace(/\bWorker-(\d+\.\.\d+) inspect their assigned subplans, find the placement pattern matches Region Construction, and use the skill for those work items\./i, 'Worker-$1 uses Region Construction on matching subplans.')
    .replace(/\bWorker-(\d+\.\.\d+) inspect their assigned subplans and find the target positions require temporary support[.;]\s*Region Construction alone is not enough, so they run the support sequence with manual steps and leave Scaffold Construction trace examples\./i, 'Worker-$1 runs support steps and leaves Scaffold Construction traces.')
    .replace(/\bWorker-(\d+\.\.\d+) complete the reachable part of the high-reach assignment with Region Construction[.;]\s*These tasks are skill reuse, not scaffold trace collection\./i, 'Worker-$1 reuses Region Construction on reachable high targets.')
    .replace(/\bWorker-(\d+\.\.\d+) find mismatched blocks from the imported blueprint and (?:collect Region Replacement traces while repairing them with the same sequence|repair them with the same manual sequence, collecting Region Replacement trace examples)\./i, 'Worker-$1 repairs mismatches and leaves Region Replacement traces.')
    .replace(/\bworker batch inspect their assigned placement subplans[.;]\s*No learned skill matches this sequence yet, so they complete the batch with manual steps and leave the Region Construction trace\./i, 'Worker batch runs manual placement and leaves Region Construction trace.')
    .replace(/\bworker batch inspect their assigned subplans, find the placement pattern matches Region Construction, and use the skill for those work items\./i, 'Worker batch uses Region Construction on matching subplans.')
    .replace(/\bworker batch inspect their assigned subplans and find the target positions require temporary support[.;]\s*Region Construction alone is not enough, so they run the support sequence with manual steps and leave Scaffold Construction trace examples\./i, 'Worker batch runs support steps and leaves Scaffold Construction traces.')
    .replace(/\bworker batch complete the reachable part of the high-reach assignment with Region Construction[.;]\s*These tasks are skill reuse, not scaffold trace collection\./i, 'Worker batch reuses Region Construction on reachable high targets.')
    .replace(/\bworker batch find mismatched blocks from the imported blueprint and (?:collect Region Replacement traces while repairing them with the same sequence|repair them with the same manual sequence, collecting Region Replacement trace examples)\./i, 'Worker batch repairs mismatches and leaves Region Replacement traces.')
    .replace(/\bAll foremen confirmed their regions: placement complete, temporary supports removed, replacements verified, cleanup clean\./i, 'All foremen confirm: placed, cleaned, replaced, verified.')
    .replace(/\bDone; ([^.]+) has been built, verified, and cleaned up with the discovered workflow chunks\./i, 'Done; $1 is built, verified, and cleaned.')
    .replace(/\bForeman-A\.\.E initialize the build stage: split regions into one subplan per worker and open five queues in parallel\./i, 'Foreman-A..E split regions into worker subplans and open parallel queues.')
    .replace(/\bForeman-A\.\.E split regions into worker subplans and open five parallel queues\./i, 'Foreman-A..E split regions into worker subplans and open parallel queues.')
    .replace(/\bForemen initialize the build stage: split regions into one subplan per worker and open five queues in parallel\./i, 'Foremen split regions into worker subplans and open parallel queues.')
    .replace(/\bForemen split regions into worker subplans and open five parallel queues\./i, 'Foremen split regions into worker subplans and open parallel queues.')
    .replace(/\bRegion Construction alone is not enough, so they run the support step sequence with manual steps and leave Scaffold Construction trace examples\./i, 'They collect Scaffold Construction traces where Region Construction needs temporary support.')
    .replace(/\bWorker-(\d+\.\.\d+) finish assigned placement and high-reach work with the existing Region Construction and Scaffold Construction skills\./i, 'Worker-$1 uses Region Construction and Scaffold Construction for placement and high-reach work.')
    .replace(/\bWorker-(\d+\.\.\d+) finish remaining mismatch and closure work with Region Replacement where it matches the learned repair workflow\./i, 'Worker-$1 uses Region Replacement for mismatch and closure repairs.')
    .replace(/\bWorker-(\d+\.\.\d+) remove leftover temporary supports with manual steps; the repeated cleanup sequence becomes Scaffold Cleaning trace evidence\./i, 'Worker-$1 collects Scaffold Cleaning traces by removing leftover temporary supports.')
    .replace(/\bWorker-(\d+\.\.\d+) scan their cleanup subplans and hit the same leftover-support sequence, completing the Scaffold Cleaning trace evidence\./i, 'Worker-$1 completes Scaffold Cleaning traces by scanning and removing leftover supports.')
    .replace(/\bworker batch finish assigned placement and high-reach work with the existing Region Construction and Scaffold Construction skills\./i, 'Worker batch uses Region Construction and Scaffold Construction for placement and high-reach work.')
    .replace(/\bworker batch finish remaining mismatch and closure work with Region Replacement where it matches the learned repair workflow\./i, 'Worker batch uses Region Replacement for mismatch and closure repairs.')
    .replace(/\bworker batch remove leftover temporary supports with manual steps; the repeated cleanup sequence becomes Scaffold Cleaning trace evidence\./i, 'Worker batch collects Scaffold Cleaning traces by removing leftover temporary supports.')
    .replace(/\bworker batch scan their cleanup subplans and hit the same leftover-support sequence, completing the Scaffold Cleaning trace evidence\./i, 'Worker batch completes Scaffold Cleaning traces by scanning and removing leftover supports.')
    .replace(/\bwith the same temporary-support step sequence, adding matching Scaffold Construction trace examples\./i, 'with the same temporary-support sequence and add Scaffold Construction traces.')
    .replace(/\brepeat the temporary-support sequence on the remaining elevated targets, giving ProjectManager enough scaffold examples to create the workflow\./i, 'repeat the temporary-support sequence until ProjectManager has enough Scaffold Construction examples.')
    .replace(/\brepair them with the same manual sequence, collecting Region Replacement trace examples\./i, 'collect Region Replacement traces while repairing them with the same sequence.')
    .replace(/\bAll build regions are complete\. Verification now checks the remaining cleanup work\./i, 'All regions are built; verification starts cleanup checks.')
    .replace(/\bStarted final verification against the blueprint\. The checker is looking for leftover temporary supports and cleanup artifacts\./i, 'ProjectManager starts final verification for leftover supports and cleanup artifacts.');
  if (!shouldJoinSentences) return text;
  const parts = text.split(/(?<=[.!?])\s+/g)
    ?.map((part) => part.trim().replace(/[.!?]+$/g, ''))
    .filter(Boolean) || [];
  if (parts.length > 1) text = `${parts.join('; ')}.`;
  return text;
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

function getCompactActorLabel(actor = '') {
  return String(actor || '').trim();
}

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
  return null;
}

function formatTerminalProgressText(progress = {}) {
  return '';
}

function createTerminalProgress(progress = {}) {
  return null;
}

function getEventBatchSummary(event = {}) {
  return event.batchSummary || event.display?.batchSummary || null;
}

function formatSavedPercent(value = 0) {
  const rounded = Math.round((Number(value) || 0) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function getBatchSummaryProgress(summary = {}, event = {}) {
  const progress = getEventProgress(event) || {};
  const total = Number(summary.total || progress.total || 0);
  const current = Number.isFinite(Number(progress.current))
    ? Number(progress.current)
    : Number(summary.current || total);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(current)) return null;
  const ratio = Math.max(0, Math.min(1, current / total));
  return {
    total,
    current: Math.max(0, Math.min(total, current)),
    ratio,
    unit: String(summary.unit || '').trim()
  };
}

function formatBatchSummaryBar(progress = {}) {
  return '';
}

function createBatchSummaryRow(kind = '', item = {}, total = 0) {
  const count = Math.max(0, Number(item.count || 0));
  if (!count || !total) return null;
  const row = document.createElement('span');
  row.className = `chunk-batch-summary-row is-${kind}`;

  const name = document.createElement('span');
  name.className = 'chunk-batch-summary-name';
  name.textContent = cleanToolLanguageForDisplay(item.label || item.name || (kind === 'skill' ? 'Skill' : 'trace'));

  const amount = document.createElement('span');
  amount.className = 'chunk-batch-summary-amount';
  amount.textContent = `${Math.round(count)}/${Math.round(total)} ${item.unit || (kind === 'skill' ? 'tasks' : 'traces')}`;

  const note = document.createElement('span');
  note.className = 'chunk-batch-summary-note';
  if (kind === 'skill') {
    const savedPercent = (count * 0.5 / total) * 100;
    note.textContent = `saved ${formatSavedPercent(savedPercent)}% time`;
  } else {
    note.textContent = item.status || 'collecting';
  }

  if (kind === 'skill') {
    const badge = document.createElement('span');
    badge.className = 'chunk-batch-summary-kind';
    badge.textContent = 'SKILL';
    row.append(badge);
  } else {
    row.classList.add('has-no-kind');
  }
  row.append(name, amount, note);
  return row;
}

function createBatchSummary(summary = {}, event = {}) {
  return null;
}

function getSkillRefForStructuredSubline(line = '', event = {}, log = {}) {
  const lineText = String(line || '').toLowerCase();
  const matchSkill = (text) => Object.entries(SKILL_REGISTRY)
    .find(([, skill]) => {
      const fullName = String(skill.name || '').toLowerCase();
      const cleanName = fullName.replace(/^learned\s+/, '');
      const aliases = Array.isArray(skill.aliases)
        ? skill.aliases.map((alias) => String(alias || '').toLowerCase()).filter(Boolean)
        : [];
      return (fullName && text.includes(fullName))
        || (cleanName && text.includes(cleanName))
        || aliases.some((alias) => text.includes(alias));
    })?.[0] || '';
  const lineMatch = matchSkill(lineText);
  if (lineMatch) return lineMatch;
  const text = [
    log.action,
    ...(Array.isArray(log.highlights) ? log.highlights : [])
  ].join(' ').toLowerCase();
  const contextMatch = matchSkill(text);
  if (contextMatch) return contextMatch;
  return lineMatch || event.skill || event.message?.skillRef || '';
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
      label: getSkillDisplayName(skillRef) || 'Skill',
      skillRef
    };
  }
  if (/^\s*(?:tool call|send message)\b/i.test(text)) {
    return { className: 'is-tool-call', accent: '#9fb0bd', label: 'Action' };
  }
  return { className: 'is-note', accent: '#80918b', label: 'Detail' };
}

function getStructuredFollowupMeta(followup = {}, event = {}, log = {}) {
  if (!followup?.type) return getStructuredSublineMeta(followup?.text || '', event, log);
  if (followup.type === 'tool' || followup.type === 'message') {
    return { className: 'is-tool-call', accent: '#9fb0bd', label: followup.label || 'Action' };
  }
  if (followup.type === 'skill') {
    if (/\bcreate skill\b/i.test(followup.text || '')) {
      return { className: 'is-tool-call', accent: '#9fb0bd', label: followup.label || 'Action' };
    }
    const skillRef = getSkillRefForStructuredSubline(followup.text || '', event, log);
    return {
      className: 'is-skill',
      accent: SKILL_REGISTRY[skillRef]?.accent || '#72ffd1',
      label: getSkillDisplayName(skillRef) || followup.label || 'Skill',
      skillRef
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

function getSkillRefTextForEvent(event = {}) {
  const display = event.display || {};
  const pieces = [
    event.skill,
    event.skillRef,
    event.message?.skillRef,
    display.skill,
    display.skillRef,
    event.logGroup,
    display.logGroup,
    event.learningLabel,
    display.learningLabel,
    event.text,
    display.action,
    display.result,
    ...(Array.isArray(event.highlights) ? event.highlights : []),
    ...(Array.isArray(display.highlights) ? display.highlights : []),
    ...(Array.isArray(display.sublines) ? display.sublines : [])
  ];
  return pieces
    .flatMap((piece) => {
      if (!piece || typeof piece !== 'object') return [piece];
      return Object.values(piece);
    })
    .filter((piece) => piece !== undefined && piece !== null)
    .join(' ');
}

function normalizeSkillMatchText(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/^learned\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function resolveSkillRefForEvent(event = {}) {
  const explicitRef = event.skill || event.skillRef || event.message?.skillRef || event.display?.skill || event.display?.skillRef;
  if (SKILL_REGISTRY[explicitRef]) return explicitRef;

  const normalized = normalizeSkillMatchText(getSkillRefTextForEvent(event));
  if (!normalized) return '';
  return Object.entries(SKILL_REGISTRY)
    .find(([ref, skill]) => {
      const refText = normalizeSkillMatchText(ref);
      const nameText = normalizeSkillMatchText(skill.name);
      const aliasTexts = (Array.isArray(skill.aliases) ? skill.aliases : [])
        .map(normalizeSkillMatchText)
        .filter(Boolean);
      return (refText && normalized.includes(refText))
        || (nameText && normalized.includes(nameText))
        || aliasTexts.some((aliasText) => normalized.includes(aliasText));
    })?.[0] || '';
}

function isLearningLogGroup(event = {}) {
  const groupKey = String(event.logGroup || event.display?.logGroup || '');
  return Boolean(event.learningLabel || event.display?.learningLabel || /^skill-/.test(groupKey));
}

function getLearningLogLabel(event = {}) {
  if (event.learningLabel || event.display?.learningLabel) return event.learningLabel || event.display.learningLabel;
  const groupKey = String(event.logGroup || event.display?.logGroup || '');
  const skill = SKILL_REGISTRY[resolveSkillRefForEvent({ ...event, learningLabel: groupKey })];
  return skill?.name ? `Learning a Reusable Skill: ${skill.name.replace(/^Learned\s+/i, '')}` : 'Learning a Reusable Skill';
}

function appendStructuredLogEntry(node, event, options = {}) {
  const log = createStructuredLogText(event);
  if (!log) return false;
  const showHeader = options.showHeader !== false;
  const entry = document.createElement('span');
  entry.className = `structured-entry${showHeader ? '' : ' is-continuation'}`;
  if (event.sublineOnly || event.display?.sublineOnly) entry.classList.add('is-subline-only');
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
    actor.textContent = `[${getCompactActorLabel(log.actor)}]`;
    main.append(timecode, actor);
  }

  const hasAction = Boolean(String(log.action || '').trim());
  if (hasAction) {
    const action = document.createElement('span');
    action.className = 'structured-action';
    appendHighlightedText(action, compactRuntimeSentence(log.action, event), log.highlights);
    main.append(action);
  }

  if (log.result) {
    const result = document.createElement('span');
    result.className = 'structured-result';
    result.textContent = `→ ${cleanToolLanguageForDisplay(log.result)}`;
    main.append(result);
  }

  const progress = createStructuredProgress(log.progress);
  if (progress) {
    main.append(progress);
  }
  if (showHeader || hasAction || log.result || progress) entry.append(main);

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
        appendHighlightedText(detail, line, getStructuredLineHighlights(line, log.highlights));
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
      appendHighlightedText(body, line, getStructuredLineHighlights(line, log.highlights));
      if (meta.className === 'is-skill') {
        subline.classList.add('has-prefix');
        const prefix = document.createElement('span');
        prefix.className = 'structured-subline-prefix';
        prefix.textContent = 'SKILL';
        const cleanSkillLine = cleanToolLanguageForDisplay(line)
          .replace(/\bLearned\s+(Region Construction|Scaffold Construction|Region Replacement|Scaffold Cleaning)\b/gi, '$1');
        body.replaceChildren();
        appendHighlightedText(body, cleanSkillLine, getStructuredLineHighlights(cleanSkillLine, log.highlights));
        if (meta.skillRef) {
          const icon = document.createElement('span');
          icon.className = 'structured-subline-icon';
          icon.innerHTML = getSkillIconMarkup(meta.skillRef);
          subline.classList.add('has-icon');
          subline.append(arrow, prefix, icon, body);
        } else {
          subline.append(arrow, prefix, body);
        }
      } else {
        subline.append(arrow, body);
      }
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
  const log = createStructuredLogText(event);
  const previousActor = article?.dataset?.logLastActor || '';
  const showHeader = isLearningLogGroup(event) || Boolean(log?.actor && previousActor && log.actor !== previousActor);
  if (!text || !appendStructuredLogEntry(text, event, { showHeader, animate: options.animate === true })) return null;
  if (log?.actor) article.dataset.logLastActor = log.actor;
  updateChatMessageMetadata(article, event, index);
  updateChatMessageProgress(article, event);
  return article;
}

function ensureSkillState(skillRef = '') {
  const ref = String(skillRef || '').trim();
  if (!ref) return null;
  if (!skillState.has(ref)) {
    const skill = SKILL_REGISTRY[ref];
    if (!skill) return null;
    skillState.set(ref, {
      ref,
      ...skill,
      learned: false,
      published: false,
      learnedRoom: '',
      learnedIndex: Number.POSITIVE_INFINITY,
      firstEventIndex: Number.POSITIVE_INFINITY,
      traceCurrent: 0,
      traceTotal: 0,
      traceLabel: '',
      usedRooms: new Set(),
      events: []
    });
  }
  return skillState.get(ref);
}

function resetSkillState() {
  skillState = new Map();
  skillSurfaceTimelineKey = '';
  Object.keys(SKILL_REGISTRY).forEach(ensureSkillState);
  focusedSkillRef = Object.keys(SKILL_REGISTRY)[0] || '';
  renderSkillLibrary();
  renderSkillNotifications();
}

function getSkillEventLabel(kind = '') {
  if (kind === 'skill-detection') return 'Skill learned';
  if (kind === 'skill-broadcast') return 'Skill broadcast';
  if (kind === 'skill-use') return 'Skill reused';
  return 'Skill event';
}

function getSkillDisplayName(skillOrRef = '') {
  const skill = typeof skillOrRef === 'string' ? SKILL_REGISTRY[skillOrRef] : skillOrRef;
  return String(skill?.name || skillOrRef || 'Skill').replace(/^Learned\s+/i, '');
}

function getSkillSchedule(skillRef) {
  return playbackEvents
    .map((event, index) => ({ ...event, index }))
    .filter((event) => (event.skill || event.message?.skillRef) === skillRef);
}

function getSkillLearningRange(skillRef = '') {
  const range = activeDemoProfile?.skillLearningRanges?.[skillRef];
  if (!Array.isArray(range) || range.length < 2) return null;
  const start = parseTimelineTime(range[0]);
  const end = parseTimelineTime(range[1]);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return { start, end };
}

function getSkillUnlockSeconds(skillRef = '') {
  const skill = skillState.get(skillRef);
  if (Number.isFinite(Number(skill?.unlockSeconds))) return Number(skill.unlockSeconds);
  const explicitRange = getSkillLearningRange(skillRef);
  if (explicitRange) return explicitRange.end;
  return Number.POSITIVE_INFINITY;
}

function isSkillUnlockedForTimeline(skill = {}, seconds = currentDemoSeconds) {
  if (!skill?.learned) return false;
  const unlockSeconds = getSkillUnlockSeconds(skill.ref);
  if (!Number.isFinite(unlockSeconds)) return true;
  return Number(seconds) >= unlockSeconds - 0.05;
}

function getUnlockedSkillStates(seconds = currentDemoSeconds) {
  return [...skillState.values()]
    .filter((skill) => isSkillUnlockedForTimeline(skill, seconds))
    .sort((a, b) => {
      const aUnlock = getSkillUnlockSeconds(a.ref);
      const bUnlock = getSkillUnlockSeconds(b.ref);
      const aIndex = Number.isFinite(a.learnedIndex) ? a.learnedIndex : a.firstEventIndex;
      const bIndex = Number.isFinite(b.learnedIndex) ? b.learnedIndex : b.firstEventIndex;
      return (aUnlock || 0) - (bUnlock || 0) || (aIndex || 0) - (bIndex || 0) || a.name.localeCompare(b.name);
    });
}

function getSkillSurfaceTimelineKey(seconds = currentDemoSeconds, activeRef = focusedSkillRef) {
  const visible = getUnlockedSkillStates(seconds)
    .map((skill) => `${skill.ref}:${skill.learned ? 1 : 0}:${skill.published ? 1 : 0}:${skill.traceCurrent || 0}/${skill.traceTotal || 0}`)
    .join('|');
  return `${activeRef || ''}::${visible}`;
}

function syncSkillSurfacesForTimeline(seconds = currentDemoSeconds, options = {}) {
  const isAllowed = updateSkillLibraryTimelineVisibility(seconds);
  const nextKey = getSkillSurfaceTimelineKey(seconds, focusedSkillRef);
  if (!options.force && skillSurfaceTimelineKey === nextKey) return;
  skillSurfaceTimelineKey = nextKey;
  if (!isAllowed) {
    skillNotificationStack?.replaceChildren();
    if (skillNotificationStack) skillNotificationStack.hidden = true;
    renderSkillLibrary(focusedSkillRef, seconds);
    return;
  }
  renderSkillLibrary(focusedSkillRef, seconds);
  renderSkillNotifications(focusedSkillRef, seconds);
}

function updateSkillStateFromEvent(event, index = -1) {
  const skillRef = event?.skill || event?.message?.skillRef;
  const skill = ensureSkillState(skillRef);
  if (!skill) return;

  const kind = event.skillEvent || event.message?.kind || event.type || 'skill-event';
  const stageTitle = event.group?.title || event.stageLabel || 'Build Pools';
  const wasLearned = skill.learned;
  const traceProgress = event.skillProgress || event.display?.skillProgress || null;
  const traceTotal = Number(traceProgress?.total || 0);
  const traceCurrent = Number(traceProgress?.current || 0);
  const hasTraceProgress = Number.isFinite(traceTotal) && traceTotal > 0 && Number.isFinite(traceCurrent);
  if (hasTraceProgress) {
    skill.traceCurrent = Math.max(0, Math.min(traceCurrent, traceTotal));
    skill.traceTotal = traceTotal;
    skill.traceLabel = traceProgress.label || skill.traceLabel || String(skill.name || '').replace(/^Learned\s+/i, '');
  }

  if (kind === 'skill-trace' || kind === 'skill-progress') {
    if (!Number.isFinite(skill.firstEventIndex)) skill.firstEventIndex = Number.isFinite(index) ? index : skill.events.length;
  } else if (kind === 'skill-detection' || String(kind).includes('SKILL◆')) {
    skill.learned = true;
    skill.learnedRoom = stageTitle;
    if (skill.traceTotal) skill.traceCurrent = skill.traceTotal;
  } else if (kind === 'skill-broadcast' || String(kind).includes('SKILL↗')) {
    skill.learned = true;
    skill.published = true;
    if (!skill.learnedRoom) skill.learnedRoom = stageTitle;
    if (skill.traceTotal) skill.traceCurrent = skill.traceTotal;
  } else if (kind === 'skill-use' || String(kind).includes('SKILL')) {
    skill.learned = true;
    skill.published = true;
    if (!skill.learnedRoom) skill.learnedRoom = skill.learnedLabel || stageTitle;
    skill.usedRooms.add(stageTitle);
    if (skill.traceTotal) skill.traceCurrent = skill.traceTotal;
  } else {
    skill.learned = true;
    if (!skill.learnedRoom) skill.learnedRoom = stageTitle;
  }
  if (!wasLearned && skill.learned) skill.learnedIndex = Number.isFinite(index) ? index : skill.events.length;
  if (!wasLearned && skill.learned && !Number.isFinite(Number(skill.unlockSeconds))) {
    const eventSeconds = Number(event.seconds);
    skill.unlockSeconds = Number.isFinite(eventSeconds) ? eventSeconds : currentDemoSeconds;
  }
  if (!Number.isFinite(skill.firstEventIndex)) skill.firstEventIndex = Number.isFinite(index) ? index : skill.events.length;
  focusedSkillRef = skill.ref;
  skill.events.push({ index, kind, room: event.group?.id || `stage-${event.stageId}`, title: stageTitle });
  syncSkillSurfacesForTimeline(currentDemoSeconds, { force: true });
}

function getSkillStatus(skill) {
  if (skill.published) return 'shared';
  if (skill.learned) return 'learned';
  return '';
}

function summarizeRooms(rooms, emptyLabel = 'Waiting') {
  const values = [...rooms];
  if (!values.length) return emptyLabel;
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
  const skill = SKILL_REGISTRY[skillRef];
  if (!skill) return '';
  const src = skill.icon;
  const alt = `${getSkillDisplayName(skill)} icon`;
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">`;
}

function getSkillTraceWindowMarkup(skill) {
  const trace = skill?.trace;
  if (!trace || !Array.isArray(trace.steps) || !trace.steps.length) return '';
  const source = trace.source || 'Worker trace';
  const steps = trace.steps
    .map((step) => `<span>${escapeHtml(cleanToolLanguageForDisplay(step))}</span>`)
    .join('');
  return `
    <span class="skill-trace-window" role="tooltip">
      <span class="skill-trace-title">Trace source · ${escapeHtml(source)}</span>
      <span class="skill-trace-line">[${escapeHtml(source)}] Representative execution</span>
      <span class="skill-trace-steps">${steps}</span>
      <span class="skill-trace-note">${escapeHtml(cleanToolLanguageForDisplay(trace.note || 'Similar workers follow the same trace.'))}</span>
    </span>
  `;
}

function renderSkillLibrary(activeRef = focusedSkillRef, seconds = currentDemoSeconds) {
  if (!skillList || !skillRoute) return;
  const skills = Object.keys(SKILL_REGISTRY).map(ensureSkillState).filter(Boolean);
  const discoveredSkills = skills.filter((skill) => isSkillUnlockedForTimeline(skill, seconds));
  skillLibrary?.classList.toggle('is-empty', discoveredSkills.length === 0);
  const title = skillLibrary?.querySelector('h3');
  if (title) title.textContent = discoveredSkills.length ? `Skill · ${discoveredSkills.length} learned` : 'Skill';
  skillList.replaceChildren();

  discoveredSkills.forEach((skill) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.className = `skill-card${skill.ref === activeRef ? ' active' : ''}`;
    button.type = 'button';
    button.dataset.skillRef = skill.ref;
    button.style.setProperty('--skill-accent', skill.accent || '#72ffd1');
    button.setAttribute('aria-pressed', String(skill.ref === activeRef));
    const learnedFrom = skill.learnedRoom || skill.learnedLabel || 'Waiting';
    const usedBy = summarizeRooms(skill.usedRooms, 'No reuse yet');
    const skillName = getSkillDisplayName(skill);
    button.title = cleanToolLanguageForDisplay(`${skillName}: ${skill.summary} Discovered in ${learnedFrom}. Used by ${usedBy}.`);
    button.innerHTML = `
      <span class="skill-icon">${getSkillIconMarkup(skill.ref)}</span>
      <span class="skill-name">${escapeHtml(skillName)}</span>
      <span class="skill-status">${escapeHtml(getSkillStatus(skill))}</span>
      <span class="skill-detail-grid" aria-label="${escapeHtml(skillName)} sharing details">
        <span class="skill-detail"><b>Discovered in</b><span title="${escapeHtml(learnedFrom)}">${escapeHtml(learnedFrom)}</span></span>
        <span class="skill-detail"><b>Used by</b><span title="${escapeHtml(usedBy)}">${escapeHtml(usedBy)}</span></span>
      </span>
      <span class="skill-share-line">Shown only after repeated traces produce a reusable workflow.</span>
      <span class="skill-jump">Jump to next ${escapeHtml(skillName)} event -></span>
      ${getSkillTraceWindowMarkup(skill)}
    `;
    button.addEventListener('click', () => activateSkillCard(skill.ref));
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

function getSkillProgressRatio(skill) {
  const total = Number(skill?.traceTotal || 0);
  const current = Number(skill?.traceCurrent || 0);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(current)) return 0;
  return Math.max(0, Math.min(1, current / total));
}

function getSkillProgressMarkup(skill) {
  if (!skill?.traceTotal || skill.learned) return '';
  const ratio = getSkillProgressRatio(skill);
  const total = Number(skill.traceTotal || 0);
  const current = Math.max(0, Math.min(Number(skill.traceCurrent || 0), total));
  const percent = Math.round(ratio * 100);
  return `
    <span class="skill-notification-progress" style="--skill-progress: ${percent}%">
      <span class="skill-notification-progress-track" aria-hidden="true"><i></i></span>
      <span class="skill-notification-progress-text">${escapeHtml(String(Math.round(current)))} / ${escapeHtml(String(Math.round(total)))} traces</span>
    </span>
  `;
}

function getSkillLibraryStartSeconds() {
  const ranges = activeDemoProfile?.skillLearningRanges || {};
  const starts = Object.values(ranges)
    .map((range) => Array.isArray(range) ? parseTimelineTime(range[0]) : Number.NaN)
    .filter((value) => Number.isFinite(value));
  if (starts.length) return Math.min(...starts);
  const keyframeStarts = timelineKeyframes
    .filter((keyframe) => keyframe.skill)
    .map((keyframe) => Number(keyframe.demoSeconds))
    .filter((value) => Number.isFinite(value));
  return keyframeStarts.length ? Math.min(...keyframeStarts) : Number.POSITIVE_INFINITY;
}

function isSkillLibraryAllowedForTimeline(seconds = currentDemoSeconds) {
  const startSeconds = getSkillLibraryStartSeconds();
  return Number.isFinite(startSeconds) && Number(seconds) >= startSeconds - 0.05;
}

function updateSkillLibraryTimelineVisibility(seconds = currentDemoSeconds) {
  const isAllowed = isSkillLibraryAllowedForTimeline(seconds);
  document.body.classList.toggle('is-skill-library-active', isAllowed);
  if (!isAllowed && skillNotificationStack) skillNotificationStack.hidden = true;
  return isAllowed;
}

function renderSkillNotifications(activeRef = focusedSkillRef, seconds = currentDemoSeconds) {
  if (!skillNotificationStack) return;
  if (!updateSkillLibraryTimelineVisibility(seconds)) {
    skillNotificationStack.replaceChildren();
    return;
  }
  const visibleSkills = getUnlockedSkillStates(seconds);

  skillNotificationStack.replaceChildren();
  skillNotificationStack.hidden = visibleSkills.length === 0;
  if (!visibleSkills.length) return;

  visibleSkills.forEach((skill) => {
    const item = document.createElement('article');
    const isLearned = Boolean(skill.learned);
    item.className = `skill-notification ${isLearned ? 'is-learned' : 'is-collecting'}${skill.ref === activeRef ? ' is-current' : ''}`;
    item.dataset.skillRef = skill.ref;
    item.tabIndex = 0;
    item.style.setProperty('--skill-accent', skill.accent || '#72ffd1');
    const learnedFrom = skill.learnedRoom || skill.learnedLabel || 'Build Pools';
    const notificationName = getSkillDisplayName(skill);
    const statusText = isLearned ? 'Learned from worker trace' : 'Collecting worker trace';
    item.title = `${notificationName}. ${statusText}. ${learnedFrom}`;
    item.innerHTML = `
      <span class="skill-notification-icon">${getSkillIconMarkup(skill.ref)}</span>
      <span class="skill-notification-body">
        <b><span>${isLearned ? 'SKILL:' : 'TRACE:'}</span> ${escapeHtml(notificationName)}</b>
        <small>${escapeHtml(statusText)}</small>
        ${getSkillProgressMarkup(skill)}
      </span>
      ${isLearned ? getSkillTraceWindowMarkup(skill) : ''}
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

function getChunkProgressState(event = {}) {
  return null;
}

function getProgressRowKey(event = {}) {
  return '';
}

function updateChatMessageProgress(article, event) {
  article.querySelector('.chunk-terminal-progress')?.remove();
  article.querySelector('.chunk-batch-summary')?.remove();
  article.classList.remove('has-chunk-progress', 'has-batch-summary');
  article.style.removeProperty('--chunk-progress');
  delete article.dataset.chunkProgressLabel;
}

function updateChatMessageMetadata(article, event, index) {
  article.dataset.chatStage = String(event.stageId);
  article.dataset.stageFilter = `stage-${event.stageId}`;
  article.dataset.eventKind = event.type || 'EVENT';
  article.dataset.eventIndex = String(index);
  const groupKey = getStructuredLogGroupKey(event);
  if (groupKey) article.dataset.logGroupKey = groupKey;
  else delete article.dataset.logGroupKey;
  if (isLearningLogGroup(event)) {
    article.classList.add('is-learning-chunk');
    article.dataset.learningLabel = getLearningLogLabel(event);
    const learningSkillRef = resolveSkillRefForEvent(event);
    if (learningSkillRef) article.dataset.learningSkillRef = learningSkillRef;
    else delete article.dataset.learningSkillRef;
    const skillAccent = SKILL_REGISTRY[learningSkillRef]?.accent;
    if (skillAccent) article.style.setProperty('--learning-accent', skillAccent);
    else article.style.removeProperty('--learning-accent');
  } else {
    article.classList.remove('is-learning-chunk');
    delete article.dataset.learningLabel;
    delete article.dataset.learningSkillRef;
    article.style.removeProperty('--learning-accent');
  }
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
    article.dataset.logLastActor = structuredLog.actor || '';
  } else {
    appendMentionedText(text, event.text || '');
  }

  if (structuredLog) {
    article.append(text);
  } else {
    article.append(time, badge, text);
  }
  updateChatMessageProgress(article, event);
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
  const behavior = index === 0 || options.instant || isAutoPlaying ? 'auto' : 'smooth';
  chatFeed.scrollTo({ top: chatFeed.scrollHeight, behavior });
  if (options.force || options.instant || isAutoPlaying) {
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
