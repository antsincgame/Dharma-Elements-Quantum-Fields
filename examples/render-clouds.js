#!/usr/bin/env node
// 🎨 Offline preview renderer for the superposition cloud — a browser-free way to
// verify the graphics at scientific-visualization quality. It draws the REAL
// orbital geometry (from the project's own orbitals.js sampling) with a physically
// motivated pipeline and writes PNGs (encoded with node:zlib — zero dependencies):
//
//   • supersampled rendering (SS×) → box-downsample for clean anti-aliasing
//     (MSAA can't touch additive point clouds — supersampling is the right tool);
//   • depth cueing — far points dim & shrink, so a flat additive cloud reads as a
//     3-D volume;
//   • additive Gaussian splats → threshold highlight extraction → multi-scale bloom
//     (only the dense cores glow, no global haze);
//   • ACES filmic tone mapping (Narkowicz fit) + sRGB gamma — HDR cores roll off to
//     warm-white instead of clipping flat;
//   • diverging PHASE color — element hue for ψ>0, an icy complementary for ψ<0,
//     so wavefunction nodes (sign flips) are visible exactly as in pro orbital art.
//
//   node examples/render-clouds.js   → docs/previews/cloud-mandala.png
//                                       docs/previews/cloud-contact.png
//
// The interactive Three.js version adds animation, real bloom and the collapse
// "breathing"; this still proves the shapes, phase structure and color are correct.

import zlib from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  sampleOrbital, ELEMENT_ORBITAL, ELEMENTS, ELEMENT_COLORS, ORBITALS, PHI, createRng, crc32,
} from '../src/generator/index.js';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'previews');
const SS = 2; // supersampling factor (render at SS×, then downsample)

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

// Diverging phase palette: the element hue for ψ>0, an icy blue-violet complement
// for ψ<0 (anchored at the node, like a Moreland/cool-warm diverging map but kept
// inside this project's white-blue-cosmic palette).
const ICE = [0.55, 0.72, 1.0];
function phaseColors(hex) {
  const [r, g, b] = hexRGB(hex);
  const pos = [Math.min(1, r * 1.04 + 0.02), Math.min(1, g * 1.04 + 0.02), Math.min(1, b * 1.04 + 0.04)];
  const mix = 0.72; // pull the negative lobe firmly toward ice so the node reads
  const neg = [r * (1 - mix) + ICE[0] * mix, g * (1 - mix) + ICE[1] * mix, b * (1 - mix) + ICE[2] * mix];
  return { pos, neg };
}

function canvas(W, H) {
  const a = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2), v = 1 - Math.min(1, dx * dx + dy * dy);
    const i = (y * W + x) * 3;
    a[i] = 0.005 + 0.012 * v; a[i + 1] = 0.009 + 0.020 * v; a[i + 2] = 0.022 + 0.046 * v; // cosmic vignette
  }
  return a;
}

// Additive Gaussian splat with per-point intensity (depth-cued upstream). A soft,
// slightly wider kernel so neighboring points blend into smooth density (not grain).
function splat(a, W, H, px, py, r, g, b, it) {
  const cx = Math.round(px), cy = Math.round(py);
  for (let oy = -3; oy <= 3; oy++) for (let ox = -3; ox <= 3; ox++) {
    const xx = cx + ox, yy = cy + oy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
    const w = Math.exp(-(ox * ox + oy * oy) / 3.0) * it; const i = (yy * W + xx) * 3;
    a[i] += r * w; a[i + 1] += g * w; a[i + 2] += b * w;
  }
}

// separable Gaussian blur (for bloom)
function blur(a, W, H, radius) {
  const sigma = radius / 2; const k = []; let sum = 0;
  for (let i = -radius; i <= radius; i++) { const w = Math.exp(-(i * i) / (2 * sigma * sigma)); k.push(w); sum += w; }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  const tmp = new Float32Array(W * H * 3), out = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let r = 0, g = 0, b = 0; for (let i = -radius; i <= radius; i++) { const xx = Math.min(W - 1, Math.max(0, x + i)), w = k[i + radius], j = (y * W + xx) * 3; r += a[j] * w; g += a[j + 1] * w; b += a[j + 2] * w; } const o = (y * W + x) * 3; tmp[o] = r; tmp[o + 1] = g; tmp[o + 2] = b; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let r = 0, g = 0, b = 0; for (let i = -radius; i <= radius; i++) { const yy = Math.min(H - 1, Math.max(0, y + i)), w = k[i + radius], j = (yy * W + x) * 3; r += tmp[j] * w; g += tmp[j + 1] * w; b += tmp[j + 2] * w; } const o = (y * W + x) * 3; out[o] = r; out[o + 1] = g; out[o + 2] = b; }
  return out;
}

// ACES filmic tone-map (Narkowicz 2016 fit) — HDR roll-off that keeps color in the
// bright cores instead of clipping to flat white. https://knarkowicz.wordpress.com
function aces(x) {
  const a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return Math.max(0, Math.min(1, (x * (a * x + b)) / (x * (c * x + d) + e)));
}

// Noise-floor subtraction → grain-smoothing base blur → threshold bloom → multi-scale
// → ACES → sRGB → downsample.
function finish(a, W, H, ex, opts = {}) {
  const threshold = opts.threshold != null ? opts.threshold : 0.5;
  const floor = opts.floor != null ? opts.floor : 0.045; // kills isolated faint specks
  const smoothR = opts.smoothR != null ? opts.smoothR : 3; // base-blur radius (×SS)
  const sharp = opts.sharp != null ? opts.sharp : 0.28; // how much crisp scene to keep
  const smoothW = opts.smoothW != null ? opts.smoothW : 0.85; // weight of the smoothed base
  // Floored scene + a blur of it: the blur smooths point grain into density, a touch
  // of the sharp scene keeps structure (lobes/nodes) crisp.
  const sc = new Float32Array(W * H * 3);
  for (let i = 0; i < W * H * 3; i++) { const v = a[i] - floor; sc[i] = v > 0 ? v : 0; }
  const sm = blur(sc, W, H, smoothR * SS);
  // Highlight pass: only light above the threshold blooms (no global haze).
  const hi = new Float32Array(W * H * 3);
  for (let i = 0; i < W * H * 3; i++) { const v = a[i] - threshold; hi[i] = v > 0 ? v : 0; }
  const b1 = blur(hi, W, H, 4 * SS);
  const b2 = blur(hi, W, H, 11 * SS);
  const b3 = blur(hi, W, H, 24 * SS);
  // Compose HDR (smoothed base + a little sharp + bloom), tone-map, gamma.
  const hdr = new Float32Array(W * H * 3);
  for (let i = 0; i < W * H * 3; i++) {
    const base = sharp * sc[i] + smoothW * sm[i];
    const lin = base + 0.9 * b1[i] + 0.5 * b2[i] + 0.28 * b3[i];
    hdr[i] = Math.pow(aces(lin * ex), 1 / 2.2);
  }
  // Box-downsample SS×SS → final resolution (this is the anti-aliasing).
  const w = W / SS, h = H / SS, out = Buffer.alloc(w * h * 3);
  const inv = 1 / (SS * SS);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, bl = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const j = ((y * SS + sy) * W + (x * SS + sx)) * 3; r += hdr[j]; g += hdr[j + 1]; bl += hdr[j + 2];
    }
    const o = (y * w + x) * 3;
    out[o] = Math.max(0, Math.min(255, Math.round(r * inv * 255)));
    out[o + 1] = Math.max(0, Math.min(255, Math.round(g * inv * 255)));
    out[o + 2] = Math.max(0, Math.min(255, Math.round(bl * inv * 255)));
  }
  return { buf: out, w, h };
}

// View rotation (yaw then pitch) returning [X, Y, Z]; Z drives the depth cue.
const cy = Math.cos(0.55), sy = Math.sin(0.55), cp = Math.cos(-0.34), sp = Math.sin(-0.34);
function rot(x, y, z) {
  const X = cy * x + sy * z;
  let Z = -sy * x + cy * z;
  const Y = cp * y - sp * Z;
  Z = sp * y + cp * Z;
  return [X, Y, Z];
}

// Draw one orbital cloud at (Cx,Cy), scaled to `scale`, with depth cueing & phase color.
function drawCloud(a, W, H, orbKey, hex, Cx, Cy, scale, seed, N, it) {
  const { positions, signs } = sampleOrbital(orbKey, N, createRng(seed));
  const { pos: cPos, neg: cNeg } = phaseColors(hex);
  const halfExtent = 3.2; // normalized half-size of a cloud (for depth mapping)
  const cull2 = 3.2 * 3.2; // drop the faint far tail that just scatters grain
  for (let p = 0; p < N; p++) {
    const nx = positions[p * 3], ny = positions[p * 3 + 1], nz = positions[p * 3 + 2];
    if (nx * nx + ny * ny + nz * nz > cull2) continue;
    const [rx, ry, rz] = rot(nx, ny, nz);
    // depth01: 0 = nearest (front), 1 = farthest (back)
    const depth01 = Math.max(0, Math.min(1, (rz + halfExtent) / (2 * halfExtent)));
    const fog = 1 - 0.55 * depth01;            // far points dim
    const persp = 1 - 0.18 * depth01;          // …and shrink slightly
    const c = signs[p] >= 0 ? cPos : cNeg;
    splat(a, W, H, Cx + rx * scale * persp, Cy - ry * scale * persp, c[0], c[1], c[2], it * fog);
  }
}

mkdirSync(OUT, { recursive: true });

// Hero: golden mandala of the five element orbitals (mirrors the live layout).
{
  const W = 1280 * SS, H = 680 * SS, a = canvas(W, H);
  const n = 5, ring = 3.1 * Math.min(1.6, PHI * 0.5 + n * 0.12), cloudR = Math.max(1.2, ring * Math.sin(Math.PI / n) * 0.9) * 0.55;
  const scale = (W * 0.42) / (ring + cloudR);
  for (let k = 0; k < n; k++) {
    const el = ELEMENTS[k], ang = (k / n) * Math.PI * 2 - Math.PI / 2, ox = Math.cos(ang) * ring, oy = Math.sin(ang) * ring * 0.62;
    drawCloud(a, W, H, ELEMENT_ORBITAL[el.key], ELEMENT_COLORS[el.key], W / 2 + ox * scale, H / 2 - oy * scale, scale * cloudR, 'm#' + el.key, 260000, 0.06);
  }
  const { buf, w, h } = finish(a, W, H, 1.95, { threshold: 0.5, floor: 0.05, smoothR: 15, sharp: 0.08, smoothW: 1.15 });
  writeFileSync(join(OUT, 'cloud-mandala.png'), png(w, h, buf));
  console.log('wrote docs/previews/cloud-mandala.png');
}

// Contact sheet: a tour of orbital structure — node-free (1s · 2p_z · 3d_z²) AND
// node-bearing (2s · 3s · 3p_z), so the radial nodes (concentric shells, opposite
// phase across each node) are legible. Labels are drawn as element-colored baselines.
{
  const TOUR = [
    { key: '1s', color: ELEMENT_COLORS.earth },
    { key: '2s', color: ELEMENT_COLORS.water },
    { key: '2pz', color: ELEMENT_COLORS.fire },
    { key: '3s', color: ELEMENT_COLORS.air },
    { key: '3pz', color: ELEMENT_COLORS.space },
    { key: '3dz2', color: ELEMENT_COLORS.water },
  ];
  const cols = TOUR.length, tw = 290 * SS, th = 330 * SS, W = cols * tw, H = th + 44 * SS, a = canvas(W, H);
  for (let k = 0; k < cols; k++) {
    const { key, color } = TOUR[k];
    drawCloud(a, W, H, key, color, k * tw + tw / 2, H / 2 - 10 * SS, tw * 0.30, 's#' + key, 220000, 0.03);
    const [r, g, b] = hexRGB(color); // element-colored baseline strip
    for (let x = k * tw + 34 * SS; x < k * tw + tw - 34 * SS; x++) for (let yy = H - 28 * SS; yy < H - 24 * SS; yy++) { const i = (yy * W + x) * 3; a[i] += r * 1.8; a[i + 1] += g * 1.8; a[i + 2] += b * 1.8; }
  }
  const { buf, w, h } = finish(a, W, H, 1.6, { threshold: 0.5, floor: 0.04, smoothR: 2, sharp: 0.5, smoothW: 0.7 });
  writeFileSync(join(OUT, 'cloud-contact.png'), png(w, h, buf));
  console.log(`wrote docs/previews/cloud-contact.png  (${ORBITALS ? Object.keys(ORBITALS).length : 0} orbitals available)`);
}
