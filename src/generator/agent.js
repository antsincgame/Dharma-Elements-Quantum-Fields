// 🪷 The wu-wei agent — the top layer over the emergent web-field (web-field.js).
//
// The agent is given a small set of TOOLS (the кирпичики of action) and a single
// koan: "do nothing / just be" (無爲). It is NOT told to build a website. Most ticks
// it rests and lets the field unfold by its own physics; now and then it touches the
// field with one tool. What emerges is the agent expressing itself with a narrow set
// of primitives under no task — and a website grows underneath.
//
// Two layers, as requested: the field's local quantum rule (bottom) + this agent
// (top). Offline, the agent's "free will" is a Born-rule draw over the toolset
// (rest-dominant), so it lives without a real LLM. Pass `decide` (async) to let a
// real model choose tools instead — same interface, no fetch in the core.

import { BLOCKS, BLOCK_NAMES, FIELD_ELEMENTS, stepField, fieldStats } from './web-field.js';

// The toolset offered to the agent. `rest`/`contemplate` are the wu-wei default;
// the rest are gentle touches. Each carries a short intention note.
export const AGENT_TOOLS = [
  { name: 'rest', note: 'रहना — abide. Do nothing; let the field unfold.' },
  { name: 'contemplate', note: 'ध्यान — deepen the emptiness; favor the void next.' },
  { name: 'seed', note: 'बीज — plant a small cluster, a possibility.' },
  { name: 'perturb', note: 'क्षोभ — stir a little randomness into a region.' },
  { name: 'infuse', note: 'तत्त्व — let one element breathe through the field.' },
  { name: 'accent', note: 'अलंकार — invite one kind of block to flourish.' },
  { name: 'freeze', note: 'स्थिर — hold a region still, let it settle.' },
];

// A compact, model-friendly summary of the field (for an LLM `decide`, and logging).
export function fieldSummary(field) {
  const s = fieldStats(field);
  const types = {};
  for (let t = 0; t < BLOCK_NAMES.length; t++) if (s.typeCounts[t]) types[BLOCK_NAMES[t]] = s.typeCounts[t];
  return { tick: field.tick, voidFraction: +s.voidFraction.toFixed(3), regions: s.regions, entropy: +s.entropy.toFixed(2), types };
}

// Offline chooser: a Born-rule draw over the tools, heavily weighted to rest (the
// koan). Weights bend gently with the field's state — when it's barren the agent is
// a little more likely to seed; when it's full, more likely to simply abide.
export function chooseActionOffline(field, rng, opts = {}) {
  const restBias = opts.restBias != null ? opts.restBias : 6.0;
  const s = fieldStats(field);
  const barren = s.voidFraction > 0.8;
  const crowded = s.voidFraction < 0.25;
  const w = {
    rest: restBias + (crowded ? 3 : 0),
    contemplate: 1.2 + (crowded ? 1.5 : 0),
    seed: barren ? 2.2 : 0.5,
    perturb: 0.7,
    infuse: 0.8,
    accent: 0.7,
    freeze: crowded ? 1.0 : 0.4,
  };
  const names = Object.keys(w);
  let sum = 0; for (const n of names) sum += w[n];
  let r = rng() * sum;
  let name = 'rest';
  for (const n of names) { r -= w[n]; if (r <= 0) { name = n; break; } }
  return buildAction(name, field, rng);
}

// Flesh out a chosen tool with concrete (random, in-bounds) arguments.
function buildAction(name, field, rng) {
  const { rows, cols } = field;
  const tool = AGENT_TOOLS.find((t) => t.name === name) || AGENT_TOOLS[0];
  const r = Math.floor(rng() * rows), c = Math.floor(rng() * cols);
  const radius = 1 + Math.floor(rng() * 2);
  switch (name) {
    case 'seed': return { name, note: tool.note, args: { type: 1 + Math.floor(rng() * 4), r, c, radius } };
    case 'perturb': return { name, note: tool.note, args: { r, c, radius } };
    case 'freeze': return { name, note: tool.note, args: { r, c, radius } };
    case 'infuse': return { name, note: tool.note, args: { element: FIELD_ELEMENTS[Math.floor(rng() * 5)] } };
    case 'accent': return { name, note: tool.note, args: { type: 1 + Math.floor(rng() * 6) } };
    default: return { name, note: tool.note, args: {} };
  }
}

// Apply an action to the field NOW (mutating cells in place) and/or return per-tick
// options to hand to stepField (bias / void / frozen). Pure w.r.t. randomness via rng.
export function applyAction(field, action, rng) {
  const { rows, cols, cells } = field;
  const stepOpts = {};
  const inRegion = (cb) => {
    const { r, c, radius } = action.args;
    for (let dr = -radius; dr <= radius; dr++) for (let dc = -radius; dc <= radius; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
      cb(rr * cols + cc);
    }
  };
  switch (action.name) {
    case 'contemplate': stepOpts.void = 2.4; break; // deepen emptiness this tick
    case 'seed': inRegion((i) => { cells[i] = { type: action.args.type, element: cells[i].element }; }); break;
    case 'perturb': inRegion((i) => { cells[i] = { type: Math.floor(rng() * 8), element: FIELD_ELEMENTS[Math.floor(rng() * 5)] }; }); break;
    case 'freeze': { const frozen = new Set(); inRegion((i) => frozen.add(i)); stepOpts.frozen = frozen; break; }
    case 'accent': { const bias = new Float64Array(8); bias[action.args.type] = 1.5; stepOpts.bias = bias; break; }
    case 'infuse': { // breathe one element sparsely through the whole field
      const el = action.args.element;
      for (let i = 0; i < cells.length; i++) if (rng() < 0.12) cells[i] = { type: cells[i].type, element: el };
      break;
    }
    case 'rest': default: break;
  }
  return stepOpts;
}

// One agent step: choose a tool (LLM `decide` if given, else offline quantum draw),
// apply it, and advance the field one tick. Returns { field, action }. Shared by the
// batch loop and the live browser loop. `decide` may return null/throw → offline.
export async function agentTick(field, rng, { decide = null, restBias } = {}) {
  let action;
  if (decide) {
    try {
      const chosen = await decide(fieldSummary(field), AGENT_TOOLS);
      action = chosen && chosen.name ? buildAction(chosen.name, field, rng) : chooseActionOffline(field, rng, { restBias });
      if (chosen && chosen.args) action.args = { ...action.args, ...chosen.args };
    } catch { action = chooseActionOffline(field, rng, { restBias }); }
  } else {
    action = chooseActionOffline(field, rng, { restBias });
  }
  const stepOpts = applyAction(field, action, rng);
  const next = stepField(field, rng, stepOpts);
  return { field: next, action };
}

// Run the agent over the field for `ticks` steps. `decide` (optional, async) lets an
// LLM choose a tool from AGENT_TOOLS given fieldSummary(); without it the offline
// quantum-seeded chooser is used. Returns the evolved field and a journal of the
// agent's intentions — its "expression" under the koan of doing nothing.
export async function runAgent({ field, rng, ticks = 30, decide = null, restBias } = {}) {
  let f = field;
  const journal = [];
  for (let t = 0; t < ticks; t++) {
    const { field: nf, action } = await agentTick(f, rng, { decide, restBias });
    f = nf;
    journal.push({ tick: f.tick, action: action.name, args: action.args, note: action.note });
  }
  return { field: f, journal };
}

// How often the agent acted vs abided — a quick read on its wu-wei character.
export function journalStats(journal) {
  const counts = {};
  for (const e of journal) counts[e.action] = (counts[e.action] || 0) + 1;
  const acted = journal.filter((e) => e.action !== 'rest' && e.action !== 'contemplate').length;
  return { counts, acted, abided: journal.length - acted, total: journal.length };
}
