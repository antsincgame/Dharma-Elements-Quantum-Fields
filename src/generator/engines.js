// Engines turn a null file + context into a superposition of candidate contents.
//   • QuantumSimulatorEngine — default, deterministic, offline. Synthesizes
//     theme-coherent content from the dharma/quantum vocabulary using a seeded
//     PRNG; generates several candidates (the superposition) and reports an
//     amplitude per candidate.
//   • LLMEngine — optional. Same interface, but asks a real Claude model via a
//     configurable endpoint. Never embeds an API key in the browser (use a
//     proxy); in Node it reads ANTHROPIC_API_KEY. Degrades to a fallback engine
//     (the simulator) on any error, so the run never hard-fails.

import { Engine } from './quantum-site-generator.js';
import { ELEMENTS, CONCEPT_PAIRS, MANTRAS, FRAGMENTS, PALETTE, PHI } from './vocabulary.js';

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Assemble a short, theme-coherent line from sentence fragments.
function markovLine(rng) {
  const parts = [rng.pick(FRAGMENTS.open), rng.pick(FRAGMENTS.bridge)];
  if (rng.bool(0.5)) parts.push(rng.pick(FRAGMENTS.close));
  return parts.join(' ');
}

function elementSection(el, rng) {
  const mantra = el.mantra;
  return [
    `      <section class="qg-element" data-element="${el.key}">`,
    `        <h2>${el.emoji} ${esc(el.en)} <span class="sa">${esc(el.sa)}</span> → ${esc(el.field)}</h2>`,
    `        <p>${esc(capitalize(el.essence))}. <em>${esc(markovLine(rng))}</em></p>`,
    `        <p class="formula"><code>${esc(el.formula)}</code> · spin ${esc(el.spin)} · ${esc(el.discovery)}</p>`,
    `        <p class="mantra sanskrit-text">${esc(mantra)}</p>`,
    `        <p class="note">Realization: ${esc(el.realization)}. Chakra: ${esc(el.chakra)}.</p>`,
    '      </section>',
  ].join('\n');
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function pairTable() {
  const rows = CONCEPT_PAIRS.map(
    (p) => `        <tr><td>${esc(p.dharma)}</td><td>${esc(p.physics)}</td></tr>`,
  ).join('\n');
  return [
    '      <table class="qg-pairs">',
    '        <thead><tr><th>Buddhist concept</th><th>Physics principle</th></tr></thead>',
    '        <tbody>',
    rows,
    '        </tbody>',
    '      </table>',
  ].join('\n');
}

function renderHtml(file, ctx, rng, fullness) {
  const title = (ctx.spec && ctx.spec.title) || 'Quantum Site';
  const mantra = rng.pick(MANTRAS);
  const count = Math.max(2, Math.round(fullness * ELEMENTS.length));
  const chosen = rng.sample(ELEMENTS, count).sort((a, b) => ELEMENTS.indexOf(a) - ELEMENTS.indexOf(b));
  const sections = chosen.map((el) => elementSection(el, rng.fork(el.key))).join('\n');
  const intro = markovLine(rng);
  const showPairs = fullness > 0.6;
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="UTF-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `  <title>${esc(mantra)} · ${esc(title)}</title>`,
    '  <link rel="stylesheet" href="style.css">',
    '</head>',
    '<body>',
    '  <header class="qg-hero">',
    `    <p class="mantra sanskrit-text">${esc(mantra)}</p>`,
    `    <h1>${esc(title)}</h1>`,
    `    <p class="subtitle">${esc(file.intent)}</p>`,
    `    <p class="lede">${esc(intro)}</p>`,
    '  </header>',
    '  <main>',
    sections,
    showPairs ? pairTable() : '',
    '  </main>',
    '  <footer>',
    `    <p>Woven from null files of negative size, guessed until quality bloomed. Golden ratio φ ≈ ${PHI}.</p>`,
    `    <p class="mantra sanskrit-text">${esc(rng.pick(FRAGMENTS.close))}</p>`,
    '  </footer>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

function renderCss(file, ctx, rng, fullness) {
  const accent = rng.pick([PALETTE.primary, PALETTE.violet, PALETTE.primaryBright]);
  const lines = [
    `/* ${file.intent} */`,
    '/* Golden-ratio rhythm: spacing derived from φ. */',
    ':root {',
    `  --phi: ${PHI};`,
    `  --ink: ${PALETTE.ink};`,
    `  --primary: ${PALETTE.primary};`,
    `  --accent: ${accent};`,
    `  --gold: ${PALETTE.gold};`,
    `  --paper: ${PALETTE.paper};`,
    `  --mist: ${PALETTE.mist};`,
    '  --space: 1rem;',
    '}',
    '* { box-sizing: border-box; }',
    'body {',
    "  font-family: 'Arial', 'Noto Sans Devanagari', sans-serif;",
    '  color: var(--ink);',
    '  background: linear-gradient(135deg, var(--paper) 0%, var(--mist) 100%);',
    '  line-height: var(--phi);',
    '  margin: 0;',
    '  padding: calc(var(--space) * var(--phi));',
    '}',
    'h1, h2 { color: var(--primary); font-weight: 400; }',
    'h1 { font-size: calc(1.5rem * var(--phi)); }',
    '.qg-hero { text-align: center; padding: calc(var(--space) * var(--phi)) 0; }',
    '.mantra { color: var(--gold); font-weight: 600; }',
    'code { background: var(--mist); color: var(--accent); padding: 2px 6px; border-radius: 4px; }',
    '.qg-element { border-left: 3px solid var(--accent); padding-left: var(--space); margin: var(--space) 0; }',
  ];
  if (fullness > 0.5) {
    lines.push(
      '.qg-pairs { width: 100%; border-collapse: collapse; margin-top: calc(var(--space) * var(--phi)); }',
      '.qg-pairs th, .qg-pairs td { border: 1px solid var(--mist); padding: calc(var(--space) / var(--phi)); text-align: left; }',
      'footer { text-align: center; color: var(--accent); margin-top: calc(var(--space) * var(--phi)); }',
    );
  }
  lines.push('');
  return lines.join('\n');
}

function renderMd(file, ctx, rng, fullness) {
  const title = (ctx.spec && ctx.spec.title) || 'Quantum Site';
  const rows = ELEMENTS.map(
    (el) => `| ${el.emoji} ${el.en} | ${el.sa} | ${el.field} | \`${el.formula}\` |`,
  ).join('\n');
  const lines = [
    `# ${title}`,
    '',
    `> ${rng.pick(MANTRAS)} — ${markovLine(rng)}`,
    '',
    file.intent,
    '',
    '## Element ↔ Field correspondences',
    '',
    '| Element | Sanskrit | Quantum field | Formula |',
    '|---|---|---|---|',
    rows,
    '',
  ];
  if (fullness > 0.5) {
    lines.push(
      '## Dharma ↔ Physics parallels',
      '',
      ...CONCEPT_PAIRS.map((p) => `- **${p.dharma}** ↔ ${p.physics}`),
      '',
      `Generated by guessing null files of negative size until quality ≥ target. Golden ratio φ ≈ ${PHI}.`,
      '',
    );
  }
  return lines.join('\n');
}

function renderJs(file, ctx, rng) {
  const mantra = rng.pick(MANTRAS);
  return [
    `// ${file.intent}`,
    `const PHI = ${PHI}; // golden ratio`,
    `const mantra = ${JSON.stringify(mantra)};`,
    'document.addEventListener("DOMContentLoaded", () => {',
    '  console.log(mantra, "— interdependence binds every particle to the whole.");',
    '});',
    '',
  ].join('\n');
}

export function renderTemplate(kind, { rng, file, ctx, fullness }) {
  switch (kind) {
    case 'css':
      return renderCss(file, ctx, rng, fullness);
    case 'md':
      return renderMd(file, ctx, rng, fullness);
    case 'js':
      return renderJs(file, ctx, rng);
    case 'html':
    default:
      return renderHtml(file, ctx, rng, fullness);
  }
}

export class QuantumSimulatorEngine extends Engine {
  constructor(opts = {}) {
    super();
    this.candidates = opts.candidates || 3;
  }
  get name() {
    return 'quantum-simulator';
  }
  async available() {
    return true;
  }

  async guess(file, ctx) {
    // Fork a reproducible sub-stream keyed by (file, measurement) so candidates
    // are stable regardless of the order files are measured in.
    const base = ctx.rng.fork(`${file.path}#${file.measurements}`);
    const fullness = Math.max(0, Math.min(1, 0.45 + 0.18 * file.measurements + base.float(-0.05, 0.05)));
    const candidates = [];
    const amplitudes = [];
    for (let i = 0; i < this.candidates; i++) {
      const branch = base.fork(`c${i}`);
      const content = renderTemplate(file.kind, { rng: branch, file, ctx, fullness });
      candidates.push(content);
      // Amplitude rewards richer (longer, more varied) candidates, with jitter.
      const unique = new Set(content.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)).size;
      amplitudes.push(unique * (0.85 + branch.float(0, 0.3)));
    }
    // Confidence grows as the file is re-measured, so it eventually commits.
    const confidence = Math.max(0.05, Math.min(0.95, 0.4 + 0.13 * file.measurements + base.float(0, 0.12)));
    return { candidates, amplitudes, confidence };
  }
}

// ---- Optional real-LLM engine --------------------------------------------

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

export class LLMEngine extends Engine {
  constructor(opts = {}) {
    super();
    this.endpoint = opts.endpoint || null; // browser: a same-origin proxy URL
    this.apiKey = opts.apiKey || null; // Node only — never set this in a browser
    this.model = opts.model || 'claude-opus-4-8';
    this.maxTokens = opts.maxTokens || 1500;
    this.anthropicVersion = opts.anthropicVersion || '2023-06-01';
    this.fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
    this.fallback = opts.fallback || new QuantumSimulatorEngine();
  }
  get name() {
    return 'llm';
  }

  async available() {
    return Boolean(this.fetchImpl && (this.endpoint || this.apiKey));
  }

  _url() {
    if (this.endpoint) return this.endpoint;
    if (this.apiKey) return ANTHROPIC_URL;
    return null;
  }

  _headers() {
    const headers = { 'content-type': 'application/json' };
    // Only attach the key when calling Anthropic directly (Node). A browser
    // proxy injects the key server-side; the key must never reach the client.
    if (this.apiKey && !this.endpoint) {
      headers['x-api-key'] = this.apiKey;
      headers['anthropic-version'] = this.anthropicVersion;
    }
    return headers;
  }

  _buildPrompt(file, ctx) {
    const title = (ctx.spec && ctx.spec.title) || 'Quantum Site';
    const others = (ctx.files || [])
      .filter((f) => f.path !== file.path)
      .map((f) => `- ${f.path} (${f.kind})`)
      .join('\n');
    const system =
      'You fill a "null file" for a static website that bridges the five Buddhist ' +
      'elements (Earth/Water/Fire/Air/Space) with the fundamental quantum fields ' +
      '(Higgs, electromagnetic, strong, weak, quantum vacuum). Output ONLY the raw ' +
      'file content — no markdown code fences, no commentary.';
    const user =
      `Site title: ${title}\n` +
      `File path: ${file.path}\nFile kind: ${file.kind}\n` +
      `Other files in the site:\n${others || '(none)'}\n\n` +
      `Write the content for this file. Intent: ${file.intent}`;
    return { system, user };
  }

  _extractText(data) {
    if (!data) return null;
    if (typeof data === 'string') return data;
    if (typeof data.text === 'string') return data.text; // simple proxy shape
    if (Array.isArray(data.content)) {
      return data.content
        .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text)
        .join('');
    }
    return null;
  }

  async guess(file, ctx) {
    const url = this._url();
    if (!url || !this.fetchImpl) return this.fallback.guess(file, ctx);
    const { system, user } = this._buildPrompt(file, ctx);
    try {
      const res = await this.fetchImpl(url, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({
          model: this.model,
          max_tokens: this.maxTokens,
          system,
          messages: [{ role: 'user', content: user }],
        }),
      });
      if (!res.ok) throw new Error(`LLM endpoint returned ${res.status}`);
      const data = await res.json();
      const text = this._extractText(data);
      if (!text) throw new Error('LLM response had no text content');
      return { candidates: [text], amplitudes: [1], confidence: 0.92 };
    } catch (err) {
      if (typeof console !== 'undefined') console.warn('[qiwg] LLMEngine fell back to simulator:', err.message);
      return this.fallback.guess(file, ctx);
    }
  }
}
