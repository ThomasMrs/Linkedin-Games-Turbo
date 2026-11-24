import { getGridDiv, anticipateOneMutation, tryAutoStartGame, waitForAnyGrid, runStrategies } from '../util.js';
import { solveQueens } from './solver.js';
import { QueensDomApiV2, QUEENS_BOARD_SELECTORS } from './board2026.js';

const QUEENS_GRID_SELECTORS = [...QUEENS_BOARD_SELECTORS, '[data-cell-idx]'];

export async function autoSolve(options = {}) {
  const { speedMode = 'turbo', autoStart = true } = options;
  if (autoStart) {
    const started = await tryAutoStartGame();
    if (started) {
      await waitForAnyGrid(QUEENS_GRID_SELECTORS, 4500);
    }
  }
  return runStrategies([new QueensDomApiV2(), new QueensDomApiV1(), new QueensDomApiV0()], speedMode, 'Queens');
}

function parseQueensMark(cellDiv) {
  const mark = cellDiv.attributes?.getNamedItem('aria-label')?.value?.toLowerCase() ?? '';
  if (!mark) return 0;
  if (mark.includes('queen') || mark.includes('reine') || mark.includes('couronne') || mark.includes('crown')) {
    return 2;
  }
  if (mark.includes('cross') || mark.includes('croix') || mark.includes('marked with an x')) {
    return 1;
  }
  return 0;
}

class QueensDomApi {

  async autoSolve(speedMode = 'turbo') {
    const gridDiv = this.getQueensGridDiv();
    const [cellDivs, queensGridArg, existingMarks] =
        this.#transformQueensGridDiv(gridDiv);
    const queenIndices = solveQueens(queensGridArg);
    console.info('Solution identified:', queenIndices);
    return await this.clickQueens(cellDivs, queenIndices, existingMarks, speedMode);
  }

  #transformQueensGridDiv(gridDiv) {
    const filtered = Array.from(gridDiv.children)
        .filter(c => this.gridDivChildIsCellDiv(c));
    if (filtered.length === 0) {
      this.orElseThrow(null, 'transformQueensGridDiv', 'gridDiv contained no '
          + 'children that matched cellDiv filter');
    }
    const cellDivs = new Array(filtered.length);
    const queensGridArg = new Array(cellDivs.length);
    const existingMarks = new Map();
    for (const cellDiv of filtered) {
      const idx = this.getCellDivIdx(cellDiv);
      const color = this.getCellDivColor(cellDiv);
      cellDivs[idx] = cellDiv;
      queensGridArg[idx] = {idx: idx, color: color};
      const existingMark = this.getCellDivExistingMark(cellDiv);
      if (existingMark) {
        existingMarks.set(idx, existingMark);
      }
    }
    return [cellDivs, queensGridArg, existingMarks];
  }

  async clickQueens(cellDivs, queenLocations, existingMarks, speedMode = 'turbo') {
    let clicks = 0;
    for (const loc of queenLocations) {
      const existingMark = existingMarks.get(loc) ?? 0;
      const cellDiv = cellDivs[loc];
      for (let i = existingMark; i < 2; i++) {
        await anticipateOneMutation(cellDiv, loc, speedMode);
        clicks++;
      }
      if (existingMark === 2) {
        existingMarks.delete(loc);
      }
    }
    for (const [key, value] of existingMarks) {
      if (value === 2) {
        await anticipateOneMutation(cellDivs[key], key, speedMode);
        clicks++;
      }
    }
    return clicks;
  }

}

class QueensDomApiV1 extends QueensDomApi {

  async autoSolve(speedMode = 'turbo') {
    const rawSolution = this.getSolution();
    const processedSolution = this.processSolution(rawSolution);
    const gridDiv = this.getQueensGridDiv();
    const [cellDivs, existingMarks] = this.transformQueensGridDiv(gridDiv);
    return await this.clickCells(cellDivs, processedSolution, existingMarks, speedMode);
  }

  getSolution() {
    const hydrationScript = this.orElseThrow(
          getGridDiv(d => d.getElementById('rehydrate-data')), 'getSolution',
          'No script with id rehydrate-data found')
        .textContent;
    const indicator = '\\"solution\\"';
    const anchor = hydrationScript.indexOf(indicator);
    if (anchor < 0) {
      this.orElseThrow(null, 'getSolution', 'Failed to locate indicator');
    }
    const start = hydrationScript.indexOf('[', anchor + indicator.length);
    const end = hydrationScript.indexOf(']', start);
    const substring = hydrationScript.substring(start, end + 1);
    return JSON.parse(substring.replaceAll('\\', ''));
  }

  processSolution(rawSolution) {
    const n = rawSolution.length;
    const result = rawSolution.map((x) => n * x.row + x.col);
    console.info('Solution identified:', result);
    return result;
  }

  getQueensGridDiv() {
    return this.orElseThrow(
        getGridDiv(d => d.querySelector('[data-testid="interactive-grid"]')),
        'getQueensGridDiv', 'QueensGridDiv selector yielded nothing');
  }

  transformQueensGridDiv(gridDiv) {
    const filtered = Array.from(gridDiv.children)
        .filter(c => this.gridDivChildIsCellDiv(c));
    if (filtered.length === 0) {
      this.orElseThrow(null, 'transformQueensGridDiv', 'gridDiv contained no '
          + 'children that matched cellDiv filter');
    }
    const cellDivs = new Array(filtered.length);
    const existingMarks = new Map();
    for (const cellDiv of filtered) {
      const idx = this.getCellDivIdx(cellDiv);
      cellDivs[idx] = cellDiv;
      const existingMark = this.getCellDivExistingMark(cellDiv);
      if (existingMark) {
        existingMarks.set(idx, existingMark);
      }
    }
    return [cellDivs, existingMarks];
  }

  gridDivChildIsCellDiv(gridDivChild) {
    return gridDivChild.attributes?.getNamedItem('data-cell-idx');
  }

  getCellDivIdx(cellDiv) {
    const dataCellIdx = cellDiv.attributes
        ?.getNamedItem('data-cell-idx')?.value;
    return parseInt(this.orElseThrow(dataCellIdx, 'getIdFromCellDiv',
        `Failed to parse an integer data cell ID from ${dataCellIdx}`));
  }

  getCellDivExistingMark(cellDiv) {
    return parseQueensMark(cellDiv);
  }

  orElseThrow(result, fname, cause) {
    if (result != null) {
      return result;
    }
    throw new Error(`${fname} failed using QueensDomApiV1: ${cause}`);
  }

  async clickCells(cellDivs, clickSequence, existingMarks, speedMode = 'turbo') {
    let clicks = 0;
    for (const loc of clickSequence) {
      const existingMark = existingMarks.get(loc) ?? 0;
      const cellDiv = cellDivs[loc];
      for (let i = existingMark; i < 2; i++) {
        await anticipateOneMutation(cellDiv, loc, speedMode);
        clicks++;
      }
      if (existingMark === 2) {
        existingMarks.delete(loc);
      }
    }
    for (const [key, value] of existingMarks) {
      if (value === 2) {
        await anticipateOneMutation(cellDivs[key], key, speedMode);
        clicks++;
      }
    }
    return clicks;
  }

}

class QueensDomApiV0 extends QueensDomApi {

  getQueensGridDiv() {
    return this.orElseThrow(getGridDiv(d => d.getElementById('queens-grid')),
        'getQueensGridDiv', 'QueensGridDiv selector yielded nothing');
  }

  gridDivChildIsCellDiv(gridDivChild) {
    return gridDivChild.attributes?.getNamedItem('data-cell-idx');
  }

  getCellDivIdx(cellDiv) {
    const dataCellIdx = cellDiv.attributes
        ?.getNamedItem('data-cell-idx')?.value;
    return parseInt(this.orElseThrow(dataCellIdx, 'getCellDivIdx',
        `Failed to parse an integer data cell ID from ${dataCellIdx}`));
  }

  getCellDivColor(cellDiv) {
    const fname = 'getCellDivColor';
    const clazz = cellDiv.attributes?.getNamedItem('class')?.value ?? '';
    const indicator = 'cell-color-';
    const pos = clazz.indexOf(indicator);
    if (pos < 0) {
      this.orElseThrow(undefined, fname,
          `Failed to find class with pattern ${indicator}{...}; saw: ${clazz}`);
    }
    const color = parseInt(clazz.substring(pos + indicator.length));
    return this.orElseThrow(Number.isNaN(color) ? null : color, fname,
        `Class pattern ${indicator}{...} did not terminate in number`);
  }

  getCellDivExistingMark(cellDiv) {
    return parseQueensMark(cellDiv);
  }

  orElseThrow(result, fname, cause) {
    if (result != null) {
      return result;
    }
    throw new Error(`${fname} failed using QueensDomApiV0: ${cause}`);
  }

}
