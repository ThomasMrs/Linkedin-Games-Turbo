import {
  cellsByIndex,
  collectAccessibleDocuments,
  fireClick,
  getDelayForMode,
  sleep,
  waitFor,
  waitForDom,
  waitForPagePuzzle,
} from '../util.js';
import { solveTango } from './solver.js';

export const TANGO_BOARD_SELECTORS = [
  '[data-testid="tango-gameboard-wrapper"] [data-testid="interactive-grid"]',
  '[data-testid="interactive-grid"]',
  '[data-testid$="-game-board"]',
  '.lotka-grid',
];
const SIZE = 6;
const COUNT = SIZE * SIZE;

const has = (el, selector) => el.matches(selector) || Boolean(el.querySelector(selector));

export function locateTangoCells() {
  for (const doc of collectAccessibleDocuments(document)) {
    const byId = Array.from({ length: COUNT }, (_, i) => doc.getElementById(`tango-cell-${i}`));
    if (byId.every(Boolean)) return { doc, cells: byId };
    for (const selector of TANGO_BOARD_SELECTORS) {
      let boards = [];
      try { boards = doc.querySelectorAll(selector); } catch (_e) { boards = []; }
      for (const board of boards) {
        const cells = cellsByIndex(board, COUNT);
        if (cells) return { doc, cells };
      }
    }
  }
  return null;
}

export function readTangoMark(cell) {
  if (has(cell, '[data-testid="cell-zero"]')) return 1;
  if (has(cell, '[data-testid="cell-one"]')) return 2;
  if (has(cell, '[data-testid="cell-empty"]')) return 0;
  const labels = [cell, ...cell.querySelectorAll('[aria-label], [title]')]
    .map((el) => el.getAttribute('aria-label') || el.getAttribute('title') || '')
    .join(' ')
    .toLowerCase();
  if (/\b(sun|soleil)\b/.test(labels)) return 1;
  if (/\b(moon|lune)\b/.test(labels)) return 2;
  if (/\b(empty|vide|blank)\b/.test(labels)) return 0;
  if (cell.querySelector('.lotka-cell-empty')) return 0;
  return null;
}

function isFixedCell(cell) {
  return cell.getAttribute('aria-disabled') === 'true'
    || cell.getAttribute('aria-readonly') === 'true'
    || cell.classList.contains('lotka-cell--locked');
}

function toValue(raw) {
  if (raw === 1 || raw === 2) return raw;
  const s = String(raw).toUpperCase();
  if (s.endsWith('ZERO') || s === '0') return 1;
  if (s.endsWith('ONE') || s === '1') return 2;
  return null;
}

function officialSolution(puzzle) {
  const sol = puzzle?.solution;
  if (!Array.isArray(sol) || sol.length !== COUNT) return null;
  const values = sol.map(toValue);
  return values.every(Boolean) ? values : null;
}

export function solveTangoFromPuzzle(puzzle, marks) {
  const presets = Array.isArray(puzzle?.presetCellIdxes) ? puzzle.presetCellIdxes : null;
  if (!presets) return null;
  const suns = [];
  const moons = [];
  for (const idx of presets) {
    if (marks[idx] === 1) suns.push(idx);
    else if (marks[idx] === 2) moons.push(idx);
    else return null;
  }
  const downEqual = [];
  const downCross = [];
  const rightEqual = [];
  const rightCross = [];
  for (const edge of Array.isArray(puzzle.edges) ? puzzle.edges : []) {
    const a = Math.min(Number(edge?.startIdx), Number(edge?.endIdx));
    const b = Math.max(Number(edge?.startIdx), Number(edge?.endIdx));
    if (!Number.isInteger(a) || !Number.isInteger(b)) return null;
    const equal = Boolean(edge.isEqual);
    if (b - a === 1 && a % SIZE !== SIZE - 1) (equal ? rightEqual : rightCross).push(a);
    else if (b - a === SIZE) (equal ? downEqual : downCross).push(a);
    else return null;
  }
  const final = new Array(COUNT).fill(0);
  suns.forEach((i) => { final[i] = 1; });
  moons.forEach((i) => { final[i] = 2; });
  for (const move of solveTango(suns, moons, downEqual, downCross, rightEqual, rightCross)) {
    final[move.idx] = move.color;
  }
  return final.every(Boolean) ? final : null;
}

async function clickUntil(index, target, isLast) {
  let misses = 0;
  for (let clicks = 0; clicks < 5; clicks++) {
    const located = locateTangoCells();
    if (!located) {
      if (isLast) return clicks;
      throw new Error('La grille Tango a disparu pendant la résolution.');
    }
    const cell = located.cells[index];
    const before = readTangoMark(cell);
    if (before === target) return clicks;
    fireClick(cell);
    const outcome = await waitForDom(located.doc.documentElement, () => {
      const now = locateTangoCells();
      if (!now) return isLast ? 'gone' : null;
      return readTangoMark(now.cells[index]) !== before ? 'changed' : null;
    }, 900);
    if (outcome === 'gone') return clicks + 1;
    if (!outcome && ++misses >= 2) throw new Error(`Le jeu ne réagit pas aux clics (case ${index}).`);
  }
  throw new Error(`Impossible de poser la bonne pièce en case ${index}.`);
}

export class TangoDomApiV2 {
  async autoSolve(speedMode = 'turbo') {
    const located = await waitFor(() => locateTangoCells(), 3500, 120);
    if (!located) throw new Error('Grille Tango introuvable (page et iframes inspectées).');
    const marks = located.cells.map(readTangoMark);
    if (marks.some((m) => m === null)) throw new Error('État des cases Tango illisible.');
    const data = await waitForPagePuzzle(['lotkaGamePuzzle'], 2500);
    if (!data) throw new Error('Données de la grille Tango indisponibles.');
    let final = null;
    try {
      final = solveTangoFromPuzzle(data.puzzle, marks);
    } catch (e) {
      console.warn('[LG Turbo] Solveur Tango :', e);
    }
    if (!final) final = officialSolution(data.puzzle);
    if (!final) throw new Error('Grille Tango lue mais aucune solution trouvée.');
    console.info('[LG Turbo] Tango :', final);
    const fixed = new Set(Array.isArray(data.puzzle.presetCellIdxes) ? data.puzzle.presetCellIdxes : []);
    located.cells.forEach((cell, i) => { if (isFixedCell(cell)) fixed.add(i); });
    const todo = [];
    for (let i = 0; i < COUNT; i++) {
      if (!fixed.has(i) && marks[i] !== final[i]) todo.push(i);
    }
    let clicks = 0;
    for (let k = 0; k < todo.length; k++) {
      clicks += await clickUntil(todo[k], final[todo[k]], k === todo.length - 1);
      const delay = getDelayForMode(speedMode);
      if (delay) await sleep(delay);
    }
    return clicks;
  }
}
