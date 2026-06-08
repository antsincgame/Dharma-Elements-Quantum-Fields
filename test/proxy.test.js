// Proxy server hardening tests: node test/proxy.test.js
// Spawns server/quantum-proxy.js on a test port and probes the security boundary —
// path-traversal guard, /api/llm body validation, and keyless-endpoint behavior.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8793;
const base = `http://localhost:${PORT}`;

// Start the server with a clean env (no keys → exercises the keyless paths).
const env = { ...process.env, PORT: String(PORT) };
delete env.ANU_QRNG_KEY; delete env.ANTHROPIC_API_KEY; delete env.IBM_QUANTUM_TOKEN;
const proc = spawn(process.execPath, [join(ROOT, 'server', 'quantum-proxy.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });

await new Promise((resolve, reject) => {
  const to = setTimeout(() => reject(new Error('server did not start in time')), 5000);
  proc.stdout.on('data', (d) => { if (String(d).includes('http://localhost')) { clearTimeout(to); resolve(); } });
  proc.on('error', reject);
});

// Raw GET with an un-normalized path (http.request does not collapse "..").
function rawGet(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: 'localhost', port: PORT, path, method: 'GET' }, (r) => {
      let b = ''; r.on('data', (c) => { b += c; }); r.on('end', () => resolve({ status: r.statusCode, body: b }));
    });
    req.on('error', reject); req.end();
  });
}

let passed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (err) { console.error(`  ✗ ${name}`); proc.kill(); throw err; }
}

console.log('Proxy server hardening tests');

await check('serves the demo at /', async () => {
  const r = await fetch(base + '/');
  assert.equal(r.status, 200);
});

await check('path-traversal (encoded ../) never escapes ROOT or leaks a file', async () => {
  // The URL parser collapses dot-segments (→ 404) and the guard rejects anything that
  // still resolves outside ROOT (→ 403). Either way: no escape, no leak.
  const r = await rawGet('/%2e%2e/%2e%2e/%2e%2e/etc/passwd');
  assert.ok(r.status === 403 || r.status === 404, `expected 403/404, got ${r.status}`);
  assert.ok(!r.body.includes('root:'), 'must not leak /etc/passwd');
});

await check('/api/llm rejects a non-JSON body with 400', async () => {
  const r = await fetch(base + '/api/llm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'not json {' });
  assert.equal(r.status, 400);
});

await check('/api/llm rejects a body without a messages[] array with 400', async () => {
  const r = await fetch(base + '/api/llm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: 'x' }) });
  assert.equal(r.status, 400);
});

await check('/api/qrng without a server key returns 501 JSON (no crash)', async () => {
  const r = await fetch(base + '/api/qrng');
  assert.equal(r.status, 501);
  const j = await r.json();
  assert.ok(j.error && /ANU_QRNG_KEY/.test(j.error));
});

await check('CORS header is present (open by default for the localhost demo)', async () => {
  const r = await fetch(base + '/');
  assert.ok(r.headers.get('access-control-allow-origin'));
});

proc.kill();
console.log(`\nAll ${passed} proxy tests passed ✓`);
