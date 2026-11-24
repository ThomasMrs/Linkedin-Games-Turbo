import { solvePatches, normalizeShape } from 'patches/solver.js';

const fixture = {
  size: 7,
  clues: [[1, 'square', null], [5, 'any', 3], [11, 'wide', null], [13, 'tall', null], [15, 'any', 4], [20, 'any', 2], [22, 'square', 4], [24, 'square', null], [26, 'tall', 3], [28, 'any', 5], [33, 'any', 2], [35, 'wide', null], [37, 'wide', null], [43, 'any', 5], [47, 'wide', null]],
};

function check(rows, cols, clues, regions) {
  const owner = new Array(rows * cols).fill(-1);
  regions.forEach((reg, k) => {
    for (let y = reg.top; y < reg.top + reg.height; y++) {
      for (let x = reg.left; x < reg.left + reg.width; x++) {
        expect(owner[y * cols + x]).toBe(-1);
        owner[y * cols + x] = k;
      }
    }
  });
  expect(owner.every((o) => o >= 0)).toBe(true);
  for (const clue of clues) {
    const reg = regions[owner[clue.idx]];
    expect(reg.clueIdx).toBe(clue.idx);
    if (clue.area) expect(reg.width * reg.height).toBe(clue.area);
    const shape = normalizeShape(clue.shape);
    if (shape === 'wide') expect(reg.width).toBeGreaterThan(reg.height);
    if (shape === 'tall') expect(reg.height).toBeGreaterThan(reg.width);
    expect(reg.width * reg.height).toBeGreaterThan(1);
  }
}

test('Patches : grille LinkedIn du 20/11/2026', () => {
  const clues = fixture.clues.map(([idx, shape, area]) => ({ idx, shape, area }));
  const solutions = solvePatches(7, 7, clues, { maxSolutions: 2 });
  expect(solutions).not.toBeNull();
  expect(solutions.length).toBe(1);
  check(7, 7, clues, solutions[0]);
});

test('Patches : formats de forme LinkedIn', () => {
  expect(normalizeShape('PatchesShapeConstraint_SQUARE')).toBe('square');
  expect(normalizeShape('PatchesShapeConstraint_HORIZONTAL_RECT')).toBe('wide');
  expect(normalizeShape('PatchesShapeConstraint_VERTICAL_RECT')).toBe('tall');
  expect(normalizeShape('PatchesShapeConstraint_UNKNOWN')).toBe('any');
});

test('Patches : grille impossible', () => {
  expect(solvePatches(2, 2, [{ idx: 0, shape: 'any', area: 3 }])).toBeNull();
});
