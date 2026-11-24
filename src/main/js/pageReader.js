(() => {
  if (window.__lgTurboPageReader) return;
  window.__lgTurboPageReader = true;

  const ATTR = 'data-lgturbo-puzzle';
  const ROOT_SELECTORS = [
    '[data-testid="interactive-grid"]',
    '[data-testid$="-game-board"]',
    '[data-testid$="-gameboard-wrapper"]',
    '[data-testid$="-game-container"]',
    '#queens-game-board',
    '[id^="tango-cell-"]',
    '[data-cell-idx]'
  ];

  const isPuzzle = p => p && typeof p === 'object' && typeof p.$case === 'string' && p[p.$case] && typeof p[p.$case] === 'object';

  function fromProps(props) {
    if (!props || typeof props !== 'object') return null;
    const candidates = [props.game && props.game.puzzle, props.puzzle, props.gamePuzzle, props.game && props.game.gamePuzzle];
    for (const c of candidates) if (isPuzzle(c)) return c;
    return null;
  }

  function findPuzzle() {
    const seenFibers = new Set();
    for (const selector of ROOT_SELECTORS) {
      let nodes = [];
      try { nodes = document.querySelectorAll(selector); } catch (e) { nodes = []; }
      let count = 0;
      for (const el of nodes) {
        if (++count > 60) break;
        let keys = [];
        try { keys = Object.keys(el); } catch (e) { keys = []; }
        for (const key of keys) {
          if (key.startsWith('__reactProps$')) {
            const found = fromProps(el[key]);
            if (found) return found;
          } else if (key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')) {
            for (let fiber = el[key], depth = 0; fiber && depth < 80; fiber = fiber.return, depth++) {
              if (seenFibers.has(fiber)) break;
              seenFibers.add(fiber);
              const found = fromProps(fiber.memoizedProps);
              if (found) return found;
            }
          }
        }
      }
    }
    return null;
  }

  const replacer = (_key, value) => (typeof value === 'bigint' ? Number(value) : value);

  document.addEventListener('lgturbo:read-puzzle', () => {
    let payload;
    try {
      const puzzle = findPuzzle();
      payload = puzzle ? { ok: true, kind: puzzle.$case, puzzle: puzzle[puzzle.$case] } : { ok: false };
    } catch (e) {
      payload = { ok: false, error: String((e && e.message) || e) };
    }
    try {
      document.documentElement.setAttribute(ATTR, JSON.stringify(payload, replacer));
    } catch (e) {
      document.documentElement.setAttribute(ATTR, JSON.stringify({ ok: false, error: 'serialization' }));
    }
  });
})();
