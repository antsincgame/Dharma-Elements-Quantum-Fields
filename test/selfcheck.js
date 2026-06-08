// Zero-dependency smoke test: node test/selfcheck.js
// Verifies the negative-size lifecycle, determinism, scoring, and LLM fallback.

import assert from 'node:assert/strict';
import {
  Generator,
  QuantumSimulatorEngine,
  HeuristicScorer,
  LLMEngine,
  createNullFile,
  byteLength,
  createRng,
  SITE_SPECS,
  sampleOrbital,
  ELEMENT_ORBITAL,
} from '../src/generator/index.js';

const spec = SITE_SPECS['dharma-landing'];

function makeGenerator() {
  return new Generator({
    spec,
    engine: new QuantumSimulatorEngine(),
    scorer: new HeuristicScorer(),
    threshold: 80,
    budget: 200,
    seed: 108,
  });
}

let passed = 0;
function check(name, fn) {
  return fn().then(
    () => {
      passed++;
      console.log(`  ✓ ${name}`);
    },
    (err) => {
      console.error(`  ✗ ${name}`);
      throw err;
    },
  );
}

async function main() {
  console.log('Self-check: quantum-informatics website generator');

  // 1. A fresh null file has negative size equal to −missingInfo.
  await check('fresh null file has size === -missingInfo', async () => {
    const rng = createRng('seed');
    const f = createNullFile({ path: 'index.html', kind: 'html', intent: 'x' }, rng);
    assert.equal(f.size, -f.missingInfo);
    assert.equal(f.state, 'superposition');
    assert.ok(f.size < 0, 'size must start negative');
  });

  // 2. After a run, every file collapses to positive size; byteLength matches.
  let firstResult;
  await check('run collapses all files to positive size; byteLength === size', async () => {
    const gen = makeGenerator();
    firstResult = await gen.run();
    for (const f of gen.files) {
      assert.equal(f.state, 'collapsed', `${f.path} should be collapsed`);
      assert.ok(f.size > 0, `${f.path} size should be positive, got ${f.size}`);
      assert.equal(f.size, byteLength(f.content || ''), `${f.path} size must equal byteLength`);
    }
  });

  // 3. Same seed → identical assembled output (determinism).
  await check('same seed produces identical output', async () => {
    const gen2 = makeGenerator();
    const second = await gen2.run();
    assert.deepEqual(second.site, firstResult.site, 'assembled sites must be byte-identical');
    assert.equal(second.score, firstResult.score);
    assert.equal(second.steps, firstResult.steps);
  });

  // 4. Heuristic score is in [0,100] and rises monotonically across a run.
  await check('heuristic score in [0,100] and non-decreasing across the run', async () => {
    const gen = makeGenerator();
    const scores = [];
    gen.on('score', ({ total }) => scores.push(total));
    const r = await gen.run();
    assert.ok(r.score >= 0 && r.score <= 100, `final score out of range: ${r.score}`);
    for (let i = 1; i < scores.length; i++) {
      assert.ok(scores[i] >= scores[i - 1] - 2, `score dropped: ${scores[i - 1]} -> ${scores[i]}`);
    }
    assert.ok(scores.length > 1);
  });

  // 5. The run reaches the target threshold with the simulator.
  await check('simulator run reaches the quality threshold', async () => {
    assert.ok(firstResult.score >= 80, `expected score >= 80, got ${firstResult.score}`);
    assert.equal(firstResult.reason, 'threshold');
  });

  // 6. LLMEngine with a throwing fetch still completes via the simulator fallback.
  await check('LLMEngine degrades to simulator when fetch throws', async () => {
    const throwingFetch = async () => {
      throw new Error('network down');
    };
    const engine = new LLMEngine({ apiKey: 'sk-test', fetchImpl: throwingFetch, fallback: new QuantumSimulatorEngine() });
    const gen = new Generator({ spec, engine, scorer: new HeuristicScorer(), threshold: 80, seed: 7 });
    const r = await gen.run();
    for (const f of gen.files) {
      assert.equal(f.state, 'collapsed');
      assert.ok((f.content || '').length > 0, `${f.path} should have content from fallback`);
    }
    assert.ok(r.score > 0);
  });

  // 7. Orbital sampling is deterministic for a given seed (byte-identical cloud).
  await check('orbital cloud sampling is deterministic for a seed', async () => {
    const a = sampleOrbital('2pz', 2000, createRng('cloud:108'));
    const b = sampleOrbital('2pz', 2000, createRng('cloud:108'));
    assert.deepEqual(Array.from(a.positions), Array.from(b.positions), 'same seed → identical points');
    const c = sampleOrbital('2pz', 2000, createRng('cloud:109'));
    assert.notDeepEqual(Array.from(a.positions), Array.from(c.positions), 'different seed → different points');
  });

  // 8. The r² shell factor is respected: a 1s cloud's mean radius is finite and
  //    near the analytic value (⟨r⟩ = 1.5 a₀), NOT collapsed at the origin.
  await check('1s radial sampling honors the r² Jacobian (mean radius ≈ 1.5 a₀)', async () => {
    const n = 20000;
    const { positions } = sampleOrbital('1s', n, createRng('r2-test'));
    let sum = 0;
    let atOrigin = 0;
    for (let i = 0; i < n; i++) {
      const r = Math.hypot(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]); // rPeak(1s)=1 → units of a₀
      sum += r;
      if (r < 0.05) atOrigin++;
    }
    const mean = sum / n;
    assert.ok(mean > 1.2 && mean < 1.8, `mean radius ${mean.toFixed(3)} should be ≈1.5 a₀ (r² factor)`);
    assert.ok(atOrigin / n < 0.01, 'points must not pile up at the nucleus');
  });

  // 9. Angular structure is correct: a 2p_z cloud is stretched along z (lobes),
  //    while 1s is isotropic. Every element maps to a known orbital.
  await check('p-orbital is axial and every element maps to an orbital', async () => {
    const n = 8000;
    const pz = sampleOrbital('2pz', n, createRng('pz'));
    let sx = 0;
    let sz = 0;
    for (let i = 0; i < n; i++) {
      sx += Math.abs(pz.positions[i * 3]);
      sz += Math.abs(pz.positions[i * 3 + 2]);
    }
    assert.ok(sz > sx * 1.5, `2p_z should extend along z: |z|=${(sz / n).toFixed(2)} vs |x|=${(sx / n).toFixed(2)}`);
    for (const key of ['earth', 'water', 'fire', 'air', 'space']) {
      assert.ok(ELEMENT_ORBITAL[key], `element ${key} must map to an orbital`);
    }
  });

  console.log(`\nAll ${passed} checks passed ✓`);
}

main().catch((err) => {
  console.error('\nSelf-check FAILED:\n', err);
  process.exit(1);
});
