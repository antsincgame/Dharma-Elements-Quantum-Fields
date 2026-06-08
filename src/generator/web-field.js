// 🌱 Emergent web-field — the substrate where a website GROWS instead of being
// templated. Every cell is a potential web "building block" (void · text · heading
// · media · accent · quote · rule · link). Each tick, a cell's next block is decided
// by (1) its neighbors and (2) a Born-rule random draw — so real structure
// crystallizes out of quantum randomness. No cell is told what to be; coherent
// regions (sections) emerge from local interaction alone.
//
// Dharma ↔ physics, made mechanical (not decorative):
//   • 縁起 / pratītyasamutpāda — a cell IS its neighbors (interdependent origination);
//   • śūnyatā / 無爲 — VOID is favored (stillness), so the page stays spacious and
//     form only arises where life gathers;
//   • the five elements influence each other by a generative/overcoming cycle (生/克),
//     so element-tinted regions flow and transform like the Wu-Xing.
//
// Framework-free & deterministic (seeded). Runs identically in the browser and Node;
// materialization to real HTML lives in web-materialize.js, the agent in agent.js.

// The block alphabet — 8 types (a 3-qubit register's worth). VOID = emptiness.
export const BLOCKS = { VOID: 0, TEXT: 1, HEAD: 2, MEDIA: 3, ACCENT: 4, QUOTE: 5, RULE: 6, LINK: 7 };
export const BLOCK_NAMES = ['void', 'text', 'head', 'media', 'accent', 'quote', 'rule', 'link'];
// Single-char glyphs for terminal / ASCII visualization.
export const BLOCK_GLYPHS = [' ', '·', '#', '◆', '▓', '"', '—', '→'];

export const FIELD_ELEMENTS = ['earth', 'water', 'fire', 'air', 'space'];

// Generative/overcoming affinity between elements by their cyclic distance d=(b−a)mod5:
//   d=0 same · d=1 generates (nourishes, strong) · d=4 is-generated-by · d=2 overcomes
//   (weak) · d=3 is-overcome-by. Mirrors the Wu-Xing 生 (generating) and 克 (overcoming).
const AFFINITY_BY_DISTANCE = [1.0, 1.35, 0.55, 0.7, 1.15];
export function elementAffinity(a, b) {
  const ia = FIELD_ELEMENTS.indexOf(a), ib = FIELD_ELEMENTS.indexOf(b);
  if (ia < 0 || ib < 0) return 1;
  return AFFINITY_BY_DISTANCE[((ib - ia) % 5 + 5) % 5];
}

// Weighted pick over a propensity array — the "measurement"/collapse (Born-rule draw).
function bornPick(weights, rng) {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) sum += weights[i];
  if (sum <= 0) return BLOCKS.VOID;
  let r = rng() * sum;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
  return weights.length - 1;
}

// A fresh field: mostly VOID (emptiness), with a sparse scatter of seeds from which
// structure will grow. `density` ≈ fraction of cells seeded.
export function createField({ rows = 18, cols = 28, rng, density = 0.06 } = {}) {
  if (!rng) throw new Error('createField requires a seeded rng');
  const cells = new Array(rows * cols);
  for (let i = 0; i < cells.length; i++) {
    const element = FIELD_ELEMENTS[Math.floor(rng() * FIELD_ELEMENTS.length)];
    // Seeds avoid VOID and HEAD (headings should emerge, not be seeded everywhere).
    const seeded = rng() < density;
    const type = seeded ? 1 + Math.floor(rng() * 4) : BLOCKS.VOID; // text/head/media/accent
    cells[i] = { type, element };
  }
  return { rows, cols, cells, tick: 0 };
}

// Moore-neighborhood (8) of (r,c), clamped to the grid (edges have fewer neighbors).
function neighbors(field, r, c) {
  const { rows, cols, cells } = field;
  const out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (dr === 0 && dc === 0) continue;
    const rr = r + dr, cc = c + dc;
    if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
    out.push(cells[rr * cols + cc]);
  }
  return out;
}

// One synchronous tick: every cell's next (type, element) from its neighbors + a draw.
// `opts.void` raises the stillness bias (more emptiness); `opts.bias` (a length-8
// array) lets an agent nudge global propensities (e.g. "more media"). `opts.frozen`
// (a Set of indices) holds regions still (an agent tool).
export function stepField(field, rng, opts = {}) {
  const { rows, cols, cells } = field;
  const voidBias = opts.void != null ? opts.void : 1.1;
  const extra = opts.bias || null; // optional per-type additive bias from the agent
  const frozen = opts.frozen || null;
  const next = new Array(rows * cols);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const idx = r * cols + c;
    const cell = cells[idx];
    if (frozen && frozen.has(idx)) { next[idx] = { type: cell.type, element: cell.element }; continue; }
    const nb = neighbors(field, r, c);
    const w = new Float64Array(8);
    w[BLOCKS.VOID] = voidBias;
    let alive = 0;
    const elementTally = {};
    for (const n of nb) {
      elementTally[n.element] = (elementTally[n.element] || 0) + 1;
      if (n.type === BLOCKS.VOID) { w[BLOCKS.VOID] += 0.15; continue; } // emptiness begets calm
      alive++;
      w[n.type] += elementAffinity(cell.element, n.element); // cluster with compatible kin
    }
    // Birth vs stillness: a VOID cell wakes only where life has gathered; a living
    // cell persists (so regions are stable, not noisy).
    if (cell.type === BLOCKS.VOID) w[BLOCKS.VOID] *= alive >= 3 ? 0.5 : 1.4;
    else w[cell.type] += 0.8;
    // Accents stay rare so the page reads as structured, not noisy.
    w[BLOCKS.HEAD] *= 0.5; w[BLOCKS.QUOTE] *= 0.5; w[BLOCKS.LINK] *= 0.7; w[BLOCKS.RULE] *= 0.8;
    if (extra) for (let t = 0; t < 8; t++) w[t] = Math.max(0, w[t] + extra[t]);
    const type = bornPick(w, rng);
    // Element drifts toward its neighbors (with self-inertia) along the 生 cycle.
    let element = cell.element;
    const ew = FIELD_ELEMENTS.map((el) => (elementTally[el] || 0) * elementAffinity(cell.element, el));
    const ei = FIELD_ELEMENTS.indexOf(cell.element);
    ew[ei] += 1.5; // inertia: regions hold their element unless strongly pulled
    let es = 0; for (const v of ew) es += v;
    let rr2 = rng() * es;
    for (let k = 0; k < FIELD_ELEMENTS.length; k++) { rr2 -= ew[k]; if (rr2 <= 0) { element = FIELD_ELEMENTS[k]; break; } }
    next[idx] = { type, element };
  }
  return { rows, cols, cells: next, tick: field.tick + 1 };
}

export function evolveField(field, ticks, rng, opts = {}) {
  let f = field;
  for (let t = 0; t < ticks; t++) f = stepField(f, rng, opts);
  return f;
}

// Connected-component count of non-VOID cells of the SAME type (4-connectivity) —
// a proxy for "how many coherent regions/sections emerged".
export function fieldStats(field) {
  const { rows, cols, cells } = field;
  const typeCounts = new Array(8).fill(0);
  for (const cell of cells) typeCounts[cell.type]++;
  const voidFraction = typeCounts[BLOCKS.VOID] / cells.length;
  // Shannon entropy of the type distribution (spread of block kinds).
  let entropy = 0;
  for (const n of typeCounts) { if (n) { const p = n / cells.length; entropy -= p * Math.log2(p); } }
  // Region labeling.
  const seen = new Uint8Array(rows * cols);
  let regions = 0;
  const stack = [];
  for (let i = 0; i < cells.length; i++) {
    if (seen[i] || cells[i].type === BLOCKS.VOID) continue;
    regions++;
    stack.length = 0; stack.push(i); seen[i] = 1;
    const t = cells[i].type;
    while (stack.length) {
      const j = stack.pop(); const r = (j / cols) | 0, c = j % cols;
      const adj = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
      for (const [rr, cc] of adj) {
        if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
        const k = rr * cols + cc;
        if (!seen[k] && cells[k].type === t) { seen[k] = 1; stack.push(k); }
      }
    }
  }
  return { voidFraction, typeCounts, entropy, regions, cells: cells.length };
}
