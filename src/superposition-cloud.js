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

import { sampleOrbital, ELEMENT_ORBITAL, ELEMENTS, ELEMENT_COLORS, PHI, createRng, determinacy, fileBlochState } from './generator/index.js';

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
    this.mode = opts.mode || 'orbital'; // 'orbital' | 'bloch'
    this.clouds = [];
    this._threads = []; // entanglement links between paired files
    this._lastFiles = null;
    this._lastSeed = null;
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
    this._lastFiles = files;
    this._lastSeed = seed;
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
      const fork = rng.fork(file.path + '#' + i);
      const cloud = this.mode === 'bloch'
        ? this._buildBloch(file, el, cloudR, fork)
        : this._buildCloud(file, el, orbitalKey, cloudR, fork);
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      cloud.node.position.set(Math.cos(angle) * ring, Math.sin(angle) * ring * 0.6, 0);
      this.group.add(cloud.node);
      this.clouds.push(cloud);
    }
    this._buildThreads();
  }

  // Entanglement threads — interbeing (प्रतीत्यसमुत्पाद) drawn between paired files.
  // Consecutive clouds are linked; the thread brightens as the pair co-collapses.
  _buildThreads() {
    for (let i = 0; i + 1 < this.clouds.length; i += 2) {
      const a = this.clouds[i];
      const b = this.clouds[i + 1];
      const pa = a.node.position;
      const pb = b.node.position;
      const arr = new Float32Array([pa.x, pa.y, pa.z, pb.x, pb.y, pb.z]);
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      const mat = new THREE.LineBasicMaterial({ color: new THREE.Color('#bcd3ff'), transparent: true, opacity: 0.2 });
      const line = new THREE.Line(geom, mat);
      this.group.add(line);
      this._threads.push({ line, geom, mat, a, b });
    }
  }

  // Switch visualization geometry ('orbital' ⇄ 'bloch') and rebuild in place.
  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode === 'bloch' ? 'bloch' : 'orbital';
    if (this._lastFiles) this.setFiles(this._lastFiles, this._lastSeed);
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
    return {
      kind: 'orbital', file, element, orbitalKey, geom, material, node, progress: 0,
      dispose() { geom.dispose(); material.dispose(); },
    };
  }

  // Bloch-sphere widget: three great-circle rings, the |0⟩–|1⟩ axis, a state vector
  // from the centre to the Bloch tip, and a glowing uncertainty cloud at the tip
  // that shrinks as the file collapses (determinacy → 1).
  _buildBloch(file, element, R, rng) {
    const node = new THREE.Group();
    const disposables = [];
    const color = hexToColor(ELEMENT_COLORS[element.key] || '#88aaff');

    const ringMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 });
    disposables.push(ringMat);
    const ringPlanes = [
      (a) => [Math.cos(a) * R, Math.sin(a) * R, 0],
      (a) => [Math.cos(a) * R, 0, Math.sin(a) * R],
      (a) => [0, Math.cos(a) * R, Math.sin(a) * R],
    ];
    for (const plane of ringPlanes) {
      const seg = 64;
      const arr = new Float32Array((seg + 1) * 3);
      for (let k = 0; k <= seg; k++) {
        const [x, y, z] = plane((k / seg) * Math.PI * 2);
        arr[k * 3] = x; arr[k * 3 + 1] = y; arr[k * 3 + 2] = z;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      disposables.push(g);
      node.add(new THREE.Line(g, ringMat));
    }

    // |0⟩–|1⟩ axis (z).
    const axisArr = new Float32Array([0, 0, -R, 0, 0, R]);
    const axisGeom = new THREE.BufferGeometry();
    axisGeom.setAttribute('position', new THREE.BufferAttribute(axisArr, 3));
    disposables.push(axisGeom);
    node.add(new THREE.Line(axisGeom, ringMat));

    // State vector (centre → tip), updated every frame.
    const vecArr = new Float32Array([0, 0, 0, 0, 0, R]);
    const vectorGeom = new THREE.BufferGeometry();
    vectorGeom.setAttribute('position', new THREE.BufferAttribute(vecArr, 3));
    disposables.push(vectorGeom);
    const vectorMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
    disposables.push(vectorMat);
    node.add(new THREE.Line(vectorGeom, vectorMat));

    // Tip + uncertainty cloud (glowing points), carried in a sub-node we move/scale.
    const M = 240;
    const pos = new Float32Array(M * 3);
    const target = new Float32Array(M * 3);
    const colors = new Float32Array(M * 3);
    const sizes = new Float32Array(M);
    const phases = new Float32Array(M);
    const bright = color.clone().lerp(new THREE.Color('#ffffff'), 0.4);
    for (let i = 0; i < M; i++) {
      if (i === 0) { pos[0] = pos[1] = pos[2] = 0; } // the tip itself
      else {
        // uncertainty offsets in a small ball (radius ~0.3R), scaled per-frame
        const u = rng(), v = rng(), w = Math.cbrt(rng()) * 0.3 * R;
        const th = Math.acos(1 - 2 * u), ph = 2 * Math.PI * v;
        pos[i * 3] = w * Math.sin(th) * Math.cos(ph);
        pos[i * 3 + 1] = w * Math.sin(th) * Math.sin(ph);
        pos[i * 3 + 2] = w * Math.cos(th);
      }
      target[i * 3] = pos[i * 3]; target[i * 3 + 1] = pos[i * 3 + 1]; target[i * 3 + 2] = pos[i * 3 + 2];
      const c = i === 0 ? bright : color;
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
      sizes[i] = (i === 0 ? 5 : 1.6 + rng() * 1.4) * this.pixelRatio;
      phases[i] = rng() * Math.PI * 2;
    }
    const tipGeom = new THREE.BufferGeometry();
    tipGeom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    tipGeom.setAttribute('targetPosition', new THREE.BufferAttribute(target, 3)); // = position → progress is inert
    tipGeom.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));
    tipGeom.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    tipGeom.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    disposables.push(tipGeom);
    const tipMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScale: { value: 320 }, uProgress: { value: 0 } },
      vertexShader: VERTEX_SHADER, fragmentShader: FRAGMENT_SHADER,
      blending: THREE.AdditiveBlending, depthTest: true, depthWrite: false, transparent: true,
    });
    disposables.push(tipMat);
    const tipNode = new THREE.Group();
    tipNode.add(new THREE.Points(tipGeom, tipMat));
    node.add(tipNode);

    return {
      kind: 'bloch', file, element, node, tipNode, vectorGeom, material: tipMat, R, progress: 0,
      dispose() { for (const d of disposables) d.dispose(); },
    };
  }

  _clearClouds() {
    for (const c of this.clouds) {
      this.group.remove(c.node);
      if (c.dispose) c.dispose();
    }
    for (const th of this._threads) {
      this.group.remove(th.line);
      th.geom.dispose();
      th.mat.dispose();
    }
    this.clouds = [];
    this._threads = [];
    if (this.group) this.group.rotation.set(0, 0, 0);
  }

  _tick() {
    this._raf = requestAnimationFrame(this._tick);
    if (!this.renderer) return;
    const t = this.clock.getElapsedTime();
    for (const c of this.clouds) {
      const f = c.file;
      const det = f.state === 'collapsed' ? 1 : determinacy(f);
      let tgt = Math.max(0, Math.min(1, det));
      // Negative-time "advance": when the quantum engine reports a negative dwell
      // time (à la Steinberg), collapse runs slightly ahead of determinacy — a
      // bounded peak-advance, never unbounded (causal floor preserved).
      const nt = f.quantum && f.quantum.negativeTime;
      if (nt && nt.negative) tgt = Math.min(1, tgt + 0.08 * Math.abs(nt.excitationRatio));
      c.progress += (tgt - c.progress) * 0.06; // smooth ease toward target
      c.material.uniforms.uTime.value = t;
      if (c.kind === 'bloch') {
        this._tickBloch(c);
      } else {
        c.material.uniforms.uProgress.value = c.progress;
        c.node.rotation.y = t * 0.25; // each orbital slowly spins about its own axis
      }
    }
    // Entanglement threads brighten + pulse as both paired files co-collapse.
    for (const th of this._threads) {
      const co = Math.min(th.a.progress, th.b.progress);
      th.mat.opacity = 0.12 + 0.55 * co * (0.8 + 0.2 * Math.sin(t * 3));
    }
    this.group.rotation.y = t * 0.1;
    this.group.rotation.x = Math.sin(t * 0.06) * 0.12;
    this.renderer.render(this.scene, this.camera);
  }

  _tickBloch(c) {
    const bs = fileBlochState(c.file);
    const tx = bs.vector[0] * c.R, ty = bs.vector[1] * c.R, tz = bs.vector[2] * c.R;
    const arr = c.vectorGeom.attributes.position.array;
    arr[3] = tx; arr[4] = ty; arr[5] = tz; // move the state-vector tip
    c.vectorGeom.attributes.position.needsUpdate = true;
    c.tipNode.position.set(tx, ty, tz);
    const s = 0.12 + 0.88 * bs.dispersion; // uncertainty cloud shrinks toward the tip
    c.tipNode.scale.set(s, s, s);
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
