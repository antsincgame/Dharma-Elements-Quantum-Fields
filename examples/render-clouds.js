#!/usr/bin/env node
// 🎨 Offline preview renderer for the superposition cloud — a browser-free way to
// verify the graphics. It draws the REAL orbital geometry (from the project's own
// orbitals.js sampling) with an additive-glow + bloom rasterizer and writes PNGs
// (encoded with node:zlib — zero dependencies). The interactive Three.js version in
// the browser adds animation, depth and the collapse "breathing"; this still proves
// the shapes, colors and phase structure are correct.
//
//   node examples/render-clouds.js            → docs/previews/cloud-mandala.png
//                                               docs/previews/cloud-contact.png

import zlib from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  sampleOrbital, ELEMENT_ORBITAL, ELEMENTS, ELEMENT_COLORS, PHI, createRng, crc32,
} from '../src/generator/index.js';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'previews');

// ---- minimal PNG encoder (RGB8) via node:zlib + the project's crc32 ----
function png(W, H, rgb) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) { raw[y * (1 + W * 3)] = 0; rgb.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3); }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const hexRGB = (h) => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]; };

function canvas(W, H) {
  const a = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2), v = 1 - Math.min(1, dx * dx + dy * dy);
    const i = (y * W + x) * 3;
    a[i] = 0.006 + 0.014 * v; a[i + 1] = 0.011 + 0.022 * v; a[i + 2] = 0.025 + 0.05 * v; // cosmic vignette
  }
  return a;
}

function splat(a, W, H, px, py, r, g, b, it) {
  const cx = Math.round(px), cy = Math.round(py);
  for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) {
    const xx = cx + ox, yy = cy + oy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
    const w = Math.exp(-(ox * ox + oy * oy) / 1.0) * it; const i = (yy * W + xx) * 3;
    a[i] += r * w; a[i + 1] += g * w; a[i + 2] += b * w;
  }
}

// separable Gaussian blur (for bloom / speckle removal)
function blur(a, W, H, radius) {
  const sigma = radius / 2; const k = []; let sum = 0;
  for (let i = -radius; i <= radius; i++) { const w = Math.exp(-(i * i) / (2 * sigma * sigma)); k.push(w); sum += w; }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  const tmp = new Float32Array(W * H * 3), out = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let r = 0, g = 0, b = 0; for (let i = -radius; i <= radius; i++) { const xx = Math.min(W - 1, Math.max(0, x + i)), w = k[i + radius], j = (y * W + xx) * 3; r += a[j] * w; g += a[j + 1] * w; b += a[j + 2] * w; } const o = (y * W + x) * 3; tmp[o] = r; tmp[o + 1] = g; tmp[o + 2] = b; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let r = 0, g = 0, b = 0; for (let i = -radius; i <= radius; i++) { const yy = Math.min(H - 1, Math.max(0, y + i)), w = k[i + radius], j = (yy * W + x) * 3; r += tmp[j] * w; g += tmp[j + 1] * w; b += tmp[j + 2] * w; } const o = (y * W + x) * 3; out[o] = r; out[o + 1] = g; out[o + 2] = b; }
  return out;
}

// dual-blur bloom + noise-floor subtraction + filmic tonemap + gamma
function finish(a, W, H, ex, floor) {
  const s = blur(a, W, H, 6), l = blur(a, W, H, 16);
  const o = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H * 3; i++) {
    let lin = a[i] * 0.05 + s[i] * 0.95 + l[i] * 0.65 - floor;
    if (lin < 0) lin = 0;
    const c = 1 - Math.exp(-lin * ex);
    o[i] = Math.max(0, Math.min(255, Math.round(Math.pow(c, 1 / 2.2) * 255)));
  }
  return o;
}

const cy = Math.cos(0.55), sy = Math.sin(0.55), cx = Math.cos(-0.34), sx = Math.sin(-0.34);
const rot = (x, y, z) => { const X = cy * x + sy * z, Z = -sy * x + cy * z; const Y = cx * y - sx * Z; return [X, Y]; };

function drawCloud(a, W, H, orb, hex, Cx, Cy, scale, seed, N, it) {
  const { positions, signs } = sampleOrbital(orb, N, createRng(seed));
  const [br, bg, bb] = hexRGB(hex);
  const nr = Math.min(1, br * 0.3 + 0.6), ng = Math.min(1, bg * 0.3 + 0.65), nb = Math.min(1, bb * 0.3 + 0.8); // cool negative-phase lobe
  for (let p = 0; p < N; p++) {
    const [rx, ry] = rot(positions[p * 3], positions[p * 3 + 1], positions[p * 3 + 2]);
    const neg = signs[p] < 0;
    splat(a, W, H, Cx + rx * scale, Cy - ry * scale, neg ? nr : br, neg ? ng : bg, neg ? nb : bb, it);
  }
}

mkdirSync(OUT, { recursive: true });

// Hero: golden mandala of the five element orbitals (mirrors the live layout).
{
  const W = 1280, H = 680, a = canvas(W, H);
  const n = 5, ring = 3.1 * Math.min(1.6, PHI * 0.5 + n * 0.12), cloudR = Math.max(1.2, ring * Math.sin(Math.PI / n) * 0.9) * 0.46;
  const scale = (W * 0.42) / (ring + cloudR);
  for (let k = 0; k < n; k++) {
    const el = ELEMENTS[k], ang = (k / n) * Math.PI * 2 - Math.PI / 2, ox = Math.cos(ang) * ring, oy = Math.sin(ang) * ring * 0.62;
    drawCloud(a, W, H, ELEMENT_ORBITAL[el.key], ELEMENT_COLORS[el.key], W / 2 + ox * scale, H / 2 - oy * scale, scale * cloudR, 'm#' + el.key, 140000, 0.045);
  }
  writeFileSync(join(OUT, 'cloud-mandala.png'), png(W, H, finish(a, W, H, 1.7, 0.05)));
  console.log('wrote docs/previews/cloud-mandala.png');
}

// Contact sheet: each element orbital, legible (1s · 2pₓ · 2p_y · 2p_z · 3d_z²).
{
  const cols = 5, tw = 300, th = 340, W = cols * tw, H = th + 44, a = canvas(W, H);
  for (let k = 0; k < 5; k++) {
    const el = ELEMENTS[k];
    drawCloud(a, W, H, ELEMENT_ORBITAL[el.key], ELEMENT_COLORS[el.key], k * tw + tw / 2, H / 2 - 10, tw * 0.26, 's#' + el.key, 140000, 0.026);
    const [r, g, b] = hexRGB(ELEMENT_COLORS[el.key]); // element-colored baseline
    for (let x = k * tw + 34; x < k * tw + tw - 34; x++) for (let yy = H - 28; yy < H - 24; yy++) { const i = (yy * W + x) * 3; a[i] += r * 2; a[i + 1] += g * 2; a[i + 2] += b * 2; }
  }
  writeFileSync(join(OUT, 'cloud-contact.png'), png(W, H, finish(a, W, H, 1.5, 0.05)));
  console.log('wrote docs/previews/cloud-contact.png');
}
