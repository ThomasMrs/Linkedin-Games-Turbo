export function normalizeShape(raw) {
  const s = String(raw ?? '').toUpperCase();
  if (s.includes('SQUARE')) return 'square';
  if (s.includes('HORIZONTAL') || s.includes('WIDE')) return 'wide';
  if (s.includes('VERTICAL') || s.includes('TALL')) return 'tall';
  return 'any';
}

function shapeFits(shape, h, w) {
  if (shape === 'square') return h === w;
  if (shape === 'wide') return w > h;
  if (shape === 'tall') return h > w;
  return true;
}

function solveOnce(rows, cols, clues, maxSolutions) {
  const total = rows * cols;
  const bit = Array.from({ length: total }, (_, i) => 1n << BigInt(i));
  const clueAt = new Map(clues.map((c, i) => [c.idx, i]));
  const byTopLeft = Array.from({ length: total }, () => []);
  for (let ci = 0; ci < clues.length; ci++) {
    const { idx, shape, area } = clues[ci];
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    let count = 0;
    for (let h = 1; h <= rows; h++) {
      for (let w = 1; w <= cols; w++) {
        if (h * w === 1) continue;
        if (area && h * w !== area) continue;
        if (!shapeFits(shape, h, w)) continue;
        for (let top = Math.max(0, r - h + 1); top <= Math.min(r, rows - h); top++) {
          for (let left = Math.max(0, c - w + 1); left <= Math.min(c, cols - w); left++) {
            let mask = 0n;
            let clean = true;
            for (let y = top; y < top + h && clean; y++) {
              for (let x = left; x < left + w; x++) {
                const cell = y * cols + x;
                if (cell !== idx && clueAt.has(cell)) { clean = false; break; }
                mask |= bit[cell];
              }
            }
            if (!clean) continue;
            byTopLeft[top * cols + left].push({ top, left, height: h, width: w, clue: ci, mask });
            count++;
          }
        }
      }
    }
    if (!count) return [];
  }
  const full = (1n << BigInt(total)) - 1n;
  const failed = new Set();
  const chosen = [];
  const solutions = [];
  let nodes = 0;
  const firstEmpty = (occupied) => {
    for (let i = 0; i < total; i++) if (!(occupied & bit[i])) return i;
    return -1;
  };
  const search = (occupied) => {
    if (occupied === full) {
      solutions.push(chosen.slice());
      return solutions.length >= maxSolutions;
    }
    if (failed.has(occupied)) return false;
    if (++nodes > 2000000) throw new Error('Patches : recherche trop longue.');
    const cell = firstEmpty(occupied);
    const before = solutions.length;
    for (const cand of byTopLeft[cell]) {
      if (cand.mask & occupied) continue;
      chosen.push(cand);
      if (search(occupied | cand.mask)) return true;
      chosen.pop();
    }
    if (solutions.length === before) failed.add(occupied);
    return false;
  };
  search(0n);
  return solutions;
}

export function solvePatches(rows, cols, clues, { maxSolutions = 1 } = {}) {
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 2 || cols < 2) return null;
  const normalized = clues.map((c) => ({
    idx: Number(c.idx),
    shape: normalizeShape(c.shape),
    area: Number.isInteger(Number(c.area)) && Number(c.area) > 0 ? Number(c.area) : null,
  }));
  if (!normalized.length || normalized.some((c) => !Number.isInteger(c.idx) || c.idx < 0 || c.idx >= rows * cols)) return null;
  if (new Set(normalized.map((c) => c.idx)).size !== normalized.length) return null;
  let solutions = solveOnce(rows, cols, normalized, maxSolutions);
  if (!solutions.length && normalized.some((c) => c.shape === 'square')) {
    solutions = solveOnce(rows, cols, normalized.map((c) => (c.shape === 'square' ? { ...c, shape: 'any' } : c)), maxSolutions);
  }
  if (!solutions.length) return null;
  return solutions.map((regions) => regions.map(({ top, left, height, width, clue }) => ({
    top, left, height, width, clueIdx: normalized[clue].idx,
  })));
}
