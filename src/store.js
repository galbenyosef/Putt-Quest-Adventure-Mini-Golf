// Best scores live in localStorage only (no backend of any kind).
const KEY = 'puttquest.scores.v1';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    /* ignore */
  }
  return { bestRound: null, bestHoles: [], rounds: 0 };
}

let data = load();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    /* ignore */
  }
}

export const store = {
  get bestRound() {
    return data.bestRound;
  },
  bestHole(i) {
    return data.bestHoles[i] ?? null;
  },
  get rounds() {
    return data.rounds || 0;
  },
  /** returns true when the score is a new personal best for that hole */
  recordHole(i, strokes) {
    const prev = data.bestHoles[i];
    if (prev == null || strokes < prev) {
      data.bestHoles[i] = strokes;
      save();
      return prev != null; // first ever score is not announced as a "best"
    }
    return false;
  },
  recordRound(total) {
    data.rounds = (data.rounds || 0) + 1;
    const isBest = data.bestRound == null || total < data.bestRound;
    const hadPrev = data.bestRound != null;
    if (isBest) data.bestRound = total;
    save();
    return isBest && hadPrev ? 'new' : isBest ? 'first' : false;
  },
  reset() {
    data = { bestRound: null, bestHoles: [], rounds: 0 };
    save();
  },
};
