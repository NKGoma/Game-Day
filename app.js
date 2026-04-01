'use strict';

// ============================================================
// CONSTANTS
// ============================================================
const TEAMS = [
  { id: 'red',    label: 'RED',    cssClass: 'team-red'    },
  { id: 'blue',   label: 'BLUE',   cssClass: 'team-blue'   },
  { id: 'green',  label: 'GREEN',  cssClass: 'team-green'  },
  { id: 'yellow', label: 'YELLOW', cssClass: 'team-yellow' },
];

const CATEGORIES = [
  { name: 'Creative',           icon: '🎨' },
  { name: 'General Knowledge',  icon: '🧠' },
  { name: 'Logical',            icon: '🔢' },
  { name: 'Physical',           icon: '💪' },
  { name: 'Talent Show',        icon: '🎭' },
];

const MINI_GAMES = [
  { name: 'Whiteboard',   type: 'whiteboard', icon: '🖊️' },
  { name: 'Level Choice', type: 'level',      icon: '🎯' },
  { name: 'Buzzer',       type: 'buzzer',     icon: '🔔' },
];

const SCORE_MAX = 10;
const JOKER_BONUS = 15;
const STORAGE_KEY = 'gameday_scoreboard_v2';

// ============================================================
// STATE BUILDER
// ============================================================
function buildInitialState() {
  return {
    categories: CATEGORIES.map((cat, ci) => ({
      id: ci,
      name: cat.name,
      miniGames: MINI_GAMES.map((mg, mgi) => ({
        id: mgi,
        name: mg.name,
        type: mg.type,
        scores: { red: 0, blue: 0, green: 0, yellow: 0 },
      })),
    })),
    jokers: { red: null, blue: null, green: null, yellow: null },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Validate basic structure
      if (parsed.categories && parsed.jokers) return parsed;
    }
  } catch (_) { /* ignore */ }
  return buildInitialState();
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) { /* ignore */ }
}

let state = loadState();

// ============================================================
// DERIVED / COMPUTED
// ============================================================
function getCategoryScore(cat, teamId) {
  return cat.miniGames.reduce((sum, mg) => sum + (mg.scores[teamId] || 0), 0);
}

function getCategoryWinners(cat) {
  const scores = TEAMS.map(t => getCategoryScore(cat, t.id));
  const max = Math.max(...scores);
  if (max === 0) return [];
  return TEAMS.filter((t, i) => scores[i] === max).map(t => t.id);
}

function getMiniGameWinners(mg) {
  const scores = TEAMS.map(t => mg.scores[t.id] || 0);
  const max = Math.max(...scores);
  if (max === 0) return [];
  return TEAMS.filter((t, i) => scores[i] === max).map(t => t.id);
}

function getJokerBonus(teamId) {
  const jokerCatId = state.jokers[teamId];
  if (jokerCatId === null || jokerCatId === undefined) return 0;
  const cat = state.categories[jokerCatId];
  if (!cat) return 0;
  const winners = getCategoryWinners(cat);
  return winners.includes(teamId) ? JOKER_BONUS : 0;
}

function getTeamTotal(teamId) {
  const catSum = state.categories.reduce((s, cat) => s + getCategoryScore(cat, teamId), 0);
  return catSum + getJokerBonus(teamId);
}

function getAllTotals() {
  const t = {};
  for (const team of TEAMS) t[team.id] = getTeamTotal(team.id);
  return t;
}

function getLeaders(totals) {
  const max = Math.max(...Object.values(totals));
  if (max === 0) return [];
  return TEAMS.filter(t => totals[t.id] === max).map(t => t.id);
}

function getRanks(totals) {
  const sorted = [...TEAMS].sort((a, b) => totals[b.id] - totals[a.id]);
  const ranks = {};
  let rank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && totals[sorted[i].id] < totals[sorted[i - 1].id]) rank = i + 1;
    ranks[sorted[i].id] = rank;
  }
  return ranks;
}

const RANK_LABELS = { 1: '1ST', 2: '2ND', 3: '3RD', 4: '4TH' };

// ============================================================
// DOM HELPERS
// ============================================================
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'className') node.className = v;
    else if (k === 'textContent') node.textContent = v;
    else if (k.startsWith('data-')) node.setAttribute(k, v);
    else node[k] = v;
  }
  for (const child of children) {
    if (child == null) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function bump(element) {
  element.classList.remove('bump');
  void element.offsetWidth;
  element.classList.add('bump');
}

// ============================================================
// RENDER — TOTALS BOARD
// ============================================================
function renderTotals() {
  const board = document.getElementById('totals-board');
  const totals = getAllTotals();
  const leaders = getLeaders(totals);
  const ranks = getRanks(totals);

  board.innerHTML = '';

  for (const team of TEAMS) {
    const isLeader = leaders.includes(team.id);
    const bonus = getJokerBonus(team.id);

    const card = el('div', {
      className: `total-card ${team.cssClass}${isLeader ? ' leader' : ''}`,
    });

    const crown   = el('div', { className: 'total-crown', textContent: '👑' });
    const dot     = el('div', { className: 'total-team-dot' });
    const name    = el('div', { className: 'total-team-name', textContent: team.label });
    const score   = el('div', { className: 'total-score', textContent: totals[team.id] });
    const maxPts  = el('div', { className: 'total-max', textContent: '/ 165' });
    const jokerBn = el('div', {
      className: `total-joker-bonus${bonus > 0 ? ' active' : ''}`,
      textContent: `🃏 +${JOKER_BONUS} JOKER`,
    });
    const rank = el('div', {
      className: 'total-rank',
      textContent: isLeader && leaders.length === 1
        ? '👑 LEADING'
        : (RANK_LABELS[ranks[team.id]] || ''),
    });

    card.append(crown, dot, name, score, maxPts, jokerBn, rank);
    board.appendChild(card);
  }
}

// ============================================================
// RENDER — CATEGORIES
// ============================================================
function renderCategories() {
  const container = document.getElementById('categories-container');
  container.innerHTML = '';
  for (const cat of state.categories) {
    container.appendChild(renderCategoryCard(cat));
  }
}

// ---- Category Card ----
function renderCategoryCard(cat) {
  const catDef = CATEGORIES[cat.id] || { icon: '📋' };
  const card = el('div', { className: 'category-card', 'data-cat-id': cat.id });

  card.appendChild(renderCategoryHeader(cat, catDef));
  card.appendChild(renderJokerRow(cat));
  card.appendChild(renderMiniGamesTable(cat));

  return card;
}

// ---- Category Header ----
function renderCategoryHeader(cat, catDef) {
  const header = el('div', { className: 'category-header' });

  const num = el('span', {
    className: 'cat-number',
    textContent: `CAT ${cat.id + 1}`,
  });

  const icon = el('span', {
    className: 'cat-icon',
    textContent: (catDef || CATEGORIES[cat.id] || { icon: '📋' }).icon,
  });

  const nameInput = el('input', {
    className: 'cat-name-input',
    type: 'text',
    value: cat.name,
    placeholder: `Category ${cat.id + 1}`,
    maxLength: 30,
    'aria-label': `Category ${cat.id + 1} name`,
  });
  nameInput.addEventListener('input', () => {
    cat.name = nameInput.value || `Category ${cat.id + 1}`;
    saveState();
  });

  const badges = buildCategoryBadges(cat);

  const resetBtn = el('button', { className: 'cat-reset-btn', textContent: 'RESET', type: 'button' });
  resetBtn.addEventListener('click', () => {
    for (const mg of cat.miniGames) {
      for (const t of TEAMS) mg.scores[t.id] = 0;
    }
    saveState();
    rerenderCategoryCard(cat);
    renderTotals();
  });

  header.append(num, icon, nameInput, badges, resetBtn);
  return header;
}

function buildCategoryBadges(cat) {
  const winners = getCategoryWinners(cat);
  const wrap = el('div', { className: 'cat-team-scores', 'data-cat-badges': cat.id });
  for (const team of TEAMS) {
    const isWinner = winners.includes(team.id);
    const badge = el('div', {
      className: `cat-score-badge ${team.cssClass}${isWinner ? ' cat-winner' : ''}`,
      'data-badge-team': team.id,
    });
    const val   = el('span', { className: 'badge-val', textContent: getCategoryScore(cat, team.id) });
    const label = el('span', { className: 'badge-label', textContent: team.label });
    badge.append(val, label);
    wrap.appendChild(badge);
  }
  return wrap;
}

// ---- Joker Row ----
function renderJokerRow(cat) {
  const row = el('div', { className: 'joker-row', 'data-joker-row': cat.id });

  const label = el('span', { className: 'joker-row-label', textContent: '🃏 JOKER:' });

  const btnsWrap = el('div', { className: 'joker-btns' });
  for (const team of TEAMS) {
    btnsWrap.appendChild(buildJokerBtn(team, cat));
  }

  const bonusTag = buildJokerBonusTag(cat);

  row.append(label, btnsWrap, bonusTag);
  return row;
}

function buildJokerBtn(team, cat) {
  const jokerCatId = state.jokers[team.id];
  const isActive = jokerCatId === cat.id;
  const usedElsewhere = jokerCatId !== null && jokerCatId !== undefined && jokerCatId !== cat.id;

  let btnText, extraClass;
  if (isActive) {
    btnText = `${team.label} ACTIVE`;
    extraClass = 'active';
  } else if (usedElsewhere) {
    btnText = `${team.label} USED`;
    extraClass = 'used-elsewhere';
  } else {
    btnText = `${team.label} DECLARE`;
    extraClass = '';
  }

  const btn = el('button', {
    className: `joker-btn ${team.cssClass}${extraClass ? ' ' + extraClass : ''}`,
    type: 'button',
    disabled: usedElsewhere,
    'data-joker-team': team.id,
    'aria-label': `${team.label} joker for category ${cat.id + 1}`,
  });

  const icon = el('span', { className: 'jb-icon', textContent: '🃏' });
  const txt  = el('span', { textContent: btnText });
  btn.append(icon, txt);

  if (!usedElsewhere) {
    btn.addEventListener('click', () => {
      // Toggle: if active → remove, else → declare
      if (state.jokers[team.id] === cat.id) {
        state.jokers[team.id] = null;
      } else {
        state.jokers[team.id] = cat.id;
      }
      saveState();
      updateAllJokerRows();
      renderTotals();
    });
  }

  return btn;
}

function buildJokerBonusTag(cat) {
  const activeJokerTeams = TEAMS.filter(t => state.jokers[t.id] === cat.id);
  const catWinners = getCategoryWinners(cat);
  const earners = activeJokerTeams.filter(t => catWinners.includes(t.id));

  const visible = earners.length > 0;
  const tag = el('div', {
    className: `joker-bonus-tag${visible ? ' visible' : ''}`,
    'data-bonus-tag': cat.id,
  });
  tag.innerHTML = `🏆 +${JOKER_BONUS} BONUS${earners.length > 1 ? 'ES' : ''}: ${earners.map(t => t.label).join(' & ')}`;
  if (!visible) tag.textContent = '';
  return tag;
}

// ---- Mini-Games Table ----
function renderMiniGamesTable(cat) {
  const table = el('div', { className: 'mini-games-table' });

  // Header row
  const headerRow = el('div', { className: 'mini-games-header' });
  headerRow.appendChild(el('div', { className: 'mgh-empty' }));
  for (const team of TEAMS) {
    const th = el('div', { className: `mgh-team ${team.cssClass}` });
    const dot = el('div', { className: 'mgh-dot' });
    const lbl = el('span', { textContent: team.label });
    th.append(dot, lbl);
    headerRow.appendChild(th);
  }
  table.appendChild(headerRow);

  // Mini-game rows
  for (const mg of cat.miniGames) {
    table.appendChild(renderMiniGameRow(cat, mg));
  }

  return table;
}

function renderMiniGameRow(cat, mg) {
  const mgDef = MINI_GAMES[mg.id] || { icon: '📋' };
  const winners = getMiniGameWinners(mg);

  const row = el('div', { className: 'mini-game-row', 'data-mg-id': mg.id });

  // Label cell
  const label = el('div', { className: 'mg-label' });
  const typeIcon = el('span', { className: 'mg-type-icon', textContent: mgDef.icon });
  const nameInput = el('input', {
    className: 'mg-name-input',
    type: 'text',
    value: mg.name,
    placeholder: mgDef.name,
    maxLength: 25,
    'aria-label': `Mini-game ${mg.id + 1} name`,
  });
  nameInput.addEventListener('input', () => {
    mg.name = nameInput.value || mgDef.name;
    saveState();
  });
  label.append(typeIcon, nameInput);
  row.appendChild(label);

  // Score cells per team
  for (const team of TEAMS) {
    row.appendChild(buildScoreCell(cat, mg, team, winners));
  }

  return row;
}

function buildScoreCell(cat, mg, team, winners) {
  const isWinner = winners.includes(team.id);
  const cell = el('div', {
    className: `mg-score-cell ${team.cssClass}${isWinner ? ' winner-cell' : ''}`,
    'data-score-cell': `${cat.id}-${mg.id}-${team.id}`,
  });

  const minus = el('button', {
    className: 'mg-score-btn minus',
    type: 'button',
    textContent: '−',
    'aria-label': `Decrease ${team.label} score`,
  });

  const input = el('input', {
    className: 'mg-score-input',
    type: 'number',
    min: 0,
    max: SCORE_MAX,
    value: mg.scores[team.id] || 0,
    'aria-label': `${team.label} score`,
  });

  const plus = el('button', {
    className: 'mg-score-btn plus',
    type: 'button',
    textContent: '+',
    'aria-label': `Increase ${team.label} score`,
  });

  const winIcon = el('span', { className: 'mg-winner-icon', textContent: '★' });

  function applyScore(val) {
    const clamped = clamp(val, 0, SCORE_MAX);
    mg.scores[team.id] = clamped;
    input.value = clamped;
    saveState();
    // Update the whole row winner highlights
    updateMiniGameRow(cell.closest('.mini-game-row'), mg);
    // Update category header badges
    updateCategoryBadges(cat);
    // Update joker bonus tag
    updateJokerBonusTag(cat);
    // Re-render totals
    renderTotals();
  }

  input.addEventListener('input', () => {
    const v = parseInt(input.value, 10);
    applyScore(isNaN(v) ? 0 : v);
  });
  input.addEventListener('blur', () => {
    input.value = mg.scores[team.id];
  });
  plus.addEventListener('click', () => {
    bump(input);
    applyScore((mg.scores[team.id] || 0) + 1);
  });
  minus.addEventListener('click', () => {
    bump(input);
    applyScore((mg.scores[team.id] || 0) - 1);
  });

  cell.append(minus, input, plus, winIcon);
  return cell;
}

// ============================================================
// PARTIAL UPDATES (avoid full re-renders where possible)
// ============================================================

function updateMiniGameRow(rowEl, mg) {
  if (!rowEl) return;
  const winners = getMiniGameWinners(mg);
  const cells = rowEl.querySelectorAll('.mg-score-cell');
  cells.forEach(cell => {
    // Extract team id from data attribute
    const cellKey = cell.getAttribute('data-score-cell') || '';
    const teamId = cellKey.split('-')[2];
    const isWinner = winners.includes(teamId);
    const team = TEAMS.find(t => t.id === teamId);
    if (!team) return;
    cell.className = `mg-score-cell ${team.cssClass}${isWinner ? ' winner-cell' : ''}`;
  });
}

function updateCategoryBadges(cat) {
  const container = document.getElementById('categories-container');
  const card = container && container.querySelector(`[data-cat-id="${cat.id}"]`);
  if (!card) return;
  const badgesWrap = card.querySelector(`[data-cat-badges="${cat.id}"]`);
  if (!badgesWrap) return;
  const winners = getCategoryWinners(cat);
  for (const team of TEAMS) {
    const badge = badgesWrap.querySelector(`[data-badge-team="${team.id}"]`);
    if (!badge) continue;
    const isWinner = winners.includes(team.id);
    badge.className = `cat-score-badge ${team.cssClass}${isWinner ? ' cat-winner' : ''}`;
    const val = badge.querySelector('.badge-val');
    if (val) val.textContent = getCategoryScore(cat, team.id);
  }
}

function updateJokerBonusTag(cat) {
  const container = document.getElementById('categories-container');
  const card = container && container.querySelector(`[data-cat-id="${cat.id}"]`);
  if (!card) return;
  const tag = card.querySelector(`[data-bonus-tag="${cat.id}"]`);
  if (!tag) return;

  const activeJokerTeams = TEAMS.filter(t => state.jokers[t.id] === cat.id);
  const catWinners = getCategoryWinners(cat);
  const earners = activeJokerTeams.filter(t => catWinners.includes(t.id));

  if (earners.length > 0) {
    tag.className = 'joker-bonus-tag visible';
    tag.innerHTML = `🏆 +${JOKER_BONUS} BONUS${earners.length > 1 ? 'ES' : ''}: ${earners.map(t => t.label).join(' & ')}`;
  } else {
    tag.className = 'joker-bonus-tag';
    tag.textContent = '';
  }
}

function updateAllJokerRows() {
  // Rebuild all joker rows in all category cards
  const container = document.getElementById('categories-container');
  if (!container) return;
  for (const cat of state.categories) {
    const card = container.querySelector(`[data-cat-id="${cat.id}"]`);
    if (!card) continue;
    const oldJokerRow = card.querySelector('.joker-row');
    const newJokerRow = renderJokerRow(cat);
    if (oldJokerRow) card.replaceChild(newJokerRow, oldJokerRow);
  }
}

function rerenderCategoryCard(cat) {
  const container = document.getElementById('categories-container');
  const existing = container.querySelector(`[data-cat-id="${cat.id}"]`);
  const fresh = renderCategoryCard(cat);
  if (existing) container.replaceChild(fresh, existing);
}

// ============================================================
// INIT
// ============================================================
function init() {
  renderTotals();
  renderCategories();
}

document.addEventListener('DOMContentLoaded', init);
