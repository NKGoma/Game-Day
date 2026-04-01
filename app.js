'use strict';

// ============================================================
// STATE
// ============================================================
const TEAMS = [
  { id: 'red',    label: 'RED',    cssClass: 'team-red'    },
  { id: 'blue',   label: 'BLUE',   cssClass: 'team-blue'   },
  { id: 'green',  label: 'GREEN',  cssClass: 'team-green'  },
  { id: 'yellow', label: 'YELLOW', cssClass: 'team-yellow' },
];

const DEFAULT_GAME_NAMES = [
  'Game 1', 'Game 2', 'Game 3', 'Game 4', 'Game 5',
];

const STORAGE_KEY = 'gameday_scoreboard_v1';

function buildInitialState() {
  return {
    games: DEFAULT_GAME_NAMES.map((name, i) => ({
      id: i,
      name,
      scores: { red: 0, blue: 0, green: 0, yellow: 0 },
    })),
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
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
// DERIVED
// ============================================================
function getTotals() {
  const totals = { red: 0, blue: 0, green: 0, yellow: 0 };
  for (const game of state.games) {
    for (const team of TEAMS) {
      totals[team.id] += (game.scores[team.id] || 0);
    }
  }
  return totals;
}

function getGameWinners(game) {
  const max = Math.max(...TEAMS.map(t => game.scores[t.id] || 0));
  if (max === 0) return [];
  return TEAMS.filter(t => (game.scores[t.id] || 0) === max).map(t => t.id);
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

const RANK_LABELS = ['', '1ST', '2ND', '3RD', '4TH'];

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

// ============================================================
// RENDER — TOTALS BOARD
// ============================================================
function renderTotals() {
  const board = document.getElementById('totals-board');
  const totals = getTotals();
  const leaders = getLeaders(totals);
  const ranks = getRanks(totals);

  board.innerHTML = '';

  for (const team of TEAMS) {
    const isLeader = leaders.includes(team.id);
    const card = el('div', {
      className: `total-card ${team.cssClass}${isLeader ? ' leader' : ''}`,
    });

    const crown = el('div', { className: 'total-crown', textContent: '👑' });
    const dot   = el('div', { className: 'total-team-dot' });
    const name  = el('div', { className: 'total-team-name', textContent: team.label });
    const score = el('div', { className: 'total-score', textContent: totals[team.id] });
    const rank  = el('div', {
      className: 'total-rank',
      textContent: isLeader && leaders.length === 1
        ? '👑 LEADING'
        : (RANK_LABELS[ranks[team.id]] || ''),
    });

    card.append(crown, dot, name, score, rank);
    board.appendChild(card);
  }
}

// ============================================================
// RENDER — GAME CARD
// ============================================================
function renderGameCard(game) {
  const winners = getGameWinners(game);

  const card = el('div', { className: 'game-card', 'data-game-id': game.id });

  // Header
  const header = el('div', { className: 'game-card-header' });
  const num    = el('span', { className: 'game-number', textContent: `GAME ${game.id + 1}` });

  const nameInput = el('input', {
    className: 'game-name-input',
    type: 'text',
    value: game.name,
    placeholder: `Game ${game.id + 1}`,
    maxLength: 30,
    'aria-label': `Game ${game.id + 1} name`,
  });
  nameInput.addEventListener('input', () => {
    game.name = nameInput.value || `Game ${game.id + 1}`;
    saveState();
  });

  const resetBtn = el('button', { className: 'game-reset-btn', textContent: 'RESET', type: 'button' });
  resetBtn.addEventListener('click', () => {
    for (const t of TEAMS) game.scores[t.id] = 0;
    saveState();
    rerenderGame(game);
    renderTotals();
  });

  header.append(num, nameInput, resetBtn);

  // Rows
  const rows = el('div', { className: 'game-rows' });

  for (const team of TEAMS) {
    const isWinner = winners.includes(team.id);
    const row = el('div', {
      className: `team-row ${team.cssClass}${isWinner ? ' winner' : ''}`,
      'data-team': team.id,
    });

    // Label
    const labelWrap = el('div', { className: 'team-label' });
    const bar    = el('div', { className: 'team-color-bar' });
    const tname  = el('div', { className: 'team-name-label', textContent: team.label });
    const badge  = el('span', { className: 'winner-badge', textContent: 'WINNER' });
    labelWrap.append(bar, tname, badge);

    // Score control
    const scoreWrap = el('div', { className: 'score-input-wrap' });

    const minusBtn = el('button', { className: 'score-btn minus', type: 'button', textContent: '−', 'aria-label': `Decrease ${team.label} score` });
    const plusBtn  = el('button', { className: 'score-btn plus',  type: 'button', textContent: '+', 'aria-label': `Increase ${team.label} score` });

    const scoreIn = el('input', {
      className: 'score-input',
      type: 'number',
      min: 0,
      max: 9999,
      value: game.scores[team.id],
      'aria-label': `${team.label} score for game ${game.id + 1}`,
    });

    scoreIn.addEventListener('input', () => {
      const v = parseInt(scoreIn.value, 10);
      game.scores[team.id] = isNaN(v) ? 0 : clamp(v, 0, 9999);
      saveState();
      updateWinnerHighlight(card, game);
      renderTotals();
    });

    scoreIn.addEventListener('blur', () => {
      scoreIn.value = game.scores[team.id];
    });

    plusBtn.addEventListener('click', () => {
      game.scores[team.id] = clamp((game.scores[team.id] || 0) + 1, 0, 9999);
      scoreIn.value = game.scores[team.id];
      bump(scoreIn);
      saveState();
      updateWinnerHighlight(card, game);
      renderTotals();
    });

    minusBtn.addEventListener('click', () => {
      game.scores[team.id] = clamp((game.scores[team.id] || 0) - 1, 0, 9999);
      scoreIn.value = game.scores[team.id];
      bump(scoreIn);
      saveState();
      updateWinnerHighlight(card, game);
      renderTotals();
    });

    scoreWrap.append(minusBtn, scoreIn, plusBtn);
    row.append(labelWrap, scoreWrap);
    rows.appendChild(row);
  }

  card.append(header, rows);
  return card;
}

function bump(element) {
  element.classList.remove('bump');
  void element.offsetWidth; // reflow
  element.classList.add('bump');
}

function updateWinnerHighlight(card, game) {
  const winners = getGameWinners(game);
  const rows = card.querySelectorAll('.team-row');
  rows.forEach(row => {
    const tid = row.dataset.team;
    const isWinner = winners.includes(tid);
    row.classList.toggle('winner', isWinner);
  });
}

// ============================================================
// RENDER — GAMES GRID
// ============================================================
function renderGames() {
  const grid = document.getElementById('games-grid');
  grid.innerHTML = '';
  for (const game of state.games) {
    grid.appendChild(renderGameCard(game));
  }
}

function rerenderGame(game) {
  const grid = document.getElementById('games-grid');
  const existing = grid.querySelector(`[data-game-id="${game.id}"]`);
  const newCard  = renderGameCard(game);
  if (existing) grid.replaceChild(newCard, existing);
}

// ============================================================
// INIT
// ============================================================
function init() {
  renderTotals();
  renderGames();
}

document.addEventListener('DOMContentLoaded', init);
