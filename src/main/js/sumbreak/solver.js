const MAX_SAFE = Number.MAX_SAFE_INTEGER;
const WILDCARD_RE = /^\s*([x×*+])\s*(-?\d+)\s*$/i;

export function parseWildcard(value) {
  if (typeof value !== 'string') return null;
  const m = value.match(WILDCARD_RE);
  return m ? { op: m[1] === '+' ? '+' : 'x', operand: Number(m[2]) } : null;
}

function applyWildcard(number, wild) {
  return wild.op === 'x' ? number * wild.operand : number + wild.operand;
}

export function mergeValues(source, target) {
  if (source === null || source === undefined || target === null || target === undefined) return null;
  const sw = parseWildcard(source);
  const tw = parseWildcard(target);
  let result;
  if (sw && tw) return null;
  if (sw) result = Number.isInteger(target) ? applyWildcard(target, sw) : null;
  else if (tw) result = Number.isInteger(source) ? applyWildcard(source, tw) : null;
  else if (Number.isInteger(source) && source === target) result = source + target;
  else return null;
  return result !== null && result >= 1 && result <= MAX_SAFE ? result : null;
}

function canMeet(small, large) {
  while (small < large) small *= 2;
  return small === large;
}

function pairable(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  while (counts.size > 1) {
    const smallest = Math.min(...counts.keys());
    const count = counts.get(smallest);
    counts.delete(smallest);
    if (count % 2) return false;
    counts.set(smallest * 2, (counts.get(smallest * 2) || 0) + count / 2);
  }
  const [count] = counts.values();
  return (count & (count - 1)) === 0;
}

export function solveSumbreak(board, { timeLimitMs = 8000 } = {}) {
  const rows = board.length;
  const cols = rows ? board[0].length : 0;
  if (!rows || !cols || board.some((r) => r.length !== cols)) throw new Error('Plateau Sumbreak invalide.');
  const wildcards = [];
  const start = [];
  for (const row of board) {
    for (const value of row) {
      const wild = parseWildcard(value);
      if (value === null || value === undefined) start.push(0);
      else if (wild) {
        let k = wildcards.findIndex((w) => w.op === wild.op && w.operand === wild.operand);
        if (k < 0) { wildcards.push(wild); k = wildcards.length - 1; }
        start.push(-(k + 1));
      } else if (Number.isInteger(value) && value > 0) start.push(value);
      else throw new Error('Valeur de tuile Sumbreak invalide : ' + value);
    }
  }
  const growing = wildcards.every((w) => (w.op === 'x' ? w.operand >= 2 : w.operand >= 1));
  const tiles = start.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  if (!tiles.length) throw new Error('Aucune tuile Sumbreak.');
  const neighbors = Array.from({ length: rows * cols }, (_, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const out = [];
    if (r > 0) out.push(i - cols);
    if (r + 1 < rows) out.push(i + cols);
    if (c > 0) out.push(i - 1);
    if (c + 1 < cols) out.push(i + 1);
    return out;
  });
  const state = start.slice();
  const connected = (count) => {
    const first = state.findIndex((v) => v);
    const seen = new Set([first]);
    const stack = [first];
    while (stack.length) {
      for (const n of neighbors[stack.pop()]) {
        if (state[n] && !seen.has(n)) { seen.add(n); stack.push(n); }
      }
    }
    return seen.size === count;
  };
  const stranded = (index) => {
    const value = state[index];
    for (const n of neighbors[index]) {
      const other = state[n];
      if (other && (value <= other ? canMeet(value, other) : canMeet(other, value))) return false;
    }
    return true;
  };
  const merged = (s, t) => {
    if (s < 0 && t < 0) return 0;
    let result;
    if (s < 0) result = applyWildcard(t, wildcards[-s - 1]);
    else if (t < 0) result = applyWildcard(s, wildcards[-t - 1]);
    else if (s === t) result = s + t;
    else return 0;
    return result >= 1 && result <= MAX_SAFE ? result : 0;
  };
  const startWild = start.filter((v) => v < 0).length;
  if (!start.some((v) => v > 0)) throw new Error('Aucune tuile numérotée.');
  if (!connected(tiles.length)) throw new Error('Tuiles Sumbreak séparées en groupes isolés.');
  if (!startWild) {
    if (!pairable(tiles.map((i) => start[i]))) throw new Error('Ces valeurs ne peuvent pas fusionner en une seule tuile.');
    if (tiles.length > 1 && tiles.some((i) => stranded(i))) throw new Error('Une tuile ne peut fusionner avec aucune voisine.');
  }
  const deadline = Date.now() + timeLimitMs;
  const dead = new Set();
  const path = [];
  let nodes = 0;
  const candidates = () => {
    if (growing) {
      let smallest = Infinity;
      for (const v of state) if (v > 0 && v < smallest) smallest = v;
      const first = state.indexOf(smallest);
      const pairs = [];
      for (const p of neighbors[first]) {
        if (state[p] === smallest || state[p] < 0) {
          pairs.push([first, p], [p, first]);
        }
      }
      return pairs;
    }
    const pairs = [];
    state.forEach((v, s) => {
      if (!v) return;
      for (const t of neighbors[s]) if (state[t]) pairs.push([s, t]);
    });
    return pairs;
  };
  const search = (count, wild) => {
    if (count === 1) return wild === 0;
    const key = state.join(',');
    if (dead.has(key)) return false;
    nodes++;
    if ((nodes & 1023) === 0 && Date.now() > deadline) throw new Error('Sumbreak : temps de recherche dépassé.');
    if (wild === count) { dead.add(key); return false; }
    for (const [s, t] of candidates()) {
      const sv = state[s];
      const tv = state[t];
      const result = merged(sv, tv);
      if (!result) continue;
      const remainingWild = wild - (sv < 0 || tv < 0 ? 1 : 0);
      state[s] = 0;
      state[t] = result;
      let viable = count === 2 || connected(count - 1);
      if (viable && !remainingWild && count > 2) {
        if (wild) {
          viable = pairable(state.filter(Boolean)) && !state.some((v, n) => v && stranded(n));
        } else {
          viable = ![t, ...neighbors[t], ...neighbors[s]].some((n) => state[n] && stranded(n));
        }
      }
      if (viable) {
        path.push({ from: s, to: t, value: result });
        if (search(count - 1, remainingWild)) return true;
        path.pop();
      }
      state[s] = sv;
      state[t] = tv;
    }
    dead.add(key);
    return false;
  };
  if (!search(tiles.length, startWild)) throw new Error('Aucune suite de fusions ne laisse une seule tuile.');
  return path.map(({ from, to, value }) => ({
    row: Math.floor(from / cols), col: from % cols,
    toRow: Math.floor(to / cols), toCol: to % cols,
    value,
  }));
}
