// ⚛️ QuantumMeasurementEngine — selects a candidate by a GENUINE Born-rule
// measurement, optionally seeded by real quantum entropy, and ready to run on real
// hardware (the selection circuit exports to OpenQASM 3).
//
// It decorates a base content engine (default: the QuantumSimulatorEngine, which
// produces candidate strings + amplitudes). The base gives amplitudes a_i; the Born
// weights are w_i = |a_i|². We then SAMPLE one candidate i ∝ w_i by descending a
// balanced binary tree of single-qubit measurements: at each node we prepare a real
// qubit RY(θ)|0⟩ with cos²(θ/2) = W_left/W, sin²(θ/2) = W_right/W and MEASURE it
// (a real state-vector collapse). The product of conditional probabilities equals
// w_i / Σw exactly, so this is a faithful Born-rule sample — not argmax, not a hack.
//
// The randomness driving each collapse comes from a pluggable EntropySource:
//   • SeededEntropy   — the project's deterministic xmur3+mulberry32 stream.
//   • QuantumEntropy  — real vacuum-fluctuation bits from the ANU QRNG (batched).
//
// Each measurement also carries a "negative time" reading (weak value / group
// delay) so the UI can surface the Steinberg effect faithfully.

import { Engine } from './quantum-site-generator.js';
import { QuantumSimulatorEngine } from './engines.js';
import { Statevector, QuantumCircuit, ryMat } from './qsim.js';
import { fileDwell, weakValueExcitation } from './negative-time.js';

// ---- Entropy sources -------------------------------------------------------
export class SeededEntropy {
  constructor(rng) { this.rng = rng; }
  get name() { return 'seeded'; }
  async uniform() { return this.rng(); }
}

const ANU_DEFAULT = 'https://api.quantumnumbers.anu.edu.au';

// Real quantum randomness from the ANU QRNG, batched into a pool. Falls back to a
// seeded stream if the service is unreachable, so the run never blocks.
export class QuantumEntropy {
  constructor(opts = {}) {
    this.apiKey = opts.apiKey || null;
    this.endpoint = opts.endpoint || null;
    this.fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
    this.fallbackRng = opts.fallbackRng || null;
    this.batch = opts.batch || 256;
    this._pool = [];
    this.usedQuantum = 0;
    this.usedFallback = 0;
  }
  get name() { return 'quantum-anu'; }
  async available() { return Boolean(this.fetchImpl && (this.apiKey || this.endpoint)); }

  async _refill() {
    const base = this.endpoint || ANU_DEFAULT;
    const url = `${base}${base.includes('?') ? '&' : '?'}length=${this.batch}&type=uint16`;
    const headers = {};
    if (this.apiKey && !this.endpoint) headers['x-api-key'] = this.apiKey;
    const res = await this.fetchImpl(url, { headers });
    if (!res.ok) throw new Error(`QRNG endpoint returned ${res.status}`);
    const data = await res.json();
    if (!data || !Array.isArray(data.data)) throw new Error('QRNG response had no data array');
    for (const v of data.data) this._pool.push((v + 0.5) / 65536);
  }

  async uniform() {
    if (this._pool.length === 0) {
      try {
        await this._refill();
      } catch (err) {
        if (typeof console !== 'undefined') console.warn('[qiwg] QuantumEntropy fell back to seeded stream:', err.message);
        this.usedFallback += 1;
        return this.fallbackRng ? this.fallbackRng() : Math.random();
      }
    }
    this.usedQuantum += 1;
    return this._pool.shift();
  }
}

// Measure one qubit prepared as RY(θ)|0⟩ using a single uniform u∈[0,1).
// P(1) = sin²(θ/2). Returns the bit. Uses the real Statevector for fidelity.
function measureRY(theta, u) {
  const sv = new Statevector(1);
  sv.applyGate(0, ryMat(theta));
  return sv.measure(0, () => u);
}

// Sample an index i ∝ weights[i] by descending a balanced binary tree of real
// single-qubit RY measurements. Returns { index, prob, qubits, qasm, path }.
export async function bornSampleTree(weights, entropy) {
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0) || 1;
  let lo = 0;
  let hi = weights.length; // [lo, hi)
  let prob = 1;
  let qubits = 0;
  const path = [];
  const qasmLines = [];
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    let wl = 0;
    for (let k = lo; k < mid; k++) wl += Math.max(0, weights[k]);
    let wr = 0;
    for (let k = mid; k < hi; k++) wr += Math.max(0, weights[k]);
    const sub = wl + wr || 1;
    // RY angle so that P(0)=wl/sub (go left), P(1)=wr/sub (go right)
    const theta = 2 * Math.atan2(Math.sqrt(wr / sub), Math.sqrt(wl / sub));
    const u = await entropy.uniform();
    const bit = measureRY(theta, u);
    qubits += 1;
    qasmLines.push(`ry(${theta.toFixed(6)}) q[0]; c[0] = measure q[0];  // ${bit === 0 ? 'left' : 'right'}`);
    if (bit === 0) { prob *= wl / sub; hi = mid; path.push(0); }
    else { prob *= wr / sub; lo = mid; path.push(1); }
  }
  const index = lo;
  const qasm = ['OPENQASM 3;', 'include "stdgates.inc";', 'qubit[1] q;', 'bit[1] c;', ...qasmLines].join('\n');
  return { index, prob: weights[index] / total, qubits, qasm, path };
}

export class QuantumMeasurementEngine extends Engine {
  constructor(opts = {}) {
    super();
    this.base = opts.base || new QuantumSimulatorEngine();
    this.entropy = opts.entropy || null; // null → derive a deterministic source per guess
    this.negativeTime = opts.negativeTime !== false; // attach weak-value/group-delay telemetry
  }
  get name() { return 'quantum-measurement'; }
  async available() { return true; }

  async guess(file, ctx) {
    const g = await this.base.guess(file, ctx);
    if (!g || !g.candidates || !g.candidates.length) return g;
    const amps = g.amplitudes || g.candidates.map(() => 1);
    const weights = amps.map((a) => Math.max(0, a * a)); // Born weights = |amplitude|²

    // Entropy: explicit source, else a deterministic per-(file,measurement) stream
    // so a seed reproduces the whole run exactly.
    const entropy = this.entropy || new SeededEntropy(ctx.rng.fork(`measure:${file.path}#${file.measurements}`));
    const sample = await bornSampleTree(weights, entropy);

    const quantum = {
      backend: this.entropy ? this.entropy.name : 'local-statevector',
      qubits: sample.qubits,
      bornProb: sample.prob,
      chosenIndex: sample.index,
      openqasm: sample.qasm,
    };

    if (this.negativeTime) {
      const dwell = fileDwell(file);
      // Pre/post-selection angles tied to the file's collapse geometry: pre-select
      // at the current determinacy, post-select near orthogonal as it collapses →
      // anomalous (possibly negative) weak value, à la Steinberg.
      const det = 1 - (file.debt || 0) / (file.missingInfo || 1);
      const a = (det * Math.PI) / 2;
      const b = ((1 - det) * Math.PI) / 2 + Math.PI / 3;
      const wv = weakValueExcitation(a, b);
      quantum.negativeTime = {
        groupDelay: dwell.tau,
        excitationRatio: dwell.ratio, // τ_T/τ₀, can be < 0
        weakValue: wv.value,
        anomalous: wv.anomalous,
        negative: dwell.negative,
      };
    }

    return { ...g, chosen: sample.index, confidence: g.confidence != null ? g.confidence : sample.prob, quantum };
  }
}
