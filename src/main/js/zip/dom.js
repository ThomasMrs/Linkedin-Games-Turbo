import { getGridDiv, anticipateOneMutation, tryAutoStartGame, waitForAnyGrid, runStrategies } from '../util.js';
import { solveZip, compressSequence } from './solver.js';
import { ZipDomApiV2, ZIP_BOARD_SELECTORS } from './board2026.js';

const ZIP_GRID_SELECTORS = [...ZIP_BOARD_SELECTORS, '[data-cell-idx]'];

export async function autoSolve(options = {}) {
  const { speedMode = 'turbo', autoStart = true } = options;
  if (autoStart) {
    const started = await tryAutoStartGame();
    if (started) {
      await waitForAnyGrid(ZIP_GRID_SELECTORS, 4500);
    }
  }
  return runStrategies([new ZipDomApiV2(), new ZipDomApiV1(), new ZipDomApiV0()], speedMode, 'Zip');
}

class ZipDomApi {

  async autoSolve(speedMode = 'turbo') {
    const gridDiv = this.getZipGridDiv();
    const [cellDivs, zipGridArgs] = this.transformZipGridDiv(gridDiv);
    const clickSequence = solveZip(...zipGridArgs);
    console.info('Solution identified:', clickSequence);
    return await this.clickCells(cellDivs, clickSequence, speedMode);
  }

  transformZipGridDiv(gridDiv) {
    const rows = this.getRowsFromGridDiv(gridDiv);
    const cols = this.getColsFromGridDiv(gridDiv);
    const filtered = Array.from(gridDiv.children)
        .filter(c => this.gridDivChildIsCellDiv(c));
    if (filtered.length === 0) {
      this.orElseThrow(null, 'transformZipGridDiv', 'gridDiv contained no '
          + 'children that matched cellDiv filter');
    }
    const cellDivs = new Array(filtered.length);
    const numberedCells = [], downWalls = [], rightWalls = [];
    for (const cellDiv of filtered) {
      const idx = this.getCellDivIdx(cellDiv);
      cellDivs[idx] = cellDiv;
      const content = this.getCellDivContent(cellDiv);
      if (content > 0) {
        numberedCells[content - 1] = idx;
      }
      if (this.cellDivHasDownWall(cellDiv)) {
        downWalls.push(idx);
      }
      if (this.cellDivHasRightWall(cellDiv)) {
        rightWalls.push(idx);
      }
    }
    return [cellDivs, [rows, cols, numberedCells, downWalls, rightWalls]];
  }

  async clickCells(cellDivs, clickSequence, speedMode = 'turbo') {
    for (const loc of clickSequence) {
      await anticipateOneMutation(cellDivs[loc], loc, speedMode);
    }
    return clickSequence.length;
  }

}

class ZipDomApiV1 extends ZipDomApi {

  async autoSolve(speedMode = 'turbo') {
    const cellSequence = compressSequence(this.getSolution());
    console.info('Solution identified:', cellSequence);
    const gridDiv = this.getZipGridDiv();
    const cellDivs = this.transformZipGridDiv(gridDiv)[0];
    return await this.clickCells(cellDivs, cellSequence, speedMode);
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
    return JSON.parse(hydrationScript.substring(start, end + 1));
  }

  getZipGridDiv() {
    return this.orElseThrow(
        getGridDiv(d => d.querySelector('[data-testid="interactive-grid"]')),
        'getZipGridDiv', 'ZipGridDiv selector yielded nothing');
  }

  getRowsFromGridDiv(gridDiv) {
    return this.getColsFromGridDiv(gridDiv);
  }

  getColsFromGridDiv(gridDiv) {
    const candidates = Object.fromEntries(
      Array.from(gridDiv.style)
        .filter(p => p.startsWith("--") && /^\d+$/.test(gridDiv.style.getPropertyValue(p).trim()))
        .map(p => [p, parseInt(gridDiv.style.getPropertyValue(p))])
    );
    const candidateCount = Object.keys(candidates).length;
    if (candidateCount === 0) {
      this.orElseThrow(null, 'getDimensionFromGridDiv', 'No appropriate dimension in gridDiv');
    } else if (candidateCount > 1) {
      console.warn('Multiple dimension candidates found in style; dump:', candidates);
    }
    const elem = candidates[Object.keys(candidates)[0]];
    return parseInt(elem);
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

  getCellDivContent(cellDiv) {
    const subCellDiv = cellDiv.querySelector('[data-cell-content="true"]');
    if (subCellDiv) {
      const parsed = parseInt(subCellDiv.textContent);
      return this.orElseThrow(Number.isNaN(parsed) ? null : parsed,
          'getCellDivContent', `Expected number, found ${subCellDiv.textContent}`);
    }
    return -1;
  }

  cellDivHasDownWall() {
    return false;
  }

  cellDivHasRightWall() {
    return false;
  }

  orElseThrow(result, fname, cause) {
    if (result != null) {
      return result;
    }
    throw new Error(`${fname} failed using ZipDomApiV1: ${cause}`);
  }

}

class ZipDomApiV0 extends ZipDomApi {

  getZipGridDiv() {
    return this.orElseThrow(
        getGridDiv(d => d.querySelector(".grid-game-board")),
        'getZipGridDiv', 'ZipGridDiv selector yielded nothing');
  }

  getRowsFromGridDiv(gridDiv) {
    const prop = this.orElseThrow(gridDiv.style?.getPropertyValue('--rows'),
        'getRowFromGridDiv', 'No --rows property found in style');
    const rows = parseInt(prop);
    return this.orElseThrow(Number.isNaN(rows) ? null : rows,
        'getRowFromGridDiv', `--rows property ${prop} is not a number`);
  }

  getColsFromGridDiv(gridDiv) {
    const prop = this.orElseThrow(gridDiv.style?.getPropertyValue('--cols'),
        'getColFromGridDiv', 'No --cols property found in style');
    const cols = parseInt(prop);
    return this.orElseThrow(Number.isNaN(cols) ? null : cols,
        'getColFromGridDiv', `--cols property ${prop} is not a number`);
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

  getCellDivContent(cellDiv) {
    const content = cellDiv.querySelector('.trail-cell-content');
    if (content && content.textContent) {
      const parsed = parseInt(content.textContent);
      return this.orElseThrow(Number.isNaN(parsed) ? null : parsed,
          'getCellDivContent', `Expected number, found ${content.textContent}`);
    }
    return -1;
  }

  cellDivHasDownWall(cellDiv) {
    return cellDiv.querySelector('.trail-cell-wall--down') != null;
  }

  cellDivHasRightWall(cellDiv) {
    return cellDiv.querySelector('.trail-cell-wall--right') != null;
  }

  orElseThrow(result, fname, cause) {
    if (result != null) {
      return result;
    }
    throw new Error(`${fname} failed using ZipDomApiV0: ${cause}`);
  }

}
