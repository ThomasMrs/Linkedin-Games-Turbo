import { getGridDiv, anticipateOneMutation, tryAutoStartGame, waitForAnyGrid } from '../util.js';
import { learnMarkStrategy } from './markStrategy.js';
import { solveTango } from './solver.js';

const TANGO_GRID_SELECTORS = ['[data-testid="interactive-grid"]', '.lotka-grid'];

export async function autoSolve(options = {}) {
  const { speedMode = 'turbo', autoStart = true } = options;
  if (autoStart) {
    const started = await tryAutoStartGame();
    if (started) {
      await waitForAnyGrid(TANGO_GRID_SELECTORS, 4500);
    }
  }

  const t0 = performance.now();
  const prioritizedApis = [new TangoDomApiV1(), new TangoDomApiV0()];
  let lastError = null;
  for (let i = 0; i < prioritizedApis.length; i++) {
    const api = prioritizedApis[i];
    try {
      const moves = await api.autoSolve(speedMode);
      return {
        success: true,
        durationMs: Math.max(1, Math.round(performance.now() - t0)),
        moves,
        api: api.constructor.name,
      };
    } catch (e) {
      lastError = e;
      console.error(e);
      if (i + 1 !== prioritizedApis.length) {
        console.info('Will reattempt autoSolve() via a prior API');
      } else {
        console.error('All APIs exhausted');
      }
    }
  }
  throw lastError || new Error('Impossible de résoudre Tango sur cette page');
}

class TangoDomApiV1 {

  async autoSolve(speedMode = 'turbo') {
    const hydrationScript = this.getHydrationScript();
    const solution = this.getSolution(hydrationScript);
    console.info('Solution identified:', solution);
    const gridSize = this.getGridSize(hydrationScript);
    const cellCount = gridSize * gridSize;
    const presetCells = this.getPresetCells(hydrationScript, cellCount);
    const gridDiv = this.getTangoGridDiv();
    const [cellDivs, clickableCell] =
        this.transformTangoGridDiv(gridDiv, presetCells, cellCount);
    const markStrategy = await learnMarkStrategy(
        clickableCell,
        c => this.getCellDivIsBlank(c));
    return await this.clickCells(cellDivs, solution, markStrategy, presetCells, speedMode);
  }

  getHydrationScript() {
    return this.orElseThrow(
          getGridDiv(d => d.getElementById('rehydrate-data')),
          'getHydrationScript',
          'No script with id rehydrate-data found')
        .textContent;
  }

  getGridSize(hydrationScript) {
    const indicator = '\\"gridSize\\"';
    const anchor = hydrationScript.indexOf(indicator);
    if (anchor < 0) {
      this.orElseThrow(null, 'getGridSize', 'Failed to locate indicator');
    }
    const start = hydrationScript.indexOf(':', anchor + indicator.length) + 1;
    const end = hydrationScript.indexOf(',', start);
    const substring = hydrationScript.substring(start, end);
    return JSON.parse(substring);
  }

  getPresetCells(hydrationScript, cellCount) {
    const indicator = '\\"presetCellIdxes\\"';
    const anchor = hydrationScript.indexOf(indicator);
    if (anchor < 0) {
      this.orElseThrow(null, 'getPresetCells', 'Failed to locate indicator');
    }
    const start = hydrationScript.indexOf('[', anchor + indicator.length);
    const end = hydrationScript.indexOf(']', start);
    const substring = hydrationScript.substring(start, end + 1);
    const result = new Array(cellCount).fill(false);
    const parsed = JSON.parse(substring);
    for (const idx of parsed) {
      if (idx >= cellCount || idx < 0) {
        this.orElseThrow(null, 'getPresetCells', `idx ${idx} out of bounds`);
      }
      result[idx] = true;
    }
    return result;
  }

  getTangoGridDiv() {
    return this.orElseThrow(
        getGridDiv(d => d.querySelector('[data-testid="interactive-grid"]')),
        'getTangoGridDiv', 'TangoGridDiv selector yielded nothing');
  }

  transformTangoGridDiv(gridDiv, presetCells, cellCount) {
    const filtered = Array.from(gridDiv.children)
        .filter(c => this.getCellDivDataCellIdx(c));
    if (filtered.length !== cellCount) {
      this.orElseThrow(null, 'transformTangoGridDiv', 'gridDiv contained '
          + filtered.length + ' cells matching filter, expected ' + cellCount);
    }
    const cellDivs = new Array(cellCount);
    for (const cellDiv of filtered) {
      const idx = this.getCellDivIdx(cellDiv);
      cellDivs[idx] = cellDiv;
    }
    const nullIdx = cellDivs.findIndex(e => !e);
    if (nullIdx >= 0) {
      this.orElseThrow(null, 'transformTangoGridDiv',
          `Undefined cell div at position ${nullIdx}`);
    }
    let cellIdx = presetCells.findIndex(e => !e);
    if (cellIdx < 0) {
      this.orElseThrow(null, 'transformTangoGridDiv', 'No free cells found');
    }
    return [cellDivs, cellDivs[cellIdx]];
  }

  getCellDivIdx(cellDiv) {
    const dataCellIdx = this.getCellDivDataCellIdx(cellDiv);
    return parseInt(this.orElseThrow(dataCellIdx, 'getIdFromCellDiv',
        `Failed to parse an integer data cell ID from ${dataCellIdx}`));
  }

  getCellDivDataCellIdx(gridDivChild) {
    return gridDivChild.attributes?.getNamedItem('data-cell-idx')?.value;
  }

  getCellDivIsBlank(cellDiv) {
    return !!cellDiv.querySelector('[data-testid="cell-empty"]');
  }

  getSolution(hydrationScript) {
    return this.processSolution(this.getRawSolution(hydrationScript));
  }

  getRawSolution(hydrationScript) {
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
    return rawSolution.map((x) => {
      if ('LotkaCellValue_ZERO' === x) {
        return 1;
      } else if ('LotkaCellValue_ONE' === x) {
        return 2;
      } else {
        this.orElseThrow(null, 'processSolution',
            `Unexpected rawSolution entry ${x} in ${rawSolution}`);
      }
    });
  }

  orElseThrow(result, fname, cause) {
    if (result != null) {
      return result;
    }
    throw new Error(`${fname} failed using TangoDomApiV1: ${cause}`);
  }

  async clickCells(cellDivs, solution, markStrategy, presetCells, speedMode = 'turbo') {
    if (cellDivs.length !== solution.length) {
      throw new Error(`cellDivs length ${cellDivs.length} does not match `
          + `solution length ${solution.length}`);
    }
    let clicks = 0;
    for (let i = 0; i < solution.length; i++) {
      if (presetCells[i]) {
        continue;
      }
      const cellDiv = cellDivs[i];
      const currentMark = markStrategy.getCellDivColor(cellDiv);
      const desiredMark = solution[i];
      for (let j = currentMark; j !== desiredMark; j = (j + 1) % 3) {
        await anticipateOneMutation(cellDiv, i, speedMode);
        clicks++;
      }
    }
    return clicks;
  }

}

class TangoDomApiV0 {

  async autoSolve(speedMode = 'turbo') {
    const gridDiv = this.getTangoGridDiv();
    const cellDivs = this.#getCellDivsFromGridDiv(gridDiv);
    const clickableCell = this.getClickableCell(cellDivs);
    const markStrategy = await learnMarkStrategy(
        clickableCell,
        c => this.cellDivIsBlank(c));
    const tangoGridArgs = this.#transformTangoGridDiv(cellDivs, markStrategy);
    const markSequence = solveTango(...tangoGridArgs);
    console.info('Solution identified:', markSequence);
    return await this.clickCells(cellDivs, markSequence, markStrategy, speedMode);
  }

  getTangoGridDiv() {
    return this.orElseThrow(getGridDiv(d => d.querySelector('.lotka-grid')),
        'getTangoGridDiv', 'TangoGridDiv selector yielded nothing');
  }

  #getCellDivsFromGridDiv(gridDiv) {
    const filtered = Array.from(gridDiv.children)
      .filter(c => this.gridDivChildIsCellDiv(c));
    if (filtered.length === 0) {
      this.orElseThrow(null, 'getCellDivsFromGridDiv', 'gridDiv contained no '
          + 'children that matched cellDiv filter');
    }
    const cellDivs = new Array(filtered.length);
    for (const cellDiv of filtered) {
      cellDivs[this.getCellDivIdx(cellDiv)] = cellDiv;
    }
    const nullIdx = cellDivs.findIndex(e => !e);
    if (nullIdx >= 0) {
      this.orElseThrow(null, 'getCellDivsFromGridDiv',
          `Undefined cell div at position ${nullIdx}`);
    }
    return cellDivs;
  }

  #transformTangoGridDiv(cellDivs, markStrategy) {
    const presetSuns = [];
    const presetMoons = [];
    const downEqualSigns = [];
    const downCrosses = [];
    const rightEqualSigns = [];
    const rightCrosses = [];
    for (let i = 0; i < cellDivs.length; i++) {
      const cellDiv = cellDivs[i];
      this.#checkPreset(markStrategy, cellDiv, i, presetSuns, presetMoons);
      this.#checkHasSign(cellDiv, i, downEqualSigns, downCrosses,
          rightEqualSigns, rightCrosses);
    }
    return [presetSuns, presetMoons, downEqualSigns, downCrosses,
        rightEqualSigns, rightCrosses];
  }

  gridDivChildIsCellDiv(gridDivChild) {
    return gridDivChild.attributes?.getNamedItem('data-cell-idx');
  }

  cellDivIsBlank(cellDiv) {
    return !cellDiv.classList.contains('lotka-cell--locked')
        && cellDiv.querySelector('.lotka-cell-content')
            ?.querySelector('svg')
            ?.classList
            ?.contains('lotka-cell-empty');
  }

  getClickableCell(cellDivs) {
    for (const cellDiv of cellDivs) {
      if (!this.cellDivIsPreset(cellDiv)) {
        return cellDiv;
      }
    }
    this.orElseThrow(null, 'getClickableCell', 'No free cells found');
  }

  cellDivIsPreset(cellDiv) {
    return cellDiv.classList.contains('lotka-cell--locked');
  }

  getCellDivIdx(cellDiv) {
    const dataCellIdx = cellDiv.attributes
        ?.getNamedItem('data-cell-idx')?.value;
    return parseInt(this.orElseThrow(dataCellIdx, 'getCellDivIdx',
        `Failed to parse an integer data cell ID from ${dataCellIdx}`));
  }

  getCellDivDownSign(cellDiv) {
    return cellDiv.querySelector('.lotka-cell-edge--down')
        ?.querySelector('svg')
        ?.getAttribute('aria-label');
  }

  getCellDivRightSign(cellDiv) {
    return cellDiv.querySelector('.lotka-cell-edge--right')
        ?.querySelector('svg')
        ?.getAttribute('aria-label');
  }

  #checkPreset(markStrategy, cellDiv, idx, presetSuns, presetMoons) {
    if (this.cellDivIsPreset(cellDiv)) {
      const color = markStrategy.getCellDivColor(cellDiv);
      if (color === 1) {
        presetSuns.push(idx);
      } else if (color === 2) {
        presetMoons.push(idx);
      } else {
        console.error('Unexpected color', color,
            'for preset cell', cellDiv,
            'at idx', idx);
        throw new Error('Unexpected color ' + color + ' for preset cell '
            + 'at idx=' + idx);
      }
    }
  }

  #classifySign(sign) {
    const s = (sign || '').trim().toLowerCase();
    if (s === 'equal' || s === 'égal' || s === 'egal' || s === '=') return 'equal';
    if (s === 'cross' || s === 'croix' || s === 'x' || s === '×') return 'cross';
    return null;
  }

  #checkHasSign(cellDiv, idx, downEqualSigns, downCrosses, rightEqualSigns,
      rightCrosses) {
    const downKind = this.#classifySign(this.getCellDivDownSign(cellDiv));
    if (downKind === 'equal') downEqualSigns.push(idx);
    else if (downKind === 'cross') downCrosses.push(idx);

    const rightKind = this.#classifySign(this.getCellDivRightSign(cellDiv));
    if (rightKind === 'equal') rightEqualSigns.push(idx);
    else if (rightKind === 'cross') rightCrosses.push(idx);
  }

  orElseThrow(result, fname, cause) {
    if (result != null) {
      return result;
    }
    throw new Error(`${fname} failed using TangoDomApiV0: ${cause}`);
  }

  async clickCells(cellDivs, solution, markStrategy, speedMode = 'turbo') {
    let clicks = 0;
    for (const move of solution) {
      const cellDiv = cellDivs[move.idx];
      const targetColor = move.color;
      const currentColor = markStrategy.getCellDivColor(cellDiv);
      for (let i = currentColor; i !== targetColor; i = (i + 1) % 3) {
        await anticipateOneMutation(cellDiv, move.idx, speedMode);
        clicks++;
      }
    }
    return clicks;
  }

}
