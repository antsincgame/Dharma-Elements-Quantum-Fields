// ⚛️ A real state-vector quantum simulator — framework-free, zero-dependency.
//
// n qubits → 2^n complex amplitudes (stored as two Float64Arrays, re[] and im[]).
// Gates are applied with the standard bit-mask pairing trick (O(2^n) per gate, no
// allocation); measurement is a genuine Born-rule collapse. Determinism comes from
// the project's seeded PRNG (createRng — xmur3 + mulberry32), so a given seed yields
// identical measurement outcomes while still honoring |amplitude|² probabilities.
//
// Circuits use OpenQASM-3 gate names and export to OpenQASM 3, so the same circuit
// runs on this simulator OR on real hardware via the backends in ./backends.js.
//
// Gate matrices and the index-pairing algorithm follow the standard references
// (Wikipedia "Quantum logic gate", Qiskit/OpenQASM conventions). RZ uses the
// symmetric convention diag(e^{-iθ/2}, e^{+iθ/2}).

import { createRng } from './prng.js';

const SQRT1_2 = Math.SQRT1_2;
const c = (re, im = 0) => ({ re, im });

// Static single-qubit gates as 2×2 matrices [[m00,m01],[m10,m11]].
export const GATES = {
  i: [[c(1), c(0)], [c(0), c(1)]],
  x: [[c(0), c(1)], [c(1), c(0)]],
  y: [[c(0), c(0, -1)], [c(0, 1), c(0)]],
  z: [[c(1), c(0)], [c(0), c(-1)]],
  h: [[c(SQRT1_2), c(SQRT1_2)], [c(SQRT1_2), c(-SQRT1_2)]],
  s: [[c(1), c(0)], [c(0), c(0, 1)]],
  sdg: [[c(1), c(0)], [c(0), c(0, -1)]],
  t: [[c(1), c(0)], [c(0), c(SQRT1_2, SQRT1_2)]],
  tdg: [[c(1), c(0)], [c(0), c(SQRT1_2, -SQRT1_2)]],
};

// Parametric gates.
export const rxMat = (t) => [[c(Math.cos(t / 2)), c(0, -Math.sin(t / 2))], [c(0, -Math.sin(t / 2)), c(Math.cos(t / 2))]];
export const ryMat = (t) => [[c(Math.cos(t / 2)), c(-Math.sin(t / 2))], [c(Math.sin(t / 2)), c(Math.cos(t / 2))]];
export const rzMat = (t) => [[c(Math.cos(t / 2), -Math.sin(t / 2)), c(0)], [c(0), c(Math.cos(t / 2), Math.sin(t / 2))]];
export const pMat = (l) => [[c(1), c(0)], [c(0), c(Math.cos(l), Math.sin(l))]];

export class Statevector {
  constructor(n) {
    this.n = n;
    const N = 1 << n;
    this.re = new Float64Array(N);
    this.im = new Float64Array(N);
    this.re[0] = 1; // |0…0⟩
  }

  // Apply a single-qubit 2×2 unitary U to qubit q (qubit 0 = least-significant bit).
  applyGate(q, U) {
    const { re, im } = this;
    const N = re.length;
    const bit = 1 << q;
    const u00 = U[0][0], u01 = U[0][1], u10 = U[1][0], u11 = U[1][1];
    for (let i = 0; i < N; i++) {
      if ((i & bit) === 0) {
        const j = i | bit;
        const ar = re[i], ai = im[i], br = re[j], bi = im[j];
        re[i] = u00.re * ar - u00.im * ai + u01.re * br - u01.im * bi;
        im[i] = u00.re * ai + u00.im * ar + u01.re * bi + u01.im * br;
        re[j] = u10.re * ar - u10.im * ai + u11.re * br - u11.im * bi;
        im[j] = u10.re * ai + u10.im * ar + u11.re * bi + u11.im * br;
      }
    }
    return this;
  }

  // Apply U to `target` only on the branch where `control` = 1.
  applyControlled(control, target, U) {
    const { re, im } = this;
    const N = re.length;
    const cbit = 1 << control;
    const tbit = 1 << target;
    const u00 = U[0][0], u01 = U[0][1], u10 = U[1][0], u11 = U[1][1];
    for (let i = 0; i < N; i++) {
      if ((i & cbit) !== 0 && (i & tbit) === 0) {
        const j = i | tbit;
        const ar = re[i], ai = im[i], br = re[j], bi = im[j];
        re[i] = u00.re * ar - u00.im * ai + u01.re * br - u01.im * bi;
        im[i] = u00.re * ai + u00.im * ar + u01.re * bi + u01.im * br;
        re[j] = u10.re * ar - u10.im * ai + u11.re * br - u11.im * bi;
        im[j] = u10.re * ai + u10.im * ar + u11.re * bi + u11.im * br;
      }
    }
    return this;
  }

  // Two-control gate (e.g. Toffoli = applyDoubleControlled(c1,c2,target, GATES.x)).
  applyDoubleControlled(c1, c2, target, U) {
    const { re, im } = this;
    const N = re.length;
    const m1 = 1 << c1, m2 = 1 << c2, tbit = 1 << target;
    const u00 = U[0][0], u01 = U[0][1], u10 = U[1][0], u11 = U[1][1];
    for (let i = 0; i < N; i++) {
      if ((i & m1) !== 0 && (i & m2) !== 0 && (i & tbit) === 0) {
        const j = i | tbit;
        const ar = re[i], ai = im[i], br = re[j], bi = im[j];
        re[i] = u00.re * ar - u00.im * ai + u01.re * br - u01.im * bi;
        im[i] = u00.re * ai + u00.im * ar + u01.re * bi + u01.im * br;
        re[j] = u10.re * ar - u10.im * ai + u11.re * br - u11.im * bi;
        im[j] = u10.re * ai + u10.im * ar + u11.re * bi + u11.im * br;
      }
    }
    return this;
  }

  swap(a, b) {
    if (a === b) return this;
    const { re, im } = this;
    const N = re.length;
    const abit = 1 << a, bbit = 1 << b;
    for (let i = 0; i < N; i++) {
      // swap amplitudes of states that differ exactly in (a=0,b=1) ↔ (a=1,b=0)
      if ((i & abit) === 0 && (i & bbit) !== 0) {
        const j = (i | abit) & ~bbit;
        const tr = re[i], ti = im[i];
        re[i] = re[j]; im[i] = im[j];
        re[j] = tr; im[j] = ti;
      }
    }
    return this;
  }

  // Born probability that qubit q reads 1.
  prob1(q) {
    const { re, im } = this;
    const N = re.length;
    const bit = 1 << q;
    let p = 0;
    for (let i = 0; i < N; i++) if ((i & bit) !== 0) p += re[i] * re[i] + im[i] * im[i];
    return p;
  }

  // Measure qubit q, collapsing the state. `rng` returns a uniform in [0,1).
  measure(q, rng) {
    const { re, im } = this;
    const N = re.length;
    const bit = 1 << q;
    const p1 = this.prob1(q);
    const outcome = rng() < p1 ? 1 : 0;
    let norm = Math.sqrt(outcome ? p1 : 1 - p1);
    if (norm === 0) norm = 1;
    for (let i = 0; i < N; i++) {
      const isOne = (i & bit) !== 0 ? 1 : 0;
      if (isOne === outcome) { re[i] /= norm; im[i] /= norm; }
      else { re[i] = 0; im[i] = 0; }
    }
    return outcome;
  }

  // Full probability distribution over basis states.
  probabilities() {
    const { re, im } = this;
    const N = re.length;
    const out = new Float64Array(N);
    for (let i = 0; i < N; i++) out[i] = re[i] * re[i] + im[i] * im[i];
    return out;
  }

  // Sample `shots` measurements of the full register (non-destructive) using the
  // cumulative |amp|² distribution → histogram of bitstrings (MSB-left).
  sampleCounts(shots, rng) {
    const probs = this.probabilities();
    const N = probs.length;
    const cum = new Float64Array(N);
    let acc = 0;
    for (let k = 0; k < N; k++) { acc += probs[k]; cum[k] = acc; }
    if (acc <= 0) return {}; // zero-norm state (degenerate) → no outcomes, not silent zeros
    const counts = {};
    for (let s = 0; s < shots; s++) {
      const r = rng() * acc;
      // binary search for smallest k with cum[k] >= r
      let lo = 0, hi = N - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
      const bs = lo.toString(2).padStart(this.n, '0');
      counts[bs] = (counts[bs] || 0) + 1;
    }
    return counts;
  }

  norm() {
    const { re, im } = this;
    let s = 0;
    for (let i = 0; i < re.length; i++) s += re[i] * re[i] + im[i] * im[i];
    return Math.sqrt(s);
  }
}

// A small OpenQASM-3-flavored circuit builder. Gate names match stdgates.inc so
// toOpenQASM() output is portable to IBM Quantum / Amazon Braket.
export class QuantumCircuit {
  constructor(n) {
    this.n = n;
    this.ops = [];
    this.measured = false;
  }
  _g(name, ...args) { this.ops.push([name, ...args]); return this; }
  h(q) { return this._g('h', q); }
  x(q) { return this._g('x', q); }
  y(q) { return this._g('y', q); }
  z(q) { return this._g('z', q); }
  s(q) { return this._g('s', q); }
  sdg(q) { return this._g('sdg', q); }
  t(q) { return this._g('t', q); }
  tdg(q) { return this._g('tdg', q); }
  rx(q, theta) { return this._g('rx', q, theta); }
  ry(q, theta) { return this._g('ry', q, theta); }
  rz(q, theta) { return this._g('rz', q, theta); }
  p(q, lambda) { return this._g('p', q, lambda); }
  cx(ctrl, tgt) { return this._g('cx', ctrl, tgt); }
  cz(ctrl, tgt) { return this._g('cz', ctrl, tgt); }
  swap(a, b) { return this._g('swap', a, b); }
  ccx(c1, c2, tgt) { return this._g('ccx', c1, c2, tgt); }
  measureAll() { this.measured = true; return this; }

  // Apply all gate ops to a fresh statevector (measurement markers are end-of-circuit
  // and handled by run()/sampleCounts; here we just evolve the unitary part).
  simulate() {
    const sv = new Statevector(this.n);
    for (const op of this.ops) {
      const [name, a, b, c2] = op;
      switch (name) {
        case 'h': case 'x': case 'y': case 'z': case 's': case 'sdg': case 't': case 'tdg':
          sv.applyGate(a, GATES[name]); break;
        case 'rx': sv.applyGate(a, rxMat(b)); break;
        case 'ry': sv.applyGate(a, ryMat(b)); break;
        case 'rz': sv.applyGate(a, rzMat(b)); break;
        case 'p': sv.applyGate(a, pMat(b)); break;
        case 'cx': sv.applyControlled(a, b, GATES.x); break;
        case 'cz': sv.applyControlled(a, b, GATES.z); break;
        case 'swap': sv.swap(a, b); break;
        case 'ccx': sv.applyDoubleControlled(a, b, c2, GATES.x); break;
        default: throw new Error(`unknown gate ${name}`);
      }
    }
    return sv;
  }

  probabilities() { return this.simulate().probabilities(); }

  // Run the circuit and return a {bitstring: count} histogram.
  run(rng, shots = 1024) { return this.simulate().sampleCounts(shots, rng); }

  // Export to OpenQASM 3 (portable to real quantum computers).
  toOpenQASM() {
    const fmt = (v) => Number(v).toFixed(6);
    const lines = ['OPENQASM 3;', 'include "stdgates.inc";', `qubit[${this.n}] q;`, `bit[${this.n}] c;`];
    for (const op of this.ops) {
      const [name, a, b, c2] = op;
      switch (name) {
        case 'rx': case 'ry': case 'rz': case 'p': lines.push(`${name}(${fmt(b)}) q[${a}];`); break;
        case 'cx': case 'cz': case 'swap': lines.push(`${name} q[${a}], q[${b}];`); break;
        case 'ccx': lines.push(`ccx q[${a}], q[${b}], q[${c2}];`); break;
        default: lines.push(`${name} q[${a}];`);
      }
    }
    if (this.measured) lines.push('c = measure q;');
    return lines.join('\n');
  }
}

// Parse the subset of OpenQASM 3 this project emits back into a QuantumCircuit
// (used by the proxy server to run a browser-submitted circuit on a real backend).
export function parseOpenQASM(qasm) {
  const lines = String(qasm).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let n = 0;
  for (const l of lines) {
    const m = l.match(/^qubit\[(\d+)\]/);
    if (m) { n = parseInt(m[1], 10); break; }
  }
  if (!n) throw new Error('OpenQASM has no qubit[n] register');
  const circ = new QuantumCircuit(n);
  for (const l of lines) {
    if (/^(OPENQASM|include|qubit|bit)\b/.test(l)) continue;
    if (/\bmeasure\b/.test(l)) { circ.measureAll(); continue; }
    let m;
    if ((m = l.match(/^(rx|ry|rz|p)\(\s*([-+0-9.eE]+)\s*\)\s+q\[(\d+)\]/))) { circ[m[1]](parseInt(m[3], 10), parseFloat(m[2])); continue; }
    if ((m = l.match(/^ccx\s+q\[(\d+)\]\s*,\s*q\[(\d+)\]\s*,\s*q\[(\d+)\]/))) { circ.ccx(+m[1], +m[2], +m[3]); continue; }
    if ((m = l.match(/^(cx|cz|swap)\s+q\[(\d+)\]\s*,\s*q\[(\d+)\]/))) { circ[m[1]](+m[2], +m[3]); continue; }
    if ((m = l.match(/^(h|x|y|z|s|sdg|t|tdg)\s+q\[(\d+)\]/))) { circ[m[1]](parseInt(m[2], 10)); continue; }
    // unrecognized lines are ignored (forward-compatible)
  }
  return circ;
}

// A canonical 2-qubit Bell circuit — used to verify connectivity to any backend
// (ideal result ≈ 50% "00", 50% "11").
export function bellCircuit() {
  return new QuantumCircuit(2).h(0).cx(0, 1).measureAll();
}

// Convenience: a default deterministic RNG for the simulator.
export function defaultRng(seed = 'OM') {
  return createRng(seed);
}
