// Live browser view for the EMERGENT generator (web-field.js + agent.js +
// web-materialize.js). Drives the wu-wei loop tick-by-tick: paints the quantum
// cellular field on a 2D canvas, streams the agent's "intentions" journal, and
// re-materializes the growing website into a live preview. The agent's will is the
// offline quantum draw, or a real LLM (LM Studio / Claude via proxy) via makeLLMDecider.
//
// Browser-only; all DOM/canvas access is inside init()/handlers, so importing this in
// Node is harmless. The heavy lifting (field, agent, materialize) is the tested core.

import {
  createField, agentTick, materializeField, makeLLMDecider, journalStats,
  fieldStats, AGENT_TOOLS, BLOCK_NAMES, ELEMENT_COLORS, createRng, makeZip,
} from './generator/index.js';

const $ = (id) => document.getElementById(id);

// Per-block-type opacity (VOID is invisible) — heads/quotes brightest, text faint.
const TYPE_ALPHA = [0, 0.5, 1.0, 0.85, 0.8, 0.95, 0.4, 0.7];

const state = {
  field: null, rng: null, decide: null, running: false, tick: 0, max: 140,
  timer: 0, journal: [], counts: {}, site: null, ctx: null, cols: 40, rows: 24,
};

function seedVal() { return ($('qg-em-seed').value || 'OM').trim(); }

function endpointDefault(will) {
  if (will === 'lmstudio') return 'http://localhost:1234/v1/chat/completions';
  if (will === 'claude') return '/api/generate';
  return '';
}

function buildDecide() {
  const will = $('qg-em-will').value;
  if (will === 'offline') return null;
  const endpoint = ($('qg-em-endpoint').value || '').trim() || endpointDefault(will);
  // Browser: never a key here. LM Studio is keyless/local; Claude goes through the proxy.
  if (will === 'lmstudio') return makeLLMDecider({ provider: 'lmstudio', endpoint });
  return makeLLMDecider({ provider: 'anthropic', endpoint });
}

function draw() {
  const { ctx, field } = state;
  if (!ctx || !field) return;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const cw = W / field.cols, ch = H / field.rows;
  ctx.fillStyle = '#05060f';
  ctx.fillRect(0, 0, W, H);
  for (let r = 0; r < field.rows; r++) {
    for (let c = 0; c < field.cols; c++) {
      const cell = field.cells[r * field.cols + c];
      const a = TYPE_ALPHA[cell.type];
      if (a <= 0) continue;
      const x = c * cw, y = r * ch;
      const color = ELEMENT_COLORS[cell.element] || '#7c3aed';
      ctx.globalAlpha = a * 0.28; // soft underlay → glow
      ctx.fillStyle = color;
      ctx.fillRect(x, y, cw, ch);
      ctx.globalAlpha = a;
      ctx.fillRect(x + cw * 0.16, y + ch * 0.16, cw * 0.68, ch * 0.68);
      if (cell.type === 2 || cell.type === 5) { // head / quote — a bright core
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + cw * 0.38, y + ch * 0.38, cw * 0.24, ch * 0.24);
      }
    }
  }
  ctx.globalAlpha = 1;
}

function pushJournal(action) {
  state.counts[action.name] = (state.counts[action.name] || 0) + 1;
  const js = journalStats(state.journal.concat([{ action: action.name }]));
  state.journal.push({ action: action.name });
  $('qg-em-count').textContent = `· abided ${js.abided} / acted ${js.acted}`;
  if (action.name === 'rest') return; // don't spam the log with stillness
  const el = $('qg-em-journal');
  const row = document.createElement('div');
  row.className = 'qg-em-entry';
  row.innerHTML = `<span class="qg-em-t">${String(state.tick).padStart(3)}</span> <span class="qg-em-act">${action.name}</span> <span class="qg-em-note">${action.note}</span>`;
  el.appendChild(row);
  while (el.childNodes.length > 60) el.removeChild(el.firstChild);
  el.scrollTop = el.scrollHeight;
}

function updateStats() {
  const s = fieldStats(state.field);
  const parts = BLOCK_NAMES.map((n, t) => s.typeCounts[t] && n !== 'void' ? `${n}:${s.typeCounts[t]}` : null).filter(Boolean);
  $('qg-em-stats').textContent = `tick ${state.tick} · void ${(s.voidFraction * 100).toFixed(0)}% · ${s.regions} regions · entropy ${s.entropy.toFixed(2)} · ${parts.join(' ')}`;
}

function renderPreview() {
  state.site = materializeField(state.field, { rng: createRng('mat:' + seedVal()), title: 'शून्य निर्माण — seed ' + seedVal() });
  const html = state.site['index.html'].replace(/<link[^>]+style\.css[^>]*>/i, `<style>\n${state.site['style.css']}\n</style>`);
  $('qg-em-preview').srcdoc = html;
}

async function loop() {
  if (!state.running) return;
  try {
    const { field, action } = await agentTick(state.field, state.rng, { decide: state.decide });
    state.field = field; state.tick++;
    draw(); pushJournal(action); updateStats();
    if (state.tick % 5 === 0) renderPreview();
  } catch (err) {
    if (typeof console !== 'undefined') console.warn('[qiwg] emergent tick error:', err);
  }
  if (state.tick >= state.max) { stop(); renderPreview(); return; }
  state.timer = setTimeout(loop, 110);
}

function start() {
  if (state.running) { stop(); return; }
  if (!state.field) reset();
  state.decide = buildDecide();
  state.running = true;
  $('qg-em-run').textContent = '⏸ Pause';
  loop();
}

function stop() {
  state.running = false;
  if (state.timer) { clearTimeout(state.timer); state.timer = 0; }
  $('qg-em-run').textContent = state.tick >= state.max ? '🌱 Begin' : '▶ Resume';
}

function reset() {
  stop();
  state.rng = createRng('web:' + seedVal());
  state.field = createField({ rows: state.rows, cols: state.cols, rng: state.rng, density: 0.06 });
  state.tick = 0; state.journal = []; state.counts = {};
  $('qg-em-journal').innerHTML = '';
  $('qg-em-count').textContent = '';
  $('qg-em-run').textContent = '🌱 Begin';
  draw(); updateStats(); renderPreview();
}

function download() {
  if (!state.site) renderPreview();
  const entries = Object.keys(state.site).map((name) => ({ name, content: state.site[name] || '' }));
  const blob = new Blob([makeZip(entries)], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `emergent-${seedVal()}-site.zip`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function fitCanvas() {
  const canvas = $('qg-em-canvas');
  if (!canvas) return;
  const w = Math.max(280, Math.min(720, canvas.parentElement.clientWidth));
  canvas.width = w;
  canvas.height = Math.round((w * state.rows) / state.cols);
  if (state.field) draw();
}

function init() {
  const canvas = $('qg-em-canvas');
  if (!canvas) return; // section not present
  state.ctx = canvas.getContext('2d');
  fitCanvas();
  $('qg-em-will').addEventListener('change', (e) => {
    const ep = $('qg-em-endpoint');
    if (e.target.value === 'offline') { ep.style.display = 'none'; }
    else { ep.style.display = ''; ep.value = endpointDefault(e.target.value); }
  });
  $('qg-em-run').addEventListener('click', start);
  $('qg-em-reset').addEventListener('click', reset);
  $('qg-em-download').addEventListener('click', download);
  $('qg-em-seed').addEventListener('change', reset);
  window.addEventListener('resize', fitCanvas);
  reset();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
