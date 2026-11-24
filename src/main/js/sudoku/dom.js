import {
  doOneClick,
  getGridDiv,
  sleep,
  getDelayForMode,
  tryAutoStartGame,
  waitForAnyGrid,
  runStrategies,
} from '../util.js';
import { SudokuGrid } from './solver.js';
import { SudokuDomApiV2, SUDOKU_BOARD_SELECTORS } from './board2026.js';

const SUDOKU_GRID_SELECTORS = [...SUDOKU_BOARD_SELECTORS, '.sudoku-cell[data-cell-idx]'];

export async function autoSolve(options = {}) {
  const { speedMode = 'turbo', autoStart = true } = options;
  if (autoStart) {
    const started = await tryAutoStartGame();
    if (started) {
      await waitForAnyGrid(SUDOKU_GRID_SELECTORS, 4500);
    }
  }
  return runStrategies([new SudokuDomApiV2(), new SudokuDomApiV0(), new SudokuDomApiV1()], speedMode, 'Mini Sudoku');
}

class SudokuDomApi {

  async autoSolve(speedMode = 'turbo') {
    const gameBoardDiv = this.getGameBoardDiv();
    const gridDiv = this.getSudokuGridDiv();
    const numberDivs = this.getNumberDivs();
    const [cellDivs, sudokuGrid] = this.#transformSudokuGridDiv(gridDiv);
    const solution = sudokuGrid.solve();
    console.info('Solution identified:', solution);
    return await this.doSolve(gameBoardDiv, cellDivs, numberDivs, solution, speedMode);
  }

  #transformSudokuGridDiv(gridDiv) {
    const filtered = Array.from(gridDiv.children)
        .filter(c => this.gridDivChildIsCellDiv(c));
    if (filtered.length === 0) {
      this.orElseThrow(null, 'transformSudokuGridDiv', 'gridDiv contained no '
          + 'children that matched cellDiv filter');
    }
    const cellDivs = new Array(filtered.length);
    const sudokuGrid = new SudokuGrid(6, 3, 2);
    for (const cellDiv of filtered) {
      const idx = this.getCellDivIdx(cellDiv);
      cellDivs[idx] = cellDiv;
      const lockedContent = this.getLockedContent(cellDiv);
      if (lockedContent > 0) {
        sudokuGrid.mark(idx, lockedContent);
      }
    }
    return [cellDivs, sudokuGrid];
  }

  async doSolve(gameBoardDiv, cellDivs, numberDivs, solution, speedMode = 'turbo') {
    let syncNotesDiv = null;
    try {
      syncNotesDiv = this.getNotesDiv();
    } catch (_e) {
      try {
        const annoyingPopup = this.getAnnoyingPopupDiv();
        await new Promise((resolve) => {
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutRef);
            observer.disconnect();
            resolve();
          };
          const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
              if (this.mutationCreatesNotesToggle(mutation)) {
                finish();
                return;
              }
            }
          });
          const timeoutRef = setTimeout(finish, 2500);
          observer.observe(gameBoardDiv, {
            attributes: true,
            attributeFilter: ['class'],
            subtree: true,
            childList: true,
          });
          this.clearAnnoyingPopup(annoyingPopup);
        });
        try {
          syncNotesDiv = this.getNotesDiv();
        } catch (_e2) {
          syncNotesDiv = null;
        }
      } catch (_popupErr) {
        // No popup to dismiss; proceed straight to clicking cells
      }
    }

    if (syncNotesDiv) {
      try {
        this.disableNotes(syncNotesDiv);
      } catch (e) {
        console.warn('[LG Turbo] Could not toggle notes off:', e);
      }
    }
    return await this.#clickCells(cellDivs, numberDivs, solution, speedMode);
  }

  async #clickCells(cellDivs, numberDivs, solution, speedMode = 'turbo') {
    for (const packed of solution) {
      const idx = packed.idx;
      const val = packed.val;
      doOneClick(cellDivs[idx]);
      doOneClick(numberDivs[val - 1]);
      const delay = getDelayForMode(speedMode);
      if (delay > 0) {
        await sleep(delay);
      }
    }
    return solution.length;
  }

}

class SudokuDomApiV0 extends SudokuDomApi {

  getGameBoardDiv() {
    return this.orElseThrow(
        getGridDiv(d => d.querySelector('.game-board.grid-board-wrapper') || d.querySelector('.grid-game-board')?.parentElement),
        'getGameBoardDiv', 'SudokuGameBoardDiv selector yielded nothing');
  }

  getSudokuGridDiv() {
    return this.orElseThrow(
        getGridDiv(d => d.querySelector('.grid-game-board')),
        'getSudokuGridDiv', 'SudokuGridDiv selector yielded nothing');
  }

  gridDivChildIsCellDiv(childDiv) {
    return childDiv.attributes?.getNamedItem('data-cell-idx');
  }

  getCellDivIdx(cellDiv) {
    const dataCellIdx = cellDiv.attributes
        ?.getNamedItem('data-cell-idx')?.value;
    return parseInt(this.orElseThrow(dataCellIdx, 'getIdFromCellDiv',
        `Failed to parse an integer data cell ID from ${dataCellIdx}`));
  }

  getLockedContent(cellDiv) {
    if (this.cellDivIsLocked(cellDiv)) {
      const content = cellDiv.querySelector('.sudoku-cell-content');
      if (content && content.textContent) {
        const parsed = parseInt(content.textContent);
        return this.orElseThrow(Number.isNaN(parsed) ? null : parsed,
            'getLockedContent', `Expected number, found ${content.textContent}`);
      }
    }
    return -1;
  }

  cellDivIsLocked(cellDiv) {
    return cellDiv.classList.contains('sudoku-cell-prefilled');
  }

  getNumberDivs() {
    const wrapper = this.orElseThrow(
        getGridDiv(d => d.querySelector('.sudoku-input-buttons__numbers')),
        'getNumberDivs', 'SudokuNumberDiv selector yielded nothing');
    const result = new Array(6).fill(null);
    for (let i = 0; i < 6; i++) {
      const button = this.orElseThrow(wrapper.querySelector(`button[data-number="${i+1}"]`),
        'getNumberDivs', 'Numeric button selector yielded nothing for i=' + i);
      result[i] = button;
    }
    return result;
  }

  mutationCreatesNotesToggle(mutation) {
    return mutation.target.classList?.contains('sudoku-under-board-controls-container');
  }

  getNotesDiv() {
    return this.orElseThrow(
        getGridDiv(d => d.querySelector('.sudoku-under-board-controls-container')),
        'getNotesDiv', 'NotesDiv selector yielded nothing');
  }

  disableNotes(notesDiv) {
    const toggle = notesDiv.querySelector('[aria-label*="notes" i], [role="switch"]');
    const isAriaOn = toggle && (
      toggle.getAttribute('aria-pressed') === 'true' ||
      toggle.getAttribute('aria-checked') === 'true'
    );
    const activeSpan = notesDiv.querySelector('span');
    const text = (activeSpan?.textContent || '').trim().toLowerCase();
    const isTextOn = text === 'on' || text === 'activé' || text === 'active' || text === 'oui';
    if (isAriaOn || isTextOn) {
      if (toggle) {
        doOneClick(toggle);
      }
    }
  }

  getAnnoyingPopupDiv() {
    return this.orElseThrow(
        getGridDiv(d => d.querySelector('.sudoku-under-board-scrim-message')),
        'getAnnoyingPopupDiv', 'AnnoyingPopupDiv selector yielded nothing');
  }

  clearAnnoyingPopup(popupDiv) {
    const button = popupDiv.querySelector(
      'button[aria-label*="close" i], button[aria-label*="fermer" i], button[aria-label*="dismiss" i], button'
    );
    doOneClick(this.orElseThrow(button, 'clearAnnoyingPopup',
        'Could not extract hint popup close button'));
  }

  orElseThrow(result, fname, cause) {
    if (result != null) {
      return result;
    }
    throw new Error(`${fname} failed using SudokuDomApiV0: ${cause}`);
  }

}

class SudokuDomApiV1 extends SudokuDomApiV0 {

  getGameBoardDiv() {
    return this.orElseThrow(
        getGridDiv(d => d.querySelector('[data-testid="interactive-grid"]')?.parentElement),
        'getGameBoardDiv', 'SudokuGameBoardDiv V1 selector yielded nothing');
  }

  getSudokuGridDiv() {
    return this.orElseThrow(
        getGridDiv(d => d.querySelector('[data-testid="interactive-grid"]')),
        'getSudokuGridDiv', 'SudokuGridDiv V1 selector yielded nothing');
  }

  getLockedContent(cellDiv) {
    if (cellDiv.getAttribute('aria-readonly') === 'true' || cellDiv.dataset?.locked === 'true' || cellDiv.classList.contains('sudoku-cell-prefilled')) {
      const parsed = parseInt((cellDiv.textContent || '').trim());
      if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 6) {
        return parsed;
      }
    }
    return -1;
  }

  getNumberDivs() {
    const result = new Array(6).fill(null);
    for (let i = 0; i < 6; i++) {
      const btn = getGridDiv(d =>
        d.querySelector(`button[data-number="${i + 1}"]`) ||
        d.querySelector(`button[aria-label="${i + 1}"]`)
      );
      result[i] = this.orElseThrow(btn, 'getNumberDivs', `Missing button ${i + 1}`);
    }
    return result;
  }

  orElseThrow(result, fname, cause) {
    if (result != null) {
      return result;
    }
    throw new Error(`${fname} failed using SudokuDomApiV1: ${cause}`);
  }

}
