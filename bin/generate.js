#!/usr/bin/env node
// Node CLI for the Quantum-Informatics Website Generator.
//
//   node bin/generate.js [--spec specs/dharma-landing.json] [--preset dharma-landing]
//        [--out ./generated] [--threshold 80] [--budget 200] [--seed 108]
//        [--engine sim|llm] [--endpoint URL] [--blend-scorer]
//
// Reads a site spec (a list of null files), runs the generator until the quality
// score reaches the threshold, and writes the materialized files to --out.
// Defaults to the offline quantum simulator; --engine llm uses Claude via
// ANTHROPIC_API_KEY (or a proxy --endpoint) and falls back to the simulator.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Generator,
  QuantumSimulatorEngine,
  LLMEngine,
  HeuristicScorer,
  LLMScorer,
  CompositeScorer,
  QuantumMeasurementEngine,
  QuantumEntropy,
  makeBackend,
  bellCircuit,
  chshExact,
  chshSampled,
  createRng,
  SITE_SPECS,
  byteLength,
  createField,
  runAgent,
  journalStats,
  materializeField,
  makeLLMDecider,
} from '../src/generator/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

function help() {
  console.log(`Quantum-Informatics Website Generator

Usage: node bin/generate.js [options]

Options:
  --spec <file>        JSON site spec ({ title, theme, files: [{path,kind,intent}] })
  --preset <id>        Built-in spec: ${Object.keys(SITE_SPECS).join(', ')} (default: dharma-landing)
  --out <dir>          Output directory (default: ./generated)
  --threshold <n>      Target quality score 0-100 (default: 80)
  --budget <n>         Max measurement steps (default: 200)
  --seed <s>           PRNG seed for reproducibility (default: OM)
  --engine sim|llm|lmstudio|ollama|openai|quantum   Generation engine (default: sim)
  --provider <id>      LLM provider preset: anthropic|lmstudio|ollama|openai (overrides --engine mapping)
  --endpoint <url>     LLM endpoint: a proxy, or a local server's own URL (e.g. http://localhost:1234/v1/chat/completions)
  --model <id>         LLM model id (default: the provider's preset model)
  --blend-scorer       Blend an LLM judge into the heuristic score (needs endpoint/key)
  --backend <id>       Quantum backend: local|qrng|ibm|braket|azure (default: local)
  --qrng-key <key>     ANU QRNG api key (or env ANU_QRNG_KEY) → real quantum entropy for --engine quantum
  --ibm-key <key>      IBM Cloud IAM key (or env IBM_QUANTUM_TOKEN) for --backend ibm
  --ibm-crn <crn>      IBM Qiskit Runtime instance Service-CRN
  --ibm-backend <id>   IBM device name (default: ibm_brisbane)
  --verify-quantum     Run a Bell circuit on --backend and print the counts (connectivity check)
  --bell-test          Run a CHSH Bell test on --backend (classical ≤ 2, quantum → 2√2)
  --emergent           Grow a site from a quantum field tended by a wu-wei agent (not a template)
  --ticks <n>          Emergent: number of agent/field ticks (default: 32)
  --quiet              Suppress per-step logging
  --help               Show this help
`);
}

function loadSpec(args) {
  if (args.spec) {
    const path = resolve(process.cwd(), String(args.spec));
    return JSON.parse(readFileSync(path, 'utf8'));
  }
  const preset = String(args.preset || 'dharma-landing');
  const spec = SITE_SPECS[preset];
  if (!spec) throw new Error(`Unknown preset "${preset}". Available: ${Object.keys(SITE_SPECS).join(', ')}`);
  return spec;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    help();
    return;
  }

  const spec = loadSpec(args);
  const outDir = resolve(process.cwd(), String(args.out || './generated'));
  const threshold = Number(args.threshold != null ? args.threshold : 80);
  const budget = Number(args.budget != null ? args.budget : 200);
  const seed = args.seed != null ? String(args.seed) : 'OM';
  const quiet = Boolean(args.quiet);

  // LLM provider: --provider wins; otherwise map --engine (llm → Claude, others 1:1).
  const LLM_ENGINES = ['llm', 'lmstudio', 'ollama', 'openai'];
  const provider = args.provider
    ? String(args.provider)
    : (args.engine === 'llm' ? 'anthropic' : String(args.engine || ''));
  // Keys come from the environment, per provider. Local servers are keyless.
  const apiKey = provider === 'openai'
    ? (process.env.OPENAI_API_KEY || null)
    : (process.env.ANTHROPIC_API_KEY || null);
  const endpoint = args.endpoint ? String(args.endpoint) : null;
  const model = args.model ? String(args.model) : null; // null → provider preset default

  // Quantum backend credentials (for --verify-quantum and the quantum engine).
  const backendId = args.backend ? String(args.backend) : 'local';
  const qrngKey = process.env.ANU_QRNG_KEY || (args['qrng-key'] ? String(args['qrng-key']) : null);
  const ibmKey = process.env.IBM_QUANTUM_TOKEN || (args['ibm-key'] ? String(args['ibm-key']) : null);
  const backendOpts = {
    seed,
    apiKey: backendId === 'qrng' ? qrngKey : ibmKey,
    crn: args['ibm-crn'] ? String(args['ibm-crn']) : null,
    backendName: args['ibm-backend'] ? String(args['ibm-backend']) : 'ibm_brisbane',
    endpoint,
  };

  // Connectivity check: run a Bell circuit on the chosen backend and print counts.
  if (args['verify-quantum']) {
    const backend = makeBackend(backendId, backendOpts);
    console.log(`🔌 Verifying quantum connectivity on backend=${backend.name} …`);
    const { counts } = await backend.run(bellCircuit(), 1024);
    console.log(`  Bell counts: ${JSON.stringify(counts)} (ideal ≈ 50% 00, 50% 11)`);
    console.log(`  OpenQASM 3:\n${bellCircuit().toOpenQASM().split('\n').map((l) => '    ' + l).join('\n')}`);
  }

  // CHSH Bell test: interbeing (प्रतीत्यसमुत्पाद) made measurable.
  if (args['bell-test']) {
    const backend = makeBackend(backendId, backendOpts);
    console.log(`🔗 CHSH Bell test on backend=${backend.name} …`);
    const r = await chshSampled(backend, 4096);
    console.log(`  E(a,b)=${r.E.ab.toFixed(3)}  E(a,b')=${r.E.abp.toFixed(3)}  E(a',b)=${r.E.apb.toFixed(3)}  E(a',b')=${r.E.apbp.toFixed(3)}`);
    console.log(`  S = ${r.S.toFixed(4)}   (classical ≤ 2 · Tsirelson 2√2 ≈ ${(2 * Math.SQRT2).toFixed(4)} · ideal ${chshExact().S.toFixed(4)})`);
    console.log(`  ${r.violates ? '✓ Bell inequality VIOLATED — interbeing is real (प्रतीत्यसमुत्पाद ↔ entanglement)' : '✗ no violation (classical/degraded path)'}`);
  }

  // 🌱 Emergent mode: a website that GROWS from a quantum cellular field tended by a
  // wu-wei agent (koan: "do nothing"). With an LLM provider the agent's will is a real
  // model; otherwise its choices are a quantum-seeded draw. Writes a real, unique site.
  if (args.emergent) {
    const ticks = Number(args.ticks != null ? args.ticks : 32);
    const rng = createRng('web:' + seed);
    const field = createField({ rows: 22, cols: 40, rng, density: 0.06 });
    let decide = null;
    if (LLM_ENGINES.includes(args.engine) || args.provider) {
      decide = makeLLMDecider({ provider, endpoint, apiKey, model });
      console.log(`🪷 Emergent agent · will = ${decide ? `${provider} (LLM, falls back to quantum per-tick)` : 'quantum (no LLM wired)'}`);
    } else {
      console.log('🪷 Emergent agent · will = quantum (offline)');
    }
    const { field: grown, journal } = await runAgent({ field, rng, ticks, decide });
    const js = journalStats(journal);
    for (const e of journal.filter((x) => x.action !== 'rest').slice(0, 10)) {
      console.log(`  tick ${String(e.tick).padStart(2)} · ${e.action.padEnd(11)} ${e.note}`);
    }
    console.log(`  …abided ${js.abided}/${js.total} ticks · acted ${js.acted} · tools ${JSON.stringify(js.counts)}`);
    const site = materializeField(grown, { rng: createRng('mat:' + seed), title: 'शून्य निर्माण — seed ' + seed });
    mkdirSync(outDir, { recursive: true });
    for (const name of Object.keys(site)) writeFileSync(join(outDir, name), site[name]);
    const secN = (site['index.html'].match(/class="em /g) || []).length;
    console.log(`\n🏛️  Materialized a real, emergent website → ${outDir}`);
    console.log(`  ${secN} emergent sections · ${byteLength(site['index.html'])} bytes HTML + ${byteLength(site['style.css'])} bytes CSS`);
    return;
  }

  const simulator = new QuantumSimulatorEngine();
  let engine = simulator;
  if (LLM_ENGINES.includes(args.engine) || args.provider) {
    engine = new LLMEngine({ provider, endpoint, apiKey, model, fallback: simulator });
    if (!(await engine.available())) {
      console.warn(`[qiwg] LLM engine (${provider}) requested but no endpoint/key found — using simulator.`);
      engine = simulator;
    }
  } else if (args.engine === 'quantum') {
    // Candidate selection becomes a genuine Born-rule measurement. With a QRNG key
    // the collapses are seeded by real quantum entropy; otherwise deterministic.
    let entropy = null;
    if (qrngKey || backendId === 'qrng') {
      entropy = new QuantumEntropy({ apiKey: qrngKey, endpoint, fallbackRng: createRng(seed) });
      const real = await entropy.available();
      console.log(`⚛️  Quantum measurement engine · entropy=${real ? 'ANU QRNG (real)' : 'seeded (no QRNG key)'} `);
    }
    engine = new QuantumMeasurementEngine({ base: simulator, entropy });
  }

  let scorer = new HeuristicScorer();
  if (args['blend-scorer']) {
    const llmScorer = new LLMScorer({ provider, endpoint, apiKey, model });
    if (await llmScorer.available()) {
      scorer = new CompositeScorer({ base: scorer, llm: llmScorer });
    } else {
      console.warn('[qiwg] --blend-scorer requested but no endpoint/key — using heuristic only.');
    }
  }

  const generator = new Generator({ spec, engine, scorer, threshold, budget, seed });
  if (!quiet) {
    console.log(`🕉  ${spec.title} — ${spec.files.length} null files · engine=${engine.name} · threshold=${threshold} · seed=${seed}`);
    generator.on('step', ({ file, score, steps }) => {
      const sign = file.size < 0 ? '' : '+';
      let tail = '';
      if (file.quantum) {
        const q = file.quantum;
        tail = ` · ⚛️${q.qubits}q p=${(q.bornProb || 0).toFixed(2)}`;
        if (q.negativeTime) tail += ` · τ/τ₀=${q.negativeTime.excitationRatio.toFixed(2)}${q.negativeTime.negative ? ' ⏪' : ''}`;
      }
      console.log(`  step ${String(steps).padStart(3)} · ${file.path.padEnd(14)} size=${sign}${file.size} · state=${file.state} · score=${score}${tail}`);
    });
  }

  const result = await generator.run();

  mkdirSync(outDir, { recursive: true });
  for (const f of result.files) {
    const target = join(outDir, f.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, f.content || '', 'utf8');
  }

  console.log(`\n✓ done (${result.reason}) — score ${result.score}/${threshold} in ${result.steps} steps`);
  console.log(`  breakdown: ${JSON.stringify(result.breakdown)}`);
  for (const f of result.files) {
    console.log(`  ${f.path.padEnd(14)} ${byteLength(f.content || '')} bytes`);
  }
  console.log(`  written to ${outDir}`);
}

main().catch((err) => {
  console.error('[qiwg] error:', err);
  process.exit(1);
});
