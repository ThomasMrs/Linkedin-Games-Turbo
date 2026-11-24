import fs from 'fs';
import path from 'path';
import { solveWend, parseWordList } from 'wend/solver.js';

const dir = path.resolve('src/assets/wend');
const words = [
  ...parseWordList(fs.readFileSync(path.join(dir, 'words.txt'), 'utf8')),
  ...parseWordList(fs.readFileSync(path.join(dir, 'supplemental_words.txt'), 'utf8')),
];
const rare = new Set([
  ...parseWordList(fs.readFileSync(path.join(dir, 'proper_nouns.txt'), 'utf8')),
  ...parseWordList(fs.readFileSync(path.join(dir, 'rare_words.txt'), 'utf8')),
]);

test('Wend 143 (29/10/2026) : une seule couverture', () => {
  const board = [
    ['W', 'O', 'F', 'L', 'O', 'O'],
    ['T', 'R', 'K', 'I', 'M', 'R'],
    ['O', null, null, 'R', null, null],
    ['O', null, null, 'R', null, 'O'],
    ['F', 'R', 'O', 'O', 'R', 'R'],
    ['O', 'A', 'N', 'A', 'G', 'E'],
  ];
  const result = solveWend(board, [3, 5, 6, 7, 8], words, { rare });
  expect(result.best.words.map((w) => w.word).sort()).toEqual(['FLOOR', 'FOOTWORK', 'MIRROR', 'OAR', 'OREGANO']);
});

test('Wend 18/11/2026 : départage NEW plutôt que WEN', () => {
  const board = [['N', 'E', null, 'U', 'N'], ['E', 'W', 'L', 'A', 'C'], ['M', 'A', null, 'T', 'H'], [null, 'G', null, 'O', null], [null, 'Y', 'A', 'D', null]];
  const result = solveWend(board, [3, 4, 5, 6], words, { rare });
  const best = result.best.words.map((w) => w.word);
  expect(best).toContain('NEW');
  expect(best).not.toContain('WEN');
  for (const w of result.best.words) {
    w.path.forEach((cell, i) => {
      expect(board[Math.floor(cell / 5)][cell % 5]).toBe(w.word[i]);
      if (i) {
        const prev = w.path[i - 1];
        expect(Math.abs(Math.floor(cell / 5) - Math.floor(prev / 5)) + Math.abs((cell % 5) - (prev % 5))).toBe(1);
      }
    });
  }
});
