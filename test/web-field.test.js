// Emergent web-field tests: node test/web-field.test.js
// Verifies the local-interaction CA: determinism, emptiness bias, region emergence,
// element affinity, valid states, and the freeze tool.

import assert from 'node:assert/strict';
import {
  createField, stepField, evolveField, fieldStats, elementAffinity,
  BLOCKS, FIELD_ELEMENTS, createRng,
} from '../src/generator/index.js';

let passed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (err) { console.error(`  ✗ ${name}`); throw err; }
}

const mkField = (seed) => createField({ rows: 16, cols: 24, rng: createRng(seed), density: 0.07 });

console.log('Emergent web-field tests');

await check('elementAffinity follows the 生/克 cycle (same > generative > overcoming)', () => {
  assert.equal(elementAffinity('earth', 'earth'), 1.0);
  assert.equal(elementAffinity('earth', 'water'), 1.35); // d=1 generates
  assert.equal(elementAffinity('earth', 'fire'), 0.55); // d=2 overcomes
  assert.ok(elementAffinity('earth', 'water') > elementAffinity('earth', 'fire'));
});

await check('a fresh field is mostly void (emptiness) with a few seeds', () => {
  const s = fieldStats(mkField('seed'));
  assert.ok(s.voidFraction > 0.85, `expected sparse seeding, got ${s.voidFraction}`);
});

await check('evolution is deterministic for a given seed', () => {
  const a = evolveField(mkField('OM'), 25, createRng('step:OM'));
  const b = evolveField(mkField('OM'), 25, createRng('step:OM'));
  assert.equal(JSON.stringify(a.cells), JSON.stringify(b.cells));
});

await check('structure EMERGES: void falls and coherent regions grow from local rules', () => {
  const f0 = mkField('grow');
  const s0 = fieldStats(f0);
  const f1 = evolveField(f0, 24, createRng('grow:step'));
  const s1 = fieldStats(f1);
  assert.ok(s1.voidFraction < s0.voidFraction - 0.3, 'life spreads from the seeds');
  const alive = s1.cells * (1 - s1.voidFraction);
  assert.ok(alive / s1.regions > 1.5, 'cells cluster into multi-cell regions (sections), not noise');
});

await check('every cell stays a valid block type and element through evolution', () => {
  const f = evolveField(mkField('valid'), 20, createRng('valid:s'));
  for (const cell of f.cells) {
    assert.ok(cell.type >= 0 && cell.type <= 7 && Number.isInteger(cell.type));
    assert.ok(FIELD_ELEMENTS.includes(cell.element));
  }
});

await check('a higher emptiness bias keeps the field more void (wu wei)', () => {
  const lo = evolveField(mkField('w'), 18, createRng('w:s'), { void: 0.6 });
  const hi = evolveField(mkField('w'), 18, createRng('w:s'), { void: 3.0 });
  assert.ok(fieldStats(hi).voidFraction > fieldStats(lo).voidFraction);
});

await check('a frozen region is held still (agent freeze tool)', () => {
  const f = evolveField(mkField('frz'), 6, createRng('frz:s'));
  const frozen = new Set([0, 1, 2, 3, 4]);
  const before = frozen.size && [...frozen].map((i) => ({ ...f.cells[i] }));
  const g = stepField(f, createRng('frz:next'), { frozen });
  for (const i of frozen) {
    const b = before[[...frozen].indexOf(i)];
    assert.deepEqual(g.cells[i], b, `cell ${i} should be frozen`);
  }
});

console.log(`\nAll ${passed} web-field tests passed ✓`);
