import {
  cellsByIndex,
  collectAccessibleDocuments,
  fireClick,
  fireKey,
  firePointerDown,
  firePointerMoveTo,
  firePointerUp,
  getDelayForMode,
  sleep,
  waitFor,
  waitForPagePuzzle,
} from '../util.js';
import { ZipGrid, compressSequence } from './solver.js';

export const ZIP_BOARD_SELECTORS = [
  '[data-testid="interactive-grid"]',
  '[data-testid$="-game-board"]',
  '.grid-game-board',
];

const ARROWS = {
  up: ['ArrowUp', 38],
  down: ['ArrowDown', 40],
  left: ['ArrowLeft', 37],
  right: ['ArrowRight', 39],
};

function locateZipBoard(count) {
  for (const doc of collectAccessibleDocuments(document)) {
    for (const selector of ZIP_BOARD_SELECTORS) {
      let boards = [];
      try { boards = doc.querySelectorAll(selector); } catch (_e) { boards = []; }
      for (const board of boards) {
        const cells = cellsByIndex(board, count);
        if (cells) return { doc, board, cells };
      }
    }
  }
  return null;
}

function wallsFromPuzzle(puzzle, n) {
  const downWalls = [];
  const rightWalls = [];
  for (const wall of Array.isArray(puzzle.walls) ? puzzle.walls : []) {
    const idx = Number(wall?.cellIdx);
    const dir = String(wall?.direction || '').replace(/^WallDirection_/i, '').toLowerCase();
    if (!Number.isInteger(idx)) continue;
    if (dir === 'down') downWalls.push(idx);
    else if (dir === 'up' && idx - n >= 0) downWalls.push(idx - n);
    else if (dir === 'right') rightWalls.push(idx);
    else if (dir === 'left' && idx % n !== 0) rightWalls.push(idx - 1);
  }
  return { downWalls: [...new Set(downWalls)], rightWalls: [...new Set(rightWalls)] };
}

function isValidPath(path, n, start) {
  if (!Array.isArray(path) || path.length !== n * n || path[0] !== start) return false;
  const seen = new Set();
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    if (!Number.isInteger(p) || p < 0 || p >= n * n || seen.has(p)) return false;
    seen.add(p);
    if (i > 0) {
      const q = path[i - 1];
      const adjacent = (Math.abs(p - q) === n) || (Math.abs(p - q) === 1 && Math.floor(p / n) === Math.floor(q / n));
      if (!adjacent) return false;
    }
  }
  return true;
}

export function solveZipFromPuzzle(puzzle) {
  const n = Number(puzzle?.gridSize);
  const sequence = puzzle?.orderedSequence;
  if (!Number.isInteger(n) || n < 2 || !Array.isArray(sequence) || sequence.length < 2) return null;
  const { downWalls, rightWalls } = wallsFromPuzzle(puzzle, n);
  let path = null;
  try {
    path = new ZipGrid(n, n, sequence.slice(), downWalls, rightWalls).solve();
  } catch (e) {
    console.warn('[LG Turbo] Solveur Zip :', e);
  }
  if (!isValidPath(path, n, sequence[0])) {
    const official = Array.isArray(puzzle.solution) ? puzzle.solution.map(Number) : null;
    path = isValidPath(official, n, sequence[0]) ? official : null;
  }
  return path ? { n, path } : null;
}

function direction(from, to, n) {
  if (to === from - n) return 'up';
  if (to === from + n) return 'down';
  if (to === from - 1) return 'left';
  return 'right';
}

function boardChanged(found, timeoutMs) {
  let mutated = false;
  const observer = new MutationObserver(() => { mutated = true; });
  const root = (found.board && found.board.isConnected && (found.board.parentElement || found.board)) || found.doc.documentElement;
  observer.observe(root, { attributes: true, childList: true, subtree: true, characterData: true });
  return waitFor(() => mutated, timeoutMs, 10).finally(() => observer.disconnect());
}

async function viaKeyboard(found, path, n, speedMode) {
  fireClick(found.cells[path[0]]);
  await sleep(60);
  const keyTarget = () => {
    const active = found.doc.activeElement;
    return active && active !== found.doc.body ? active : (found.board || found.doc.body);
  };
  for (let i = 1; i < path.length; i++) {
    const [key, code] = ARROWS[direction(path[i - 1], path[i], n)];
    const changed = boardChanged(found, i === 1 ? 350 : 250);
    fireKey(keyTarget(), key, key, code);
    const ok = await changed;
    if (i === 1 && !ok) return false;
    const delay = getDelayForMode(speedMode);
    if (delay) await sleep(delay);
  }
  return true;
}

async function viaDrag(found, path, speedMode) {
  firePointerDown(found.cells[path[0]]);
  for (let i = 1; i < path.length; i++) {
    const located = found.cells[path[i]].isConnected ? found : (locateZipBoard(found.cells.length) || found);
    const changed = boardChanged(located, i === 1 ? 350 : 250);
    firePointerMoveTo(located.cells[path[i]]);
    const ok = await changed;
    if (i === 1 && !ok) {
      firePointerUp(located.cells[path[i]]);
      return false;
    }
    const delay = getDelayForMode(speedMode);
    if (delay) await sleep(delay);
  }
  const last = locateZipBoard(found.cells.length);
  if (last) firePointerUp(last.cells[path[path.length - 1]]);
  return true;
}

async function viaClicks(found, path, speedMode) {
  const turns = compressSequence(path);
  for (const idx of turns) {
    const located = locateZipBoard(found.cells.length);
    if (!located) break;
    const changed = boardChanged(located, 400);
    fireClick(located.cells[idx]);
    await changed;
    const delay = getDelayForMode(speedMode);
    if (delay) await sleep(delay);
  }
  return true;
}

export class ZipDomApiV2 {
  async autoSolve(speedMode = 'turbo') {
    const data = await waitForPagePuzzle(['trailGamePuzzle'], 3500);
    if (!data) throw new Error('Données de la grille Zip indisponibles.');
    const solved = solveZipFromPuzzle(data.puzzle);
    if (!solved) throw new Error('Grille Zip lue mais aucun chemin trouvé.');
    const { n, path } = solved;
    console.info('[LG Turbo] Zip :', path);
    const found = await waitFor(() => locateZipBoard(n * n), 2500, 100);
    if (!found) throw new Error('Cases Zip introuvables (data-cell-idx).');
    if (await viaKeyboard(found, path, n, speedMode)) return path.length;
    const again = locateZipBoard(n * n) || found;
    if (await viaDrag(again, path, speedMode)) return path.length;
    await viaClicks(locateZipBoard(n * n) || found, path, speedMode);
    return path.length;
  }
}
