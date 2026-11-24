import {
  polyfilledBrowser,
  GAMES,
  SPEED_MODES,
  detectGameFromUrl,
  getSettings,
  saveSettings,
  getStats,
  resetTodayStats,
  getTodayKey,
} from './shared/settings.js';

const GAME_SCRIPT_FILES = {
  queens: 'queens.js',
  tango: 'tango.js',
  zip: 'zip.js',
  sudoku: 'sudoku.js',
  patches: 'patches.js',
  wend: 'wend.js',
  sumbreak: 'sumbreak.js',
};

let activeTab = null;
let activeGame = null;
let currentSettings = null;
let currentStats = null;
let isSolving = false;

const els = {
  statusSubtitle: document.getElementById('status-subtitle'),
  dailyCount: document.getElementById('daily-count'),
  progressFill: document.getElementById('progress-fill'),
  heroCard: document.getElementById('hero-card'),
  heroEmoji: document.getElementById('hero-emoji'),
  heroName: document.getElementById('hero-name'),
  heroMeta: document.getElementById('hero-meta'),
  heroBadge: document.getElementById('hero-badge'),
  mainBtn: document.getElementById('main-action-btn'),
  mainBtnIcon: document.getElementById('main-btn-icon'),
  mainBtnLabel: document.getElementById('main-btn-label'),
  mainBtnKbd: document.getElementById('main-btn-kbd'),
  feedbackBanner: document.getElementById('feedback-banner'),
  gamesGrid: document.getElementById('games-grid'),
  nextGameBtn: document.getElementById('next-game-btn'),
  speedDesc: document.getElementById('speed-desc'),
  speedBtns: Array.from(document.querySelectorAll('.seg-btn')),
  totalSolvedText: document.getElementById('total-solved-text'),
  resetTodayBtn: document.getElementById('reset-today-btn'),
  toggles: {
    autoSolve: document.getElementById('toggle-autoSolve'),
    autoStart: document.getElementById('toggle-autoStart'),
    showHud: document.getElementById('toggle-showHud'),
    shortcutEnabled: document.getElementById('toggle-shortcutEnabled'),
  },
};

async function init() {
  const [tabs, settings, stats] = await Promise.all([
    polyfilledBrowser.tabs.query({ active: true, currentWindow: true }),
    getSettings(),
    getStats(),
  ]);

  activeTab = tabs?.[0] || null;
  activeGame = detectGameFromUrl(activeTab?.url || '');
  currentSettings = settings;
  currentStats = stats;

  bindEvents();
  renderAll();
}

function bindEvents() {
  els.mainBtn.addEventListener('click', async () => {
    if (activeGame && activeTab) {
      await runSolveOnActiveTab();
    } else {
      await openNextUnsolvedGame();
    }
  });

  els.nextGameBtn.addEventListener('click', () => openNextUnsolvedGame());

  els.speedBtns.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const speedMode = btn.dataset.speed;
      currentSettings = await saveSettings({ speedMode });
      renderSpeed();
    });
  });

  for (const [key, input] of Object.entries(els.toggles)) {
    input.addEventListener('change', async () => {
      currentSettings = await saveSettings({ [key]: input.checked });
      renderHero();
    });
  }

  els.resetTodayBtn.addEventListener('click', async () => {
    currentStats = await resetTodayStats();
    renderStatsAndGames();
    showFeedback('Progression du jour réinitialisée.', false);
  });
}

function renderAll() {
  renderHero();
  renderStatsAndGames();
  renderSpeed();
  renderToggles();
}

function renderHero() {
  if (activeGame) {
    els.heroCard.classList.add('active-game');
    els.heroEmoji.textContent = activeGame.emoji;
    els.heroName.textContent = activeGame.name;
    const todayMap = currentStats?.daily?.[getTodayKey()] || {};
    const todayMs = todayMap[activeGame.id];
    els.heroMeta.textContent = todayMs != null
      ? `Déjà résolu aujourd'hui (${todayMs} ms)`
      : 'Jeu LinkedIn détecté sur cet onglet';
    els.heroBadge.textContent = 'Prêt';
    els.heroBadge.className = 'status-badge ready';
    els.statusSubtitle.textContent = `${activeGame.name} actif`;

    els.mainBtn.disabled = isSolving;
    if (isSolving) {
      els.mainBtnIcon.innerHTML = '<span class="spinner-inline"></span>';
      els.mainBtnLabel.textContent = 'Résolution en cours...';
    } else {
      els.mainBtnIcon.textContent = '⚡';
      els.mainBtnLabel.textContent = `Résoudre ${activeGame.name}`;
    }
    els.mainBtnKbd.classList.toggle('hidden', !currentSettings?.shortcutEnabled);
  } else {
    els.heroCard.classList.remove('active-game');
    els.heroEmoji.textContent = '🎯';
    els.heroName.textContent = 'Prêt pour les jeux du jour';
    els.heroMeta.textContent = 'Ouvre un jeu ci-dessous pour le résoudre en 1 clic';
    els.heroBadge.textContent = 'Hors jeu';
    els.heroBadge.className = 'status-badge';
    els.statusSubtitle.textContent = '7 jeux LinkedIn';

    els.mainBtn.disabled = false;
    const nextGame = getNextUnsolvedGame();
    els.mainBtnIcon.textContent = '🚀';
    els.mainBtnLabel.textContent = `Lancer ${nextGame.name}`;
    els.mainBtnKbd.classList.add('hidden');
  }
}

function renderStatsAndGames() {
  const todayMap = currentStats?.daily?.[getTodayKey()] || {};
  const doneCount = GAMES.filter((g) => todayMap[g.id] != null).length;
  els.dailyCount.textContent = `${doneCount}/${GAMES.length}`;
  els.progressFill.style.width = `${Math.round((doneCount / GAMES.length) * 100)}%`;
  els.totalSolvedText.textContent = `Total résolus : ${currentStats?.totalSolved || 0}`;

  els.gamesGrid.innerHTML = '';
  for (const game of GAMES) {
    const doneMs = todayMap[game.id];
    const isCurrent = activeGame?.id === game.id;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `game-card ${isCurrent ? 'current' : ''}`;
    card.style.setProperty('--game-color', game.color);
    card.innerHTML = `
      <div class="game-card-icon">${game.emoji}</div>
      <div class="game-card-info">
        <div class="game-card-name">${game.name}</div>
        <div class="game-card-sub ${doneMs != null ? 'done' : ''}">
          ${doneMs != null ? `✓ ${doneMs} ms` : (isCurrent ? 'Onglet actif' : 'À faire')}
        </div>
      </div>
    `;
    card.addEventListener('click', () => openGameUrl(game.url));
    els.gamesGrid.appendChild(card);
  }
}

function renderSpeed() {
  const mode = currentSettings?.speedMode || 'turbo';
  els.speedDesc.textContent = SPEED_MODES[mode]?.desc || '';
  els.speedBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.speed === mode);
  });
}

function renderToggles() {
  for (const [key, input] of Object.entries(els.toggles)) {
    input.checked = Boolean(currentSettings?.[key]);
  }
}

function showFeedback(text, isError = false) {
  els.feedbackBanner.textContent = text;
  els.feedbackBanner.className = `feedback-banner${isError ? ' error' : ''}`;
}

function getNextUnsolvedGame() {
  const todayMap = currentStats?.daily?.[getTodayKey()] || {};
  const candidates = GAMES.filter((g) => todayMap[g.id] == null && g.id !== activeGame?.id);
  if (candidates.length > 0) return candidates[0];
  const anyOther = GAMES.find((g) => g.id !== activeGame?.id);
  return anyOther || GAMES[0];
}

async function openNextUnsolvedGame() {
  const next = getNextUnsolvedGame();
  await openGameUrl(next.url);
}

async function openGameUrl(url) {
  try {
    const isLinkedIn = (activeTab?.url || '').includes('linkedin.com');
    if (isLinkedIn && activeTab?.id != null) {
      await polyfilledBrowser.tabs.update(activeTab.id, { url });
    } else {
      await polyfilledBrowser.tabs.create({ url });
    }
    window.close();
  } catch (err) {
    showFeedback(`Erreur d'ouverture : ${err.message}`, true);
  }
}

async function ensureContentScriptInjected(tabId, gameId) {
  try {
    const ping = await polyfilledBrowser.tabs.sendMessage(tabId, { type: 'LG_TURBO_PING' });
    if (ping?.ok) return;
  } catch (_e) {
    // Not injected yet
  }
  try {
    await polyfilledBrowser.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ['pageReader.js'],
      world: 'MAIN',
    });
  } catch (_e) {
    console.warn('[LG Turbo] Page reader injection failed');
  }
  const scriptFile = GAME_SCRIPT_FILES[gameId];
  if (scriptFile) {
    await polyfilledBrowser.scripting.executeScript({
      target: { tabId },
      files: [scriptFile],
    });
  }
}

async function runSolveOnActiveTab() {
  if (isSolving || !activeTab || !activeGame) return;
  isSolving = true;
  renderHero();
  els.feedbackBanner.classList.add('hidden');

  try {
    await ensureContentScriptInjected(activeTab.id, activeGame.id);
    const response = await polyfilledBrowser.tabs.sendMessage(activeTab.id, {
      type: 'LG_TURBO_SOLVE',
      options: {
        speedMode: currentSettings.speedMode,
        autoStart: currentSettings.autoStart,
      },
    });

    if (response?.success) {
      currentStats = await getStats();
      showFeedback(`✅ ${activeGame.name} résolu en ${response.durationMs} ms !`, false);
      renderStatsAndGames();
    } else {
      showFeedback(`⚠️ ${response?.error || 'Impossible de résoudre. Lance la grille puis réessaie.'}`, true);
    }
  } catch (err) {
    showFeedback(`⚠️ ${err?.message || 'Erreur de communication avec la page.'}`, true);
  } finally {
    isSolving = false;
    renderHero();
  }
}

init();
