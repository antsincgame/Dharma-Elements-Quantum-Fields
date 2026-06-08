// Entanglement & Bell–CHSH tests (zero-dependency): node test/entanglement.test.js

import assert from 'node:assert/strict';
import {
  chshExact, chshSampled, correlation, correlationFromCounts, chshCircuit, CHSH_ANGLES,
  EntangledPair, entangledPairs, QuantumCircuit, parseOpenQASM,
  LocalSimulatorBackend, createRng,
} from '../src/generator/index.js';

let passed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (err) { console.error(`  ✗ ${name}`); throw err; }
}

console.log('Entanglement & Bell–CHSH tests');

await check('Bell state |Φ⁺⟩ correlations: P(00)=P(11)=½, P(01)=P(10)=0', () => {
  const p = chshCircuit(0, 0).probabilities();
  assert.ok(Math.abs(p[0] - 0.5) < 1e-12 && Math.abs(p[3] - 0.5) < 1e-12);
  assert.ok(p[1] < 1e-12 && p[2] < 1e-12);
});

await check('E(a,b) = cos(a − b) for the Bell state', () => {
  for (const [a, b] of [[0, 0], [0, Math.PI / 4], [Math.PI / 3, Math.PI / 7], [1.1, -0.4]]) {
    assert.ok(Math.abs(correlation(a, b) - Math.cos(a - b)) < 1e-12, `E(${a},${b})`);
  }
});

await check('exact CHSH reaches the Tsirelson bound S = 2√2', () => {
  const r = chshExact();
  assert.ok(Math.abs(r.S - 2 * Math.SQRT2) < 1e-9, `S=${r.S}, want ${2 * Math.SQRT2}`);
  assert.ok(r.violates, 'S must violate the classical bound of 2');
});

await check('a separable (non-entangled) state cannot exceed |S| ≤ 2', () => {
  // No CX → product state (|+⟩ ⊗ |0⟩). Correlations factorize → local-realistic.
  const corr = (a, b) => {
    const p = new QuantumCircuit(2).h(0).ry(0, -a).ry(1, -b).measureAll().probabilities();
    return p[0] - p[1] - p[2] + p[3];
  };
  const { a, ap, b, bp } = CHSH_ANGLES;
  const S = corr(a, b) + corr(a, bp) + corr(ap, b) - corr(ap, bp);
  assert.ok(Math.abs(S) <= 2 + 1e-9, `separable S=${S} must satisfy |S| ≤ 2`);
});

await check('CHSH circuit exports OpenQASM and round-trips', () => {
  const qasm = chshCircuit(CHSH_ANGLES.a, CHSH_ANGLES.b).toOpenQASM();
  assert.ok(qasm.includes('h q[0];') && qasm.includes('cx q[0], q[1];') && qasm.includes('ry('));
  const back = parseOpenQASM(qasm).probabilities();
  const orig = chshCircuit(CHSH_ANGLES.a, CHSH_ANGLES.b).probabilities();
  // OpenQASM serializes angles to 6 decimals, so the round-trip is exact to ~1e-5.
  for (let i = 0; i < 4; i++) assert.ok(Math.abs(back[i] - orig[i]) < 1e-4, `prob[${i}] drift`);
});

await check('sampled CHSH on the local backend approaches 2√2 (deterministic)', async () => {
  const be = new LocalSimulatorBackend({ rng: createRng('chsh') });
  const r = await chshSampled(be, 20000);
  assert.ok(Math.abs(r.S - 2 * Math.SQRT2) < 0.1, `sampled S=${r.S}`);
  assert.ok(r.violates, 'sampled S should exceed 2');
  const r2 = await chshSampled(new LocalSimulatorBackend({ rng: createRng('chsh') }), 20000);
  assert.equal(r2.S, r.S, 'same seed → identical sampled S');
});

await check('correlationFromCounts matches the analytic sign convention', () => {
  assert.equal(correlationFromCounts({ '00': 50, '11': 50 }), 1); // perfectly correlated
  assert.equal(correlationFromCounts({ '01': 50, '10': 50 }), -1); // anti-correlated
});

await check('EntangledPair |Φ⁺⟩ always yields correlated outcomes', () => {
  const rng = createRng('pair');
  for (let i = 0; i < 500; i++) {
    const [b0, b1] = new EntangledPair('phi+').measure(rng);
    assert.equal(b0, b1, 'Φ⁺ outcomes must be equal');
  }
});

await check('EntangledPair |Ψ⁻⟩ always yields anti-correlated outcomes', () => {
  const rng = createRng('pair2');
  for (let i = 0; i < 500; i++) {
    const p = new EntangledPair('psi-');
    const [b0, b1] = p.measure(rng);
    assert.notEqual(b0, b1, 'Ψ⁻ outcomes must differ');
    assert.equal(p.correlated, false);
  }
});

await check('entangledPairs pairs files two-by-two', () => {
  const files = [{ path: 'a' }, { path: 'b' }, { path: 'c' }, { path: 'd' }, { path: 'e' }];
  const pairs = entangledPairs(files);
  assert.equal(pairs.length, 2); // e is left unentangled
  assert.equal(pairs[0].a.path, 'a');
  assert.equal(pairs[0].b.path, 'b');
});

console.log(`\nAll ${passed} entanglement tests passed ✓`);
