// Interactive demo for the Quantum-Informatics Website Generator.
// Binds the framework-free core (./generator/index.js) to a DOM visualization:
// null-file size meters collapsing from negative → 0 → positive, a live quality
// gauge climbing to the threshold, and a preview of the assembled site.
//
// This file duplicates only the few constants it needs (it does NOT import the
// non-module src/script.js). The core does all the real work.

import {
  Generator,
  QuantumSimulatorEngine,
  LLMEngine,
  HeuristicScorer,
  QuantumMeasurementEngine,
  QuantumEntropy,
  makeBackend,
  ProxyBackend,
  bellCircuit,
  chshSampled,
  createRng,
  makeZip,
  SITE_SPECS,
  ELEMENT_COLORS,
  byteLength,
  assembleSite,
} from './generator/index.js';
import { SuperpositionField } from './superposition-cloud.js';

const $ = (id) => document.getElementById(id);
const METRIC_LABELS = {
  completeness: 'Completeness',
  richness: 'Richness',
  diversity: 'Diversity',
  coherence: 'Coherence',
  consistency: 'Consistency',
  aesthetics: 'Aesthetics',
  llm: 'LLM judge',
};
const KIND_COLOR = { html: ELEMENT_COLORS.water, css: ELEMENT_COLORS.space, md: ELEMENT_COLORS.fire, js: ELEMENT_COLORS.air };

let generator = null;
let running = false;
let cards = {}; // path -> { root, meter, fill, sizeLabel, state, det }
let currentTab = null;
let field = null; // SuperpositionField — the Three.js orbital cloud (browser-only)

function presetId() {
  return $('qg-preset').value;
}
function threshold() {
  return Number($('qg-threshold').value);
}

function makeEngine() {
  const simulator = new QuantumSimulatorEngine();
  const mode = $('qg-engine').value;
  if (mode === 'llm') {
    const endpoint = $('qg-endpoint').value.trim() || null;
    return new LLMEngine({ endpoint, fallback: simulator }); // no API key in the browser
  }
  if (mode === 'lmstudio') {
    // Local OpenAI-compatible server — keyless, called directly from the browser
    // (or via /api/llm). Blank endpoint → the LM Studio default localhost URL.
    const endpoint = $('qg-lm-endpoint').value.trim() || null;
    const model = $('qg-lm-model').value.trim() || null;
    return new LLMEngine({ provider: 'lmstudio', endpoint, model, fallback: simulator });
  }
  if (mode === 'quantum') {
    // Candidate selection becomes a real Born-rule measurement. With the QRNG
    // backend + proxy the collapses are seeded by real quantum entropy.
    let entropy = null;
    if ($('qg-backend').value === 'qrng') {
      entropy = new QuantumEntropy({ endpoint: qrngEndpoint(), fallbackRng: createRng($('qg-seed').value || 'OM') });
    }
    return new QuantumMeasurementEngine({ base: simulator, entropy });
  }
  return simulator;
}

// Proxy origin (blank = same origin as the page; run server/quantum-proxy.js).
function proxyOrigin() {
  return $('qg-qproxy').value.trim().replace(/\/$/, '');
}
function qrngEndpoint() { return proxyOrigin() + '/api/qrng'; }

// Build the selected backend, routing real providers through the example proxy
// (keys live on the server, never in the browser).
function buildBackend() {
  const id = $('qg-backend').value;
  const seed = $('qg-seed').value || 'OM';
  if (id === 'local') return makeBackend('local', { seed });
  if (id === 'qrng') return makeBackend('qrng', { endpoint: qrngEndpoint(), seed });
  return new ProxyBackend({ endpoint: proxyOrigin() + '/api/quantum', provider: id });
}

async function verifyQuantum() {
  const out = $('qg-verify-out');
  out.textContent = '⏳ running…';
  try {
    const { counts, backend } = await buildBackend().run(bellCircuit(), 1024);
    out.textContent = `${backend} → ${JSON.stringify(counts)}`;
  } catch (err) {
    out.textContent = '✗ ' + err.message;
  }
}

// Run a CHSH Bell test on the selected backend and show S vs the bounds.
async function runBellTest() {
  const out = $('qg-bell-S');
  out.textContent = '⏳ measuring…';
  out.className = 'qg-bell-S';
  try {
    const r = await chshSampled(buildBackend(), 4096);
    out.textContent = `S = ${r.S.toFixed(3)}${r.violates ? '  ✓ violates 2' : ''}`;
    out.className = 'qg-bell-S' + (r.violates ? ' qg-bell-violate' : '');
    const marker = $('qg-bell-marker');
    marker.style.left = `${Math.max(0, Math.min(100, (r.S / 3) * 100))}%`; // bar spans S ∈ [0,3]
    marker.title = `E(a,b)=${r.E.ab.toFixed(2)} · E(a,b')=${r.E.abp.toFixed(2)} · E(a',b)=${r.E.apb.toFixed(2)} · E(a',b')=${r.E.apbp.toFixed(2)}`;
  } catch (err) {
    out.textContent = '✗ ' + err.message;
  }
}

// Package the assembled site into a .zip and trigger a browser download.
function downloadSite() {
  if (!generator) return;
  const site = assembleSite(generator.files);
  const entries = Object.keys(site).map((name) => ({ name, content: site[name] || '' }));
  const blob = new Blob([makeZip(entries)], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${presetId()}-site.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function toggleCloudMode() {
  if (!field) return;
  const next = field.mode === 'bloch' ? 'orbital' : 'bloch';
  field.setMode(next);
  $('qg-cloud-mode').textContent = next === 'bloch' ? '🌀 Orbital view' : '🌐 Bloch view';
  const cap = document.querySelector('.qg-cloud-caption');
  if (cap) {
    cap.textContent = next === 'bloch'
      ? '🌐 Bloch sphere — each file as a qubit state |ψ⟩ = cos(θ/2)|0⟩ + e^{iφ}sin(θ/2)|1⟩, rising to a pole as it collapses'
      : '🌀 Superposition cloud — each null file as an orbital |ψ|², collapsing on measurement';
  }
}

function updateNegTime(file) {
  if (!file || !file.quantum || !file.quantum.negativeTime) return;
  const nt = file.quantum.negativeTime;
  $('qg-negtime').style.display = 'block';
  $('qg-negtime-body').innerHTML = `
    <div class="qg-nt-grid">
      <span>file</span><strong>${file.path}</strong>
      <span>weak value A<sub>w</sub></span><strong class="${nt.anomalous ? 'qg-nt-anom' : ''}">${nt.weakValue.toFixed(3)}${nt.anomalous ? ' · anomalous' : ''}</strong>
      <span>group delay τ<sub>g</sub></span><strong>${nt.groupDelay.toFixed(3)}</strong>
      <span>excitation τ<sub>T</sub>/τ₀</span><strong class="${nt.negative ? 'qg-nt-neg' : ''}">${nt.excitationRatio.toFixed(3)}${nt.negative ? ' ⏪ negative' : ''}</strong>
      <span>qubits measured</span><strong>${file.quantum.qubits}</strong>
    </div>`;
}

function buildGenerator() {
  const spec = SITE_SPECS[presetId()];
  generator = new Generator({
    spec,
    engine: makeEngine(),
    scorer: new HeuristicScorer(),
    threshold: threshold(),
    budget: 200,
    seed: $('qg-seed').value || 'OM',
    stepDelay: 220,
  });
  generator.on('step', ({ file }) => {
    updateCard(file);
    updateNegTime(file);
  });
  generator.on('collapse', ({ file }) => {
    updateCard(file);
    renderPreview();
  });
  generator.on('score', ({ total, breakdown }) => updateGauge(total, breakdown));
  generator.on('done', ({ reason, score }) => {
    running = false;
    setButtons();
    renderPreview();
    const ok = reason === 'threshold';
    $('qg-status').textContent = ok
      ? `🎉 Site manifested — quality ${score} reached the threshold of ${generator.threshold}.`
      : `Stopped (${reason}) at quality ${score}. Try a lower threshold or a different seed.`;
  });
  renderFiles();
  renderTabs();
  updateGauge(0, {});
  renderPreview();
  // (Re)seed the superposition cloud; clouds then follow each file's live
  // determinacy every frame and collapse as the run progresses.
  if (field) field.setFiles(generator.files, generator.seed);
  if ($('qg-engine').value !== 'quantum') $('qg-negtime').style.display = 'none';
  $('qg-threshold-show').textContent = String(threshold());
}

function stateBadge(state) {
  if (state === 'collapsed') return '💎 collapsed';
  if (state === 'collapsing') return '🌀 collapsing';
  return '☁️ superposition';
}

function renderFiles() {
  cards = {};
  const wrap = $('qg-files');
  wrap.innerHTML = '';
  for (const f of generator.files) {
    const root = document.createElement('div');
    root.className = 'qg-file';
    root.style.setProperty('--kind', KIND_COLOR[f.kind] || ELEMENT_COLORS.earth);
    root.innerHTML = `
      <div class="qg-file-head">
        <span class="qg-file-path">${f.path}</span>
        <span class="qg-file-kind">${f.kind}</span>
        <span class="qg-file-state">${stateBadge(f.state)}</span>
      </div>
      <div class="qg-meter"><div class="qg-meter-zero"></div><div class="qg-meter-fill neg"></div></div>
      <div class="qg-file-foot">
        <span class="qg-file-size">${f.size}</span>
        <span class="qg-file-det">debt ${f.debt | 0}</span>
      </div>`;
    wrap.appendChild(root);
    cards[f.path] = {
      root,
      fill: root.querySelector('.qg-meter-fill'),
      sizeLabel: root.querySelector('.qg-file-size'),
      state: root.querySelector('.qg-file-state'),
      det: root.querySelector('.qg-file-det'),
    };
    updateCard(f);
  }
}

function updateCard(file) {
  const c = cards[file.path];
  if (!c) return;
  const ref = Math.max(file.missingInfo, Math.abs(file.size), byteLength(file.content || ''), 1);
  const w = Math.min(0.5, (0.5 * Math.abs(file.size)) / ref);
  if (file.size < 0) {
    c.fill.className = 'qg-meter-fill neg';
    c.fill.style.left = `${(0.5 - w) * 100}%`;
    c.fill.style.width = `${w * 100}%`;
  } else {
    c.fill.className = 'qg-meter-fill pos';
    c.fill.style.left = '50%';
    c.fill.style.width = `${w * 100}%`;
  }
  c.sizeLabel.textContent = (file.size >= 0 ? '+' : '') + file.size;
  c.state.textContent = stateBadge(file.state);
  c.det.textContent = file.state === 'collapsed' ? `${file.size} bytes` : `debt ${file.debt | 0}`;
  c.root.classList.toggle('is-collapsed', file.state === 'collapsed');
}

function updateGauge(total, breakdown) {
  $('qg-score').textContent = String(total);
  $('qg-gauge-fill').style.width = `${Math.max(0, Math.min(100, total))}%`;
  const mark = $('qg-gauge-mark');
  mark.style.left = `${generator ? generator.threshold : threshold()}%`;
  const metrics = $('qg-metrics');
  metrics.innerHTML = '';
  for (const key of Object.keys(breakdown || {})) {
    const v = breakdown[key];
    const row = document.createElement('div');
    row.className = 'qg-metric';
    row.innerHTML = `<span class="qg-metric-name">${METRIC_LABELS[key] || key}</span>
      <span class="qg-metric-bar"><span style="width:${Math.max(0, Math.min(100, v))}%"></span></span>
      <span class="qg-metric-val">${v}</span>`;
    metrics.appendChild(row);
  }
}

function renderTabs() {
  const tabs = $('qg-tabs');
  tabs.innerHTML = '';
  const htmlFirst = generator.files.find((f) => f.kind === 'html');
  currentTab = currentTab && generator.files.some((f) => f.path === currentTab) ? currentTab : (htmlFirst ? htmlFirst.path : generator.files[0].path);
  for (const f of generator.files) {
    const b = document.createElement('button');
    b.className = 'qg-tab' + (f.path === currentTab ? ' active' : '');
    b.textContent = f.path;
    b.onclick = () => {
      currentTab = f.path;
      renderTabs();
      renderPreview();
    };
    tabs.appendChild(b);
  }
}

function inlineCss(html, css) {
  if (!css) return html;
  if (/<link[^>]+style\.css[^>]*>/i.test(html)) {
    return html.replace(/<link[^>]+style\.css[^>]*>/i, `<style>\n${css}\n</style>`);
  }
  return html.replace(/<\/head>/i, `<style>\n${css}\n</style></head>`);
}

function renderPreview() {
  if (!generator) return;
  const site = assembleSite(generator.files);
  const file = generator.files.find((f) => f.path === currentTab) || generator.files[0];
  const iframe = $('qg-preview');
  const pre = $('qg-preview-text');
  if (file && file.kind === 'html') {
    iframe.style.display = 'block';
    pre.style.display = 'none';
    iframe.srcdoc = inlineCss(site[file.path] || '<em>not yet guessed</em>', site['style.css']);
  } else {
    iframe.style.display = 'none';
    pre.style.display = 'block';
    pre.textContent = (file && site[file.path]) || '(not yet guessed)';
  }
}

function setButtons() {
  $('qg-run').disabled = running;
  $('qg-step').disabled = running;
  $('qg-reset').disabled = running;
  $('qg-run').textContent = running ? '⏳ Measuring…' : '🌀 Begin Measurement';
}

async function run() {
  if (running) return;
  buildGenerator();
  running = true;
  setButtons();
  $('qg-status').textContent = 'Measuring null files…';
  try {
    await generator.run();
  } finally {
    running = false;
    setButtons();
  }
}

async function step() {
  if (running) return;
  if (!generator || generator.files.every((f) => f.state === 'collapsed')) buildGenerator();
  await generator.step();
  renderPreview();
}

function reset() {
  if (running) return;
  buildGenerator();
  $('qg-status').textContent = 'Reset. Press “Begin Measurement”.';
}

function init() {
  // The orbital cloud is purely additive eye-candy; if Three.js fails to load it
  // disables itself gracefully and the generator keeps working offline.
  try {
    field = new SuperpositionField($('qg-cloud'), { pointsPerCloud: 9000 });
  } catch (err) {
    if (typeof console !== 'undefined') console.warn('[qiwg] superposition cloud disabled:', err);
    field = null;
  }
  const presetSel = $('qg-preset');
  for (const id of Object.keys(SITE_SPECS)) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = `${SITE_SPECS[id].title} (${SITE_SPECS[id].files.length} files)`;
    presetSel.appendChild(opt);
  }
  $('qg-threshold').addEventListener('input', (e) => {
    $('qg-threshold-val').textContent = e.target.value;
    $('qg-threshold-show').textContent = e.target.value;
    if (generator && !running) generator.threshold = Number(e.target.value);
    updateGauge(generator ? generator.lastScore : 0, generator ? generator.lastBreakdown : {});
  });
  $('qg-engine').addEventListener('change', (e) => {
    $('qg-endpoint-wrap').style.display = e.target.value === 'llm' ? 'flex' : 'none';
    $('qg-lmstudio-wrap').style.display = e.target.value === 'lmstudio' ? 'flex' : 'none';
    $('qg-quantum-wrap').style.display = e.target.value === 'quantum' ? 'flex' : 'none';
  });
  $('qg-verify').addEventListener('click', verifyQuantum);
  $('qg-bell-run').addEventListener('click', runBellTest);
  $('qg-download').addEventListener('click', downloadSite);
  $('qg-cloud-mode').addEventListener('click', toggleCloudMode);
  $('qg-preset').addEventListener('change', () => reset());
  $('qg-seed').addEventListener('change', () => reset());
  $('qg-run').addEventListener('click', run);
  $('qg-step').addEventListener('click', step);
  $('qg-reset').addEventListener('click', reset);

  buildGenerator();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
