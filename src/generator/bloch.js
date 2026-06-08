// 🌐 Bloch-sphere geometry — the qubit-superposition view of a null file.
//
// A qubit pure state is |ψ⟩ = cos(θ/2)|0⟩ + e^{iφ} sin(θ/2)|1⟩, a point on the
// unit sphere at (sinθ cosφ, sinθ sinφ, cosθ): the north pole is |0⟩, the south
// pole |1⟩, the equator the equal superpositions. We map a file's collapse onto
// this sphere: while it is a diffuse superposition (determinacy 0) its Bloch vector
// sits on the equator (maximal uncertainty); as it is measured (determinacy → 1)
// the vector rises to the north pole (a definite, collapsed value), and the
// uncertainty "cloud" around the tip shrinks. Framework-free and Node-testable.

// Cartesian Bloch vector for spherical angles (θ polar, φ azimuth).
export function blochVector(theta, phi) {
  const s = Math.sin(theta);
  return [s * Math.cos(phi), s * Math.sin(phi), Math.cos(theta)];
}

// Map a file to a Bloch state. determinacy = 1 − debt/missingInfo ∈ [0,1].
//   θ = (π/2)(1 − determinacy)  → equator (π/2) when uncertain, north pole (0) when collapsed
//   φ winds with the measurement count so the vector precesses as it is probed
//   dispersion = 1 − determinacy → uncertainty-cloud radius, shrinks to 0 on collapse
export function fileBlochState(file) {
  const missing = file.missingInfo || 1;
  const determinacy = Math.max(0, Math.min(1, 1 - (file.debt || 0) / missing));
  const theta = (Math.PI / 2) * (1 - determinacy);
  const phi = ((file.measurements || 0) * 0.7 + (file.path ? file.path.length : 0) * 0.3) % (2 * Math.PI);
  return {
    determinacy,
    theta,
    phi,
    vector: blochVector(theta, phi),
    dispersion: 1 - determinacy,
  };
}
