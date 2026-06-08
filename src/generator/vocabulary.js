// The corpus the simulator draws on. Distilled from the live page's
// `elementInteractions` data (src/script.js) so generated sites stay on-theme
// and scientifically faithful to the existing visualization. Pure data — no DOM,
// no Node, no side effects.

export const PHI = 1.618; // golden ratio — सुवर्ण अनुपात

export const PALETTE = {
  ink: '#1e293b',
  primary: '#1e40af',
  primaryBright: '#3b82f6',
  gold: '#f59e0b',
  violet: '#7c3aed',
  paper: '#f8fafc',
  mist: '#dbeafe',
};

// Mirror of ELEMENT_COLORS in src/script.js (kept as hex strings for the DOM/UI).
export const ELEMENT_COLORS = {
  earth: '#8B4513',
  water: '#1e40af',
  fire: '#dc2626',
  air: '#0891b2',
  space: '#7c3aed',
};

// The five elements ↔ quantum fields, with the formula, mantra and chakra each
// element carries on the live page.
export const ELEMENTS = [
  {
    key: 'earth', emoji: '🌍', en: 'Earth', sa: 'पृथ्वी (Prithvi)',
    field: 'Higgs Field', formula: 'm = gv/√2', discovery: 'CERN 2012',
    spin: '0 (scalar field)', mantra: 'ॐ पृथ्वी तत्त्वाय नमः', chakra: 'मूलाधार — Root',
    essence: 'gives mass and gravitational stability to all matter',
    realization: 'form arising from emptiness',
  },
  {
    key: 'water', emoji: '💧', en: 'Water', sa: 'आप् (Apas)',
    field: 'Electromagnetic Field', formula: 'F = q(E + v×B)', discovery: 'Maxwell 1860s',
    spin: '1 (vector field)', mantra: 'ॐ आप् तत्त्वाय नमः', chakra: 'स्वाधिष्ठान — Sacral',
    essence: 'binds atoms into molecules and lets chemistry and life flow',
    realization: 'the interbeing of all phenomena',
  },
  {
    key: 'fire', emoji: '🔥', en: 'Fire', sa: 'तेजस् (Tejas)',
    field: 'Strong Nuclear Force', formula: 'E = mc²', discovery: '1970s QCD',
    spin: '1 (gauge field)', mantra: 'ॐ तेजस् तत्त्वाय नमः', chakra: 'मणिपूर — Solar Plexus',
    essence: 'binds quarks into protons and powers the stars',
    realization: 'wisdom-fire burning away delusion',
  },
  {
    key: 'air', emoji: '💨', en: 'Air', sa: 'वायु (Vayu)',
    field: 'Weak Nuclear Force', formula: 'n → p + e⁻ + ν̄ₑ', discovery: '1980s W/Z',
    spin: '1 (gauge field)', mantra: 'ॐ वायु तत्त्वाय नमः', chakra: 'अनाहत — Heart',
    essence: 'governs radioactive decay, movement and change',
    realization: 'the impermanence of all phenomena',
  },
  {
    key: 'space', emoji: '🌌', en: 'Space', sa: 'आकाश (Akasha)',
    field: 'Quantum Vacuum', formula: '⟨0|H|0⟩ = ½ℏω', discovery: 'Casimir 1948',
    spin: '2 (tensor field)', mantra: 'ॐ आकाश तत्त्वाय नमः', chakra: 'विशुद्ध — Throat',
    essence: 'the source of virtual particles — emptiness full of potential',
    realization: 'the spacious, unborn nature of mind',
  },
];

// Buddhist concept ↔ physics principle parallels (from index.html).
export const CONCEPT_PAIRS = [
  { dharma: 'Impermanence (अनित्य)', physics: 'Second Law of Thermodynamics' },
  { dharma: 'Emptiness (शून्यता)', physics: 'Quantum Superposition' },
  { dharma: 'Interdependence (प्रतीत्यसमुत्पाद)', physics: 'Quantum Entanglement' },
  { dharma: 'No-Self (अनात्मन्)', physics: 'Observer Effect' },
];

export const MANTRAS = [
  'ॐ',
  'ॐ मणि पद्मे हूँ',
  'गते गते पारगते पारसंगते बोधि स्वाहा',
  'सर्वे भवन्तु सुखिनः',
  'ॐ तारे तुत्तारे तुरे स्वाहा',
];

// Sentence fragments for the markov-ish phrase assembler.
export const FRAGMENTS = {
  open: [
    'From emptiness (शून्यता) the field condenses into form,',
    'Before measurement every possibility coexists,',
    'In the quantum vacuum all potential sleeps,',
    'As the observer turns toward the wave,',
    'Where dharma meets the field equation,',
    'A null file of negative size waits to be guessed,',
  ],
  bridge: [
    'and what seemed solid reveals itself as vibration.',
    'so the macrocosm mirrors the microcosm.',
    'the boson lends its mass and the world coheres.',
    'interdependence binds each particle to the whole.',
    'the superposition collapses into a single, luminous value.',
    'the entropy debt is paid and meaning crystallizes.',
  ],
  close: [
    'May all beings realize the empty, radiant nature of mind.',
    'Thus the site is woven from nothing and everything.',
    'Form is emptiness; emptiness is form.',
    'The measurement completes, and the field rests.',
    'सर्वं खल्विदं ब्रह्म — all this is indeed Brahman.',
    'यत् पिण्डे तत् ब्रह्माण्डे — as in the body, so in the cosmos.',
  ],
};

// Built-in site specifications: a "site" is a set of null files to guess.
export const SITE_SPECS = {
  'dharma-landing': {
    id: 'dharma-landing',
    title: 'Dharma ⊗ Quantum Fields',
    theme: 'A site bridging the five Buddhist elements with the fundamental quantum fields.',
    files: [
      { path: 'index.html', kind: 'html', intent: 'Landing page: a hero invocation, the five element↔field correspondences, and a call to contemplate.' },
      { path: 'elements.html', kind: 'html', intent: 'A detailed page on each element and its dual quantum field, with formula and mantra.' },
      { path: 'about.html', kind: 'html', intent: 'About page: microcosm/macrocosm and the non-duality of quantum physics and dharma.' },
      { path: 'style.css', kind: 'css', intent: 'A stylesheet in a white-blue cosmic palette with golden-ratio spacing.' },
      { path: 'README.md', kind: 'md', intent: 'A readme describing the generated site and the element/field correspondence table.' },
    ],
  },
  'quantum-lab': {
    id: 'quantum-lab',
    title: 'Shunya Lab — शून्य प्रयोगशाला',
    theme: 'A minimalist research-lab microsite exploring negative-information files and measurement.',
    files: [
      { path: 'index.html', kind: 'html', intent: 'Lab landing: what a null file of negative size is, and how measurement collapses it.' },
      { path: 'theory.html', kind: 'html', intent: 'Theory page: negative quantum conditional entropy and compression-as-prediction.' },
      { path: 'style.css', kind: 'css', intent: 'A clean, high-contrast stylesheet with golden-ratio rhythm.' },
      { path: 'README.md', kind: 'md', intent: 'A readme describing the lab and its measurement loop.' },
    ],
  },
};
