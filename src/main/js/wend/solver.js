export function parseWordList(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((w) => w.trim().toUpperCase())
    .filter((w) => /^[A-Z]+$/.test(w));
}

function buildTrie(words, lengths) {
  const wanted = new Set(lengths);
  const root = Object.create(null);
  for (const word of words) {
    if (!wanted.has(word.length)) continue;
    let node = root;
    for (const ch of word) {
      node = node[ch] || (node[ch] = Object.create(null));
    }
    node.$ = word;
  }
  return root;
}

export function findWendCandidates(board, lengths, words) {
  const rows = board.length;
  const cols = rows ? board[0].length : 0;
  const maxLen = Math.max(...lengths);
  const wanted = new Set(lengths);
  const trie = buildTrie(words, lengths);
  const letter = (i) => board[Math.floor(i / cols)][i % cols];
  const neighbors = (i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const out = [];
    if (r > 0) out.push(i - cols);
    if (r + 1 < rows) out.push(i + cols);
    if (c > 0) out.push(i - 1);
    if (c + 1 < cols) out.push(i + 1);
    return out.filter((n) => letter(n));
  };
  const candidates = [];
  const seen = new Set();
  const visited = new Uint8Array(rows * cols);
  const path = [];
  const dfs = (cell, node) => {
    path.push(cell);
    visited[cell] = 1;
    if (node.$ && wanted.has(path.length)) {
      const key = node.$ + '|' + path.slice().sort((a, b) => a - b).join(',');
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push({ word: node.$, path: path.slice() });
      }
    }
    if (path.length < maxLen) {
      for (const n of neighbors(cell)) {
        if (visited[n]) continue;
        const next = node[letter(n)];
        if (next) dfs(n, next);
      }
    }
    visited[cell] = 0;
    path.pop();
  };
  for (let i = 0; i < rows * cols; i++) {
    const l = letter(i);
    if (l && trie[l]) dfs(i, trie[l]);
  }
  return candidates;
}

export function solveWend(board, lengths, words, { rare = new Set(), maxSolutions = 12, nodeLimit = 4000000 } = {}) {
  const rows = board.length;
  const cols = rows ? board[0].length : 0;
  const total = rows * cols;
  const visible = [];
  for (let i = 0; i < total; i++) if (board[Math.floor(i / cols)][i % cols]) visible.push(i);
  if (visible.length !== lengths.reduce((a, b) => a + b, 0)) {
    throw new Error(`Wend : ${visible.length} lettres pour ${lengths.reduce((a, b) => a + b, 0)} cases de mots.`);
  }
  const candidates = findWendCandidates(board, lengths, words);
  const byCell = Array.from({ length: total }, () => []);
  candidates.forEach((cand, k) => cand.path.forEach((cell) => byCell[cell].push(k)));
  const remaining = new Map();
  for (const l of lengths) remaining.set(l, (remaining.get(l) || 0) + 1);
  const covered = new Uint8Array(total);
  const chosen = [];
  const solutions = [];
  let nodes = 0;
  let left = visible.length;
  const fits = (k) => {
    const cand = candidates[k];
    if (!remaining.get(cand.path.length)) return false;
    for (const cell of cand.path) if (covered[cell]) return false;
    return true;
  };
  const search = () => {
    if (left === 0) {
      solutions.push(chosen.map((k) => candidates[k]));
      return solutions.length >= maxSolutions;
    }
    if (++nodes > nodeLimit) return true;
    let bestCell = -1;
    let bestOptions = null;
    for (const cell of visible) {
      if (covered[cell]) continue;
      const options = byCell[cell].filter(fits);
      if (!bestOptions || options.length < bestOptions.length) {
        bestCell = cell;
        bestOptions = options;
        if (!options.length) return false;
      }
    }
    for (const k of bestOptions) {
      const cand = candidates[k];
      const len = cand.path.length;
      remaining.set(len, remaining.get(len) - 1);
      cand.path.forEach((cell) => { covered[cell] = 1; });
      left -= len;
      chosen.push(k);
      const stop = search();
      chosen.pop();
      left += len;
      cand.path.forEach((cell) => { covered[cell] = 0; });
      remaining.set(len, remaining.get(len) + 1);
      if (stop) return true;
    }
    return false;
  };
  search();
  const scored = solutions.map((words) => ({
    words,
    rareCount: words.filter((w) => rare.has(w.word)).length,
  }));
  scored.sort((a, b) => a.rareCount - b.rareCount);
  return {
    solutions: scored,
    best: scored[0] || null,
    ambiguous: scored.length > 1 && scored[0].rareCount === scored[1].rareCount,
    exhaustive: nodes <= nodeLimit && solutions.length < maxSolutions,
  };
}
