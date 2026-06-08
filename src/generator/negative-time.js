// ⏳ "Negative time" — a scientifically faithful layer, grounded in the 2024
// Steinberg/Angulo experiment (a photon can spend a NEGATIVE amount of time as an
// atomic excitation): arXiv:2409.03680, Phys. Rev. Lett. 136, 153601 (2026).
//
// What is real (and modeled here):
//   • The measured atomic excitation time is a WEAK VALUE; weak values can lie
//     outside an observable's eigenvalue range, hence "negative time".
//     A_w = ⟨φ|A|ψ⟩ / ⟨φ|ψ⟩   (Aharonov–Albert–Vaidman 1988).
//   • That weak value equals the optical GROUP DELAY τ_g = dφ/dω, which goes
//     NEGATIVE in the anomalous-dispersion region of a resonant medium.
//
// What is NOT real (and must never be implied): no time travel, no faster-than-
// light signaling, no causality violation. The minus sign is a phase-derivative /
// weak-value sign, not a clock running backwards (Steinberg: "we don't want to say
// anything traveled backward in time — that's a misinterpretation").
//
// Relation to this project's "negative size = entropy debt": negative conditional
// entropy S(A|B) < 0 and negative dwell time are STRUCTURAL COUSINS — both are
// well-defined negative quantities arising from quantum coherence + a conditioning
// structure. This is a conceptual analogy, NOT a theorem mapping one to the other.

export const NEGATIVE_TIME_REFERENCE = {
  title: 'Experimental evidence that a photon can spend a negative amount of time in an atom cloud',
  authors: 'Angulo, Thompson, Nixon, Jiao, Wiseman, Steinberg',
  arxiv: 'arXiv:2409.03680',
  journal: 'Phys. Rev. Lett. 136, 153601 (2026)',
  measuredRatioRange: [-0.82, 0.54], // τ_T/τ₀ : narrowband (negative) → broadband (positive)
  disclaimer: 'Negative weak value of excitation time = negative group delay. No time travel, no FTL signaling, no causality violation.',
};

// Weak value of A = |1⟩⟨1| for a qubit pre-selected at polar angle α and
// post-selected at polar angle β (real states |·⟩ = cos(θ/2)|0⟩ + sin(θ/2)|1⟩,
// here parameterized directly by half-angle a = θ/2 so |ψ⟩ = cos a|0⟩ + sin a|1⟩).
//   A_w = sin(a)·sin(b) / cos(a − b)
// Can be negative or exceed 1 (anomalous) when cos(a−b) is small/negative —
// exactly the regime the Steinberg experiment probes.
export function weakValueExcitation(a, b) {
  const den = Math.cos(a - b);
  if (Math.abs(den) < 1e-9) return { value: Infinity, postSelectProb: 0, anomalous: true };
  const value = (Math.sin(a) * Math.sin(b)) / den;
  return {
    value,
    postSelectProb: den * den, // |⟨φ|ψ⟩|² — vanishes as the weak value blows up
    anomalous: value < 0 || value > 1,
  };
}

// Group delay τ_g(Δ) for a single Lorentzian absorber of half-width γ and optical
// depth `depth`, from the phase φ(Δ) = −depth·γ·Δ/(Δ²+γ²):
//   τ_g = dφ/dΔ = −depth·γ·(γ² − Δ²)/(Δ² + γ²)²
// NEGATIVE inside the line (|Δ| < γ, anomalous dispersion → "negative time"),
// positive in the wings. A phenomenological, sign-correct toy model (not the exact
// experimental fit). Δ = detuning from resonance, in units of γ if γ = 1.
export function groupDelay(detuning, opts = {}) {
  const gamma = opts.gamma != null ? opts.gamma : 1;
  const depth = opts.depth != null ? opts.depth : 1;
  const d2 = detuning * detuning;
  const g2 = gamma * gamma;
  const denom = (d2 + g2) * (d2 + g2);
  if (denom === 0) return 0; // γ=Δ=0 → no absorber, no delay (avoid 0/0 = NaN)
  return (-depth * gamma * (g2 - d2)) / denom;
}

// Faithful-to-data illustrative map from pulse bandwidth (0 = narrowband → 1 =
// broadband) to the measured normalized excitation time τ_T/τ₀, linearly spanning
// the experiment's reported range [−0.82, +0.54].
export function excitationTimeRatio(bandwidth) {
  const [lo, hi] = NEGATIVE_TIME_REFERENCE.measuredRatioRange;
  const b = Math.max(0, Math.min(1, bandwidth));
  return lo + (hi - lo) * b;
}

// Derive a per-file "dwell" reading for the generator/visualization from a file's
// state. We treat each file's measurement "detuning" as how far its determinacy is
// from the half-collapsed point (determinacy 0.5 ≈ on resonance → most negative).
// Returns { detuning, tau, ratio, weak, negative } with a CAUSAL FLOOR so the
// effect never breaks the generation loop (advance is bounded, never unbounded).
export function fileDwell(file, opts = {}) {
  const gamma = opts.gamma != null ? opts.gamma : 0.5;
  const missing = file.missingInfo || 1;
  const determinacy = 1 - (file.debt || 0) / missing; // 0 → 1
  // map determinacy∈[0,1] to a detuning∈[-1,1] centered on the half-collapsed point
  const detuning = (determinacy - 0.5) * 2;
  const tau = groupDelay(detuning, { gamma, depth: 1 });
  // normalize tau into a bounded [-0.82, 0.54]-style ratio for display/animation
  const tauOnResonance = groupDelay(0, { gamma, depth: 1 }); // most negative value
  const norm = tauOnResonance !== 0 ? tau / Math.abs(tauOnResonance) : 0;
  const ratio = norm < 0
    ? Math.max(NEGATIVE_TIME_REFERENCE.measuredRatioRange[0], norm * 0.82)
    : Math.min(NEGATIVE_TIME_REFERENCE.measuredRatioRange[1], norm * 0.54);
  return { detuning, tau, ratio, negative: ratio < 0 };
}
