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
  SITE_SPECS,
  byteLength,
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
  --engine sim|llm     Generation engine (default: sim)
  --endpoint <url>     LLM proxy endpoint (browser-style); Node can also use ANTHROPIC_API_KEY
  --model <id>         LLM model id (default: claude-opus-4-8)
  --blend-scorer       Blend an LLM judge into the heuristic score (needs endpoint/key)
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

  const apiKey = process.env.ANTHROPIC_API_KEY || null;
  const endpoint = args.endpoint ? String(args.endpoint) : null;
  const model = args.model ? String(args.model) : 'claude-opus-4-8';

  const simulator = new QuantumSimulatorEngine();
  let engine = simulator;
  if (args.engine === 'llm') {
    engine = new LLMEngine({ endpoint, apiKey, model, fallback: simulator });
    if (!(await engine.available())) {
      console.warn('[qiwg] LLM engine requested but no endpoint/ANTHROPIC_API_KEY found — using simulator.');
      engine = simulator;
    }
  }

  let scorer = new HeuristicScorer();
  if (args['blend-scorer']) {
    const llmScorer = new LLMScorer({ endpoint, apiKey, model });
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
      console.log(`  step ${String(steps).padStart(3)} · ${file.path.padEnd(14)} size=${sign}${file.size} · state=${file.state} · score=${score}`);
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
