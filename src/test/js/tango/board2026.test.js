import { solveTangoFromPuzzle } from 'tango/board2026.js';

test('solveTangoFromPuzzle résout une grille au format LinkedIn 2026', () => {
  const marks = new Array(36).fill(0);
  [9, 35].forEach((i) => { marks[i] = 1; });
  [0, 26].forEach((i) => { marks[i] = 2; });
  const puzzle = {
    gridSize: 6,
    presetCellIdxes: [0, 9, 26, 35],
    edges: [
      { startIdx: 8, endIdx: 2, isEqual: true },
      { startIdx: 15, endIdx: 21 },
      { startIdx: 17, endIdx: 23 },
      { startIdx: 18, endIdx: 24 },
      { startIdx: 21, endIdx: 27 },
      { startIdx: 23, endIdx: 29 },
      { startIdx: 13, endIdx: 14, isEqual: true },
      { startIdx: 34, endIdx: 33, isEqual: true },
      { startIdx: 1, endIdx: 2 },
      { startIdx: 10, endIdx: 11 },
      { startIdx: 12, endIdx: 13 },
      { startIdx: 24, endIdx: 25 },
    ],
  };
  const final = solveTangoFromPuzzle(puzzle, marks);
  const suns = final.map((v, i) => (v === 1 ? i : -1)).filter((i) => i >= 0);
  const moons = final.map((v, i) => (v === 2 ? i : -1)).filter((i) => i >= 0);
  expect(suns).toEqual([1, 3, 4, 6, 9, 10, 13, 14, 17, 18, 20, 21, 25, 28, 29, 30, 32, 35]);
  expect(moons).toEqual([0, 2, 5, 7, 8, 11, 12, 15, 16, 19, 22, 23, 24, 26, 27, 31, 33, 34]);
});

test('solveTangoFromPuzzle renvoie null si une case fixe est illisible', () => {
  expect(solveTangoFromPuzzle({ presetCellIdxes: [0], edges: [] }, new Array(36).fill(0))).toBeNull();
});
