// 🏛️ Materialize an evolved web-field (web-field.js) into a REAL website.
//
// The field is read top→bottom as horizontal bands; each band's dominant block type
// becomes a real DOM section and its dominant element gives the color. So the page's
// section order, count, content and palette all EMERGE from the field — a different
// seed (or run of the agent) yields a genuinely different site, never a template.
//
// Richness: MEDIA blocks are inline-SVG **quantum orbitals** sampled from the same
// orbitals.js the rest of the project uses (so the grown site literally displays the
// orbitals it is about); text/accent sections pull DISTINCT facts per element via a
// rotor (no two read alike); a nav is synthesized from the elements present.
// Framework-free; returns a site object { 'index.html', 'style.css' }.

import { BLOCKS, fieldStats } from './web-field.js';
import { ELEMENTS, ELEMENT_COLORS, MANTRAS, FRAGMENTS, PHI } from './vocabulary.js';
import { sampleOrbital, ELEMENT_ORBITAL } from './orbitals.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const elByKey = (k) => ELEMENTS.find((e) => e.key === k) || ELEMENTS[0];
const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const NEG_PHASE = '#bcd2ff'; // cool tint for the ψ<0 lobe

function line(rng) {
  const parts = [rng.pick(FRAGMENTS.open), rng.pick(FRAGMENTS.bridge)];
  if (rng.bool(0.5)) parts.push(rng.pick(FRAGMENTS.close));
  return parts.join(' ');
}

// Distinct statements about an element — the rotor hands out a different one each
// time a section for that element appears, so repeated sections never read the same.
function elementFacts(el) {
  return [
    `${capitalize(el.essence)}.`,
    `Realization — ${esc(el.realization)}.`,
    `${esc(el.field)}: its law reads <code>${esc(el.formula)}</code>.`,
    `Held at the ${esc(el.chakra)} center; its seed-sound is <span class="em-sa">${esc(el.mantra)}</span>.`,
    `Revealed ${esc(el.discovery)} · spin ${esc(el.spin)}.`,
  ];
}
function nextFact(ctx, el) {
  const facts = elementFacts(el);
  const i = ctx.rotor[el.key] || 0;
  ctx.rotor[el.key] = i + 1;
  return facts[i % facts.length];
}

// A self-contained inline-SVG orbital for an element — real |ψ|² points (orbitals.js),
// tinted by element color (ψ>0) and a cool complement (ψ<0). No JS, no external deps.
function orbitalSVG(elementKey, rng, ctx, size = 200) {
  const key = ELEMENT_ORBITAL[elementKey] || '2pz';
  const { positions, signs } = sampleOrbital(key, 170, rng.fork('orb' + ctx.svgN));
  const uid = 'o' + ctx.svgN++;
  const color = ELEMENT_COLORS[elementKey] || '#7c3aed';
  const pts = []; let maxR = 0.001;
  for (let i = 0; i < signs.length; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    const X = x * 0.92 + z * 0.39, Y = y * 0.92 - z * 0.2; // gentle 3/4 view
    pts.push([X, Y, signs[i]]);
    const rr = Math.hypot(X, Y); if (rr > maxR) maxR = rr;
  }
  const half = size / 2, sc = (half * 0.84) / maxR;
  const dots = pts.map(([X, Y, s]) => `<circle cx="${(half + X * sc).toFixed(1)}" cy="${(half - Y * sc).toFixed(1)}" r="1.7" fill="${s >= 0 ? color : NEG_PHASE}"/>`).join('');
  return `<svg class="em-orbital" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${esc(key)} orbital of ${esc(elementKey)}">` +
    `<defs><radialGradient id="${uid}"><stop offset="0%" stop-color="${color}" stop-opacity="0.30"/><stop offset="72%" stop-color="${color}" stop-opacity="0"/></radialGradient></defs>` +
    `<rect width="${size}" height="${size}" fill="url(#${uid})"/><g fill-opacity="0.7">${dots}</g></svg>`;
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
    if (cols - tc[BLOCKS.VOID] < cols * 0.25) domType = BLOCKS.VOID; // sparse row = gap
    let domEl = 'space', be = -1;
    for (const k of Object.keys(ec)) if (ec[k] > be) { be = ec[k]; domEl = k; }
    rowInfo.push({ domType, domEl });
  }
  const out = [];
  for (const ri of rowInfo) {
    const last = out[out.length - 1];
    if (last && last.type === ri.domType) { last.height++; last.elements.push(ri.domEl); }
    else out.push({ type: ri.domType, height: 1, elements: [ri.domEl] });
  }
  for (const b of out) {
    const ec = {}; for (const e of b.elements) ec[e] = (ec[e] || 0) + 1;
    b.element = Object.keys(ec).sort((a, z) => ec[z] - ec[a])[0] || 'space';
  }
  return out.filter((b) => b.type !== BLOCKS.VOID || b.height >= 2);
}

function sectionHTML(band, rng, ctx) {
  const el = elByKey(band.element);
  const sty = `--accent:${ELEMENT_COLORS[band.element] || '#7c3aed'}`;
  const idAttr = ctx.anchored.has(band.element) ? '' : ` id="${band.element}"`;
  ctx.anchored.add(band.element);
  switch (band.type) {
    case BLOCKS.HEAD:
      return `      <section class="em em-section"${idAttr} data-el="${band.element}" style="${sty}">\n` +
        `        <h2>${el.emoji} ${esc(el.en)} <span class="em-sa">${esc(el.sa)}</span> ↔ ${esc(el.field)}</h2>\n` +
        `        <p>${nextFact(ctx, el)}</p>\n      </section>`;
    case BLOCKS.TEXT: {
      const n = Math.max(1, Math.min(3, Math.round(band.height / 2)));
      const ps = [`        <p>${esc(line(rng))}</p>`];
      for (let i = 1; i < n; i++) ps.push(`        <p>${nextFact(ctx, el)}</p>`);
      return `      <section class="em em-text"${idAttr} data-el="${band.element}" style="${sty}">\n${ps.join('\n')}\n      </section>`;
    }
    case BLOCKS.MEDIA:
      return `      <section class="em em-media"${idAttr} data-el="${band.element}" style="${sty}">\n` +
        `        ${orbitalSVG(band.element, rng, ctx)}\n` +
        `        <div class="em-media-cap"><h3>${el.emoji} ${esc(el.en)}</h3><p>${esc(el.field)} · <code>${esc(el.formula)}</code></p></div>\n      </section>`;
    case BLOCKS.ACCENT:
      return `      <aside class="em em-accent"${idAttr} data-el="${band.element}" style="${sty}">\n        <p>${nextFact(ctx, el)}</p>\n      </aside>`;
    case BLOCKS.QUOTE:
      return `      <blockquote class="em em-quote" data-el="${band.element}" style="${sty}">\n        ${esc(rng.pick(MANTRAS))}<cite>${esc(el.en)} · ${esc(el.sa)}</cite>\n      </blockquote>`;
    case BLOCKS.RULE:
      return `      <hr class="em em-rule" style="${sty}">`;
    case BLOCKS.LINK:
      return ''; // nav is synthesized once at the top from the elements present
    default:
      return `      <div class="em em-gap" style="height:${band.height * 0.6}rem"></div>`;
  }
}

export function materializeCSS() {
  return [
    ':root{--phi:' + PHI + ';--bg0:#05060f;--bg1:#0b1026;--ink:#e6ecff;--muted:#8aa0d0;--space:1rem}',
    '*{box-sizing:border-box}',
    'body{margin:0;font-family:"Segoe UI","Noto Sans Devanagari",system-ui,sans-serif;color:var(--ink);',
    '  background:radial-gradient(130% 100% at 50% 0%,var(--bg1),var(--bg0)) fixed;line-height:var(--phi);padding:0 var(--space) calc(var(--space)*var(--phi))}',
    'main.emergent{max-width:48rem;margin:0 auto;display:flex;flex-direction:column;gap:calc(var(--space)*var(--phi))}',
    '.em-hero{text-align:center;padding:calc(var(--space)*var(--phi)*1.4) var(--space) var(--space)}',
    '.em-hero h1{font-size:calc(1.7rem*var(--phi));font-weight:300;margin:.2em 0;color:#fff}',
    '.em-mantra{color:#f5c451;letter-spacing:.05em;margin:0}',
    '.em-sub{color:var(--muted);max-width:40ch;margin:.4em auto 0}',
    '.em-sa{color:var(--muted);font-size:.7em}',
    '.em-topnav{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;gap:.5rem;justify-content:center;',
    '  padding:.6rem;margin:0 auto;backdrop-filter:blur(8px);background:rgba(5,6,15,.55);border-radius:0 0 14px 14px}',
    '.em-topnav a{color:var(--ink);text-decoration:none;border:1px solid var(--accent,#445);padding:.25em .8em;border-radius:999px;font-size:.85em}',
    '.em-topnav a:hover{background:rgba(255,255,255,.06)}',
    '.em{padding:calc(var(--space)*var(--phi)) calc(var(--space)*var(--phi));border-radius:16px}',
    '.em-section,.em-text{background:rgba(255,255,255,.025);border-left:3px solid var(--accent)}',
    '.em h2{font-weight:400;color:var(--accent);margin:.1em 0 .5em}',
    '.em h3{font-weight:500;margin:0 0 .2em}',
    '.em p{margin:.4em 0}',
    '.em-accent{background:color-mix(in srgb,var(--accent) 20%,transparent);border:1px solid color-mix(in srgb,var(--accent) 45%,transparent);text-align:center}',
    '.em-media{display:flex;align-items:center;gap:calc(var(--space)*var(--phi));flex-wrap:wrap}',
    '.em-orbital{width:12rem;height:12rem;flex:0 0 auto;border-radius:50%;',
    '  filter:drop-shadow(0 0 1.6rem color-mix(in srgb,var(--accent) 55%,transparent))}',
    '.em-media-cap{flex:1 1 12rem}',
    '.em-media-cap h3{color:var(--accent)}',
    '.em-cap,.em-media-cap p{color:var(--muted)}',
    'code{background:rgba(255,255,255,.06);color:var(--accent);padding:1px 6px;border-radius:5px}',
    '.em-quote{text-align:center;color:#f5c451;font-size:1.25em;border-top:1px solid var(--accent);border-bottom:1px solid var(--accent)}',
    '.em-quote cite{display:block;color:var(--muted);font-size:.62em;margin-top:.5em}',
    '.em-rule{border:none;height:2px;background:linear-gradient(90deg,transparent,var(--accent),transparent)}',
    'footer{max-width:48rem;margin:calc(var(--space)*var(--phi)) auto 0;text-align:center;color:var(--muted);font-size:.85em}',
    '',
  ].join('\n');
}

// Build the site from an evolved field. Returns { 'index.html', 'style.css' }.
export function materializeField(field, { rng, title } = {}) {
  if (!rng) throw new Error('materializeField requires a seeded rng');
  const T = title || 'शून्य — woven from emptiness';
  const ctx = { rotor: {}, svgN: 0, anchored: new Set() };
  const bs = bands(field);
  // Elements present, in order of first appearance → a synthesized nav.
  const present = [];
  for (const b of bs) if (b.type !== BLOCKS.VOID && !present.includes(b.element)) present.push(b.element);
  const navEl = present[0] || 'space';
  const nav = present.length
    ? `      <nav class="em-topnav" style="--accent:${ELEMENT_COLORS[navEl]}">` +
      present.map((k) => { const e = elByKey(k); return `<a href="#${k}">${e.emoji} ${esc(e.en)}</a>`; }).join('') + '</nav>'
    : '';
  const heroEl = present[0] || 'space';
  const hero = `      <header class="em-hero" style="--accent:${ELEMENT_COLORS[heroEl]}">\n` +
    `        <p class="em-mantra">${esc(rng.pick(MANTRAS))}</p>\n        <h1>${esc(T)}</h1>\n` +
    `        <p class="em-sub">${esc(line(rng))}</p>\n      </header>`;
  const body = bs.map((b) => sectionHTML(b, rng, ctx)).filter(Boolean).join('\n');
  const s = fieldStats(field);
  const html = [
    '<!DOCTYPE html>', '<html lang="en">', '<head>', '  <meta charset="UTF-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `  <title>${esc(T)}</title>`, '  <link rel="stylesheet" href="style.css">', '</head>', '<body>',
    nav, '  <main class="emergent">', hero, body, '  </main>',
    `  <footer>Woven from ${s.cells} cells over ${field.tick} ticks · ${bs.filter((b) => b.type !== BLOCKS.VOID).length} emergent sections · ${present.length} elements · φ ≈ ${PHI}. Form is emptiness; emptiness is form.</footer>`,
    '</body>', '</html>', '',
  ].filter((l) => l !== '').join('\n') + '\n';
  return { 'index.html': html, 'style.css': materializeCSS() };
}
