// CraftUtopia demo utils.
function updateUiScale() {
  const viewport = window.visualViewport || window;
  const viewportWidth = viewport.width || window.innerWidth;
  const viewportHeight = viewport.height || window.innerHeight;
  const rawScale = Math.min(viewportWidth / DESIGN_WIDTH, viewportHeight / DESIGN_HEIGHT);
  const isCompact = viewportWidth <= COMPACT_BREAKPOINT;
  const minScale = isCompact ? 0.82 : 0.74;
  const scale = Math.min(Math.max(rawScale, minScale), 1.45);
  root.style.setProperty('--ui-scale', scale.toFixed(4));
}

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const titleCase = (value = '') => String(value)
  .split(/(\s+|-)/)
  .map((part) => (/^\w/.test(part) ? part.charAt(0).toUpperCase() + part.slice(1) : part))
  .join('');

function addMentionTerm(terms, term, accent) {
  const cleaned = String(term || '').trim();
  if (cleaned.length < 3) return;
  terms.set(cleaned.toLowerCase(), { term: cleaned, accent });
}

function buildMentionIndex(groups) {
  const terms = new Map();
  [
    ['User', '#ffcf66'],
    ['System Bot', '#72ffd1'],
    ['ProjectManager', '#ffd987'],
    ['Project Manager', '#ffd987'],
    ['Designer', '#f6a5ff'],
    ['TRELLIS', '#74d6c4'],
    ['Foreman-A', '#ffd987'],
    ['Foreman-B', '#9ddcff'],
    ['Foreman-C', '#f06f9f'],
    ['Foreman-D', '#a7ff83'],
    ['Foreman-E', '#ffb66e'],
    ['Worker-001', '#72ffd1'],
    ['Worker-047', '#f06f9f'],
    ['Worker-100', '#ffb66e'],
    ['Region-A', '#ffd987'],
    ['Region-B', '#9ddcff'],
    ['Region-C', '#f06f9f'],
    ['Region-D', '#a7ff83'],
    ['Region-E', '#ffb66e'],
    ['Skill Library', '#72ffd1'],
    ['Shared Skill Library', '#72ffd1']
  ].forEach(([term, accent]) => addMentionTerm(terms, term, accent));
  groups.forEach((group) => {
    Object.entries(group.agents || {}).forEach(([key, agent]) => {
      const accent = agent.accent || '#ffd987';
      addMentionTerm(terms, agent.name, accent);
      addMentionTerm(terms, key, accent);
      addMentionTerm(terms, titleCase(key.replace(/-/g, ' ')), accent);
      addMentionTerm(terms, titleCase(key), accent);

      const foremanMatch = key.match(/^foreman-([a-z])$/);
      if (foremanMatch) addMentionTerm(terms, `Foreman-${foremanMatch[1].toUpperCase()}`, accent);

      const workerMatch = key.match(/^worker-(\d+)$/);
      if (workerMatch) addMentionTerm(terms, `Worker-${workerMatch[1]}`, accent);

      if (key === 'system-bot') addMentionTerm(terms, 'System Bot', accent);
      if (key === 'project-manager') addMentionTerm(terms, 'Project Manager', accent);
      if (key === 'skill-library') {
        addMentionTerm(terms, 'Skill Library', accent);
        addMentionTerm(terms, 'Shared Skill Library', accent);
      }
    });
  });
  Object.values(SKILL_REGISTRY).forEach((skill) => {
    addMentionTerm(terms, skill.name, skill.accent || '#72ffd1');
    addMentionTerm(terms, skill.name.replace(/_/g, ' '), skill.accent || '#72ffd1');
    addMentionTerm(terms, 'Skill Scheduler', '#72ffd1');
  });

  mentionAccentByTerm.clear();
  [...terms.values()].forEach(({ term, accent }) => mentionAccentByTerm.set(term.toLowerCase(), accent));
  const pattern = [...terms.values()]
    .map(({ term }) => escapeRegExp(term))
    .sort((a, b) => b.length - a.length)
    .join('|');
  mentionRegex = pattern ? new RegExp(`(^|[^A-Za-z0-9_-])(${pattern})(?=$|[^A-Za-z0-9_-])`, 'gi') : null;
}

function appendMentionedText(node, value = '') {
  const text = cleanToolLanguageForDisplay(value);
  node.replaceChildren();
  if (!mentionRegex) {
    node.textContent = text;
    return;
  }

  mentionRegex.lastIndex = 0;
  let cursor = 0;
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    const prefix = match[1] || '';
    const mention = match[2] || '';
    const mentionStart = match.index + prefix.length;
    const mentionEnd = mentionStart + mention.length;
    if (mentionStart > cursor) node.append(document.createTextNode(text.slice(cursor, mentionStart)));

    const span = document.createElement('span');
    span.className = 'agent-mention';
    span.style.setProperty('--mention-accent', mentionAccentByTerm.get(mention.toLowerCase()) || '#ffd987');
    span.textContent = mention;
    node.append(span);
    cursor = mentionEnd;
  }

  if (cursor < text.length) node.append(document.createTextNode(text.slice(cursor)));
}

function cleanToolLanguageForDisplay(value = '') {
  return String(value || '')
    .replace(/\btool_call\s*:\s*/gi, '')
    .replace(/\bTool\s+call\s+/gi, '')
    .replace(/\bTool\s+trace\s*:/gi, 'trace:')
    .replace(/\btools?\s+trace\b/gi, 'trace')
    .replace(/\bbasic-tools?\b/gi, 'manual')
    .replace(/\bbasic\s+tools\b/gi, 'manual steps')
    .replace(/\bwith\s+tools\b/gi, 'manually')
    .replace(/\btools?\s+sequence\b/gi, 'step sequence')
    .replace(/\btools?\s+execution\b/gi, 'execution')
    .replace(/\btools?\b/gi, 'steps');
}
