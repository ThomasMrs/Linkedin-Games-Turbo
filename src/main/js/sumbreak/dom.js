import {
  collectAccessibleDocuments,
  fireClick,
  getDelayForMode,
  revealInViewport,
  runStrategies,
  sleep,
  tryAutoStartGame,
  waitFor,
  waitForAnyGrid,
} from '../util.js';
import { mergeValues, solveSumbreak } from './solver.js';

export const SUMBREAK_ROOT_SELECTOR = '[data-numo-design][data-numo-rows][data-numo-columns]';

function locateSumbreak() {
  for (const doc of collectAccessibleDocuments(document)) {
    const root = doc.querySelector(SUMBREAK_ROOT_SELECTOR);
    if (!root) continue;
    const rows = Number(root.getAttribute('data-numo-rows'));
    const cols = Number(root.getAttribute('data-numo-columns'));
    if (Number.isInteger(rows) && Number.isInteger(cols) && rows >= 2 && cols >= 2) return { doc, root, rows, cols };
  }
  return null;
}

function wildcardValue(text) {
  const m = String(text || '').replace(/\s+/g, '').match(/^([×x*+])(-?\d+)$/i);
  return m ? `${m[1] === '+' ? '+' : 'x'}${Number(m[2])}` : undefined;
}

function cellValue(root, index) {
  const cell = root.querySelector(`[data-numo-index="${index}"]`);
  if (!cell) return undefined;
  const tile = cell.querySelector('button[data-numo-kind]');
  if (!tile) return null;
  const kind = tile.getAttribute('data-numo-kind');
  const label = (root.querySelector(`[data-numo-svg-cell="${index}"] [data-numo-label]`)?.textContent
    || tile.textContent || '').trim();
  if (kind === 'wildcard') return wildcardValue(label);
  if (kind !== 'number') return undefined;
  const text = /^\d+$/.test(label) ? label : (tile.getAttribute('aria-label') || '').match(/\d+/)?.[0];
  const value = Number(text);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

export function readSumbreakBoard(found) {
  const board = [];
  for (let r = 0; r < found.rows; r++) {
    const row = [];
    for (let c = 0; c < found.cols; c++) {
      const v = cellValue(found.root, r * found.cols + c);
      if (v === undefined) return null;
      row.push(v);
    }
    board.push(row);
  }
  return board;
}

function tileButton(found, row, col) {
  return found?.root.querySelector(`[data-numo-index="${row * found.cols + col}"] button[data-numo-kind]`) || null;
}

function isIdle(found) {
  if (!found) return false;
  return Array.from(found.root.querySelectorAll('[data-numo-paint-role]'))
    .every((n) => n.getAttribute('data-numo-paint-role') === 'resting');
}

function isFinished() {
  return /\/games\/(view\/)?sumbreak\/results\//.test(window.location.pathname) || !locateSumbreak();
}

function isPressed(btn) {
  return btn?.getAttribute('aria-pressed') === 'true';
}

function tap(btn) {
  btn.click();
}

class SumbreakDomApiV2 {
  async autoSolve(speedMode = 'turbo') {
    const found = await waitFor(() => locateSumbreak(), 3500, 100);
    if (!found) throw new Error('Plateau Sumbreak introuvable (data-numo-design).');
    const board = readSumbreakBoard(found);
    if (!board || !board.flat().some((v) => typeof v === 'number')) throw new Error('Tuiles Sumbreak illisibles.');
    const moves = solveSumbreak(board);
    console.info('[LG Turbo] Sumbreak :', moves);
    revealInViewport(found.root);
    let done = 0;
    for (const move of moves) {
      if (isFinished()) break;
      const idle = await waitFor(() => isFinished() || isIdle(locateSumbreak()), 3000, 25);
      if (!idle) throw new Error('Sumbreak reste en animation, arrêt.');
      if (isFinished()) break;
      const live = locateSumbreak();
      const before = readSumbreakBoard(live);
      if (!before || mergeValues(before[move.row][move.col], before[move.toRow][move.toCol]) !== move.value) {
        throw new Error(`Les tuiles ne correspondent plus au plan (fusion ${done + 1}).`);
      }
      const source = tileButton(live, move.row, move.col);
      for (const pressed of live.root.querySelectorAll('button[aria-pressed="true"]')) {
        if (pressed !== source) tap(pressed);
      }
      if (!isPressed(source)) tap(source);
      let selected = await waitFor(() => isPressed(tileButton(locateSumbreak(), move.row, move.col)), 700, 20);
      if (!selected) {
        fireClick(tileButton(locateSumbreak(), move.row, move.col));
        selected = await waitFor(() => isPressed(tileButton(locateSumbreak(), move.row, move.col)), 700, 20);
      }
      if (!selected) throw new Error(`Sumbreak n'a pas sélectionné la tuile (fusion ${done + 1}).`);
      const target = tileButton(locateSumbreak(), move.toRow, move.toCol);
      if (!target) throw new Error('Tuile cible Sumbreak introuvable.');
      tap(target);
      const merged = await waitFor(() => {
        if (isFinished()) return true;
        const after = readSumbreakBoard(locateSumbreak());
        return Boolean(after && after[move.row][move.col] === null && after[move.toRow][move.toCol] === move.value);
      }, 2500, 25);
      if (!merged) throw new Error(`Sumbreak n'a pas accepté la fusion ${done + 1}.`);
      done++;
      const delay = getDelayForMode(speedMode);
      if (delay) await sleep(delay);
    }
    return done;
  }
}

export async function autoSolve(options = {}) {
  const { speedMode = 'turbo', autoStart = true } = options;
  if (autoStart) {
    const started = await tryAutoStartGame();
    if (started) await waitForAnyGrid([SUMBREAK_ROOT_SELECTOR], 4500);
  }
  return runStrategies([new SumbreakDomApiV2()], speedMode, 'Sumbreak');
}
