// Handles LinkedIn SPA navigation + toolbar badge feedback.
const polyfilledBrowser = (typeof browser !== 'undefined') ? browser : chrome;

const gameScriptMap = [
  { prefix: '/games/queens', script: 'queens.js', badge: 'Q', color: '#A855F7' },
  { prefix: '/games/zip', script: 'zip.js', badge: 'Z', color: '#FB7185' },
  { prefix: '/games/tango', script: 'tango.js', badge: 'T', color: '#F59E0B' },
  { prefix: '/games/sudoku', script: 'sudoku.js', badge: 'S', color: '#10B981' },
  { prefix: '/games/mini-sudoku', script: 'sudoku.js', badge: 'S', color: '#10B981' },
  { prefix: '/games/minisudoku', script: 'sudoku.js', badge: 'S', color: '#10B981' },
];

function matchGame(url) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith('linkedin.com')) return null;
    return gameScriptMap.find((g) => parsed.pathname.startsWith(g.prefix)) || null;
  } catch (_e) {
    return null;
  }
}

function updateBadge(tabId, match) {
  try {
    const actionApi = polyfilledBrowser.action || polyfilledBrowser.browserAction;
    if (!actionApi) return;
    if (match) {
      actionApi.setBadgeText({ tabId, text: match.badge });
      actionApi.setBadgeBackgroundColor({ tabId, color: match.color });
    } else {
      actionApi.setBadgeText({ tabId, text: '' });
    }
  } catch (_e) {
    // Ignore badge errors on closed tabs
  }
}

polyfilledBrowser.webNavigation.onHistoryStateUpdated.addListener(({ tabId, url }) => {
  const match = matchGame(url);
  updateBadge(tabId, match);
  if (match) {
    polyfilledBrowser.scripting.executeScript({
      target: { tabId },
      files: [match.script],
    }).catch((err) => console.error('[LG Turbo] Injection failed:', err));
  }
});

polyfilledBrowser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab?.url) {
    updateBadge(tabId, matchGame(tab.url));
  }
});
