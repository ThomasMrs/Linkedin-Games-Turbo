import wordsText from '../../../assets/wend/words.txt';
import supplementalText from '../../../assets/wend/supplemental_words.txt';
import properText from '../../../assets/wend/proper_nouns.txt';
import rareText from '../../../assets/wend/rare_words.txt';
import {
  cellCenter,
  cellsByIndex,
  collectAccessibleDocuments,
  dragThrough,
  getDelayForMode,
  readPagePuzzle,
  revealInViewport,
  runStrategies,
  sleep,
  tryAutoStartGame,
  waitFor,
  waitForAnyGrid,
} from '../util.js';
import { parseWordList, solveWend } from './solver.js';

export const WEND_BOARD_SELECTORS = [
  '[data-testid="wend-game-board"]',
  '[data-testid="interactive-grid"]',
];
const SLOT_ROWS = '[data-testid^="wend-word-list-slots-"]';
const SLOT = '[data-testid^="wend-word-list-slot-"]';

let dictionary = null;
function getDictionary() {
  if (!dictionary) {
    dictionary = {
      words: [...parseWordList(wordsText), ...parseWordList(supplementalText)],
      rare: new Set([...parseWordList(properText), ...parseWordList(rareText)]),
    };
  }
  return dictionary;
}

function locateWend() {
  for (const doc of collectAccessibleDocuments(document)) {
    for (const selector of WEND_BOARD_SELECTORS) {
      let boards = [];
      try { boards = doc.querySelectorAll(selector); } catch (_e) { boards = []; }
      for (const board of boards) {
        const cells = cellsByIndex(board);
        if (!cells) continue;
        const size = Math.round(Math.sqrt(cells.length));
        if (size * size === cells.length && size >= 4 && size <= 9) return { doc, board, cells, size };
      }
    }
  }
  return null;
}

function isHole(cell) {
  return cell.getAttribute('data-cell-is-hole') === 'true';
}

function isLocked(cell) {
  return cell?.getAttribute('data-cell-is-locked') === 'true';
}

export function readWendBoard(found) {
  const board = [];
  for (let r = 0; r < found.size; r++) {
    const row = [];
    for (let c = 0; c < found.size; c++) {
      const cell = found.cells[r * found.size + c];
      const text = (cell.textContent || '').trim().toUpperCase();
      if (isHole(cell) || !text) row.push(null);
      else if (/^[A-Z]$/.test(text)) row.push(text);
      else return null;
    }
    board.push(row);
  }
  return board;
}

function slotRows() {
  for (const doc of collectAccessibleDocuments(document)) {
    const rows = Array.from(doc.querySelectorAll(SLOT_ROWS));
    if (rows.length) return rows;
  }
  return [];
}

function readLengths() {
  return slotRows().map((row) => row.querySelectorAll(SLOT).length).filter((n) => n > 0);
}

function wordShownInSlots(word) {
  return slotRows().some((row) => (row.textContent || '').replace(/\s+/g, '').toUpperCase() === word);
}

function findWordList(value, lengthsKey, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 6) return null;
  if (Array.isArray(value)) {
    const strings = value.map((v) => (typeof v === 'string' ? v : typeof v?.word === 'string' ? v.word : null));
    if (strings.length && strings.every((s) => s && /^[A-Za-z]+$/.test(s))) {
      const key = strings.map((s) => s.length).sort((a, b) => a - b).join(',');
      if (key === lengthsKey) return strings.map((s) => s.toUpperCase());
    }
  }
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    const found = findWordList(child, lengthsKey, depth + 1);
    if (found) return found;
  }
  return null;
}

class WendDomApiV2 {
  async autoSolve(speedMode = 'turbo') {
    const found = await waitFor(() => locateWend(), 3500, 100);
    if (!found) throw new Error('Grille Wend introuvable (wend-game-board).');
    const board = readWendBoard(found);
    if (!board) throw new Error('Lettres Wend illisibles.');
    const lengths = readLengths();
    if (!lengths.length) throw new Error('Longueurs des mots Wend introuvables.');
    const lengthsKey = lengths.slice().sort((a, b) => a - b).join(',');
    const page = readPagePuzzle();
    const gameWords = page ? findWordList(page.puzzle, lengthsKey) : null;
    const { words, rare } = getDictionary();
    let result = gameWords ? solveWend(board, lengths, gameWords) : null;
    if (!result?.best) result = solveWend(board, lengths, words, { rare });
    if (!result.best) throw new Error('Aucune combinaison de mots Wend trouvée.');
    if (result.ambiguous) console.warn('[LG Turbo] Wend : plusieurs solutions possibles, la plus courante est utilisée.', result.solutions);
    console.info('[LG Turbo] Wend :', result.best.words.map((w) => w.word));
    revealInViewport(found.board);
    await sleep(40);
    let done = 0;
    for (const entry of result.best.words) {
      const live = locateWend();
      if (!live) break;
      const cells = entry.path.map((i) => live.cells[i]);
      if (cells.every(isLocked)) continue;
      if (cells.some(isLocked)) throw new Error(`Le mot ${entry.word} chevauche un mot déjà validé.`);
      await dragThrough(live.doc, cells.map(cellCenter), { steps: 4, stepDelay: 8, startDelay: 16, fallbacks: cells });
      const accepted = await waitFor(() => {
        const now = locateWend();
        if (!now) return true;
        return entry.path.every((i) => isLocked(now.cells[i])) || wordShownInSlots(entry.word);
      }, 2000, 30);
      if (!accepted) throw new Error(`Wend n'a pas accepté le mot ${entry.word}.`);
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
    if (started) await waitForAnyGrid([...WEND_BOARD_SELECTORS, '[data-cell-idx]'], 4500);
  }
  return runStrategies([new WendDomApiV2()], speedMode, 'Wend');
}
