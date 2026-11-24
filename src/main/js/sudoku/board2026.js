import {
  cellsByIndex,
  collectAccessibleDocuments,
  fireClick,
  fireKey,
  focusQuietly,
  getDelayForMode,
  sleep,
  waitFor,
  waitForDom,
} from '../util.js';
import { SudokuGrid } from './solver.js';

export const SUDOKU_BOARD_SELECTORS = [
  '.sudoku-grid',
  '[data-testid="interactive-grid"]',
  '[data-testid$="-game-board"]',
  '.grid-game-board',
];
const N = 6;
const COUNT = N * N;

function locateSudoku() {
  for (const doc of collectAccessibleDocuments(document)) {
    for (const selector of SUDOKU_BOARD_SELECTORS) {
      let boards = [];
      try { boards = doc.querySelectorAll(selector); } catch (_e) { boards = []; }
      for (const board of boards) {
        const cells = cellsByIndex(board, COUNT);
        if (cells) return { doc, board, cells };
      }
    }
    const loose = Array.from(doc.querySelectorAll('.sudoku-cell[data-cell-idx]'));
    if (loose.length === COUNT) {
      const cells = cellsByIndex(doc.body, COUNT);
      if (cells) return { doc, board: cells[0].parentElement, cells };
    }
  }
  return null;
}

export function readSudokuValue(cell) {
  if (cell.querySelector('.sudoku-cell-notes')) return 0;
  const content = cell.querySelector('.sudoku-cell-content');
  const text = ((content ? content.textContent : cell.textContent) || '').trim();
  return /^[1-9]$/.test(text) ? Number(text) : 0;
}

function isPrefilled(cell) {
  return cell.classList.contains('sudoku-cell-prefilled')
    || cell.getAttribute('aria-readonly') === 'true'
    || cell.getAttribute('aria-disabled') === 'true'
    || cell.dataset?.locked === 'true'
    || cell.dataset?.prefilled === 'true';
}

function isSelected(cell) {
  return cell.classList.contains('sudoku-cell-active')
    || cell.classList.contains('sudoku-cell-selected')
    || cell.getAttribute('aria-selected') === 'true';
}

function notesToggle(doc) {
  return doc.querySelector('[data-control-btn="notes"]');
}

function notesEnabled(doc) {
  const toggle = notesToggle(doc);
  if (!toggle) return false;
  return Boolean(toggle.querySelector('.sudoku-under-board__text--active'))
    || toggle.getAttribute('aria-pressed') === 'true'
    || toggle.getAttribute('aria-checked') === 'true';
}

async function disableNotes(doc) {
  if (!notesEnabled(doc)) return;
  fireClick(notesToggle(doc));
  await waitFor(() => !notesEnabled(doc), 800, 40);
  if (notesEnabled(doc)) throw new Error('Impossible de désactiver le mode Notes du Sudoku.');
}

function numberButton(doc, value) {
  const selectors = [
    `button[data-number="${value}"]`,
    `[data-control-btn="${value}"]`,
    `button[aria-label="${value}"]`,
  ];
  for (const selector of selectors) {
    const el = doc.querySelector(selector);
    if (el) return el;
  }
  for (const btn of doc.querySelectorAll('.sudoku-input-buttons__numbers button, [class*="number"] button')) {
    if ((btn.textContent || '').trim() === String(value)) return btn;
  }
  return null;
}

async function waitValue(found, index, value, isLast) {
  return waitForDom(found.doc.documentElement, () => {
    const now = locateSudoku();
    if (!now) return isLast ? 'gone' : null;
    return readSudokuValue(now.cells[index]) === value ? 'ok' : null;
  }, isLast ? 1500 : 600);
}

async function enterValue(index, value, isLast, state) {
  const found = locateSudoku();
  if (!found) throw new Error('Grille Sudoku introuvable pendant la saisie.');
  const cell = found.cells[index];
  fireClick(cell);
  await waitFor(() => {
    const now = locateSudoku();
    return now && isSelected(now.cells[index]);
  }, 300, 20);
  const methods = state.method === 'buttons' ? ['buttons', 'keyboard'] : ['keyboard', 'buttons'];
  for (const method of methods) {
    const live = locateSudoku() || found;
    if (method === 'keyboard') {
      const target = live.cells[index].closest('.sudoku-grid') || live.board || live.doc.body;
      focusQuietly(target);
      fireKey(target, String(value), `Digit${value}`, 48 + value);
    } else {
      const btn = numberButton(live.doc, value);
      if (!btn) continue;
      fireClick(btn);
    }
    const outcome = await waitValue(live, index, value, isLast);
    if (outcome) {
      state.method = method;
      return;
    }
  }
  throw new Error(`Le Sudoku n'a pas accepté le ${value} en case ${index}.`);
}

export class SudokuDomApiV2 {
  async autoSolve(speedMode = 'turbo') {
    const found = await waitFor(() => locateSudoku(), 3500, 120);
    if (!found) throw new Error('Grille Mini Sudoku introuvable (page et iframes inspectées).');
    const grid = new SudokuGrid(N, 3, 2);
    const prefilled = found.cells.map(isPrefilled);
    found.cells.forEach((cell, idx) => {
      if (prefilled[idx]) {
        const v = readSudokuValue(cell);
        if (v > 0) grid.mark(idx, v);
      }
    });
    const final = found.cells.map((cell, idx) => (prefilled[idx] ? readSudokuValue(cell) : 0));
    for (const { idx, val } of grid.solve()) final[idx] = val;
    if (final.some((v) => !v)) throw new Error('Mini Sudoku : solution incomplète.');
    console.info('[LG Turbo] Mini Sudoku :', final);
    await disableNotes(found.doc);
    const todo = [];
    found.cells.forEach((cell, idx) => {
      if (!prefilled[idx] && readSudokuValue(cell) !== final[idx]) todo.push(idx);
    });
    const state = { method: null };
    for (let k = 0; k < todo.length; k++) {
      await enterValue(todo[k], final[todo[k]], k === todo.length - 1, state);
      const delay = getDelayForMode(speedMode);
      if (delay) await sleep(delay);
    }
    return todo.length;
  }
}
