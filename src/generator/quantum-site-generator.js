// ⚛️ Core of the Quantum-Informatics Website Generator.
//
// A "site" is a set of NULL FILES OF NEGATIVE SIZE — placeholders that store no
// content. Negative size models an *entropy debt*: the amount of information the
// generator still owes. Each file is also a SUPERPOSITION of candidate contents;
// an AI engine "measures" it, paying down the debt geometrically until the file
// collapses to one committed value. Grounded in two real ideas:
//   • quantum conditional entropy S(A|B) = S(AB) − S(B) can be negative
//     (Horodecki–Oppenheim–Winter, "Quantum information can be negative");
//   • the best predictor is the best compressor (Solomonoff / Kolmogorov), so an
//     AI "guessing" a file is just paying down its conditional description length.
//
// Framework-free ES module: no DOM, no Three.js, no Node APIs — runs unchanged in
// the browser (<script type="module">) and in Node (package.json "type":"module").

import { createRng } from './prng.js';
import { Emitter } from './events.js';

// Byte length via TextEncoder (a global in modern browsers and Node ≥18).
const _encoder = new TextEncoder();
export function byteLength(str) {
  return _encoder.encode(str == null ? '' : String(str)).length;
}

// Target information budget per file kind (in "infons" ≈ expected bytes).
export const KIND_BANDS = {
  html: { min: 1200, ideal: 4200, max: 9000 },
  css: { min: 300, ideal: 1000, max: 2600 },
  js: { min: 160, ideal: 420, max: 1000 },
  md: { min: 500, ideal: 1300, max: 3500 },
};

// Deterministically estimate how much information a file is missing.
export function estimateInfo(kind, rng) {
  const band = KIND_BANDS[kind] || KIND_BANDS.html;
  return Math.round(band.ideal * rng.float(0.85, 1.15));
}

// Create a null file: negative size = −(missing information) = entropy debt.
export function createNullFile(spec, rng) {
  const kind = spec.kind || 'html';
  const T = estimateInfo(kind, rng);
  return {
    path: spec.path,
    kind,
    intent: spec.intent || '',
    state: 'superposition', // 'superposition' | 'collapsing' | 'collapsed'
    missingInfo: T, // T — the original debt
    debt: T, // D ≥ 0 — information still owed
    size: -T, // SIGNED size: −D while owed, +byteLength once committed
    candidates: [], // [{ content, weight }] — the superposition
    content: null, // collapsed concrete content
    confidence: 0,
    measurements: 0,
  };
}

// 0 → 1 as the file collapses (1 = fully measured). Drives the UI meter.
export function determinacy(file) {
  return file.missingInfo ? 1 - file.debt / file.missingInfo : 1;
}
export function debtFraction(file) {
  return file.missingInfo ? file.debt / file.missingInfo : 0;
}

// One measurement: a guess with self-confidence q ∈ (0,1] pays down a fraction q
// of the remaining debt (geometric → asymptotic), and provisionally keeps the
// best candidate as `content`. Size stays negative but climbs toward 0.
export function applyMeasurement(file, candidate, confidence) {
  const q = Math.max(0.02, Math.min(0.98, confidence == null ? 0.5 : confidence));
  file.debt = file.debt * (1 - q);
  file.size = -file.debt;
  file.state = 'collapsing';
  if (candidate != null) file.content = candidate;
  file.confidence = confidence == null ? file.confidence : confidence;
  file.measurements += 1;
  return file;
}

// Commit when the residual debt is tiny or the per-file measurement cap is hit.
export function shouldCommit(file, maxMeasurements = 6, epsilonFactor = 0.02) {
  return file.debt <= file.missingInfo * epsilonFactor || file.measurements >= maxMeasurements;
}

// Full collapse: size snaps to the real positive byte length of the content.
export function commit(file, content, confidence) {
  if (content != null) file.content = content;
  if (confidence != null) file.confidence = confidence;
  file.debt = 0;
  file.size = byteLength(file.content || '');
  file.state = 'collapsed';
  return file;
}

// Assemble the committed (or provisional) contents into a { path: content } map.
export function assembleSite(files) {
  const out = {};
  for (const f of files) out[f.path] = f.content || '';
  return out;
}

// ---- Pluggable interfaces -------------------------------------------------

// An Engine guesses content: async guess(file, ctx) -> { candidates, amplitudes, confidence }
export class Engine {
  get name() {
    return 'engine';
  }
  async available() {
    return true;
  }
  // eslint-disable-next-line no-unused-vars
  async guess(file, ctx) {
    throw new Error('Engine.guess not implemented');
  }
}

// A Scorer rates the site 0–100: async score(site) -> { total, breakdown }
export class Scorer {
  get name() {
    return 'scorer';
  }
  async available() {
    return true;
  }
  // eslint-disable-next-line no-unused-vars
  async score(site) {
    throw new Error('Scorer.score not implemented');
  }
}

// ---- Orchestrator ---------------------------------------------------------

export class Generator extends Emitter {
  constructor(opts = {}) {
    super();
    this.spec = opts.spec;
    this.engine = opts.engine;
    this.scorer = opts.scorer;
    this.threshold = opts.threshold != null ? opts.threshold : 80;
    this.budget = opts.budget != null ? opts.budget : 200;
    this.maxMeasurements = opts.maxMeasurements || 6;
    this.stepDelay = opts.stepDelay || 0; // ms between steps — lets the UI animate
    this.seed = opts.seed != null ? opts.seed : 'OM';
    this.rng = createRng(this.seed);
    this.files = (this.spec.files || []).map((f) => createNullFile(f, this.rng));
    this.steps = 0;
    this.lastScore = 0;
    this.lastBreakdown = {};
    this.running = false;
  }

  site() {
    return { files: this.files, spec: this.spec };
  }

  async _score() {
    const result = await this.scorer.score(this.site());
    this.lastScore = result.total;
    this.lastBreakdown = result.breakdown || {};
    return result;
  }

  // Greedy: measure the non-collapsed file with the largest entropy debt.
  _pickTarget() {
    let target = null;
    for (const f of this.files) {
      if (f.state === 'collapsed') continue;
      if (!target || f.debt > target.debt) target = f;
    }
    return target;
  }

  async _guess(file) {
    try {
      return await this.engine.guess(file, { files: this.files, spec: this.spec, rng: this.rng });
    } catch (err) {
      if (typeof console !== 'undefined') console.error('[qiwg] engine.guess failed', err);
      return null;
    }
  }

  async step() {
    const file = this._pickTarget();
    if (!file) return null;
    const guess = await this._guess(file);
    if (guess && guess.candidates && guess.candidates.length) {
      const amps = guess.amplitudes || guess.candidates.map(() => 1);
      file.candidates = guess.candidates.map((content, i) => ({ content, weight: amps[i] || 0 }));
      // Pick the collapsed candidate. A quantum engine returns `chosen` — a genuine
      // Born-rule measurement outcome; otherwise fall back to the highest amplitude.
      let bestIdx = 0;
      if (guess.chosen != null && guess.chosen >= 0 && guess.chosen < guess.candidates.length) {
        bestIdx = guess.chosen;
      } else {
        for (let i = 1; i < amps.length; i++) if (amps[i] > amps[bestIdx]) bestIdx = i;
      }
      const best = guess.candidates[bestIdx] != null ? guess.candidates[bestIdx] : guess.candidates[0];
      if (guess.quantum) file.quantum = guess.quantum; // measurement + negative-time telemetry
      applyMeasurement(file, best, guess.confidence != null ? guess.confidence : 0.5);
    } else {
      // No usable guess — still nudge the debt so the loop terminates.
      applyMeasurement(file, file.content || '', 0.5);
    }
    if (shouldCommit(file, this.maxMeasurements)) {
      commit(file);
      this.emit('collapse', { file });
    }
    this.steps += 1;
    const { total, breakdown } = await this._score();
    this.emit('score', { total, breakdown });
    this.emit('step', { file, score: total, breakdown, steps: this.steps });
    return file;
  }

  _anyOpen() {
    return this.files.some((f) => f.state !== 'collapsed');
  }

  async run() {
    this.running = true;
    this.emit('start', { files: this.files, threshold: this.threshold, budget: this.budget });
    let { total, breakdown } = await this._score();
    this.emit('score', { total, breakdown });

    while (this.running && this.lastScore < this.threshold && this.steps < this.budget && this._anyOpen()) {
      await this.step();
      if (this.stepDelay) await new Promise((r) => setTimeout(r, this.stepDelay));
    }

    // Force-commit any remaining files so the assembled site is complete.
    for (const f of this.files) {
      if (f.state === 'collapsed') continue;
      if (f.content == null) {
        const g = await this._guess(f);
        if (g && g.candidates && g.candidates.length) f.content = g.candidates[0];
      }
      commit(f);
      this.emit('collapse', { file: f });
    }

    const final = await this._score();
    this.emit('score', final);
    let reason = 'complete';
    if (final.total >= this.threshold) reason = 'threshold';
    else if (this.steps >= this.budget) reason = 'budget';
    this.running = false;
    this.emit('done', { reason, score: final.total, breakdown: final.breakdown, files: this.files });
    return {
      site: assembleSite(this.files),
      files: this.files,
      score: final.total,
      breakdown: final.breakdown,
      steps: this.steps,
      reason,
    };
  }

  stop() {
    this.running = false;
  }

  reset() {
    this.rng = createRng(this.seed);
    this.files = (this.spec.files || []).map((f) => createNullFile(f, this.rng));
    this.steps = 0;
    this.lastScore = 0;
    this.lastBreakdown = {};
    this.running = false;
  }
}
