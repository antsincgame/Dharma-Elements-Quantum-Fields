// Shared request/response shaping for LLM providers, so both the generation
// engine (engines.js) and the quality judge (scorers.js) can speak either the
// Anthropic Messages API or the OpenAI-compatible chat-completions protocol.
//
// The OpenAI-compatible protocol covers a whole family of local + hosted servers
// that expose `POST /v1/chat/completions` — most importantly **LM Studio**
// (http://localhost:1234), but also Ollama, llama.cpp, vLLM, LocalAI and OpenAI
// itself. LM Studio is the headline case: it runs entirely on your machine, needs
// **no API key**, and enables CORS by default, so the browser can call it
// directly — a perfect fit for this project's "no secret ever in the browser" rule
// (there is no secret at all).

// Presets resolve a friendly provider id → { protocol, url, model, local }.
//   protocol : 'anthropic' | 'openai'   — which request/response shape to use
//   url      : the provider's own endpoint (used when no explicit endpoint given)
//   model    : a sensible default model id
//   local    : true for keyless servers reachable on a default localhost port
export const PROVIDER_PRESETS = {
  anthropic: { protocol: 'anthropic', url: 'https://api.anthropic.com/v1/messages', model: 'claude-opus-4-8', local: false },
  lmstudio: { protocol: 'openai', url: 'http://localhost:1234/v1/chat/completions', model: 'local-model', local: true },
  ollama: { protocol: 'openai', url: 'http://localhost:11434/v1/chat/completions', model: 'llama3', local: true },
  openai: { protocol: 'openai', url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini', local: false },
};

export function resolveProvider(id) {
  return PROVIDER_PRESETS[id] || PROVIDER_PRESETS.anthropic;
}

// Build the POST body for a chat request in the given protocol.
export function buildChatBody(protocol, { model, maxTokens, system, user, temperature }) {
  if (protocol === 'openai') {
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: user });
    const body = { model, messages, max_tokens: maxTokens, stream: false };
    if (temperature != null) body.temperature = temperature;
    return body;
  }
  // anthropic — system is a top-level field, not a message
  return { model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] };
}

// Build request headers. The key is attached only for a DIRECT provider call —
// a proxy injects credentials server-side, and a browser must never see a key.
// (LM Studio/Ollama are keyless, so `apiKey` is simply absent there.)
export function buildChatHeaders(protocol, { apiKey, anthropicVersion } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (!apiKey) return headers;
  if (protocol === 'openai') {
    headers['authorization'] = `Bearer ${apiKey}`;
  } else {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = anthropicVersion || '2023-06-01';
  }
  return headers;
}

// Extract the assistant text from a response of EITHER protocol (and from the
// simple `{ text }` shape some proxies return), so callers stay protocol-agnostic
// when reading the reply.
export function extractChatText(data) {
  if (!data) return null;
  if (typeof data === 'string') return data;
  // OpenAI-compatible: choices[0].message.content (chat) or choices[0].text (legacy completion)
  if (Array.isArray(data.choices) && data.choices.length) {
    const c = data.choices[0];
    if (c && c.message && typeof c.message.content === 'string') return c.message.content;
    if (c && typeof c.text === 'string') return c.text;
  }
  // Simple proxy shape
  if (typeof data.text === 'string') return data.text;
  // Anthropic Messages: content is an array of typed blocks
  if (Array.isArray(data.content)) {
    return data.content
      .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join('');
  }
  return null;
}

// Local models often wrap the whole file in one ```fence``` despite being asked
// for raw content. Strip the outermost fence only when it encloses the ENTIRE
// reply, so legitimate inner code blocks (e.g. inside a .md file) are preserved.
export function stripOuterCodeFence(text) {
  if (typeof text !== 'string') return text;
  const m = text.trim().match(/^```[\w-]*\n([\s\S]*?)\n?```$/);
  return m ? m[1] : text;
}
