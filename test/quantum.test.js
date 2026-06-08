// Quantum layer tests (zero-dependency): node test/quantum.test.js
// Covers the state-vector simulator, the backend abstraction (with graceful
// degrade), the Born-rule candidate measurement, the QuantumMeasurementEngine
// integrated into the Generator, and the negative-time module.

import assert from 'node:assert/strict';
import {
  Statevector, QuantumCircuit, bellCircuit, ryMat, GATES,
  LocalSimulatorBackend, QRNGBackend, IBMBackend, BraketBackend, makeBackend,
  bornSampleTree, SeededEntropy, QuantumMeasurementEngine,
  QuantumSimulatorEngine, HeuristicScorer, Generator, createRng, SITE_SPECS,
  weakValueExcitation, groupDelay, excitationTimeRatio, fileDwell, NEGATIVE_TIME_REFERENCE,
} from '../src/generator/index.js';

let passed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (err) { console.error(`  ✗ ${name}`); throw err; }
}

console.log('Quantum layer tests');

// ---- State-vector simulator ----
await check('X|0⟩ = |1⟩ (deterministic measurement)', () => {
  const sv = new Statevector(1);
  sv.applyGate(0, GATES.x);
  assert.equal(sv.measure(0, () => 0.5), 1);
});

await check('H·H = identity', () => {
  const sv = new Statevector(1);
  sv.applyGate(0, GATES.h).applyGate(0, GATES.h);
  assert.ok(Math.abs(sv.re[0] - 1) < 1e-12 && Math.abs(sv.re[1]) < 1e-12, 'back to |0⟩');
});

await check('RY(θ)|0⟩ has P(1) = sin²(θ/2)', () => {
  for (const theta of [0.3, 1.0, 2.0, Math.PI]) {
    const sv = new Statevector(1);
    sv.applyGate(0, ryMat(theta));
    assert.ok(Math.abs(sv.prob1(0) - Math.sin(theta / 2) ** 2) < 1e-12, `θ=${theta}`);
  }
});

await check('gates preserve the norm (unitarity)', () => {
  const sv = new Statevector(3);
  sv.applyGate(0, GATES.h).applyControlled(0, 1, GATES.x).applyGate(2, ryMat(0.7)).applyGate(1, GATES.t).swap(0, 2);
  assert.ok(Math.abs(sv.norm() - 1) < 1e-12);
});

await check('Bell circuit yields ~50/50 over {00,11} only (seeded)', () => {
  const counts = bellCircuit().run(createRng('bell'), 4000);
  assert.equal((counts['01'] || 0) + (counts['10'] || 0), 0, 'no 01/10');
  const total = (counts['00'] || 0) + (counts['11'] || 0);
  assert.equal(total, 4000);
  assert.ok(Math.abs((counts['00'] || 0) / total - 0.5) < 0.05, `~50% 00, got ${(counts['00'] || 0) / total}`);
});

await check('same seed → identical sampled counts (determinism)', () => {
  const a = bellCircuit().run(createRng('s1'), 1000);
  const b = bellCircuit().run(createRng('s1'), 1000);
  assert.deepEqual(a, b);
});

await check('OpenQASM 3 export is well-formed and portable', () => {
  const qasm = bellCircuit().toOpenQASM();
  assert.ok(qasm.includes('OPENQASM 3;'));
  assert.ok(qasm.includes('include "stdgates.inc";'));
  assert.ok(qasm.includes('h q[0];'));
  assert.ok(qasm.includes('cx q[0], q[1];'));
  assert.ok(qasm.includes('c = measure q;'));
});

// ---- Backends ----
await check('LocalSimulatorBackend runs a circuit', async () => {
  const out = await new LocalSimulatorBackend({ seed: 'b' }).run(bellCircuit(), 500);
  assert.equal(out.backend, 'local-simulator');
  assert.equal((out.counts['00'] || 0) + (out.counts['11'] || 0), 500);
});

await check('QRNGBackend degrades to local simulator when fetch fails', async () => {
  const throwing = async () => { throw new Error('network down'); };
  const be = new QRNGBackend({ apiKey: 'k', fetchImpl: throwing });
  const out = await be.run(bellCircuit(), 200);
  assert.equal(out.shots, 200);
  assert.ok((out.counts['00'] || 0) + (out.counts['11'] || 0) === 200, 'fallback produced counts');
});

await check('QRNGBackend uses real-style quantum uniforms when fetch succeeds', async () => {
  // Mock the ANU endpoint returning uint16 values.
  const fakeFetch = async () => ({ ok: true, json: async () => ({ data: Array.from({ length: 1024 }, (_, i) => (i * 64) % 65536) }) });
  const be = new QRNGBackend({ apiKey: 'k', fetchImpl: fakeFetch });
  const out = await be.run(bellCircuit(), 300);
  assert.equal(out.backend, 'qrng-anu');
  assert.equal((out.counts['00'] || 0) + (out.counts['11'] || 0), 300);
});

await check('IBMBackend degrades to local simulator on failure', async () => {
  const throwing = async () => { throw new Error('no network'); };
  const be = new IBMBackend({ apiKey: 'k', crn: 'crn:x', fetchImpl: throwing });
  const out = await be.run(bellCircuit(), 128);
  assert.equal(out.shots, 128);
  assert.ok((out.counts['00'] || 0) + (out.counts['11'] || 0) === 128);
});

await check('Braket stub degrades to local simulator without a proxy', async () => {
  const out = await new BraketBackend({}).run(bellCircuit(), 64);
  assert.equal((out.counts['00'] || 0) + (out.counts['11'] || 0), 64);
});

await check('makeBackend builds the requested backend', () => {
  assert.equal(makeBackend('local').name, 'local-simulator');
  assert.equal(makeBackend('qrng').name, 'qrng-anu');
  assert.equal(makeBackend('ibm').name, 'ibm-qiskit-runtime');
});

// ---- Born-rule candidate measurement ----
await check('bornSampleTree empirical distribution ≈ weights', async () => {
  const weights = [0.1, 0.6, 0.3];
  const N = 30000;
  const entropy = new SeededEntropy(createRng('born'));
  const hist = [0, 0, 0];
  for (let i = 0; i < N; i++) hist[(await bornSampleTree(weights, entropy)).index]++;
  for (let k = 0; k < 3; k++) {
    assert.ok(Math.abs(hist[k] / N - weights[k]) < 0.03, `index ${k}: ${(hist[k] / N).toFixed(3)} vs ${weights[k]}`);
  }
});

await check('bornSampleTree is deterministic for a seed and reports qubits/qasm', async () => {
  const w = [0.2, 0.5, 0.2, 0.1];
  const r1 = await bornSampleTree(w, new SeededEntropy(createRng('d')));
  const r2 = await bornSampleTree(w, new SeededEntropy(createRng('d')));
  assert.equal(r1.index, r2.index);
  assert.equal(r1.qubits, 2); // ceil(log2 4)
  assert.ok(r1.qasm.includes('measure'));
});

// ---- QuantumMeasurementEngine integrated into the Generator ----
await check('QuantumMeasurementEngine returns a Born `chosen` index + telemetry', async () => {
  const engine = new QuantumMeasurementEngine({ base: new QuantumSimulatorEngine() });
  const rng = createRng('q');
  const file = { path: 'index.html', kind: 'html', intent: 'x', measurements: 0, debt: 1000, missingInfo: 1000 };
  const g = await engine.guess(file, { rng, files: [file], spec: SITE_SPECS['dharma-landing'] });
  assert.ok(g.chosen >= 0 && g.chosen < g.candidates.length);
  assert.ok(g.quantum && g.quantum.qubits >= 1 && g.quantum.openqasm.includes('OPENQASM 3;'));
  assert.ok(g.quantum.negativeTime && typeof g.quantum.negativeTime.weakValue === 'number');
});

let qResult;
await check('Generator with the quantum engine completes and is deterministic', async () => {
  const make = () => new Generator({
    spec: SITE_SPECS['dharma-landing'],
    engine: new QuantumMeasurementEngine({ base: new QuantumSimulatorEngine() }),
    scorer: new HeuristicScorer(),
    threshold: 80, budget: 200, seed: 108,
  });
  qResult = await make().run();
  for (const f of qResult.files) assert.equal(f.state, 'collapsed');
  assert.ok(qResult.score > 0);
  const second = await make().run();
  assert.deepEqual(second.site, qResult.site, 'same seed → byte-identical site via real Born measurement');
});

// ---- Negative-time module ----
await check('weak value of excitation time can be negative (anomalous)', () => {
  // a = +0.5, b = −0.5: sin a sin b < 0 while cos(a−b) > 0 ⇒ A_w < 0 (outside [0,1]).
  const wv = weakValueExcitation(0.5, -0.5);
  assert.ok(wv.value < 0, `expected negative weak value, got ${wv.value}`);
  assert.ok(wv.anomalous);
  // matches the closed form A_w = sin a sin b / cos(a−b)
  const expected = (Math.sin(0.5) * Math.sin(-0.5)) / Math.cos(0.5 - (-0.5));
  assert.ok(Math.abs(wv.value - expected) < 1e-12);
});

await check('group delay is negative on resonance, ~0 far away', () => {
  assert.ok(groupDelay(0, { gamma: 1, depth: 1 }) < 0, 'negative group delay on resonance');
  assert.ok(Math.abs(groupDelay(20, { gamma: 1, depth: 1 })) < 1e-2, 'vanishes far from resonance');
  assert.ok(groupDelay(3, { gamma: 1, depth: 1 }) > 0, 'positive in the wings (normal dispersion)');
});

await check('excitation ratio spans the measured experimental range', () => {
  assert.ok(Math.abs(excitationTimeRatio(0) - NEGATIVE_TIME_REFERENCE.measuredRatioRange[0]) < 1e-9);
  assert.ok(Math.abs(excitationTimeRatio(1) - NEGATIVE_TIME_REFERENCE.measuredRatioRange[1]) < 1e-9);
});

await check('fileDwell goes negative near the half-collapsed point', () => {
  const half = fileDwell({ debt: 500, missingInfo: 1000 }); // determinacy 0.5 → on resonance
  assert.ok(half.negative, `expected negative dwell at determinacy 0.5, got ratio ${half.ratio}`);
});

console.log(`\nAll ${passed} quantum tests passed ✓`);
