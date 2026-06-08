// Browser-integration smoke test for the superposition cloud: node test/cloud-integration.js
//
// Real WebGL/shader compilation needs a browser; here we drive SuperpositionField
// against a faithful mock of the Three.js r128 API surface it uses, to verify the
// integration contract: one cloud per file, correct BufferGeometry attributes and
// sizes, additive/transparent/depthWrite:false material, element→orbital mapping,
// and that the collapse progress tracks each file's live determinacy.

import assert from 'node:assert/strict';

// ---- Minimal Three.js r128 mock (only what superposition-cloud.js touches) ----
class MockColor {
  constructor(c) {
    if (typeof c === 'string') {
      const h = c.replace('#', '');
      this.r = parseInt(h.slice(0, 2), 16) / 255;
      this.g = parseInt(h.slice(2, 4), 16) / 255;
      this.b = parseInt(h.slice(4, 6), 16) / 255;
    } else {
      this.r = this.g = this.b = 1;
    }
  }
  clone() {
    const c = new MockColor();
    c.r = this.r; c.g = this.g; c.b = this.b;
    return c;
  }
  lerp(o, a) {
    this.r += (o.r - this.r) * a;
    this.g += (o.g - this.g) * a;
    this.b += (o.b - this.b) * a;
    return this;
  }
}
class MockVec3 { set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } }
class MockBufferAttribute { constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; } }
class MockBufferGeometry {
  constructor() { this.attributes = {}; this.disposed = false; }
  setAttribute(name, attr) { this.attributes[name] = attr; }
  dispose() { this.disposed = true; }
}
class MockShaderMaterial {
  constructor(o) { Object.assign(this, o); this.disposed = false; }
  dispose() { this.disposed = true; }
}
class MockPoints { constructor(geom, mat) { this.geometry = geom; this.material = mat; } }
class MockGroup {
  constructor() { this.children = []; this.position = new MockVec3(); this.rotation = new MockVec3().set(0, 0, 0); }
  add(o) { this.children.push(o); }
  remove(o) { this.children = this.children.filter((c) => c !== o); }
}
class MockScene { add() {} }
class MockCamera { constructor() { this.position = new MockVec3().set(0, 0, 0); } updateProjectionMatrix() {} }
class MockRenderer {
  constructor() { this.domElement = { style: {}, parentNode: null }; }
  setPixelRatio() {}
  setSize() {}
  render() { this.rendered = (this.rendered || 0) + 1; }
  dispose() {}
}
let now = 0;
class MockClock { getElapsedTime() { now += 0.016; return now; } }

globalThis.THREE = {
  Color: MockColor,
  BufferAttribute: MockBufferAttribute,
  BufferGeometry: MockBufferGeometry,
  ShaderMaterial: MockShaderMaterial,
  Points: MockPoints,
  Group: MockGroup,
  Scene: MockScene,
  PerspectiveCamera: MockCamera,
  WebGLRenderer: MockRenderer,
  Clock: MockClock,
  AdditiveBlending: 'ADDITIVE',
};
globalThis.window = { devicePixelRatio: 1, addEventListener() {}, removeEventListener() {} };
globalThis.requestAnimationFrame = () => 1; // do NOT auto-invoke; we tick manually
globalThis.cancelAnimationFrame = () => {};

const container = {
  clientWidth: 800,
  clientHeight: 340,
  appendChild() {},
  classList: { add() {} },
};

// Import AFTER the mock is installed.
const { SuperpositionField } = await import('../src/superposition-cloud.js');
const { ELEMENTS, ELEMENT_ORBITAL, SITE_SPECS } = await import('../src/generator/index.js');

// Build mock files the way the generator does (path/kind/state/debt/missingInfo).
function mockFiles(spec) {
  return spec.files.map((f) => ({ ...f, state: 'superposition', missingInfo: 1000, debt: 1000 }));
}

let passed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (err) { console.error(`  ✗ ${name}`); throw err; }
}

console.log('Cloud-integration check (mock THREE)');

const N = 1200;
const field = new SuperpositionField(container, { pointsPerCloud: N });

check('field initializes with a mock renderer', () => {
  assert.equal(field.available, true);
  assert.ok(field.renderer && field.scene && field.camera);
});

const files = mockFiles(SITE_SPECS['dharma-landing']);
field.setFiles(files, 108);

check('one cloud per file', () => {
  assert.equal(field.clouds.length, files.length);
});

check('each cloud geometry has the expected attributes and sizes', () => {
  for (const c of field.clouds) {
    const a = c.geom.attributes;
    assert.equal(a.position.array.length, N * 3, 'position N*3');
    assert.equal(a.targetPosition.array.length, N * 3, 'targetPosition N*3');
    assert.equal(a.customColor.array.length, N * 3, 'customColor N*3');
    assert.equal(a.aSize.array.length, N, 'aSize N');
    assert.equal(a.aPhase.array.length, N, 'aPhase N');
  }
});

check('material is additive, transparent, depthWrite:false with the 3 uniforms', () => {
  for (const c of field.clouds) {
    assert.equal(c.material.blending, 'ADDITIVE');
    assert.equal(c.material.transparent, true);
    assert.equal(c.material.depthWrite, false);
    for (const u of ['uTime', 'uScale', 'uProgress']) {
      assert.ok(c.material.uniforms[u], `uniform ${u} present`);
    }
  }
});

check('files map to orbitals by the element→orbital table', () => {
  field.clouds.forEach((c, i) => {
    const el = ELEMENTS[i % ELEMENTS.length];
    assert.equal(c.orbitalKey, ELEMENT_ORBITAL[el.key], `file ${i} → ${el.key} orbital`);
  });
});

check('collapse progress tracks live determinacy (superposition → 0)', () => {
  for (let i = 0; i < 60; i++) field._tick();
  // All files still in full superposition (debt == missingInfo) → progress ≈ 0.
  for (const c of field.clouds) assert.ok(c.progress < 0.02, `progress ${c.progress} ≈ 0`);
});

check('collapse progress rises as a file is measured then collapses', () => {
  files[0].debt = files[0].missingInfo * 0.5; // determinacy 0.5
  for (let i = 0; i < 200; i++) field._tick();
  assert.ok(Math.abs(field.clouds[0].progress - 0.5) < 0.05, `progress ${field.clouds[0].progress} ≈ 0.5`);
  files[0].state = 'collapsed';
  for (let i = 0; i < 200; i++) field._tick();
  assert.ok(field.clouds[0].progress > 0.95, `collapsed progress ${field.clouds[0].progress} ≈ 1`);
});

check('rebuild on a new spec disposes old clouds and rebuilds', () => {
  const old = field.clouds.slice();
  const labFiles = mockFiles(SITE_SPECS['quantum-lab']);
  field.setFiles(labFiles, 7);
  assert.equal(field.clouds.length, labFiles.length);
  assert.ok(old.every((c) => c.geom.disposed && c.material.disposed), 'old GPU resources disposed');
});

check('renderer actually drew frames', () => {
  assert.ok(field.renderer.rendered > 0);
});

field.dispose();
console.log(`\nAll ${passed} cloud-integration checks passed ✓`);
