// 🌀 The "superposition cloud" — a Three.js visualization layer for the generator.
//
// Each null file is rendered as a cloud of points sampled from a hydrogen-like
// orbital's |ψ|² (see ./generator/orbitals.js). While a file is in superposition
// the cloud is diffuse; as it is "measured" the cloud collapses (point positions
// lerp toward a focused luminous cluster), driven live by the file's determinacy
// (1 − debt/missingInfo). The five files map to the five elements ↔ quantum fields,
// arranged as a golden-ratio mandala.
//
// THREE is the global from the r128 CDN <script> in generator.html. This module is
// browser-only and is NEVER imported by the Node test/CLI; it touches `THREE` only
// inside methods, so importing it in Node (if ever) wouldn't throw at load time.
// The pure sampling math lives in the framework-free core and is unit-tested there.

import { sampleOrbital, ELEMENT_ORBITAL, ELEMENTS, ELEMENT_COLORS, PHI, createRng, determinacy } from './generator/index.js';

const VERTEX_SHADER = `
  uniform float uTime;
  uniform float uScale;
  uniform float uProgress;     // 0 = diffuse superposition, 1 = collapsed
  attribute vec3 targetPosition;
  attribute vec3 customColor;
  attribute float aSize;
  attribute float aPhase;
  varying vec3 vColor;
  varying float vGlow;
  void main() {
    vColor = customColor;
    // easeInOutCubic on the collapse progress
    float p = uProgress;
    float eased = p < 0.5 ? 4.0 * p * p * p : 1.0 - pow(-2.0 * p + 2.0, 3.0) / 2.0;
    vec3 pos = mix(position, targetPosition, eased);
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    // "breathing" of the superposition + a brightening pulse as it collapses
    float pulse = 0.7 + 0.3 * sin(uTime * 1.6 + aPhase);
    vGlow = 0.6 + 0.4 * eased + 0.15 * sin(uTime * 2.2 + aPhase);
    gl_PointSize = aSize * pulse * (1.0 + 0.6 * eased) * (uScale / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  varying vec3 vColor;
  varying float vGlow;
  void main() {
    // soft round glowing point, computed procedurally (no texture)
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float alpha = pow(smoothstep(0.5, 0.0, d), 1.6);
    gl_FragColor = vec4(vColor * vGlow, alpha);
  }
`;

function hexToColor(hex) {
  return new THREE.Color(hex);
}

export class SuperpositionField {
  constructor(container, opts = {}) {
    this.container = container;
    this.available = typeof THREE !== 'undefined' && !!container;
    this.pointsPerCloud = opts.pointsPerCloud || 6000;
    this.clouds = [];
    this._raf = 0;
    if (!this.available) {
      if (container) container.classList.add('qg-cloud-off');
      return;
    }
    this._initThree();
    this._tick = this._tick.bind(this);
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
    this._raf = requestAnimationFrame(this._tick);
  }

  _initThree() {
    const w = this.container.clientWidth || 640;
    const h = this.container.clientHeight || 320;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h);
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, w / h, 0.1, 200);
    this.camera.position.set(0, 0, 15);
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.clock = new THREE.Clock();
  }

  // (Re)build one cloud per file. Clouds then follow their file's live state every
  // frame, so no per-event wiring is needed beyond this call.
  setFiles(files, seed) {
    if (!this.available) return;
    this._clearClouds();
    const list = files || [];
    const n = Math.max(1, list.length);
    const rng = createRng('cloud:' + (seed == null ? 'OM' : seed));
    // Golden-ratio mandala: clouds on a ring; radius and per-cloud size from φ.
    const ring = n > 1 ? 3.1 * Math.min(1.6, PHI * 0.5 + n * 0.12) : 0;
    const cloudR = n > 1 ? Math.max(1.2, ring * Math.sin(Math.PI / n) * 0.9) : 3.4;
    // Frame the whole mandala in view.
    this.camera.position.z = Math.max(11, (ring + cloudR) * 2.4);

    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      const el = ELEMENTS[i % ELEMENTS.length];
      const orbitalKey = ELEMENT_ORBITAL[el.key] || '1s';
      const cloud = this._buildCloud(file, el, orbitalKey, cloudR, rng.fork(file.path + '#' + i));
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      cloud.node.position.set(Math.cos(angle) * ring, Math.sin(angle) * ring * 0.6, 0);
      this.group.add(cloud.node);
      this.clouds.push(cloud);
    }
  }

  _buildCloud(file, element, orbitalKey, cloudR, rng) {
    const N = this.pointsPerCloud;
    const { positions, signs } = sampleOrbital(orbitalKey, N, rng);

    const pos = new Float32Array(N * 3);
    const target = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    const sizes = new Float32Array(N);
    const phases = new Float32Array(N);

    const base = hexToColor(ELEMENT_COLORS[element.key] || '#88aaff');
    // Negative-phase lobe: shift toward a cool violet-white to read as opposite phase.
    const neg = base.clone().lerp(new THREE.Color('#bcd3ff'), 0.65);

    for (let i = 0; i < N; i++) {
      const x = positions[i * 3] * cloudR;
      const y = positions[i * 3 + 1] * cloudR;
      const z = positions[i * 3 + 2] * cloudR;
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      // Collapse target: a small jittered cluster at the cloud center (a focused
      // luminous "measured" point).
      const j = cloudR * 0.05;
      target[i * 3] = (rng() - 0.5) * j;
      target[i * 3 + 1] = (rng() - 0.5) * j;
      target[i * 3 + 2] = (rng() - 0.5) * j;
      const c = signs[i] >= 0 ? base : neg;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
      sizes[i] = (1.6 + rng() * 1.8) * this.pixelRatio;
      phases[i] = rng() * Math.PI * 2;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geom.setAttribute('targetPosition', new THREE.BufferAttribute(target, 3));
    geom.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));
    geom.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geom.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: 320 },
        uProgress: { value: 0 },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      blending: THREE.AdditiveBlending, // overlapping points sum their light → glow
      depthTest: true,
      depthWrite: false, // critical: don't let translucent points occlude each other
      transparent: true,
    });

    const node = new THREE.Group();
    node.add(new THREE.Points(geom, material));
    return { file, element, orbitalKey, geom, material, node, progress: 0 };
  }

  _clearClouds() {
    for (const c of this.clouds) {
      this.group.remove(c.node);
      c.geom.dispose();
      c.material.dispose();
    }
    this.clouds = [];
    if (this.group) this.group.rotation.set(0, 0, 0);
  }

  _tick() {
    this._raf = requestAnimationFrame(this._tick);
    if (!this.renderer) return;
    const t = this.clock.getElapsedTime();
    for (const c of this.clouds) {
      // Target collapse = the file's live determinacy (1 when collapsed).
      const f = c.file;
      const det = f.state === 'collapsed' ? 1 : determinacy(f);
      let tgt = Math.max(0, Math.min(1, det));
      // Negative-time "advance": when the quantum engine reports a negative dwell
      // time (à la Steinberg), the cloud collapses slightly ahead of its determinacy
      // — a bounded peak-advance, never unbounded (causal floor preserved).
      const nt = f.quantum && f.quantum.negativeTime;
      if (nt && nt.negative) tgt = Math.min(1, tgt + 0.08 * Math.abs(nt.excitationRatio));
      c.progress += (tgt - c.progress) * 0.06; // smooth ease toward target
      c.material.uniforms.uProgress.value = c.progress;
      c.material.uniforms.uTime.value = t;
      c.node.rotation.y = t * 0.25; // each orbital slowly spins about its own axis
    }
    this.group.rotation.y = t * 0.1;
    this.group.rotation.x = Math.sin(t * 0.06) * 0.12;
    this.renderer.render(this.scene, this.camera);
  }

  _resize() {
    if (!this.renderer) return;
    const w = this.container.clientWidth || 640;
    const h = this.container.clientHeight || 320;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    this._clearClouds();
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
  }
}
