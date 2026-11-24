export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getDelayForMode(speedMode = 'turbo') {
  if (speedMode === 'human') {
    return 55 + Math.floor(Math.random() * 80);
  }
  if (speedMode === 'fast') {
    return 18;
  }
  return 0;
}

export function collectAccessibleDocuments(rootDoc = document, visited = new Set()) {
  if (!rootDoc || visited.has(rootDoc)) return [];
  visited.add(rootDoc);
  const docs = [rootDoc];
  let frames = [];
  try { frames = rootDoc.querySelectorAll('iframe, frame'); } catch (_err) { frames = []; }
  for (const frame of frames) {
    try {
      const frameDoc = frame.contentDocument || frame.contentWindow?.document;
      if (frameDoc && frameDoc.documentElement) {
        docs.push(...collectAccessibleDocuments(frameDoc, visited));
      }
    } catch (_err) {
      continue;
    }
  }
  return docs;
}

export function queryAllDocuments(extractFromDocument) {
  for (const doc of collectAccessibleDocuments(document)) {
    try {
      const result = extractFromDocument.call(null, doc);
      if (result) return result;
    } catch (_err) {
      continue;
    }
  }
  return null;
}

export function getGridDiv(extractFromDocument) {
  const found = queryAllDocuments(extractFromDocument);
  if (!found) {
    throw new Error('Élément introuvable dans la page et ses iframes');
  }
  return found;
}

export function doOneMouseCycle(clickTarget) {
  const view = clickTarget?.ownerDocument?.defaultView || window;
  const commonClickArgs = { bubbles: true, cancelable: true, view };
  clickTarget.dispatchEvent(new MouseEvent('mousedown', commonClickArgs));
  clickTarget.dispatchEvent(new MouseEvent('mouseup', commonClickArgs));
}

export function doOneClick(clickTarget) {
  const view = clickTarget?.ownerDocument?.defaultView || window;
  const commonClickArgs = { bubbles: true, cancelable: true, view };
  clickTarget.dispatchEvent(new MouseEvent('mousedown', commonClickArgs));
  clickTarget.dispatchEvent(new MouseEvent('mouseup', commonClickArgs));
  clickTarget.dispatchEvent(new MouseEvent('click', commonClickArgs));
}

function centerOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function hitTarget(el, x, y) {
  let target = null;
  try { target = el.ownerDocument.elementFromPoint(x, y); } catch (_e) { target = null; }
  return target && el.contains(target) ? target : el;
}

function pointerInit(x, y, buttons, extra = {}) {
  return {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: x,
    clientY: y,
    screenX: x,
    screenY: y,
    button: 0,
    buttons,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    width: 1,
    height: 1,
    pressure: buttons ? 0.5 : 0,
    ...extra,
  };
}

function makePointer(type, init) {
  const P = typeof PointerEvent === 'function' ? PointerEvent : MouseEvent;
  return new P(type, init);
}

export function fireClick(el) {
  const { x, y } = centerOf(el);
  const target = hitTarget(el, x, y);
  target.dispatchEvent(makePointer('pointerover', pointerInit(x, y, 0)));
  target.dispatchEvent(new MouseEvent('mouseover', pointerInit(x, y, 0)));
  target.dispatchEvent(makePointer('pointerdown', pointerInit(x, y, 1)));
  target.dispatchEvent(new MouseEvent('mousedown', pointerInit(x, y, 1)));
  target.dispatchEvent(makePointer('pointerup', pointerInit(x, y, 0)));
  target.dispatchEvent(new MouseEvent('mouseup', pointerInit(x, y, 0)));
  target.dispatchEvent(new MouseEvent('click', pointerInit(x, y, 0, { detail: 1 })));
}

export function firePointerDown(el) {
  const { x, y } = centerOf(el);
  const target = hitTarget(el, x, y);
  target.dispatchEvent(makePointer('pointerover', pointerInit(x, y, 0)));
  target.dispatchEvent(makePointer('pointerdown', pointerInit(x, y, 1)));
  target.dispatchEvent(new MouseEvent('mousedown', pointerInit(x, y, 1)));
}

export function firePointerMoveTo(el) {
  const { x, y } = centerOf(el);
  const target = hitTarget(el, x, y);
  target.dispatchEvent(makePointer('pointerover', pointerInit(x, y, 1)));
  target.dispatchEvent(makePointer('pointerenter', { ...pointerInit(x, y, 1), bubbles: false }));
  target.dispatchEvent(makePointer('pointermove', pointerInit(x, y, 1)));
  target.dispatchEvent(new MouseEvent('mouseover', pointerInit(x, y, 1)));
  target.dispatchEvent(new MouseEvent('mouseenter', { ...pointerInit(x, y, 1), bubbles: false }));
  target.dispatchEvent(new MouseEvent('mousemove', pointerInit(x, y, 1)));
}

export function firePointerUp(el) {
  const { x, y } = centerOf(el);
  const target = hitTarget(el, x, y);
  target.dispatchEvent(makePointer('pointerup', pointerInit(x, y, 0)));
  target.dispatchEvent(new MouseEvent('mouseup', pointerInit(x, y, 0)));
}

export function cellCenter(el) {
  return centerOf(el);
}

function frameOf(el) {
  try {
    return el.ownerDocument.defaultView?.frameElement || null;
  } catch (_e) {
    return null;
  }
}

export function revealInViewport(el) {
  if (!el) return;
  const frame = frameOf(el);
  if (frame) frame.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
  const r = el.getBoundingClientRect();
  const view = el.ownerDocument.defaultView || window;
  if (r.top < 0 || r.left < 0 || r.bottom > view.innerHeight || r.right > view.innerWidth) {
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
  }
}

export function dispatchAtPoint(doc, type, x, y, buttons, fallback = null) {
  let target = null;
  try { target = doc.elementFromPoint(x, y); } catch (_e) { target = null; }
  if (!target || target.tagName === 'IFRAME') target = fallback;
  if (!target) return false;
  const init = pointerInit(x, y, buttons, type === 'click' ? { detail: 1 } : {});
  const isPointer = type.startsWith('pointer');
  target.dispatchEvent(isPointer ? makePointer(type, init) : new MouseEvent(type, init));
  return true;
}

export async function dragThrough(doc, points, { steps = 5, stepDelay = 8, startDelay = 16, click = false, fallbacks = [] } = {}) {
  if (!points.length) return false;
  const first = points[0];
  const last = points[points.length - 1];
  const fb = (i) => fallbacks[i] || null;
  dispatchAtPoint(doc, 'pointerover', first.x, first.y, 0, fb(0));
  const started = dispatchAtPoint(doc, 'pointerdown', first.x, first.y, 1, fb(0));
  dispatchAtPoint(doc, 'mousedown', first.x, first.y, 1, fb(0));
  if (!started) return false;
  if (startDelay) await sleep(startDelay);
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    for (let s = 1; s <= steps; s++) {
      const x = a.x + ((b.x - a.x) * s) / steps;
      const y = a.y + ((b.y - a.y) * s) / steps;
      const near = s === steps ? fb(i + 1) : null;
      dispatchAtPoint(doc, 'pointerover', x, y, 1, near);
      dispatchAtPoint(doc, 'pointermove', x, y, 1, near);
      dispatchAtPoint(doc, 'mousemove', x, y, 1, near);
      if (stepDelay) await sleep(stepDelay);
    }
  }
  dispatchAtPoint(doc, 'pointerup', last.x, last.y, 0, fb(points.length - 1));
  dispatchAtPoint(doc, 'mouseup', last.x, last.y, 0, fb(points.length - 1));
  if (click) dispatchAtPoint(doc, 'click', last.x, last.y, 0, fb(points.length - 1));
  return true;
}

export function waitForSettle(root, maxMs = 150, quietMs = 30) {
  return new Promise((resolve) => {
    let quietTimer = null;
    const finish = () => {
      observer.disconnect();
      clearTimeout(quietTimer);
      clearTimeout(limitTimer);
      resolve();
    };
    const observer = new MutationObserver(() => {
      clearTimeout(quietTimer);
      quietTimer = setTimeout(finish, quietMs);
    });
    const limitTimer = setTimeout(finish, maxMs);
    try {
      observer.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
    } catch (_e) {
      finish();
    }
  });
}

export function fireKey(target, key, code, keyCode) {
  const init = { key, code, keyCode, which: keyCode, bubbles: true, cancelable: true, composed: true };
  target.dispatchEvent(new KeyboardEvent('keydown', init));
  target.dispatchEvent(new KeyboardEvent('keyup', init));
}

export function focusQuietly(el) {
  if (!el || typeof el.focus !== 'function') return;
  try { el.focus({ preventScroll: true }); } catch (_e) { el.focus(); }
}

export function waitForDom(root, predicate, timeoutMs = 800) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearInterval(poll);
      observer.disconnect();
      resolve(value);
    };
    const check = () => {
      let value = null;
      try { value = predicate(); } catch (_e) { value = null; }
      if (value) finish(value);
    };
    const observer = new MutationObserver(check);
    try {
      observer.observe(root, { attributes: true, childList: true, subtree: true, characterData: true });
    } catch (_e) {
      observer.disconnect();
    }
    const poll = setInterval(check, 40);
    const timer = setTimeout(() => finish(null), timeoutMs);
    check();
  });
}

export async function waitFor(predicate, timeoutMs = 3000, intervalMs = 60) {
  const start = performance.now();
  for (;;) {
    let value = null;
    try { value = predicate(); } catch (_e) { value = null; }
    if (value) return value;
    if (performance.now() - start >= timeoutMs) return null;
    await sleep(intervalMs);
  }
}

const PUZZLE_ATTR = 'data-lgturbo-puzzle';

export function readPagePuzzle(expectedKinds = null) {
  for (const doc of collectAccessibleDocuments(document)) {
    try {
      const root = doc.documentElement;
      root.removeAttribute(PUZZLE_ATTR);
      doc.dispatchEvent(new CustomEvent('lgturbo:read-puzzle'));
      const raw = root.getAttribute(PUZZLE_ATTR);
      root.removeAttribute(PUZZLE_ATTR);
      if (!raw) continue;
      const data = JSON.parse(raw);
      if (data && data.ok && (!expectedKinds || expectedKinds.includes(data.kind))) {
        return { kind: data.kind, puzzle: data.puzzle, doc };
      }
    } catch (_e) {
      continue;
    }
  }
  return null;
}

export async function waitForPagePuzzle(expectedKinds, timeoutMs = 2500) {
  return waitFor(() => readPagePuzzle(expectedKinds), timeoutMs, 120);
}

export function cellsByIndex(root, expectedCount = null) {
  if (!root) return null;
  let list = [];
  try { list = Array.from(root.querySelectorAll('[data-cell-idx]')); } catch (_e) { list = []; }
  const set = new Set(list);
  list = list.filter((el) => {
    for (let p = el.parentElement; p && p !== root; p = p.parentElement) if (set.has(p)) return false;
    return true;
  });
  const map = new Map();
  for (const el of list) {
    const idx = Number(el.getAttribute('data-cell-idx'));
    if (!Number.isInteger(idx) || idx < 0) return null;
    if (!map.has(idx)) map.set(idx, el);
  }
  const count = expectedCount ?? map.size;
  if (!count || map.size !== count) return null;
  const cells = [];
  for (let i = 0; i < count; i++) {
    if (!map.has(i)) return null;
    cells.push(map.get(i));
  }
  return cells;
}

export async function runStrategies(apis, speedMode, gameName) {
  const t0 = performance.now();
  const errors = [];
  for (const api of apis) {
    try {
      const moves = await api.autoSolve(speedMode);
      return {
        success: true,
        durationMs: Math.max(1, Math.round(performance.now() - t0)),
        moves,
        api: api.constructor.name,
      };
    } catch (e) {
      errors.push(`${api.constructor.name}: ${e?.message || e}`);
      console.warn(`[LG Turbo] ${gameName} — ${api.constructor.name} a échoué :`, e);
    }
  }
  console.error(`[LG Turbo] ${gameName} — toutes les méthodes ont échoué :\n` + errors.join('\n'));
  const err = new Error(`${gameName} : ${errors[0] ? errors[0].replace(/^[^:]+:\s*/, '') : 'grille introuvable'}`);
  err.details = errors;
  throw err;
}

export async function anticipateOneMutation(cellDiv, loc, speedMode = 'turbo') {
  const delay = getDelayForMode(speedMode);
  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutRef);
      observer.disconnect();
      resolve();
    };
    const timeoutRef = setTimeout(() => {
      console.warn('[LG Turbo] Mutation timeout on cell', loc, '- continuing');
      finish();
    }, 2200);
    const observer = new MutationObserver(() => {
      finish();
    });
    observer.observe(cellDiv, { attributes: true, childList: true, subtree: true });
    doOneMouseCycle(cellDiv);
  });
  if (delay > 0) {
    await sleep(delay);
  }
}

function isElementVisible(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export async function tryAutoStartGame() {
  const startPattern = /^(start game|start|play|play now|commencer|jouer|c'est parti|lancer|démarrer|resume|reprendre)$/i;
  const startButton = queryAllDocuments((doc) => {
    const knownSelectors = [
      'button[data-testid*="launch" i]',
      'button[data-testid*="start-game" i]',
      'button[data-testid*="start" i]',
      'button.launch-footer__btn--start',
      'button.pr-game-web__launch-btn',
    ];
    for (const sel of knownSelectors) {
      const btn = doc.querySelector(sel);
      if (btn && isElementVisible(btn) && !btn.disabled) {
        return btn;
      }
    }
    const buttons = doc.querySelectorAll('button');
    for (const btn of buttons) {
      if (!isElementVisible(btn) || btn.disabled) continue;
      const text = (btn.textContent || '').trim();
      if (startPattern.test(text)) {
        return btn;
      }
    }
    return null;
  });

  if (!startButton) {
    return false;
  }
  fireClick(startButton);
  await sleep(220);
  return true;
}

export async function waitForAnyGrid(selectors, timeoutMs = 4500) {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    const found = queryAllDocuments((doc) => {
      for (const sel of selectors) {
        const el = doc.querySelector(sel);
        if (el) return el;
      }
      return null;
    });
    if (found) return found;
    await sleep(80);
  }
  return null;
}

export function hasAnyGrid(selectors) {
  return Boolean(
    queryAllDocuments((doc) => {
      for (const sel of selectors) {
        if (doc.querySelector(sel)) return true;
      }
      return false;
    })
  );
}
