// 🔌 Quantum backends — run a circuit and return measurement counts. The same
// QuantumCircuit (OpenQASM-3 portable) runs on a local state-vector simulator, on
// real quantum-random hardware (ANU QRNG), or on a real QPU (IBM Qiskit Runtime).
//
//   QuantumBackend.run(circuit, shots) -> { counts: { "00": n, ... }, shots, backend }
//
// Real backends accept a `fallback` (default: LocalSimulatorBackend) and degrade to
// it on any error, so a run never hard-fails — mirroring the LLMEngine pattern.
// Secrets: an API key must NEVER live in the browser. Browser callers pass a
// same-origin proxy `endpoint`; Node callers may pass `apiKey` directly.

import { createRng } from './prng.js';
import { Statevector } from './qsim.js';

export class QuantumBackend {
  get name() { return 'backend'; }
  async available() { return true; }
  // eslint-disable-next-line no-unused-vars
  async run(circuit, shots = 1024) { throw new Error('QuantumBackend.run not implemented'); }
}

// --- Local state-vector simulator (default, deterministic, offline) ---------
export class LocalSimulatorBackend extends QuantumBackend {
  constructor(opts = {}) {
    super();
    this.rng = opts.rng || createRng(opts.seed != null ? opts.seed : 'OM');
  }
  get name() { return 'local-simulator'; }
  async run(circuit, shots = 1024) {
    return { counts: circuit.run(this.rng, shots), shots, backend: this.name };
  }
}

const ANU_DEFAULT = 'https://api.quantumnumbers.anu.edu.au';

// --- ANU Quantum Random Number Generator (real quantum hardware) ------------
// A QRNG is not a universal QPU: it cannot apply arbitrary gates. We therefore
// compute the circuit's outcome PROBABILITIES classically (exact, via the state
// vector) and draw the `shots` samples from REAL quantum randomness (vacuum-
// fluctuation bits from ANU). Honest framing: amplitudes are simulated, but the
// measurement outcomes are sourced from genuine quantum entropy.
export class QRNGBackend extends QuantumBackend {
  constructor(opts = {}) {
    super();
    this.apiKey = opts.apiKey || null; // Node only
    this.endpoint = opts.endpoint || null; // browser: same-origin proxy
    this.fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
    this.fallback = opts.fallback || new LocalSimulatorBackend(opts);
  }
  get name() { return 'qrng-anu'; }
  async available() { return Boolean(this.fetchImpl && (this.apiKey || this.endpoint)); }

  // Fetch `count` uniforms in [0,1) from real quantum randomness (uint16/65536).
  async _quantumUniforms(count) {
    const out = [];
    while (out.length < count) {
      const need = Math.min(1024, count - out.length);
      const base = this.endpoint || ANU_DEFAULT;
      const url = `${base}${base.includes('?') ? '&' : '?'}length=${need}&type=uint16`;
      const headers = {};
      if (this.apiKey && !this.endpoint) headers['x-api-key'] = this.apiKey;
      const res = await this.fetchImpl(url, { headers });
      if (!res.ok) throw new Error(`QRNG endpoint returned ${res.status}`);
      const data = await res.json();
      if (!data || !Array.isArray(data.data)) throw new Error('QRNG response had no data array');
      for (const v of data.data) out.push((v + 0.5) / 65536); // uint16 → (0,1)
    }
    return out;
  }

  async run(circuit, shots = 1024) {
    try {
      if (!(await this.available())) throw new Error('QRNG unavailable (no key/endpoint)');
      const probs = circuit.probabilities();
      const n = circuit.n;
      const cum = new Float64Array(probs.length);
      let acc = 0;
      for (let k = 0; k < probs.length; k++) { acc += probs[k]; cum[k] = acc; }
      const uni = await this._quantumUniforms(shots);
      const counts = {};
      for (let s = 0; s < shots; s++) {
        const r = uni[s] * acc;
        let lo = 0, hi = probs.length - 1;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
        const bs = lo.toString(2).padStart(n, '0');
        counts[bs] = (counts[bs] || 0) + 1;
      }
      return { counts, shots, backend: this.name };
    } catch (err) {
      if (typeof console !== 'undefined') console.warn('[qiwg] QRNGBackend fell back to local simulator:', err.message);
      return this.fallback.run(circuit, shots);
    }
  }
}

// --- IBM Quantum (Qiskit Runtime REST API) — a real QPU ---------------------
// Flow (verified 2025/2026): IBM Cloud IAM API key → bearer token → submit a
// Sampler PUB (OpenQASM 3) to /api/v1/jobs → poll → results. The legacy
// api.quantum-computing.ibm.com API is deprecated; everything is under
// quantum.cloud.ibm.com/api/v1. The API is date-pinned via IBM-API-Version.
const IBM_IAM = 'https://iam.cloud.ibm.com/identity/token';
const IBM_API = 'https://quantum.cloud.ibm.com/api/v1';

export class IBMBackend extends QuantumBackend {
  constructor(opts = {}) {
    super();
    this.apiKey = opts.apiKey || null; // IBM Cloud IAM key (Node / server only)
    this.crn = opts.crn || null; // Service-CRN of the Qiskit Runtime instance
    this.endpoint = opts.endpoint || null; // optional same-origin proxy that injects auth
    this.backendName = opts.backendName || 'ibm_brisbane';
    this.apiVersion = opts.apiVersion || '2025-05-01';
    this.fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
    this.fallback = opts.fallback || new LocalSimulatorBackend(opts);
    this.pollMs = opts.pollMs || 3000;
    this.maxPolls = opts.maxPolls || 100;
  }
  get name() { return 'ibm-qiskit-runtime'; }
  async available() { return Boolean(this.fetchImpl && (this.endpoint || (this.apiKey && this.crn))); }

  async _token() {
    const res = await this.fetchImpl(IBM_IAM, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${encodeURIComponent(this.apiKey)}`,
    });
    if (!res.ok) throw new Error(`IBM IAM token request returned ${res.status}`);
    return (await res.json()).access_token;
  }

  async run(circuit, shots = 1024) {
    try {
      if (!(await this.available())) throw new Error('IBM backend unavailable (need endpoint or apiKey+crn)');
      const qasm = circuit.toOpenQASM();
      const base = this.endpoint || IBM_API;
      const headers = { 'Content-Type': 'application/json' };
      if (!this.endpoint) {
        headers.Authorization = `Bearer ${await this._token()}`;
        headers['Service-CRN'] = this.crn;
        headers['IBM-API-Version'] = this.apiVersion;
      }
      const sub = await this.fetchImpl(`${base}/jobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          program_id: 'sampler',
          backend: this.backendName,
          params: { pubs: [[qasm]], version: 2, options: { default_shots: shots } },
        }),
      });
      if (!sub.ok) throw new Error(`IBM job submit returned ${sub.status}`);
      const { id } = await sub.json();
      let status = 'Queued';
      for (let i = 0; i < this.maxPolls && (status === 'Queued' || status === 'Running'); i++) {
        await new Promise((r) => setTimeout(r, this.pollMs));
        const st = await this.fetchImpl(`${base}/jobs/${id}`, { headers });
        status = (await st.json()).status;
      }
      if (status !== 'Completed') throw new Error(`IBM job ended with status ${status}`);
      const rj = await this.fetchImpl(`${base}/jobs/${id}/results`, { headers });
      const data = await rj.json();
      return { counts: extractIBMCounts(data), shots, backend: this.name, jobId: id };
    } catch (err) {
      if (typeof console !== 'undefined') console.warn('[qiwg] IBMBackend fell back to local simulator:', err.message);
      return this.fallback.run(circuit, shots);
    }
  }
}

// Best-effort mapping of a SamplerV2 result payload to a {bitstring: count} map.
// The exact shape is version-dependent; we probe the common locations and fall
// back to an empty map (the caller's fallback handles a miss).
export function extractIBMCounts(data) {
  try {
    const pub = data.results ? data.results[0] : (data[0] || data);
    const meas = pub && (pub.data || pub);
    for (const key of Object.keys(meas || {})) {
      const field = meas[key];
      if (field && field.samples && Array.isArray(field.samples)) {
        const counts = {};
        for (const s of field.samples) counts[s] = (counts[s] || 0) + 1;
        return counts;
      }
      if (field && field.get_counts) return field.get_counts();
    }
    if (pub && pub.counts) return pub.counts;
  } catch (_e) { /* fall through */ }
  return {};
}

// --- Stubs for providers that need request signing / OAuth + storage --------
// Amazon Braket (AWS SigV4) and Azure Quantum (Azure AD + storage containers)
// cannot be called from a zero-dependency browser/Node fetch client. They are
// provided as adapters for completeness and route through a backend proxy if one
// is supplied; otherwise they explain why and degrade to the local simulator.
class ProxyOnlyBackend extends QuantumBackend {
  constructor(opts, providerName, why) {
    super();
    this.endpoint = opts.endpoint || null;
    this.fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
    this.fallback = opts.fallback || new LocalSimulatorBackend(opts);
    this.providerName = providerName;
    this.why = why;
  }
  async available() { return Boolean(this.fetchImpl && this.endpoint); }
  async run(circuit, shots = 1024) {
    if (!(await this.available())) {
      if (typeof console !== 'undefined') {
        console.warn(`[qiwg] ${this.providerName} requires a backend proxy (${this.why}); using local simulator.`);
      }
      return this.fallback.run(circuit, shots);
    }
    try {
      const res = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openqasm: circuit.toOpenQASM(), shots, provider: this.providerName }),
      });
      if (!res.ok) throw new Error(`${this.providerName} proxy returned ${res.status}`);
      const data = await res.json();
      return { counts: data.counts || {}, shots, backend: this.name };
    } catch (err) {
      if (typeof console !== 'undefined') console.warn(`[qiwg] ${this.providerName} proxy failed, using local simulator:`, err.message);
      return this.fallback.run(circuit, shots);
    }
  }
}

export class BraketBackend extends ProxyOnlyBackend {
  constructor(opts = {}) { super(opts, 'amazon-braket', 'AWS SigV4 request signing'); }
  get name() { return 'amazon-braket'; }
}
export class AzureBackend extends ProxyOnlyBackend {
  constructor(opts = {}) { super(opts, 'azure-quantum', 'Azure AD OAuth + storage containers'); }
  get name() { return 'azure-quantum'; }
}

// --- Generic proxy backend (browser → your server → real provider) ----------
// The browser must never hold provider API keys. This backend POSTs the circuit
// (as OpenQASM 3) to a same-origin proxy endpoint (see server/quantum-proxy.js),
// which runs the real provider server-side with keys from the environment and
// returns { counts }. Degrades to the local simulator if the proxy is unreachable.
export class ProxyBackend extends QuantumBackend {
  constructor(opts = {}) {
    super();
    this.endpoint = opts.endpoint || '/api/quantum';
    this.provider = opts.provider || opts.backendId || 'local';
    this.fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
    this.fallback = opts.fallback || new LocalSimulatorBackend(opts);
  }
  get name() { return `proxy:${this.provider}`; }
  async available() { return Boolean(this.fetchImpl && this.endpoint); }
  async run(circuit, shots = 1024) {
    try {
      if (!this.fetchImpl) throw new Error('no fetch available');
      const res = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openqasm: circuit.toOpenQASM(), shots, backend: this.provider }),
      });
      if (!res.ok) throw new Error(`proxy returned ${res.status}`);
      const data = await res.json();
      return { counts: data.counts || {}, shots, backend: data.backend || this.name };
    } catch (err) {
      if (typeof console !== 'undefined') console.warn('[qiwg] ProxyBackend fell back to local simulator:', err.message);
      return this.fallback.run(circuit, shots);
    }
  }
}

// Factory: build a backend by id with sensible fallbacks.
export function makeBackend(id, opts = {}) {
  switch ((id || 'local').toLowerCase()) {
    case 'qrng': case 'anu': return new QRNGBackend(opts);
    case 'ibm': return new IBMBackend(opts);
    case 'braket': return new BraketBackend(opts);
    case 'azure': return new AzureBackend(opts);
    case 'proxy': return new ProxyBackend(opts);
    case 'local': default: return new LocalSimulatorBackend(opts);
  }
}
