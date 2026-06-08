// ⚛️ Hydrogen-like orbital sampling — the math behind the "superposition cloud".
//
// A null file in superposition is drawn as a cloud of points whose spatial density
// follows the Born-rule probability density |ψ_nlm(r,θ,φ)|² of a hydrogen-like
// orbital. Framework-free and deterministic (seeded PRNG) so it runs unchanged in
// the browser and in Node, and reproduces byte-for-byte for a given seed.
//
// Physics (researched & cross-checked):
//   • ψ_nlm(r,θ,φ) = R_nl(r) · Y_lm(θ,φ);  density = R_nl(r)² · |Y_lm|².
//   • The RADIAL probability is P(r) = r² · R_nl(r)²  — the r² shell (Jacobian)
//     factor is essential: R₁₀ peaks at r=0 but r²R² peaks at the Bohr radius a₀.
//     Forgetting r² is the #1 bug in home-made orbital visualizers, so we sample
//     the radius from P(r) explicitly (numerical inverse-transform of its CDF).
//   • Angles are sampled uniformly on the sphere — cosθ = 1−2u, φ = 2πv (this is
//     the sinθ area element) — then accept/reject by |Y_lm|² (rejection sampling).
// We work in dimensionless atomic units (a₀ = 1) and drop overall normalization
// constants: only the SHAPE of |ψ|² matters for sampling (M-normalized rejection).

// Each orbital: radial(r) ∝ R_nl(r); angular(ux,uy,uz) is the SIGNED real spherical
// harmonic on the unit sphere (its sign is the wavefunction phase, used for color);
// angularMax = max|angular| over the sphere; rPeak ≈ most-probable radius (used to
// normalize cloud size); rMax = radius beyond which density is negligible.
export const ORBITALS = {
  // 1s (l=0): spherical, isotropic. P(r)=r²e^{-2r} peaks at r=a₀=1.
  '1s': {
    label: '1s', n: 1, l: 0,
    radial: (r) => Math.exp(-r),
    angular: () => 1,
    angularMax: 1,
    rPeak: 1,
    rMax: 9,
  },
  // 2p (l=1): two lobes along an axis. ψ_2p ∝ r e^{-r/2} · (axis/r). P(r)=r⁴e^{-r} peaks at r=4.
  '2px': {
    label: '2pₓ', n: 2, l: 1,
    radial: (r) => r * Math.exp(-r / 2),
    angular: (x) => x,
    angularMax: 1,
    rPeak: 4,
    rMax: 18,
  },
  '2py': {
    label: '2p_y', n: 2, l: 1,
    radial: (r) => r * Math.exp(-r / 2),
    angular: (x, y) => y,
    angularMax: 1,
    rPeak: 4,
    rMax: 18,
  },
  '2pz': {
    label: '2p_z', n: 2, l: 1,
    radial: (r) => r * Math.exp(-r / 2),
    angular: (x, y, z) => z,
    angularMax: 1,
    rPeak: 4,
    rMax: 18,
  },
  // 3d_z² (l=2): lobes along z + an equatorial torus. ∝ (3z²−1). P(r)=r⁶e^{-2r/3} peaks at r=9.
  '3dz2': {
    label: '3d_z²', n: 3, l: 2,
    radial: (r) => r * r * Math.exp(-r / 3),
    angular: (x, y, z) => 3 * z * z - 1,
    angularMax: 2,
    rPeak: 9,
    rMax: 28,
  },
  // 3d_{x²−y²} (l=2): four lobes in the xy-plane.
  '3dx2y2': {
    label: '3d_{x²−y²}', n: 3, l: 2,
    radial: (r) => r * r * Math.exp(-r / 3),
    angular: (x, y) => x * x - y * y,
    angularMax: 1,
    rPeak: 9,
    rMax: 28,
  },
};

// The five elements ↔ quantum fields, mapped to orbitals by the field's spin
// (spin → orbital angular momentum l): the scalar Higgs (spin 0) → s, the three
// spin-1 vector/gauge fields → the three p lobes, the spin-2 vacuum → a d orbital.
export const ELEMENT_ORBITAL = {
  earth: '1s', // Higgs field — scalar (spin 0) → l=0
  water: '2px', // electromagnetic — vector (spin 1) → l=1
  fire: '2py', // strong — gauge (spin 1) → l=1
  air: '2pz', // weak — gauge (spin 1) → l=1
  space: '3dz2', // quantum vacuum — tensor (spin 2) → l=2
};

// Build a normalized cumulative distribution for the radial probability
// P(r) = r² · R_nl(r)² on a uniform grid over [0, rMax]. (The r² is the shell
// Jacobian — see the file header.)
export function buildRadialCDF(orbital, bins = 512) {
  const rMax = orbital.rMax;
  const dr = rMax / bins;
  const cdf = new Float64Array(bins + 1);
  let acc = 0;
  cdf[0] = 0;
  for (let i = 1; i <= bins; i++) {
    const r = (i - 0.5) * dr;
    const R = orbital.radial(r);
    acc += r * r * R * R; // P(r) ∝ r²·R(r)²
    cdf[i] = acc;
  }
  const inv = acc > 0 ? 1 / acc : 0;
  for (let i = 0; i <= bins; i++) cdf[i] *= inv;
  return { cdf, dr, bins };
}

// Inverse-transform: draw r ~ P(r) by inverting the tabulated CDF (binary search +
// linear interpolation within the bin).
export function sampleRadius(radialCDF, rng) {
  const { cdf, dr, bins } = radialCDF;
  const u = rng();
  let lo = 1;
  let hi = bins;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cdf[mid] < u) lo = mid + 1;
    else hi = mid;
  }
  const c0 = cdf[lo - 1];
  const c1 = cdf[lo];
  const frac = c1 > c0 ? (u - c0) / (c1 - c0) : 0;
  return (lo - 1 + frac) * dr;
}

// Draw a direction on the unit sphere distributed ∝ |Y_lm|². Step 1: uniform on the
// sphere (cosθ = 1−2u handles the sinθ measure). Step 2: rejection by |angular|².
// Returns [ux, uy, uz, sign] where sign (±1) is the wavefunction phase.
export function sampleDirection(orbital, rng, maxTries = 64) {
  const ux2max = orbital.angularMax * orbital.angularMax;
  for (let t = 0; t < maxTries; t++) {
    const cosT = 1 - 2 * rng();
    const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));
    const phi = 2 * Math.PI * rng();
    const ux = sinT * Math.cos(phi);
    const uy = sinT * Math.sin(phi);
    const uz = cosT;
    const a = orbital.angular(ux, uy, uz);
    if (rng() * ux2max <= a * a) return [ux, uy, uz, a >= 0 ? 1 : -1];
  }
  // Fallback (only for pathological maxTries): keep the last accepted-ish guess.
  return [0, 0, 1, orbital.angular(0, 0, 1) >= 0 ? 1 : -1];
}

// Sample N points of an orbital "cloud". Positions are normalized by the orbital's
// peak radius so every orbital fills a comparable unit-ish volume; the renderer
// scales them to scene units. Returns flat Float32Arrays for direct GPU upload.
export function sampleOrbital(key, n, rng) {
  const orbital = ORBITALS[key] || ORBITALS['1s'];
  const radialCDF = buildRadialCDF(orbital);
  const positions = new Float32Array(n * 3);
  const signs = new Float32Array(n);
  const inv = 1 / orbital.rPeak; // normalize cloud size by most-probable radius
  for (let i = 0; i < n; i++) {
    const r = sampleRadius(radialCDF, rng);
    const d = sampleDirection(orbital, rng);
    const rr = r * inv;
    positions[i * 3] = rr * d[0];
    positions[i * 3 + 1] = rr * d[1];
    positions[i * 3 + 2] = rr * d[2];
    signs[i] = d[3];
  }
  return { positions, signs, orbital };
}
