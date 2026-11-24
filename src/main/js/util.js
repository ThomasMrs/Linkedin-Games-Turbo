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

function collectAccessibleDocuments(rootDoc = document, visited = new Set()) {
  if (!rootDoc || visited.has(rootDoc)) return [];
  visited.add(rootDoc);
  const docs = [rootDoc];
  const frames = rootDoc.querySelectorAll('iframe');
  for (const frame of frames) {
    try {
      const frameDoc = frame.contentDocument || frame.contentWindow?.document;
      if (frameDoc) {
        docs.push(...collectAccessibleDocuments(frameDoc, visited));
      }
    } catch (_err) {
      // Cross-origin iframe; safely skip
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
      // Continue searching other documents
    }
  }
  return null;
}

export function getGridDiv(extractFromDocument) {
  const found = queryAllDocuments(extractFromDocument);
  if (!found) {
    throw new Error('Could not extract target element from document or iframes');
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
  const startPattern = /^(start game|play|play now|commencer|jouer|c'est parti|lancer|démarrer|resume|reprendre)$/i;
  const startButton = queryAllDocuments((doc) => {
    const knownSelectors = [
      'button[data-testid*="launch" i]',
      'button[data-testid*="start-game" i]',
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
  doOneClick(startButton);
  startButton.click();
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
