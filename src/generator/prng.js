// ॐ — Deterministic "quantum" pseudo-randomness for reproducible measurement.
//
// A quantum random number generator collapses a superposition into a definite
// state at measurement; here we mimic that with a seeded stream. xmur3 hashes a
// string seed; mulberry32 turns it into a uniform stream. Both are public-domain
// and zero-dependency, so this module runs unchanged in the browser and in Node.

export function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A "quantum" PRNG: a seeded stream of amplitudes in [0,1) with helpers.
export function createRng(seed = 'OM') {
  const seedFn = xmur3(String(seed));
  const next = mulberry32(seedFn());

  function rng() {
    return next();
  }
  rng.float = (min = 0, max = 1) => min + next() * (max - min);
  rng.int = (min, max) => Math.floor(min + next() * (max - min + 1));
  rng.bool = (p = 0.5) => next() < p;
  rng.pick = (arr) => arr[Math.floor(next() * arr.length)];
  // Sample k distinct items (Fisher–Yates over a copy).
  rng.sample = (arr, k) => {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy.slice(0, Math.max(0, Math.min(k, copy.length)));
  };
  // Collapse a superposition: choose an index with probability ∝ amplitude².
  rng.measure = (weights) => {
    const probs = weights.map((w) => w * w);
    const total = probs.reduce((a, b) => a + b, 0) || 1;
    let r = next() * total;
    for (let i = 0; i < probs.length; i++) {
      r -= probs[i];
      if (r <= 0) return i;
    }
    return probs.length - 1;
  };
  // Fork an independent, reproducible sub-stream (used for per-candidate branches).
  rng.fork = (label = '') => createRng((seedFn() ^ xmur3(String(label))()) >>> 0);
  return rng;
}
