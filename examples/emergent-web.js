#!/usr/bin/env node
// 🌱 Watch a website's structure EMERGE from quantum randomness — headless.
// Seeds a near-empty field, evolves it by the local interaction rule (each cell
// shaped by its neighbors + a Born-rule draw), and prints the field as ASCII every
// few ticks so you can see coherent regions (sections) crystallize out of noise.
//
//   node examples/emergent-web.js [seed] [ticks]
//
// Glyphs:  (space)=void  ·=text  #=head  ◆=media  ▓=accent  "=quote  —=rule  →=link

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createField, evolveField, stepField, fieldStats, BLOCK_GLYPHS, BLOCK_NAMES,
  runAgent, journalStats, materializeField, createRng,
} from '../src/generator/index.js';

const seed = process.argv[2] || 'OM';
const ticks = Number(process.argv[3] || 28);
const rng = createRng('web:' + seed);

const rows = 18, cols = 40;
let field = createField({ rows, cols, rng, density: 0.07 });

function render(f) {
  const lines = [];
  for (let r = 0; r < f.rows; r++) {
    let line = '';
    for (let c = 0; c < f.cols; c++) line += BLOCK_GLYPHS[f.cells[r * f.cols + c].type];
    lines.push('  │' + line + '│');
  }
  return lines.join('\n');
}

function statline(f) {
  const s = fieldStats(f);
  const parts = BLOCK_NAMES.map((n, t) => s.typeCounts[t] ? `${n}:${s.typeCounts[t]}` : null).filter(Boolean);
  return `tick ${String(f.tick).padStart(2)} · void ${(s.voidFraction * 100).toFixed(0)}% · regions ${s.regions} · entropy ${s.entropy.toFixed(2)} · ${parts.join(' ')}`;
}

console.log(`\n🌱 Emergent web-field — seed "${seed}", ${rows}×${cols}, ${ticks} ticks`);
console.log(`   (a website's structure self-assembling from quantum randomness + local interaction)\n`);

const snapshots = [0, Math.floor(ticks / 3), Math.floor((2 * ticks) / 3), ticks];
for (let t = 0; t <= ticks; t++) {
  if (snapshots.includes(t)) {
    console.log('  ' + statline(field));
    console.log(render(field) + '\n');
  }
  if (t < ticks) field = stepField(field, rng);
}

// Show that it is alive (changes) yet deterministic (same seed → same field).
const a = evolveField(createField({ rows, cols, rng: createRng('web:' + seed), density: 0.07 }), ticks, createRng('web:' + seed));
const b = evolveField(createField({ rows, cols, rng: createRng('web:' + seed), density: 0.07 }), ticks, createRng('web:' + seed));
const same = JSON.stringify(a.cells) === JSON.stringify(b.cells);
console.log(`  determinism: same seed → identical field … ${same ? '✓' : '✗'}`);
console.log('  (different seed → a different website; the structure is never templated)\n');

// ── Top layer: the wu-wei agent acts on its OWN field under the koan "do nothing".
console.log('🪷 The wu-wei agent (koan: "do nothing") — its journal of intentions:\n');
const arng = createRng('agent:' + seed);
const af0 = createField({ rows, cols, rng: arng, density: 0.05 });
const { field: afield, journal } = await runAgent({ field: af0, rng: arng, ticks: 24 });
const js = journalStats(journal);
const acts = journal.filter((e) => e.action !== 'rest');
for (const e of acts.slice(0, 8)) console.log(`  tick ${String(e.tick).padStart(2)} · ${e.action.padEnd(11)} ${e.note}`);
console.log(`  …abided (rested) ${js.abided}/${js.total} ticks · acted ${js.acted} · tools: ${JSON.stringify(js.counts)}\n`);

// ── Materialize the agent's field into a REAL, unique website on disk.
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'generated', 'emergent');
mkdirSync(OUT, { recursive: true });
const site = materializeField(afield, { rng: createRng('mat:' + seed), title: 'शून्य निर्माण — seed ' + seed });
for (const name of Object.keys(site)) writeFileSync(join(OUT, name), site[name]);
const headN = (site['index.html'].match(/<h[12]/g) || []).length;
const secN = (site['index.html'].match(/class="em /g) || []).length;
console.log(`🏛️  Materialized a real website → generated/emergent/index.html`);
console.log(`   ${secN} emergent sections (${headN} headings) · ${site['index.html'].length} bytes HTML + ${site['style.css'].length} bytes CSS`);
console.log('   (open it in a browser — its structure came from the field, not a template)\n');
