// Scorers rate the assembled site 0–100.
//   • HeuristicScorer — deterministic, Lighthouse-inspired metrics (themed).
//   • LLMScorer — optional Claude judge via a configurable endpoint.
//   • CompositeScorer — the hybrid: heuristics always, LLM blended in when available.

import { Scorer, byteLength, KIND_BANDS } from './quantum-site-generator.js';
import { ELEMENTS, PHI } from './vocabulary.js';

const ELEMENT_NAMES = ELEMENTS.map((e) => e.en);
const FIELD_NAMES = ELEMENTS.map((e) => e.field);

function tokenize(text) {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
}

// Triangular score: 1 at the ideal length, tapering to 0 below min / above max.
function bandScore(len, band) {
  if (len <= 0) return 0;
  if (len < band.ideal) return Math.max(0, (len - band.min) / (band.ideal - band.min));
  return Math.max(0, Math.min(1, 1 - (len - band.ideal) / (band.max - band.ideal)));
}

export class HeuristicScorer extends Scorer {
  get name() {
    return 'heuristic';
  }
  async available() {
    return true;
  }

  async score(site) {
    const files = site.files;
    const assembled = files.map((f) => f.content || '').join('\n');
    const lower = assembled.toLowerCase();

    // Completeness — fraction of the entropy debt paid off.
    let owed = 0;
    let original = 0;
    for (const f of files) {
      owed += f.debt;
      original += f.missingInfo;
    }
    const completeness = original ? 1 - owed / original : 1;

    // Richness — average per-file length score within its kind's band.
    let richness = 0;
    for (const f of files) {
      const band = KIND_BANDS[f.kind] || KIND_BANDS.html;
      richness += bandScore(byteLength(f.content || ''), band);
    }
    richness = files.length ? richness / files.length : 0;

    // Diversity — average per-file vocabulary variety (cross-file repetition,
    // which is natural for a templated multi-page site, shouldn't be penalized).
    let diversity = 0;
    for (const f of files) {
      const t = tokenize(f.content || '');
      diversity += t.length ? new Set(t).size / t.length : 0;
    }
    diversity = files.length ? Math.min(1, diversity / files.length / 0.6) : 0;

    // Coherence — presence of the expected theme markers.
    const checks = [
      ELEMENT_NAMES.some((n) => assembled.includes(n)),
      FIELD_NAMES.some((n) => assembled.includes(n)),
      assembled.includes('ॐ'),
      assembled.includes('='),
      lower.includes('golden') || assembled.includes('φ') || assembled.includes(String(PHI)),
    ];
    const coherence = checks.filter(Boolean).length / checks.length;

    // Consistency — site title echoed across files + correct element↔field pairs.
    const title = (site.spec && site.spec.title) || '';
    const titleEchoed = title ? files.filter((f) => (f.content || '').includes(title)).length : 0;
    const titleScore = title ? Math.min(1, titleEchoed / Math.max(1, Math.ceil(files.length / 2))) : 1;
    let pairOk = 0;
    for (const el of ELEMENTS) {
      // If the element name appears, its correct field should appear too.
      if (assembled.includes(el.en) && assembled.includes(el.field)) pairOk += 1;
      else if (!assembled.includes(el.en)) pairOk += 1; // not mentioned → no contradiction
    }
    const consistency = 0.5 * titleScore + 0.5 * (pairOk / ELEMENTS.length);

    // Aesthetics — golden-ratio signal + five-fold completeness.
    const hasPhi = lower.includes('golden') || assembled.includes('φ') || assembled.includes(String(PHI));
    const allFive = ELEMENT_NAMES.every((n) => assembled.includes(n));
    const aesthetics = 0.5 * (hasPhi ? 1 : 0) + 0.5 * (allFive ? 1 : 0);

    const weights = {
      completeness: 0.3,
      richness: 0.2,
      diversity: 0.15,
      coherence: 0.2,
      consistency: 0.1,
      aesthetics: 0.05,
    };
    const metrics = { completeness, richness, diversity, coherence, consistency, aesthetics };
    let total = 0;
    const breakdown = {};
    for (const k of Object.keys(weights)) {
      total += weights[k] * metrics[k];
      breakdown[k] = Math.round(100 * metrics[k]);
    }
    return { total: Math.round(100 * total), breakdown };
  }
}

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

export class LLMScorer extends Scorer {
  constructor(opts = {}) {
    super();
    this.endpoint = opts.endpoint || null;
    this.apiKey = opts.apiKey || null;
    this.model = opts.model || 'claude-opus-4-8';
    this.maxTokens = opts.maxTokens || 200;
    this.anthropicVersion = opts.anthropicVersion || '2023-06-01';
    this.fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  }
  get name() {
    return 'llm-judge';
  }
  async available() {
    return Boolean(this.fetchImpl && (this.endpoint || this.apiKey));
  }

  async score(site) {
    const url = this.endpoint || (this.apiKey ? ANTHROPIC_URL : null);
    if (!url || !this.fetchImpl) throw new Error('LLMScorer unavailable');
    const assembled = site.files
      .map((f) => `=== ${f.path} ===\n${(f.content || '').slice(0, 1200)}`)
      .join('\n\n');
    const headers = { 'content-type': 'application/json' };
    if (this.apiKey && !this.endpoint) {
      headers['x-api-key'] = this.apiKey;
      headers['anthropic-version'] = this.anthropicVersion;
    }
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        system:
          'You are a strict website quality judge. Rate the assembled site 0–100 on theme ' +
          'coherence, richness and polish. Reply with ONLY an integer.',
        messages: [{ role: 'user', content: assembled }],
      }),
    });
    if (!res.ok) throw new Error(`LLMScorer endpoint returned ${res.status}`);
    const data = await res.json();
    const text = Array.isArray(data.content)
      ? data.content.map((b) => (b && b.text) || '').join('')
      : data.text || '';
    const n = parseInt((text.match(/\d+/) || ['0'])[0], 10);
    const total = Math.max(0, Math.min(100, n));
    return { total, breakdown: { llm: total } };
  }
}

export class CompositeScorer extends Scorer {
  constructor(opts = {}) {
    super();
    this.base = opts.base || new HeuristicScorer();
    this.llm = opts.llm || null;
    this.beta = opts.beta != null ? opts.beta : 0.4;
  }
  get name() {
    return 'composite';
  }
  async available() {
    return true;
  }

  async score(site) {
    const base = await this.base.score(site);
    if (this.llm && (await this.llm.available())) {
      try {
        const llm = await this.llm.score(site);
        const total = Math.round((1 - this.beta) * base.total + this.beta * llm.total);
        return { total, breakdown: { ...base.breakdown, llm: llm.total } };
      } catch (err) {
        if (typeof console !== 'undefined') console.warn('[qiwg] LLM judge fell back to heuristic:', err.message);
      }
    }
    return base;
  }
}
