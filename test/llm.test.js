// LLM provider tests (zero-dependency): node test/llm.test.js
// Covers the Anthropic + OpenAI-compatible (LM Studio / Ollama / OpenAI) protocols,
// the key-safety rules, code-fence stripping, and graceful simulator fallback.

import assert from 'node:assert/strict';
import {
  LLMEngine, LLMScorer, QuantumSimulatorEngine, createRng,
  buildChatBody, buildChatHeaders, extractChatText, stripOuterCodeFence,
  resolveProvider, PROVIDER_PRESETS,
} from '../src/generator/index.js';

let passed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (err) { console.error(`  ✗ ${name}`); throw err; }
}

// A fetch stub that records the request and returns a canned JSON response.
function recordingFetch(responseData, capture = {}) {
  const fn = async (url, opts) => {
    capture.url = url;
    capture.opts = opts;
    capture.headers = opts.headers;
    capture.body = JSON.parse(opts.body);
    return { ok: true, status: 200, json: async () => responseData };
  };
  fn.capture = capture;
  return fn;
}

const FILE = { path: 'index.html', kind: 'html', intent: 'home page', measurements: 0 };
const ctx = () => ({ spec: { title: 'Quantum Site' }, files: [FILE], rng: createRng('OM') });

console.log('LLM provider tests');

// ---- protocol helpers -----------------------------------------------------

await check('buildChatBody (openai) uses a messages array with system + user', () => {
  const b = buildChatBody('openai', { model: 'm', maxTokens: 50, system: 'S', user: 'U' });
  assert.equal(b.model, 'm');
  assert.equal(b.max_tokens, 50);
  assert.equal(b.stream, false);
  assert.deepEqual(b.messages, [{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }]);
  assert.ok(!('system' in b), 'openai has no top-level system field');
});

await check('buildChatBody (anthropic) keeps system top-level', () => {
  const b = buildChatBody('anthropic', { model: 'm', maxTokens: 50, system: 'S', user: 'U' });
  assert.equal(b.system, 'S');
  assert.deepEqual(b.messages, [{ role: 'user', content: 'U' }]);
});

await check('buildChatHeaders attaches the right auth per protocol', () => {
  assert.equal(buildChatHeaders('openai', { apiKey: 'sk-x' }).authorization, 'Bearer sk-x');
  const a = buildChatHeaders('anthropic', { apiKey: 'sk-x' });
  assert.equal(a['x-api-key'], 'sk-x');
  assert.equal(a['anthropic-version'], '2023-06-01');
  // No key → no auth header (keyless local servers like LM Studio).
  assert.ok(!('authorization' in buildChatHeaders('openai', {})));
});

await check('extractChatText reads both protocol shapes', () => {
  assert.equal(extractChatText({ choices: [{ message: { content: 'hi' } }] }), 'hi'); // openai chat
  assert.equal(extractChatText({ choices: [{ text: 'yo' }] }), 'yo'); // legacy completion
  assert.equal(extractChatText({ content: [{ type: 'text', text: 'an' }] }), 'an'); // anthropic
  assert.equal(extractChatText({ text: 'simple' }), 'simple'); // simple proxy shape
  assert.equal(extractChatText(null), null);
});

await check('stripOuterCodeFence unwraps a whole-file fence but keeps inner blocks', () => {
  assert.equal(stripOuterCodeFence('```html\n<p>x</p>\n```'), '<p>x</p>');
  const md = '# Title\n\n```js\nfoo()\n```\n'; // inner fence, not the whole file
  assert.equal(stripOuterCodeFence(md), md);
});

await check('resolveProvider maps LM Studio to a keyless local OpenAI server', () => {
  const p = resolveProvider('lmstudio');
  assert.equal(p.protocol, 'openai');
  assert.equal(p.local, true);
  assert.match(p.url, /localhost:1234/);
  assert.equal(resolveProvider('nonsense').protocol, 'anthropic'); // safe default
  assert.ok(PROVIDER_PRESETS.ollama && PROVIDER_PRESETS.openai);
});

// ---- LLMEngine: LM Studio -------------------------------------------------

await check('LLMEngine(lmstudio) posts an OpenAI body to localhost:1234 with no key', async () => {
  const cap = {};
  const engine = new LLMEngine({
    provider: 'lmstudio',
    fetchImpl: recordingFetch({ choices: [{ message: { content: '<html>ok</html>' } }] }, cap),
  });
  assert.equal(engine.name, 'llm-lmstudio');
  assert.equal(await engine.available(), true); // keyless default URL is enough
  const out = await engine.guess(FILE, ctx());
  assert.match(cap.url, /localhost:1234\/v1\/chat\/completions/);
  assert.ok(Array.isArray(cap.body.messages) && cap.body.messages.length === 2);
  assert.equal(cap.body.model, 'local-model');
  assert.ok(!('authorization' in cap.headers), 'no API key for a local server');
  assert.equal(out.candidates[0], '<html>ok</html>');
  assert.equal(out.confidence, 0.92);
});

await check('LLMEngine(lmstudio) honors a custom endpoint + model', async () => {
  const cap = {};
  const engine = new LLMEngine({
    provider: 'lmstudio', endpoint: '/api/llm', model: 'qwen2.5-coder',
    fetchImpl: recordingFetch({ choices: [{ message: { content: 'x' } }] }, cap),
  });
  await engine.guess(FILE, ctx());
  assert.equal(cap.url, '/api/llm');
  assert.equal(cap.body.model, 'qwen2.5-coder');
});

await check('LLMEngine(lmstudio) strips a whole-file code fence from the reply', async () => {
  const engine = new LLMEngine({
    provider: 'lmstudio',
    fetchImpl: recordingFetch({ choices: [{ message: { content: '```html\n<h1>Hi</h1>\n```' } }] }),
  });
  const out = await engine.guess(FILE, ctx());
  assert.equal(out.candidates[0], '<h1>Hi</h1>');
});

await check('LLMEngine(lmstudio) degrades to the simulator when fetch throws', async () => {
  const throwing = async () => { throw new Error('LM Studio not running'); };
  const engine = new LLMEngine({ provider: 'lmstudio', fetchImpl: throwing, fallback: new QuantumSimulatorEngine() });
  const out = await engine.guess(FILE, ctx());
  assert.ok(out.candidates.length > 0 && out.candidates[0].length > 0, 'fallback produced content');
});

// ---- LLMEngine: key-safety across protocols --------------------------------

await check('LLMEngine(openai) direct call attaches a Bearer key (Node only)', async () => {
  const cap = {};
  const engine = new LLMEngine({
    provider: 'openai', apiKey: 'sk-test',
    fetchImpl: recordingFetch({ choices: [{ message: { content: 'ok' } }] }, cap),
  });
  await engine.guess(FILE, ctx());
  assert.match(cap.url, /api\.openai\.com/);
  assert.equal(cap.headers.authorization, 'Bearer sk-test');
});

await check('a key is NEVER attached when a proxy endpoint is set', async () => {
  const cap = {};
  const engine = new LLMEngine({
    provider: 'openai', endpoint: '/api/llm', apiKey: 'sk-test',
    fetchImpl: recordingFetch({ choices: [{ message: { content: 'ok' } }] }, cap),
  });
  await engine.guess(FILE, ctx());
  assert.equal(cap.url, '/api/llm');
  assert.ok(!('authorization' in cap.headers), 'proxy injects the key server-side; client must not');
});

await check('LLMEngine(anthropic) is unavailable with no endpoint and no key', async () => {
  const engine = new LLMEngine({ fetchImpl: async () => ({}) });
  assert.equal(engine.name, 'llm');
  assert.equal(await engine.available(), false);
});

// ---- LLMScorer over an OpenAI-compatible server ----------------------------

await check('LLMScorer(lmstudio) parses an integer score from an OpenAI reply', async () => {
  const cap = {};
  const scorer = new LLMScorer({
    provider: 'lmstudio',
    fetchImpl: recordingFetch({ choices: [{ message: { content: 'I rate this 87/100.' } }] }, cap),
  });
  assert.equal(await scorer.available(), true);
  const r = await scorer.score({ files: [{ path: 'index.html', content: '<h1>Earth ↔ Higgs</h1>' }], spec: { title: 'T' } });
  assert.equal(r.total, 87);
  assert.equal(r.breakdown.llm, 87);
  assert.ok(Array.isArray(cap.body.messages), 'used the OpenAI chat shape');
});

console.log(`\nAll ${passed} LLM provider tests passed ✓`);
