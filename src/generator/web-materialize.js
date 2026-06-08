// 🏛️ Materialize an evolved web-field (web-field.js) into a REAL website.
//
// The field is read top→bottom as horizontal bands; each band's dominant block type
// becomes a real DOM section and its dominant element gives the color. So the page's
// section order, count, content and palette all EMERGE from the field — a different
// seed (or a different run of the agent) yields a genuinely different site, never a
// template. Text is filled from the dharma/quantum vocabulary; media blocks become
// CSS "orbital" orbs. Framework-free; returns a site object { 'index.html', 'style.css' }.

import { BLOCKS, BLOCK_NAMES } from './web-field.js';
import { fieldStats } from './web-field.js';
import { ELEMENTS, ELEMENT_COLORS, MANTRAS, FRAGMENTS, PHI } from './vocabulary.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const elByKey = (k) => ELEMENTS.find((e) => e.key === k) || ELEMENTS[0];

function line(rng) {
  const parts = [rng.pick(FRAGMENTS.open), rng.pick(FRAGMENTS.bridge)];
  if (rng.bool(0.5)) parts.push(rng.pick(FRAGMENTS.close));
  return parts.join(' ');
}

// Reduce the field to vertical bands: runs of rows sharing a dominant block type.
function bands(field) {
  const { rows, cols, cells } = field;
  const rowInfo = [];
  for (let r = 0; r < rows; r++) {
    const tc = new Array(8).fill(0); const ec = {};
    for (let c = 0; c < cols; c++) { const cell = cells[r * cols + c]; tc[cell.type]++; if (cell.type !== BLOCKS.VOID) ec[cell.element] = (ec[cell.element] || 0) + 1; }
    let domType = BLOCKS.VOID, best = -1;
    for (let t = 1; t < 8; t++) if (tc[t] > best) { best = tc[t]; domType = t; }
    const alive = cols - tc[BLOCKS.VOID];
    if (alive < cols * 0.25) domType = BLOCKS.VOID; // a sparse row is a gap (breathing space)
    let domEl = 'space', be = -1;
    for (const k of Object.keys(ec)) if (ec[k] > be) { be = ec[k]; domEl = k; }
    rowInfo.push({ domType, domEl, alive });
  }
  // Merge consecutive rows of the same dominant type into bands.
  const out = [];
  for (const ri of rowInfo) {
    const last = out[out.length - 1];
    if (last && last.type === ri.domType) { last.height++; last.elements.push(ri.domEl); }
    else out.push({ type: ri.domType, height: 1, elements: [ri.domEl] });
  }
  // Each band's element = its most common row element.
  for (const b of out) {
    const ec = {}; for (const e of b.elements) ec[e] = (ec[e] || 0) + 1;
    b.element = Object.keys(ec).sort((a, z) => ec[z] - ec[a])[0] || 'space';
  }
  return out.filter((b) => b.type !== BLOCKS.VOID || b.height >= 2); // keep meaningful gaps
}

function sectionHTML(band, rng, ctx) {
  const el = elByKey(band.element);
  const color = ELEMENT_COLORS[band.element] || '#7c3aed';
  const sty = `--accent:${color}`;
  switch (band.type) {
    case BLOCKS.HEAD: {
      const hero = !ctx.heroDone; ctx.heroDone = true;
      const tag = hero ? 'h1' : 'h2';
      const title = hero ? ctx.title : `${el.emoji} ${esc(el.en)} ↔ ${esc(el.field)}`;
      return `      <header class="em em-head" data-el="${band.element}" style="${sty}">\n` +
        `        <p class="em-mantra">${esc(rng.pick(MANTRAS))}</p>\n` +
        `        <${tag}>${title}</${tag}>\n` +
        `        <p class="em-sub">${esc(line(rng))}</p>\n      </header>`;
    }
    case BLOCKS.TEXT: {
      const n = Math.max(1, Math.min(3, Math.round(band.height / 2)));
      const ps = Array.from({ length: n }, () => `        <p>${esc(line(rng))}</p>`).join('\n');
      return `      <section class="em em-text" data-el="${band.element}" style="${sty}">\n${ps}\n      </section>`;
    }
    case BLOCKS.MEDIA:
      return `      <section class="em em-media" data-el="${band.element}" style="${sty}">\n` +
        `        <div class="em-orb" aria-hidden="true"></div>\n` +
        `        <p class="em-cap">${esc(el.field)} · <code>${esc(el.formula)}</code></p>\n      </section>`;
    case BLOCKS.ACCENT:
      return `      <section class="em em-accent" data-el="${band.element}" style="${sty}">\n` +
        `        <p>${esc(capitalize(el.essence))}.</p>\n      </section>`;
    case BLOCKS.QUOTE:
      return `      <blockquote class="em em-quote" data-el="${band.element}" style="${sty}">\n` +
        `        ${esc(rng.pick(MANTRAS))}<cite>${esc(el.sa)}</cite>\n      </blockquote>`;
    case BLOCKS.RULE:
      return `      <hr class="em em-rule" style="${sty}">`;
    case BLOCKS.LINK:
      return `      <nav class="em em-nav" style="${sty}">` +
        ELEMENTS.map((e) => `<a href="#${e.key}">${e.emoji} ${esc(e.en)}</a>`).join(' ') + `</nav>`;
    default:
      return `      <div class="em em-gap" style="height:${band.height * 0.6}rem"></div>`;
  }
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

export function materializeCSS() {
  return [
    ':root{--phi:' + PHI + ';--bg0:#05060f;--bg1:#0b1026;--ink:#dbe4ff;--muted:#8aa0d0;--space:1rem}',
    '*{box-sizing:border-box}',
    'body{margin:0;font-family:"Segoe UI","Noto Sans Devanagari",system-ui,sans-serif;color:var(--ink);',
    '  background:radial-gradient(120% 100% at 50% 0%,var(--bg1),var(--bg0));line-height:var(--phi);padding:calc(var(--space)*var(--phi))}',
    'main.emergent{max-width:46rem;margin:0 auto;display:flex;flex-direction:column;gap:calc(var(--space)*var(--phi))}',
    '.em{padding:calc(var(--space)*var(--phi)) var(--space);border-radius:14px}',
    '.em-head{text-align:center}',
    '.em-head h1{font-size:calc(1.7rem*var(--phi));font-weight:300;margin:.2em 0;color:#fff}',
    '.em-head h2{font-weight:400;color:var(--accent)}',
    '.em-mantra{color:#f5c451;letter-spacing:.04em;margin:0}',
    '.em-sub{color:var(--muted)}',
    '.em-text{border-left:3px solid var(--accent);background:rgba(255,255,255,.02)}',
    '.em-text p{margin:.4em 0}',
    '.em-accent{background:color-mix(in srgb,var(--accent) 22%,transparent);border:1px solid color-mix(in srgb,var(--accent) 45%,transparent)}',
    '.em-media{display:flex;align-items:center;gap:var(--space)}',
    '.em-orb{width:7rem;height:7rem;border-radius:50%;flex:0 0 auto;',
    '  background:radial-gradient(circle at 38% 34%,#fff,var(--accent) 42%,transparent 72%);',
    '  box-shadow:0 0 3rem color-mix(in srgb,var(--accent) 60%,transparent)}',
    '.em-cap{color:var(--muted);font-size:.9em}',
    '.em-quote{text-align:center;color:#f5c451;font-size:1.2em;border-top:1px solid var(--accent);border-bottom:1px solid var(--accent)}',
    '.em-quote cite{display:block;color:var(--muted);font-size:.7em;margin-top:.4em}',
    '.em-rule{border:none;height:2px;background:linear-gradient(90deg,transparent,var(--accent),transparent)}',
    '.em-nav{display:flex;flex-wrap:wrap;gap:var(--space);justify-content:center}',
    '.em-nav a{color:var(--accent);text-decoration:none;border:1px solid var(--accent);padding:.3em .8em;border-radius:999px}',
    'footer{max-width:46rem;margin:calc(var(--space)*var(--phi)) auto 0;text-align:center;color:var(--muted);font-size:.85em}',
    '',
  ].join('\n');
}

// Build the site from an evolved field. Returns { 'index.html', 'style.css' }.
export function materializeField(field, { rng, title } = {}) {
  if (!rng) throw new Error('materializeField requires a seeded rng');
  const T = title || 'शून्य — woven from emptiness';
  const ctx = { title: esc(T), heroDone: false };
  const bs = bands(field);
  let body = bs.map((b) => sectionHTML(b, rng, ctx)).join('\n');
  if (!ctx.heroDone) { // ensure a hero exists even if no HEAD band emerged
    body = `      <header class="em em-head" style="--accent:${ELEMENT_COLORS.space}">\n        <h1>${ctx.title}</h1>\n      </header>\n` + body;
  }
  const s = fieldStats(field);
  const html = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="UTF-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `  <title>${esc(T)}</title>`,
    '  <link rel="stylesheet" href="style.css">',
    '</head>',
    '<body>',
    '  <main class="emergent">',
    body,
    '  </main>',
    `  <footer>Woven from ${s.cells} cells over ${field.tick} ticks · ${bs.length} emergent sections · φ ≈ ${PHI}. Form is emptiness; emptiness is form.</footer>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
  return { 'index.html': html, 'style.css': materializeCSS() };
}
