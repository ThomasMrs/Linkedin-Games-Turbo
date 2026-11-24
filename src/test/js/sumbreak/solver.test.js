import { solveSumbreak, mergeValues } from 'sumbreak/solver.js';

function replay(board, moves) {
  const grid = board.map((r) => r.slice());
  for (const m of moves) {
    expect(Math.abs(m.row - m.toRow) + Math.abs(m.col - m.toCol)).toBe(1);
    const v = mergeValues(grid[m.row][m.col], grid[m.toRow][m.toCol]);
    expect(v).toBe(m.value);
    grid[m.row][m.col] = null;
    grid[m.toRow][m.toCol] = v;
  }
  const left = grid.flat().filter((v) => v !== null);
  expect(left.length).toBe(1);
  expect(typeof left[0]).toBe('number');
}

test('Sumbreak : grille de lancement (18/11/2026)', () => {
  const board = [[1, 1, 64], [4, 2, 32], [4, 4, 16]];
  replay(board, solveSumbreak(board));
});

test('Sumbreak : grille avec opérateur ×2 (20/11/2026)', () => {
  const board = [[null, 2, 1], [null, 4, 1], [16, 'x2', 4]];
  replay(board, solveSumbreak(board));
});

test('Sumbreak : règles de fusion', () => {
  expect(mergeValues(4, 4)).toBe(8);
  expect(mergeValues(4, 2)).toBeNull();
  expect(mergeValues('x2', 4)).toBe(8);
  expect(mergeValues(3, '+3')).toBe(6);
  expect(mergeValues('x2', '+1')).toBeNull();
});

test('Sumbreak : grille impossible', () => {
  expect(() => solveSumbreak([[1, 2], [null, null]])).toThrow();
});
