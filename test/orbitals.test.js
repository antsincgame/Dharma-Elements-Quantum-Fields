// Orbital |ψ|² sampling tests (zero-dependency): node test/orbitals.test.js
// Verifies the radial CDF (r² Jacobian), inverse-transform sampling, |Y_lm|²
// rejection, and the phase sign — including the radial nodes of 2s/3s/3p.

import assert from 'node:assert/strict';
import {
  ORBITALS, buildRadialCDF, sampleRadius, sampleDirection, sampleOrbital, createRng,
} from '../src/generator/index.js';

let passed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (err) { console.error(`  ✗ ${name}`); throw err; }
}

// Sample an orbital and tally phase signs / radii.
function tally(key, n = 8000, seed = 'orb') {
  const { positions, signs } = sampleOrbital(key, n, createRng(seed));
  let pos = 0, neg = 0, bad = 0, maxR = 0;
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    const r = Math.hypot(x, y, z);
    if (!Number.isFinite(r) || !Number.isFinite(signs[i])) bad++;
    if (r > maxR) maxR = r;
    if (signs[i] >= 0) pos++; else neg++;
  }
  return { pos, neg, bad, maxR };
}

console.log('Orbital sampling tests');

await check('ORBITALS includes node-free and node-bearing orbitals', () => {
  for (const k of ['1s', '2s', '2pz', '3s', '3pz', '3dz2', '3dx2y2', '3dxy', '3dxz', '3dyz']) {
    assert.ok(ORBITALS[k], `missing ${k}`);
    assert.equal(typeof ORBITALS[k].radial, 'function');
    assert.equal(typeof ORBITALS[k].angular, 'function');
    assert.ok(ORBITALS[k].angularMax > 0);
  }
});

await check('buildRadialCDF is monotone non-decreasing and ends at 1', () => {
  const { cdf } = buildRadialCDF(ORBITALS['2pz']);
  for (let i = 1; i < cdf.length; i++) assert.ok(cdf[i] >= cdf[i - 1] - 1e-12, 'monotone');
  assert.ok(Math.abs(cdf[cdf.length - 1] - 1) < 1e-9, 'normalized to 1');
});

await check('the r² Jacobian moves the 1s peak off the nucleus (no pile-up at r=0)', () => {
  // Most-probable radius of 1s is a₀=1 (rPeak), not 0. Sample radii and check the
  // mode is well away from 0.
  const o = ORBITALS['1s'];
  const cdf = buildRadialCDF(o);
  const rng = createRng('jac');
  const bins = new Array(20).fill(0);
  for (let i = 0; i < 20000; i++) { const r = sampleRadius(cdf, rng); bins[Math.min(19, Math.floor(r / (o.rMax / 20)))]++; }
  assert.ok(bins[0] < bins[2], 'density near r=0 is below the shell peak (r² suppresses the origin)');
});

await check('1s has no nodes → every point is positive phase', () => {
  const { pos, neg, bad } = tally('1s');
  assert.equal(bad, 0);
  assert.equal(neg, 0, 'no sign flips for a node-free orbital');
  assert.ok(pos > 0);
});

await check('2s has ONE radial node → both phases present, outer (dominant) is positive', () => {
  const { pos, neg, bad } = tally('2s');
  assert.equal(bad, 0);
  assert.ok(neg > 0 && pos > 0, 'a radial node produces opposite-phase shells');
  assert.ok(pos > neg, 'the dominant outer shell is the positive (element) phase');
  // The wavefunction sign flips across the node at r=2a₀.
  assert.ok(ORBITALS['2s'].radial(1) < 0 && ORBITALS['2s'].radial(5) > 0, 'sign flips across r≈2');
});

await check('3s has TWO radial nodes → three alternating shells', () => {
  const { pos, neg, bad } = tally('3s');
  assert.equal(bad, 0);
  assert.ok(neg > 0 && pos > 0);
  // Sign pattern of (27 − 18r + 2r²): + (r<1.9), − (1.9<r<7.1), + (r>7.1).
  const R = ORBITALS['3s'].radial;
  assert.ok(R(1) > 0 && R(4) < 0 && R(10) > 0, 'three sign regions');
});

await check('2pz angular node splits ±z lobes ~50/50', () => {
  const { pos, neg } = tally('2pz');
  const ratio = pos / (pos + neg);
  assert.ok(ratio > 0.4 && ratio < 0.6, `lobes balanced (got ${ratio.toFixed(2)})`);
});

await check('3d_z² angularMax is the polar value 3·1−1 = 2', () => {
  assert.equal(ORBITALS['3dz2'].angularMax, 2);
  // poles positive, equatorial torus negative (3cos²θ−1 < 0 near the equator)
  assert.ok(ORBITALS['3dz2'].angular(0, 0, 1) > 0 && ORBITALS['3dz2'].angular(1, 0, 0) < 0);
});

await check('sampleDirection returns a unit vector and a ±1 phase', () => {
  const rng = createRng('dir');
  for (const k of ['2pz', '3dz2', '3dxy']) {
    const [x, y, z, s] = sampleDirection(ORBITALS[k], rng);
    assert.ok(Math.abs(Math.hypot(x, y, z) - 1) < 1e-9, `${k} unit vector`);
    assert.ok(s === 1 || s === -1, `${k} phase ±1`);
  }
});

await check('sampleOrbital is deterministic for a given seed', () => {
  const a = sampleOrbital('3pz', 500, createRng('same'));
  const b = sampleOrbital('3pz', 500, createRng('same'));
  assert.deepEqual(Array.from(a.positions), Array.from(b.positions));
  assert.deepEqual(Array.from(a.signs), Array.from(b.signs));
});

console.log(`\nAll ${passed} orbital tests passed ✓`);
