import {
  collectAccessibleDocuments,
  fireClick,
  getDelayForMode,
  readPagePuzzle,
  sleep,
  waitFor,
  waitForDom,
} from '../util.js';
import { solveQueens } from './solver.js';

export const QUEENS_BOARD_SELECTORS = [
  '#queens-game-board',
  '[data-testid="queens-game-board"]',
  '[data-testid="interactive-grid"]',
  '[data-testid$="-game-board"]',
  '#queens-grid',
  '.queens-grid',
  '[class*="queens-grid"]',
  '[class*="queens-board"]',
  '[role="grid"]',
];
const CELL_SELECTORS = ['[data-cell-idx]', '[role="gridcell"]', '[class*="queens-cell"]'];
const MIN_SIZE = 4;
const MAX_SIZE = 16;
const QUEEN_RE = /\b(queen|reine|dame|crown|couronne)\b/i;
const CROSS_RE = /\b(cross|croix|cross-mark|x-mark|marked|marqu[ée]e?)\b/i;
const EMPTY_RE = /\b(empty|vide|blank)\b/i;
const COLOR_NAME_RE = /(?:colou?r|couleur)\s*:?\s*(?:de\s+|of\s+)?([^,;]+)/i;

function collectRoots() {
  const roots = [];
  for (const doc of collectAccessibleDocuments(document)) {
    roots.push(doc);
    let all = [];
    try { all = doc.querySelectorAll('*'); } catch (_e) { all = []; }
    for (const el of all) if (el.shadowRoot) roots.push(el.shadowRoot);
  }
  return roots;
}

function isRendered(el) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function outermost(list) {
  const set = new Set(list);
  return list.filter((el) => {
    for (let p = el.parentElement; p; p = p.parentElement) if (set.has(p)) return false;
    return true;
  });
}

function orderByIndex(list) {
  const map = new Map();
  for (const el of list) {
    const idx = Number(el.getAttribute('data-cell-idx'));
    if (!Number.isInteger(idx) || idx < 0) return null;
    if (!map.has(idx)) map.set(idx, el);
  }
  const size = Math.round(Math.sqrt(map.size));
  if (size * size !== map.size) return null;
  const cells = [];
  for (let i = 0; i < map.size; i++) {
    if (!map.has(i)) return null;
    cells.push(map.get(i));
  }
  return { cells, size };
}

function orderByGeometry(list) {
  const items = list.filter(isRendered).map((el) => ({ el, r: el.getBoundingClientRect() }));
  const size = Math.round(Math.sqrt(items.length));
  if (size * size !== items.length) return null;
  items.sort((a, b) => a.r.top - b.r.top || a.r.left - b.r.left);
  const cells = [];
  for (let row = 0; row < size; row++) {
    const slice = items.slice(row * size, row * size + size).sort((a, b) => a.r.left - b.r.left);
    cells.push(...slice.map((item) => item.el));
  }
  return { cells, size };
}

function cellsIn(container) {
  for (const selector of CELL_SELECTORS) {
    let list = [];
    try { list = Array.from(container.querySelectorAll(selector)); } catch (_e) { list = []; }
    if (list.length < MIN_SIZE * MIN_SIZE) continue;
    list = outermost(list);
    const grid = list.every((el) => el.hasAttribute('data-cell-idx')) ? orderByIndex(list) : orderByGeometry(list);
    if (grid && grid.size >= MIN_SIZE && grid.size <= MAX_SIZE) return grid;
  }
  return null;
}

function commonAncestor(cells) {
  let node = cells[0].parentElement;
  while (node && !cells.every((c) => node.contains(c))) node = node.parentElement;
  return node || cells[0].parentElement;
}

export function locateQueensBoard() {
  const roots = collectRoots();
  for (const root of roots) {
    for (const selector of QUEENS_BOARD_SELECTORS) {
      let nodes = [];
      try { nodes = root.querySelectorAll(selector); } catch (_e) { nodes = []; }
      for (const board of nodes) {
        const grid = cellsIn(board);
        if (grid) return { root, board, cells: grid.cells, size: grid.size };
      }
    }
  }
  for (const root of roots) {
    const grid = cellsIn(root);
    if (grid) return { root, board: commonAncestor(grid.cells), cells: grid.cells, size: grid.size };
  }
  return null;
}

function regionsFromPage(found) {
  const data = readPagePuzzle(['queensGamePuzzle']);
  const grid = data?.puzzle?.colorGrid;
  if (!Array.isArray(grid) || grid.length !== found.size) return null;
  const flat = [];
  for (const row of grid) {
    const colors = Array.isArray(row) ? row : row?.colors;
    if (!Array.isArray(colors) || colors.length !== found.size) return null;
    flat.push(...colors);
  }
  return flat;
}

function regionsFromClasses(found) {
  return found.cells.map((cell) => {
    for (const el of [cell, ...cell.querySelectorAll('*')]) {
      const m = (el.getAttribute('class') || '').match(/cell-colou?r-(\d+)/);
      if (m) return 'c' + m[1];
    }
    return null;
  });
}

function regionsFromAttributes(found) {
  return found.cells.map((cell) => {
    for (const attr of cell.attributes) {
      if (/colou?r/i.test(attr.name) && attr.value !== '') return attr.name + '=' + attr.value;
    }
    return null;
  });
}

function regionsFromAria(found) {
  return found.cells.map((cell) => {
    const m = (cell.getAttribute('aria-label') || '').match(COLOR_NAME_RE);
    return m ? m[1].trim().toLowerCase() : null;
  });
}

function parseRgb(value) {
  const m = String(value).match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/i);
  if (!m) return null;
  let alpha = m[4] === undefined ? 1 : parseFloat(m[4]);
  if (m[4] && m[4].endsWith('%')) alpha /= 100;
  if (alpha < 0.05) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function cellBackground(cell) {
  const view = cell.ownerDocument.defaultView || window;
  const queue = [cell, ...Array.from(cell.querySelectorAll('*')).slice(0, 12)];
  for (const el of queue) {
    const rgb = parseRgb(view.getComputedStyle(el).backgroundColor);
    if (rgb) return rgb;
  }
  return null;
}

function regionsFromBackground(found) {
  const colors = found.cells.map(cellBackground);
  if (colors.some((c) => !c)) return null;
  for (const tolerance of [0, 10, 24]) {
    const centers = [];
    const keys = colors.map((c) => {
      let best = -1;
      let bestDist = Infinity;
      centers.forEach((center, i) => {
        const d = Math.hypot(center[0] - c[0], center[1] - c[1], center[2] - c[2]);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      if (best >= 0 && bestDist <= tolerance) return best;
      centers.push(c);
      return centers.length - 1;
    });
    if (centers.length === found.size) return keys;
  }
  return null;
}

function normalizeRegionIds(raw, size) {
  const ids = new Map();
  const flat = [];
  for (let i = 0; i < size * size; i++) {
    const key = raw[i];
    if (key === undefined || key === null || key === '') return null;
    if (!ids.has(key)) ids.set(key, ids.size);
    flat.push(ids.get(key));
  }
  return ids.size === size ? flat : null;
}

export function readQueensRegions(found) {
  const strategies = [
    ['données du jeu', regionsFromPage],
    ['classes', regionsFromClasses],
    ['attributs', regionsFromAttributes],
    ['aria-label', regionsFromAria],
    ['couleurs', regionsFromBackground],
  ];
  for (const [method, read] of strategies) {
    let raw = null;
    try { raw = read(found); } catch (_e) { raw = null; }
    if (!raw) continue;
    const flat = normalizeRegionIds(raw, found.size);
    if (flat) return { method, flat };
  }
  return null;
}

function officialSolution(size) {
  const data = readPagePuzzle(['queensGamePuzzle']);
  const sol = data?.puzzle?.solution;
  if (!Array.isArray(sol) || sol.length !== size) return null;
  const out = sol.map((p) => (Number.isInteger(p) ? p : size * Number(p?.row) + Number(p?.col)));
  return out.every((i) => Number.isInteger(i) && i >= 0 && i < size * size) ? out : null;
}

export function readQueensMark(cell) {
  const own = cell.getAttribute('aria-label') || '';
  if (own) {
    if (EMPTY_RE.test(own)) return { mark: 0, known: true };
    if (QUEEN_RE.test(own)) return { mark: 2, known: true };
    if (CROSS_RE.test(own)) return { mark: 1, known: true };
  }
  for (const el of cell.querySelectorAll('[aria-label], [data-testid], [title], [alt]')) {
    const text = ['aria-label', 'data-testid', 'title', 'alt'].map((a) => el.getAttribute(a)).filter(Boolean).join(' ');
    if (QUEEN_RE.test(text)) return { mark: 2, known: true };
    if (CROSS_RE.test(text)) return { mark: 1, known: true };
  }
  return { mark: 0, known: false };
}

function marksReadable(cells) {
  return cells.some((cell) => readQueensMark(cell).known);
}

function resolveCell(found, index) {
  const cell = found.cells[index];
  if (cell && cell.isConnected) return cell;
  const fresh = locateQueensBoard();
  if (!fresh || fresh.size !== found.size) return null;
  Object.assign(found, fresh);
  return found.cells[index];
}

async function clickUntil(found, index, wanted, isLast) {
  let misses = 0;
  for (let clicks = 0; clicks < 6; clicks++) {
    const cell = resolveCell(found, index);
    if (!cell) {
      if (isLast) return clicks;
      throw new Error(`Case ${index} introuvable après mise à jour du plateau.`);
    }
    const before = readQueensMark(cell).mark;
    if (wanted(before)) return clicks;
    const doc = cell.ownerDocument;
    fireClick(cell);
    const changed = await waitForDom(doc.documentElement, () => {
      const c = resolveCell(found, index);
      if (!c) return isLast ? 'gone' : null;
      return readQueensMark(c).mark !== before ? 'changed' : null;
    }, 900);
    if (changed === 'gone') return clicks + 1;
    if (!changed && ++misses >= 2) throw new Error(`Le jeu ne réagit pas aux clics (case ${index}).`);
  }
  throw new Error(`Impossible de placer la reine en case ${index}.`);
}

async function applyQueens(found, queens, speedMode) {
  const size = found.size;
  const targets = new Set(queens);
  let clicks = 0;
  if (marksReadable(found.cells)) {
    for (let i = 0; i < size * size; i++) {
      if (targets.has(i)) continue;
      const cell = resolveCell(found, i);
      if (cell && readQueensMark(cell).mark === 2) {
        clicks += await clickUntil(found, i, (m) => m !== 2, false);
      }
    }
    const order = [...targets];
    for (let k = 0; k < order.length; k++) {
      clicks += await clickUntil(found, order[k], (m) => m === 2, k === order.length - 1);
      const delay = getDelayForMode(speedMode);
      if (delay) await sleep(delay);
    }
    return clicks;
  }
  for (const i of targets) {
    for (let k = 0; k < 2; k++) {
      const cell = resolveCell(found, i);
      if (!cell) break;
      fireClick(cell);
      clicks++;
      await sleep(Math.max(30, getDelayForMode(speedMode)));
    }
  }
  return clicks;
}

export class QueensDomApiV2 {
  async autoSolve(speedMode = 'turbo') {
    const found = await waitFor(() => locateQueensBoard(), 3500, 120);
    if (!found) throw new Error('Plateau Queens introuvable (page et iframes inspectées).');
    const regions = readQueensRegions(found);
    let queens = null;
    if (regions) {
      try {
        queens = solveQueens(regions.flat.map((color, idx) => ({ idx, color })));
      } catch (e) {
        console.warn('[LG Turbo] Solveur Queens :', e);
      }
    }
    if (!queens || queens.length !== found.size) queens = officialSolution(found.size);
    if (!queens) {
      throw new Error(regions
        ? 'Grille Queens lue mais aucune solution trouvée.'
        : `Plateau ${found.size}×${found.size} trouvé, mais zones de couleur illisibles.`);
    }
    console.info('[LG Turbo] Queens :', { taille: found.size, zones: regions?.method, solution: queens });
    return await applyQueens(found, queens, speedMode);
  }
}
