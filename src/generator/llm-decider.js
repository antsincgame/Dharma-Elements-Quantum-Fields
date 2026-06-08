// 🧠 makeLLMDecider — give the wu-wei agent (agent.js) a real model for its will.
//
// Returns an async `decide(summary, tools)` that asks an LLM (LM Studio / Claude /
// any OpenAI-compatible server) to choose ONE tool under the koan "do nothing", and
// parses the tool name from the reply. Reuses the provider protocol helpers; never
// puts a key in the browser (same rules as LLMEngine). Returns `null` on any failure
// or unconfigured provider — the agent then falls back to its offline quantum draw,
// so the loop is never blocked. Returns `null` (not a decider) when nothing is wired.

import { resolveProvider, buildChatBody, buildChatHeaders, extractChatText } from './llm-protocol.js';

const TOOL_NAMES = ['rest', 'contemplate', 'seed', 'perturb', 'infuse', 'accent', 'freeze'];

export function makeLLMDecider(opts = {}) {
  const provider = opts.provider || 'anthropic';
  const preset = resolveProvider(provider);
  const protocol = opts.protocol || preset.protocol;
  const endpoint = opts.endpoint || null; // proxy, or a local server's own URL
  const apiKey = opts.apiKey || null; // Node only — never in a browser
  const model = opts.model || preset.model;
  const fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  // Resolve the URL the same way LLMEngine does.
  const url = endpoint || (preset.local ? preset.url : (apiKey ? preset.url : null));
  if (!fetchImpl || !url) return null; // nothing wired → caller uses the offline chooser

  const system =
    'You are a wu-wei (無爲) agent tending a cellular field that slowly grows into a website. ' +
    'Your koan is "do nothing": most of the time you should REST and let the field unfold by itself. ' +
    'Only occasionally act. Choose exactly ONE tool. Reply with ONLY JSON, e.g. {"tool":"rest"}.';

  return async function decide(summary, tools) {
    const toolList = tools.map((t) => `- ${t.name}: ${t.note}`).join('\n');
    const user =
      `Field now — void ${(summary.voidFraction * 100).toFixed(0)}%, ${summary.regions} regions, ` +
      `entropy ${summary.entropy}, blocks ${JSON.stringify(summary.types)}.\n\n` +
      `Tools:\n${toolList}\n\nChoose one tool (prefer "rest"). JSON only.`;
    try {
      const headers = buildChatHeaders(protocol, { apiKey: endpoint ? null : apiKey });
      const res = await fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(buildChatBody(protocol, { model, maxTokens: 40, system, user })),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const text = extractChatText(data) || '';
      // Prefer an explicit {"tool":"name"}; else any bare tool word in the reply.
      const m = text.match(/"tool"\s*:\s*"([a-zA-Z]+)"/) || text.match(new RegExp(`\\b(${TOOL_NAMES.join('|')})\\b`, 'i'));
      const name = m ? m[1].toLowerCase() : null;
      return name && TOOL_NAMES.includes(name) ? { name } : null;
    } catch {
      return null; // network/parse error → offline fallback for this tick
    }
  };
}
