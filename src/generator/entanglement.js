// 🔗 Entanglement & the Bell–CHSH test — interbeing (प्रतीत्यसमुत्पाद) made literal.
//
// The site already names the parallel "Interdependence ↔ Quantum Entanglement". Here
// it becomes real: files are paired into entangled (Bell) states, measuring one
// instantly correlates its partner, and a genuine CHSH test demonstrates that these
// correlations are stronger than any local-realistic ("separate, independent")
// world allows.
//
// The CHSH quantity  S = E(a,b) + E(a,b') + E(a',b) − E(a',b')  obeys |S| ≤ 2 for any
// local hidden-variable theory (Bell 1964; Clauser–Horne–Shimony–Holt 1969), but a
// shared Bell state |Φ⁺⟩ = (|00⟩+|11⟩)/√2 reaches the Tsirelson bound 2√2 ≈ 2.828.
// Experimentally confirmed (Aspect 1982; 2022 Nobel Prize, Aspect/Clauser/Zeilinger).
//
// Honest framing: entanglement correlations carry NO signal — the no-communication
// theorem forbids faster-than-light messaging. "Measuring one shapes the other" is a
// correlation revealed only when the two results are later compared, not a channel.

import { QuantumCircuit } from './qsim.js';

export const ENTANGLEMENT_REFERENCE = {
  parallel: 'Interdependence (प्रतीत्यसमुत्पाद) ↔ Quantum Entanglement',
  bell: 'Bell, Physics 1, 195 (1964)',
  chsh: 'Clauser–Horne–Shimony–Holt, Phys. Rev. Lett. 23, 880 (1969)',
  experiment: 'Aspect 1982; Nobel Prize in Physics 2022 (Aspect, Clauser, Zeilinger)',
  classicalBound: 2,
  tsirelson: 2 * Math.SQRT2,
  disclaimer: 'Entanglement correlations cannot transmit information (no-communication theorem) — no FTL signaling.',
};

// Canonical CHSH measurement angles (Bloch polar angles) that maximize S to 2√2 for
// |Φ⁺⟩, with E(a,b) = cos(a − b).
export const CHSH_ANGLES = { a: 0, ap: Math.PI / 2, b: Math.PI / 4, bp: -Math.PI / 4 };

// Circuit: prepare |Φ⁺⟩ (h, cx), then measure qubit 0 along Bloch angle `angleA`
// and qubit 1 along `angleB` by rotating RY(−angle) into the computational basis.
// Exports to OpenQASM 3, so the very same test runs on a real QPU via the proxy.
export function chshCircuit(angleA, angleB) {
  return new QuantumCircuit(2).h(0).cx(0, 1).ry(0, -angleA).ry(1, -angleB).measureAll();
}

// Bell-state correlation E(a,b) = ⟨Z⊗Z⟩ after the rotations, computed EXACTLY from
// the state vector (no sampling noise). Equals cos(a − b).
export function correlation(angleA, angleB) {
  const p = chshCircuit(angleA, angleB).probabilities(); // [00, 01, 10, 11]
  return p[0] - p[1] - p[2] + p[3];
}

// ⟨Z⊗Z⟩ from a measured {bitstring: count} histogram (bitstring = q1 q0).
export function correlationFromCounts(counts) {
  const c00 = counts['00'] || 0, c01 = counts['01'] || 0, c10 = counts['10'] || 0, c11 = counts['11'] || 0;
  const tot = c00 + c01 + c10 + c11 || 1;
  return (c00 - c01 - c10 + c11) / tot;
}

// Exact CHSH value from the state vector — the headline number (→ 2√2).
export function chshExact(angles = CHSH_ANGLES) {
  const { a, ap, b, bp } = angles;
  const E = { ab: correlation(a, b), abp: correlation(a, bp), apb: correlation(ap, b), apbp: correlation(ap, bp) };
  const S = E.ab + E.abp + E.apb - E.apbp;
  return { S, E, classicalBound: 2, tsirelson: 2 * Math.SQRT2, violates: S > 2 + 1e-9 };
}

// Sampled CHSH — run the four setting-pairs on a real backend (local simulator,
// QRNG, or a real QPU via the proxy) and estimate S from measurement counts.
export async function chshSampled(backend, shots = 2048, angles = CHSH_ANGLES) {
  const { a, ap, b, bp } = angles;
  const pairs = { ab: [a, b], abp: [a, bp], apb: [ap, b], apbp: [ap, bp] };
  const E = {};
  for (const key of Object.keys(pairs)) {
    const [x, y] = pairs[key];
    const { counts } = await backend.run(chshCircuit(x, y), shots);
    E[key] = correlationFromCounts(counts);
  }
  const S = E.ab + E.abp + E.apb - E.apbp;
  return { S, E, shots, classicalBound: 2, tsirelson: 2 * Math.SQRT2, violates: S > 2 };
}

// A shared entangled pair (default |Φ⁺⟩): measuring it collapses BOTH qubits, with
// perfectly correlated outcomes for |Φ⁺⟩ (b0 === b1) — the literal "interbeing".
export class EntangledPair {
  constructor(kind = 'phi+') {
    this.kind = kind;
    this.measured = false;
    this.bits = null;
    this.correlated = null;
  }
  _state() {
    const c = new QuantumCircuit(2).h(0).cx(0, 1); // |Φ⁺⟩
    if (this.kind === 'psi-') c.z(0).x(1); // |Ψ⁻⟩ (anti-correlated)
    if (this.kind === 'phi-') c.z(0);
    return c.simulate();
  }
  // Collapse both halves with a shared RNG; returns [bitA, bitB].
  measure(rng) {
    const sv = this._state();
    const b0 = sv.measure(0, rng);
    const b1 = sv.measure(1, rng);
    this.measured = true;
    this.bits = [b0, b1];
    this.correlated = b0 === b1;
    return this.bits;
  }
}

// Pair up files for entanglement (consecutive pairs; a trailing odd file is left
// unentangled). Returns [{ a, b }] with file references.
export function entangledPairs(files) {
  const pairs = [];
  const list = files || [];
  for (let i = 0; i + 1 < list.length; i += 2) pairs.push({ a: list[i], b: list[i + 1] });
  return pairs;
}
