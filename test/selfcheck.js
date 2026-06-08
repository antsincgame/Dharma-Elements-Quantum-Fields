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

  console.log(`\nAll ${passed} checks passed ✓`);
}

main().catch((err) => {
  console.error('\nSelf-check FAILED:\n', err);
  process.exit(1);
});
