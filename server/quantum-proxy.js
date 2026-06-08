#!/usr/bin/env node
// 🔌 Example backend proxy — keeps API keys on the server, never in the browser.
//
// Run:  node server/quantum-proxy.js            (serves the site + the proxy on :8787)
// Then open  http://localhost:8787/src/generator.html  and, in the Quantum engine,
// set the backend proxy endpoint to  /api/quantum  (and QRNG entropy to  /api/qrng ).
//
// Secrets come from the environment (never hard-code them):
//   ANU_QRNG_KEY        — ANU Quantum Numbers API key      → /api/qrng
//   IBM_QUANTUM_TOKEN   — IBM Cloud IAM key                ┐ → /api/quantum (backend=ibm)
//   IBM_CRN             — Qiskit Runtime instance CRN      ┘
//   ANTHROPIC_API_KEY   — Claude key                       → /api/generate (LLM engine)
//   LMSTUDIO_URL        — OpenAI-compatible upstream        ┐ → /api/llm (LM Studio etc.)
//   LMSTUDIO_KEY        — bearer key (optional, hosted)     ┘   default localhost:1234
//
// Zero dependencies: Node's built-in http/fs + global fetch (Node ≥18). This is a
// reference implementation, not a hardened production server.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeBackend, parseOpenQASM } from '../src/generator/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PORT = Number(process.env.PORT || 8787);

const ANU_KEY = process.env.ANU_QRNG_KEY || null;
const IBM_TOKEN = process.env.IBM_QUANTUM_TOKEN || null;
const IBM_CRN = process.env.IBM_CRN || null;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || null;
const LMSTUDIO_URL = process.env.LMSTUDIO_URL || 'http://localhost:1234/v1/chat/completions';
const LMSTUDIO_KEY = process.env.LMSTUDIO_KEY || null;
const ANU_URL = 'https://api.quantumnumbers.anu.edu.au';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
// CORS: the proxy holds API keys, so '*' makes it an open credentialed relay for any
// reachable origin. Fine for a localhost demo (default); set ALLOWED_ORIGIN to lock it down.
const ALLOW_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/markdown; charset=utf-8',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Access-Control-Allow-Origin': ALLOW_ORIGIN, 'Access-Control-Allow-Headers': 'Content-Type', ...headers });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    // Cap the body and tear the socket down on overflow (don't keep buffering).
    req.on('data', (c) => { data += c; if (data.length > 4e6) { req.destroy(); reject(new Error('body too large')); } });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// GET /api/qrng?length=N&type=uint16 — forward to ANU with the server-side key.
async function handleQRNG(req, res, url) {
  if (!ANU_KEY) return send(res, 501, JSON.stringify({ error: 'ANU_QRNG_KEY not set on server' }), { 'Content-Type': 'application/json' });
  const length = Math.min(1024, Number(url.searchParams.get('length') || 256));
  const type = url.searchParams.get('type') || 'uint16';
  try {
    const r = await fetch(`${ANU_URL}?length=${length}&type=${encodeURIComponent(type)}`, { headers: { 'x-api-key': ANU_KEY } });
    const text = await r.text();
    send(res, r.status, text, { 'Content-Type': 'application/json' });
  } catch (err) {
    send(res, 502, JSON.stringify({ error: String(err.message) }), { 'Content-Type': 'application/json' });
  }
}

// POST /api/quantum {openqasm, shots, backend} — run on a real provider server-side.
async function handleQuantum(req, res) {
  try {
    const { openqasm, shots = 1024, backend = 'local' } = JSON.parse(await readBody(req) || '{}');
    if (!openqasm) throw new Error('missing openqasm');
    const circuit = parseOpenQASM(openqasm);
    const be = makeBackend(backend, {
      apiKey: backend === 'ibm' ? IBM_TOKEN : ANU_KEY,
      crn: IBM_CRN,
      backendName: process.env.IBM_BACKEND || 'ibm_brisbane',
    });
    const out = await be.run(circuit, Math.min(8192, Number(shots) || 1024));
    send(res, 200, JSON.stringify(out), { 'Content-Type': 'application/json' });
  } catch (err) {
    send(res, 400, JSON.stringify({ error: String(err.message) }), { 'Content-Type': 'application/json' });
  }
}

// POST /api/generate — proxy a message to Claude with the server-side key.
async function handleGenerate(req, res) {
  if (!ANTHROPIC_KEY) return send(res, 501, JSON.stringify({ error: 'ANTHROPIC_API_KEY not set on server' }), { 'Content-Type': 'application/json' });
  try {
    const body = await readBody(req);
    const r = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body,
    });
    const text = await r.text();
    send(res, r.status, text, { 'Content-Type': 'application/json' });
  } catch (err) {
    send(res, 502, JSON.stringify({ error: String(err.message) }), { 'Content-Type': 'application/json' });
  }
}

// POST /api/llm — forward an OpenAI-compatible chat request to a local server
// (LM Studio by default). Lets the browser reach LM Studio same-origin when its
// CORS is off. The upstream URL is server-fixed (not client-controlled → no SSRF);
// the body is validated and max_tokens clamped before forwarding.
async function handleLLM(req, res) {
  let body;
  try {
    body = JSON.parse((await readBody(req)) || '{}');
  } catch {
    return send(res, 400, JSON.stringify({ error: 'invalid JSON body' }), { 'Content-Type': 'application/json' });
  }
  if (!Array.isArray(body.messages)) {
    return send(res, 400, JSON.stringify({ error: 'body must include a messages[] array' }), { 'Content-Type': 'application/json' });
  }
  if (body.max_tokens != null) body.max_tokens = Math.min(8192, Math.max(1, Number(body.max_tokens) || 1024));
  try {
    const headers = { 'content-type': 'application/json' };
    if (LMSTUDIO_KEY) headers['authorization'] = `Bearer ${LMSTUDIO_KEY}`;
    const r = await fetch(LMSTUDIO_URL, { method: 'POST', headers, body: JSON.stringify(body) });
    const text = await r.text();
    send(res, r.status, text, { 'Content-Type': 'application/json' });
  } catch (err) {
    send(res, 502, JSON.stringify({ error: `LM Studio upstream (${LMSTUDIO_URL}) unreachable: ${err.message}` }), { 'Content-Type': 'application/json' });
  }
}

async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/src/generator.html';
  const filePath = normalize(join(ROOT, pathname));
  // Path-traversal guard: require the resolved path to be ROOT itself or inside it
  // (the trailing separator stops a sibling like ROOT+"-secrets" from matching).
  if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) return send(res, 403, 'forbidden');
  try {
    const data = await readFile(filePath);
    send(res, 200, data, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
  } catch {
    send(res, 404, 'not found');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === 'OPTIONS') return send(res, 204, '');
  if (req.method === 'GET' && url.pathname === '/api/qrng') return handleQRNG(req, res, url);
  if (req.method === 'POST' && url.pathname === '/api/quantum') return handleQuantum(req, res);
  if (req.method === 'POST' && url.pathname === '/api/generate') return handleGenerate(req, res);
  if (req.method === 'POST' && url.pathname === '/api/llm') return handleLLM(req, res);
  return serveStatic(req, res, url);
});

server.listen(PORT, () => {
  console.log(`🔌 quantum proxy + static server on http://localhost:${PORT}`);
  console.log(`   demo:    http://localhost:${PORT}/src/generator.html`);
  console.log(`   QRNG:    ${ANU_KEY ? 'ready' : 'set ANU_QRNG_KEY to enable real quantum entropy'}  → /api/qrng`);
  console.log(`   IBM QPU: ${IBM_TOKEN && IBM_CRN ? 'ready' : 'set IBM_QUANTUM_TOKEN + IBM_CRN to enable'}  → POST /api/quantum {backend:"ibm"}`);
  console.log(`   Claude:  ${ANTHROPIC_KEY ? 'ready' : 'set ANTHROPIC_API_KEY to enable'}  → /api/generate`);
  console.log(`   LM Studio: relaying to ${LMSTUDIO_URL}  → POST /api/llm  (browser can also call LM Studio directly)`);
  if (ALLOW_ORIGIN === '*' && (ANU_KEY || IBM_TOKEN || ANTHROPIC_KEY || LMSTUDIO_KEY)) {
    console.log('   ⚠️  CORS is open (*) while keys are set — ok for a localhost demo; set ALLOWED_ORIGIN to lock it down.');
  }
});
