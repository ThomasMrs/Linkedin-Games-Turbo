import {
  cellCenter,
  cellsByIndex,
  collectAccessibleDocuments,
  dragThrough,
  getDelayForMode,
  revealInViewport,
  runStrategies,
  sleep,
  tryAutoStartGame,
  waitFor,
  waitForAnyGrid,
  waitForPagePuzzle,
  waitForSettle,
} from '../util.js';
import { solvePatches } from './solver.js';

export const PATCHES_BOARD_SELECTORS = [
  '[data-testid="patches-game-board"] [data-testid="interactive-grid"]',
  '[data-testid="patches-game-board"]',
  '[data-testid="interactive-grid"]',
];

function locatePatches(count) {
  for (const doc of collectAccessibleDocuments(document)) {
    for (const selector of PATCHES_BOARD_SELECTORS) {
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

export function patchesInputFromPuzzle(puzzle) {
  const rows = Number(puzzle?.gridRows ?? puzzle?.gridSize);
  const cols = Number(puzzle?.gridCols ?? puzzle?.gridSize);
  const clueCells = Array.isArray(puzzle?.clueCells) ? puzzle.clueCells : null;
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || !clueCells) return null;
  const clues = clueCells.map((c) => ({
    idx: Number(c?.cellIdx),
    shape: c?.shapeConstraint,
    area: Number(c?.numberConstraint) || null,
  }));
  return { rows, cols, clues };
}

class PatchesDomApiV2 {
  async autoSolve(speedMode = 'turbo') {
    const data = await waitForPagePuzzle(['patchesGamePuzzle'], 3500);
    if (!data) throw new Error('Données de la grille Patches indisponibles.');
    const input = patchesInputFromPuzzle(data.puzzle);
    if (!input) throw new Error('Format de grille Patches inattendu.');
    const solutions = solvePatches(input.rows, input.cols, input.clues);
    if (!solutions) throw new Error('Grille Patches lue mais aucun pavage trouvé.');
    const regions = solutions[0].slice().sort((a, b) => a.top - b.top || a.left - b.left);
    console.info('[LG Turbo] Patches :', regions);
    const count = input.rows * input.cols;
    const found = await waitFor(() => locatePatches(count), 2500, 100);
    if (!found) throw new Error('Cases Patches introuvables (data-cell-idx).');
    revealInViewport(found.board);
    await sleep(60);
    for (const region of regions) {
      const live = locatePatches(count) || found;
      const a = live.cells[region.top * input.cols + region.left];
      const b = live.cells[(region.top + region.height - 1) * input.cols + region.left + region.width - 1];
      await dragThrough(live.doc, [cellCenter(a), cellCenter(b)], {
        steps: 6,
        stepDelay: 0,
        startDelay: 0,
        click: true,
        fallbacks: [a, b],
      });
      await waitForSettle(live.board, 150);
      const delay = getDelayForMode(speedMode);
      if (delay) await sleep(delay);
    }
    return regions.length;
  }
}

export async function autoSolve(options = {}) {
  const { speedMode = 'turbo', autoStart = true } = options;
  if (autoStart) {
    const started = await tryAutoStartGame();
    if (started) await waitForAnyGrid([...PATCHES_BOARD_SELECTORS, '[data-cell-idx]'], 4500);
  }
  return runStrategies([new PatchesDomApiV2()], speedMode, 'Patches');
}
