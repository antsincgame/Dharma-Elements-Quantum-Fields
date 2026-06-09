// Emergent agent + materialization tests: node test/emergent.test.js
// The wu-wei agent (tools + "do nothing") and the field→website materializer.

import assert from 'node:assert/strict';
import {
  createField, runAgent, journalStats, applyAction, AGENT_TOOLS,
  materializeField, makeLLMDecider, BLOCKS, createRng,
} from '../src/generator/index.js';

// A fetch stub returning a canned chat reply (OpenAI shape).
const replyFetch = (content) => async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) });

let passed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (err) { console.error(`  ✗ ${name}`); throw err; }
}

const mkField = (seed) => createField({ rows: 14, cols: 22, rng: createRng(seed), density: 0.05 });

console.log('Emergent agent + materialization tests');

await check('AGENT_TOOLS includes rest (the wu-wei default)', () => {
  assert.ok(AGENT_TOOLS.some((t) => t.name === 'rest'));
});

await check('runAgent returns a journal of the requested length', async () => {
  const { field, journal } = await runAgent({ field: mkField('a'), rng: createRng('a:agent'), ticks: 20 });
  assert.equal(journal.length, 20);
  assert.equal(field.tick, 20);
  for (const e of journal) assert.ok(AGENT_TOOLS.some((t) => t.name === e.action));
});

await check('under the koan "do nothing", the agent abides more than it acts', async () => {
  const { journal } = await runAgent({ field: mkField('wu'), rng: createRng('wu:agent'), ticks: 40 });
  const s = journalStats(journal);
  assert.ok(s.abided > s.acted, `expected rest-dominant, abided=${s.abided} acted=${s.acted}`);
});

await check('the agent run is deterministic for a given seed', async () => {
  const r1 = await runAgent({ field: mkField('d'), rng: createRng('d:agent'), ticks: 18 });
  const r2 = await runAgent({ field: mkField('d'), rng: createRng('d:agent'), ticks: 18 });
  assert.deepEqual(r1.journal.map((e) => e.action), r2.journal.map((e) => e.action));
  assert.equal(JSON.stringify(r1.field.cells), JSON.stringify(r2.field.cells));
});

await check('applyAction tools produce the right effects (freeze/accent/seed)', () => {
  const f = mkField('t');
  const frozenOpts = applyAction(f, { name: 'freeze', args: { r: 2, c: 2, radius: 1 } }, createRng('t1'));
  assert.ok(frozenOpts.frozen instanceof Set && frozenOpts.frozen.size > 0);
  const accentOpts = applyAction(f, { name: 'accent', args: { type: BLOCKS.MEDIA } }, createRng('t2'));
  assert.ok(accentOpts.bias && accentOpts.bias[BLOCKS.MEDIA] > 0);
  applyAction(f, { name: 'seed', args: { type: BLOCKS.TEXT, r: 5, c: 5, radius: 1 } }, createRng('t3'));
  assert.equal(f.cells[5 * f.cols + 5].type, BLOCKS.TEXT);
});

await check('an LLM-style decide hook can drive tool choice', async () => {
  const decide = async () => ({ name: 'seed' }); // a model that always seeds
  const { journal } = await runAgent({ field: mkField('llm'), rng: createRng('llm:a'), ticks: 10, decide });
  assert.equal(journalStats(journal).counts.seed, 10);
});

await check('a thrown decide hook falls back to the offline chooser (run never fails)', async () => {
  const decide = async () => { throw new Error('model offline'); };
  const { journal } = await runAgent({ field: mkField('fb'), rng: createRng('fb:a'), ticks: 8, decide });
  assert.equal(journal.length, 8); // completed via fallback
});

await check('materializeField produces a real, valid HTML+CSS site', async () => {
  const { field } = await runAgent({ field: mkField('m'), rng: createRng('m:a'), ticks: 24 });
  const site = materializeField(field, { rng: createRng('m:mat'), title: 'Test' });
  const html = site['index.html'];
  assert.ok(html.startsWith('<!DOCTYPE html>'));
  assert.ok(html.includes('<main class="emergent">') && html.includes('</html>'));
  assert.ok(/<h1>/.test(html), 'always has a hero heading');
  assert.ok((html.match(/class="em /g) || []).length > 0, 'has emergent sections');
  assert.ok(/class="em-topnav"/.test(html), 'synthesizes a nav from elements present');
  // Every MEDIA section embeds exactly one inline-SVG orbital.
  const media = (html.match(/class="em em-media"/g) || []).length;
  const svgs = (html.match(/class="em-orbital"/g) || []).length;
  assert.equal(media, svgs, 'each media block is a real orbital SVG');
  assert.ok(site['style.css'].includes('.em-orbital'));
});

await check('media blocks become real |ψ|² orbital SVGs (sampled from orbitals.js)', async () => {
  // Across several seeds at least one site grows a media/orbital block.
  let withOrbital = 0, validSvg = true;
  for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
    const f = (await runAgent({ field: mkField(seed), rng: createRng(seed + ':a'), ticks: 30 })).field;
    const html = materializeField(f, { rng: createRng(seed + ':m'), title: 'S' })['index.html'];
    if (/class="em-orbital"/.test(html)) {
      withOrbital++;
      if (!/<svg class="em-orbital"[^>]*viewBox="0 0 \d+ \d+"/.test(html) || !/<circle /.test(html)) validSvg = false;
    }
  }
  assert.ok(withOrbital > 0, 'at least one emergent site embeds an orbital');
  assert.ok(validSvg, 'embedded orbitals are well-formed SVG with sampled points');
});

await check('different fields materialize different sites (never templated)', async () => {
  const fa = (await runAgent({ field: mkField('x'), rng: createRng('x:a'), ticks: 24 })).field;
  const fb = (await runAgent({ field: mkField('y'), rng: createRng('y:a'), ticks: 24 })).field;
  const sa = materializeField(fa, { rng: createRng('x:m'), title: 'S' })['index.html'];
  const sb = materializeField(fb, { rng: createRng('y:m'), title: 'S' })['index.html'];
  assert.notEqual(sa, sb);
});

// ---- LLM decider (the agent's real will) ----------------------------------

await check('makeLLMDecider returns null when nothing is wired (→ offline)', () => {
  assert.equal(makeLLMDecider({ provider: 'anthropic', fetchImpl: async () => ({}) }), null);
});

await check('makeLLMDecider(lmstudio) parses {"tool":"seed"} from the reply', async () => {
  const decide = makeLLMDecider({ provider: 'lmstudio', fetchImpl: replyFetch('{"tool":"seed"}') });
  assert.ok(typeof decide === 'function');
  const choice = await decide({ voidFraction: 0.5, regions: 3, entropy: 1.2, types: {} }, AGENT_TOOLS);
  assert.deepEqual(choice, { name: 'seed' });
});

await check('makeLLMDecider accepts a bare tool word and rejects junk', async () => {
  const d1 = makeLLMDecider({ provider: 'lmstudio', fetchImpl: replyFetch('I will rest now.') });
  assert.deepEqual(await d1({ voidFraction: 0.3, regions: 1, entropy: 1, types: {} }, AGENT_TOOLS), { name: 'rest' });
  const d2 = makeLLMDecider({ provider: 'lmstudio', fetchImpl: replyFetch('blah blah no tool here') });
  assert.equal(await d2({ voidFraction: 0.3, regions: 1, entropy: 1, types: {} }, AGENT_TOOLS), null);
});

await check('makeLLMDecider returns null on a failed/throwing fetch (→ offline)', async () => {
  const d1 = makeLLMDecider({ provider: 'lmstudio', fetchImpl: async () => ({ ok: false, status: 502 }) });
  assert.equal(await d1({ voidFraction: 0.3, regions: 1, entropy: 1, types: {} }, AGENT_TOOLS), null);
  const d2 = makeLLMDecider({ provider: 'lmstudio', fetchImpl: async () => { throw new Error('down'); } });
  assert.equal(await d2({ voidFraction: 0.3, regions: 1, entropy: 1, types: {} }, AGENT_TOOLS), null);
});

await check('runAgent uses an LLM decider when supplied (always rests here)', async () => {
  const decide = makeLLMDecider({ provider: 'lmstudio', fetchImpl: replyFetch('{"tool":"rest"}') });
  const { journal } = await runAgent({ field: mkField('llmdec'), rng: createRng('llmdec:a'), ticks: 12, decide });
  assert.equal(journalStats(journal).counts.rest, 12);
});

console.log(`\nAll ${passed} emergent tests passed ✓`);
