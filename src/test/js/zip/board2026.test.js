import { solveZipFromPuzzle } from 'zip/board2026.js';

test('solveZipFromPuzzle convertit les murs LinkedIn et trouve le chemin', () => {
  const puzzle = {
    gridSize: 6,
    orderedSequence: [25, 7, 1, 34, 10, 28],
    walls: [
      { cellIdx: 7, direction: 'WallDirection_DOWN' },
      { cellIdx: 14, direction: 'WallDirection_UP' },
      { cellIdx: 21, direction: 'WallDirection_DOWN' },
      { cellIdx: 28, direction: 'WallDirection_UP' },
      { cellIdx: 12, direction: 'WallDirection_RIGHT' },
      { cellIdx: 17, direction: 'WallDirection_LEFT' },
      { cellIdx: 18, direction: 'WallDirection_RIGHT' },
      { cellIdx: 23, direction: 'WallDirection_LEFT' },
    ],
  };
  expect(solveZipFromPuzzle(puzzle)).toEqual({
    n: 6,
    path: [
      25, 19, 13, 14, 15, 9,
      3, 2, 8, 7, 1, 0,
      6, 12, 18, 24, 30, 31,
      32, 33, 34, 35, 29, 23,
      17, 11, 5, 4, 10, 16,
      22, 21, 20, 26, 27, 28,
    ],
  });
});

test('solveZipFromPuzzle retombe sur la solution officielle si besoin', () => {
  const path = [0, 1, 3, 2];
  expect(solveZipFromPuzzle({ gridSize: 2, orderedSequence: [0, 2], walls: [], solution: path }).path).toHaveLength(4);
});

test('solveZipFromPuzzle refuse des données incomplètes', () => {
  expect(solveZipFromPuzzle({})).toBeNull();
  expect(solveZipFromPuzzle({ gridSize: 6 })).toBeNull();
});
