export const polyfilledBrowser = (typeof browser !== 'undefined') ? browser : chrome;

export const GAMES = [
  {
    id: 'queens',
    name: 'Queens',
    shortName: 'Queens',
    emoji: '👑',
    color: '#A855F7',
    url: 'https://www.linkedin.com/games/queens/',
    legacyFn: 'queensPopupButtonOnClick',
    matches: (url) => url.includes('linkedin.com/games/queens'),
  },
  {
    id: 'tango',
    name: 'Tango',
    shortName: 'Tango',
    emoji: '☀️',
    color: '#F59E0B',
    url: 'https://www.linkedin.com/games/tango/',
    legacyFn: 'tangoPopupButtonOnClick',
    matches: (url) => url.includes('linkedin.com/games/tango'),
  },
  {
    id: 'zip',
    name: 'Zip',
    shortName: 'Zip',
    emoji: '⚡',
    color: '#FB7185',
    url: 'https://www.linkedin.com/games/zip/',
    legacyFn: 'zipPopupButtonOnClick',
    matches: (url) => url.includes('linkedin.com/games/zip'),
  },
  {
    id: 'sudoku',
    name: 'Mini Sudoku',
    shortName: 'Sudoku',
    emoji: '🔢',
    color: '#10B981',
    url: 'https://www.linkedin.com/games/mini-sudoku/',
    legacyFn: 'sudokuPopupButtonOnClick',
    matches: (url) =>
      url.includes('linkedin.com/games/sudo') ||
      url.includes('linkedin.com/games/mini-sudo') ||
      url.includes('linkedin.com/games/minisudo'),
  },
];

export function detectGameFromUrl(url = '') {
  return GAMES.find((g) => g.matches(url)) || null;
}

export function getGameById(id) {
  return GAMES.find((g) => g.id === id) || null;
}

export const SPEED_MODES = {
  turbo: { id: 'turbo', label: 'Turbo', icon: '⚡', desc: 'Instantané (~0 ms)' },
  fast: { id: 'fast', label: 'Rapide', icon: '🚀', desc: 'Fluide (~18 ms)' },
  human: { id: 'human', label: 'Humain', icon: '🧑', desc: 'Naturel (~85 ms)' },
};

export const DEFAULT_SETTINGS = {
  speedMode: 'turbo',
  autoSolve: false,
  autoStart: true,
  showHud: true,
  shortcutEnabled: true,
};

const SETTINGS_KEY = 'lgTurboSettings';
const STATS_KEY = 'lgTurboStats';

export function getTodayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function getSettings() {
  try {
    const res = await polyfilledBrowser.storage.local.get(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...(res?.[SETTINGS_KEY] || {}) };
  } catch (_e) {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(partial) {
  const current = await getSettings();
  const next = { ...current, ...partial };
  try {
    await polyfilledBrowser.storage.local.set({ [SETTINGS_KEY]: next });
  } catch (e) {
    console.warn('[LG Turbo] Failed to save settings:', e);
  }
  return next;
}

export async function getStats() {
  const fallback = { daily: {}, totalSolved: 0, bestTimes: {} };
  try {
    const res = await polyfilledBrowser.storage.local.get(STATS_KEY);
    return { ...fallback, ...(res?.[STATS_KEY] || {}) };
  } catch (_e) {
    return fallback;
  }
}

export async function recordSolve(gameId, durationMs) {
  const stats = await getStats();
  const today = getTodayKey();
  if (!stats.daily[today]) {
    stats.daily[today] = {};
  }
  const rounded = Math.max(1, Math.round(durationMs));
  const alreadyToday = stats.daily[today][gameId] != null;
  stats.daily[today][gameId] = alreadyToday
    ? Math.min(stats.daily[today][gameId], rounded)
    : rounded;
  stats.totalSolved = (stats.totalSolved || 0) + 1;

  if (!stats.bestTimes[gameId] || rounded < stats.bestTimes[gameId]) {
    stats.bestTimes[gameId] = rounded;
  }

  const keys = Object.keys(stats.daily).sort();
  if (keys.length > 14) {
    for (const oldKey of keys.slice(0, keys.length - 14)) {
      delete stats.daily[oldKey];
    }
  }

  try {
    await polyfilledBrowser.storage.local.set({ [STATS_KEY]: stats });
  } catch (e) {
    console.warn('[LG Turbo] Failed to save stats:', e);
  }
  return stats;
}

export async function resetTodayStats() {
  const stats = await getStats();
  const today = getTodayKey();
  delete stats.daily[today];
  try {
    await polyfilledBrowser.storage.local.set({ [STATS_KEY]: stats });
  } catch (e) {
    console.warn('[LG Turbo] Failed to reset today stats:', e);
  }
  return stats;
}

export function onStorageChange(callback) {
  try {
    polyfilledBrowser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes[SETTINGS_KEY] || changes[STATS_KEY]) {
        callback({
          settings: changes[SETTINGS_KEY]?.newValue
            ? { ...DEFAULT_SETTINGS, ...changes[SETTINGS_KEY].newValue }
            : null,
          stats: changes[STATS_KEY]?.newValue || null,
        });
      }
    });
  } catch (_e) {
    // Ignore if storage API unavailable
  }
}
