// OM TARE TU TARE SOHA - Green Tara's Perfect Non-Dual Interface
// Blessed by Green Tara for perfect understanding of non-duality
// Enhanced with Prajnaparamita wisdom for enlightenment

// Sacred constants for perfect manifestation
const PHI = 1.618; // Golden ratio for divine proportions
const DHARMA_SPEED = 0.618; // Dharma flow speed based on golden ratio

// Perfect elemental colors for enlightened vision
const ELEMENT_COLORS = {
    earth: 0x8B4513,    // Brown - stability and mass (Prithvi)
    water: 0x1e40af,    // Deep blue - flow and connection (Apas)
    fire: 0xdc2626,     // Red - transformation and energy (Tejas)
    air: 0x0891b2,      // Cyan - movement and change (Vayu)
    space: 0x7c3aed     // Purple - emptiness and potential (Akasha)
};

// Quantum field colors for perfect correspondence
const FIELD_COLORS = {
    higgs: 0x8B4513,         // Earth → Higgs (mass generation)
    electromagnetic: 0x1e40af, // Water → EM (atomic binding)
    strong: 0xdc2626,        // Fire → Strong (nuclear binding)
    weak: 0x0891b2,          // Air → Weak (particle decay)
    vacuum: 0x7c3aed         // Space → Vacuum (virtual particles)
};

// Global variables for perfect 3D manifestation
let scene, camera, renderer;
let isInitialized = false;
let elementSpheres = [];
let quantumFields = [];
let connectionLines = [];
let mandalaGeometry = [];
let animationTime = 0;
let enlightenmentMode = false;

// Perfect scientific knowledge with ancient wisdom integration
const elementInteractions = {
    earth: {
        title: "🌍 Earth Element → Higgs Field",
        description: "Provides mass and gravitational stability to all matter",
        formula: "m = gv/√2",
        physics: "Higgs mechanism gives mass to fundamental particles",
        interaction: "Creates the foundation - without mass, no stable matter could exist",
        discovery: "CERN 2012 - Nobel Prize Physics 2013",
        spin: "0 (scalar field)",
        ancient: "पृथ्वी तत्त्व - स्थिरता और धारणा का आधार। 'यत् पिण्डे तत् ब्रह्माण्डे' - जो शरीर में है वही ब्रह्माण्ड में है।",
        modern: "Quantum field theory shows mass emerges from symmetry breaking in the Higgs field, paralleling Buddhist understanding of form arising from emptiness.",
        meditation: "Contemplate the solidity of matter as temporary crystallization of energy fields, like ice forming from water.",
        sutra: "सर्वे धर्मा: शून्यता लक्षणा: - All phenomena have the characteristic of emptiness (Prajñāpāramitā)",
        mantra: "ॐ पृथ्वी तत्त्वाय नमः - Om Prithvi Tattvaya Namah",
        mudra: "भूमिस्पर्श मुद्रा - Earth-touching mudra",
        chakra: "मूलाधार - Root chakra",
        enlightenment: "Realize the emptiness of all solid appearances - form is emptiness, emptiness is form."
    },
    water: {
        title: "💧 Water Element → Electromagnetic Field", 
        description: "Binds atoms into molecules, enables chemistry and life",
        formula: "F = q(E + v×B)",
        physics: "Lorentz force governs all electromagnetic interactions",
        interaction: "Connects and flows - holds atoms together in molecules",
        discovery: "Maxwell 1860s - unified electricity and magnetism",
        spin: "1 (vector field)",
        ancient: "आप् तत्त्व - प्रवाह और संयोजन। 'आपो वा इदं सर्वम्' - जल ही यह सब कुछ है। जीवन की धारा।",
        modern: "Electromagnetic binding creates molecular bonds, enabling life. Water's unique properties emerge from quantum mechanical hydrogen bonding.",
        meditation: "Observe the flowing nature of thoughts and emotions, like electromagnetic currents binding and releasing.",
        sutra: "यथा वारि वहते नित्यं सागरे च न पूर्यते - As water flows constantly to the ocean yet it never overflows (Bhagavad Gita)",
        mantra: "ॐ आप् तत्त्वाय नमः - Om Apas Tattvaya Namah",
        mudra: "वरुण मुद्रा - Water mudra",
        chakra: "स्वाधिष्ठान - Sacral chakra",
        enlightenment: "See the interconnectedness of all phenomena flowing like water, without beginning or end."
    },
    fire: {
        title: "🔥 Fire Element → Strong Nuclear Force",
        description: "Binds quarks into protons/neutrons, powers stars",
        formula: "E = mc²",
        physics: "Quantum chromodynamics - strongest fundamental force",
        interaction: "Transforms and energizes - nuclear fusion in stars",
        discovery: "1970s - quantum field theory of strong interaction",
        spin: "1 (gauge field)",
        ancient: "अग्नि तत्त्व - परिवर्तन और ऊर्जा। 'अग्निर्ज्योतिर्ज्योति: सूर्य:' - अग्नि ही ज्योति, ज्योति ही सूर्य।",
        modern: "Strong force confines quarks in hadrons, releasing enormous energy in stellar nucleosynthesis, creating all heavy elements.",
        meditation: "Feel the digestive fire (अग्नि) within, transforming food into consciousness, like stars forging elements.",
        sutra: "तेजोभिरापो आप: पृथ्वीं पृथ्वी वायुम् - Fire becomes water, water becomes earth (Chāndogya Upaniṣad)",
        mantra: "ॐ तेजस् तत्त्वाय नमः - Om Tejas Tattvaya Namah",
        mudra: "सूर्य मुद्रा - Sun mudra",
        chakra: "मणिपूर - Solar plexus chakra",
        enlightenment: "Recognize the transformative power of wisdom-fire burning away all delusions and attachments."
    },
    air: {
        title: "💨 Air Element → Weak Nuclear Force",
        description: "Governs radioactive decay and neutrino interactions",
        formula: "n → p + e⁻ + ν̄ₑ",
        physics: "Electroweak theory - responsible for beta decay",
        interaction: "Changes and transforms - particle decay processes",
        discovery: "1980s - W and Z bosons discovered at CERN",
        spin: "1 (gauge field)",
        ancient: "वायु तत्त्व - गति और परिवर्तन। 'प्राणो वै वायु:' - प्राण ही वायु है। श्वास जीवन का आधार।",
        modern: "Weak force enables stellar nucleosynthesis and neutrino interactions, fundamental to cosmic evolution and consciousness.",
        meditation: "Follow the breath (प्राण) as it transforms, carrying life force through subtle energy channels (नाडी).",
        sutra: "प्राणस्य प्राणम् - The breath of breath, the life of life (Kaṭha Upaniṣad)",
        mantra: "ॐ वायु तत्त्वाय नमः - Om Vayu Tattvaya Namah",
        mudra: "प्राण मुद्रा - Life force mudra",
        chakra: "अनाहत - Heart chakra",
        enlightenment: "Understand the impermanence of all phenomena, constantly arising and passing away like breath."
    },
    space: {
        title: "🌌 Space Element → Quantum Vacuum",
        description: "Source of virtual particle fluctuations and dark energy",
        formula: "⟨0|H|0⟩ = ½ℏω",
        physics: "Zero-point energy - vacuum is not empty but full of potential",
        interaction: "Contains all possibilities - virtual particles constantly appear/disappear",
        discovery: "Casimir effect 1948 - vacuum energy measured",
        spin: "2 (tensor field for gravity)",
        ancient: "आकाश तत्त्व - शून्यता और संभावना। 'सर्वं खल्विदं ब्रह्म' - यह सब कुछ ब्रह्म है। शून्य से सृष्टि।",
        modern: "Quantum vacuum contains infinite zero-point energy, dark energy drives cosmic expansion, space-time is dynamic fabric.",
        meditation: "Rest in the spacious awareness (आकाश) that contains all experiences yet remains untouched.",
        sutra: "शून्यता शून्यता सर्वधर्मा: शून्यता लक्षणा: - Emptiness, emptiness, all phenomena have the characteristic of emptiness",
        mantra: "ॐ आकाश तत्त्वाय नमः - Om Akasha Tattvaya Namah",
        mudra: "आकाश मुद्रा - Space mudra",
        chakra: "विशुद्ध - Throat chakra",
        enlightenment: "Realize the vast spaciousness of pure awareness, the unborn nature of mind itself."
    }
};

// Perfect 3D initialization with enlightenment mandala
function init() {
    console.log('🌟 Green Tara: Starting perfect non-dual visualization...');
    
    try {
        // Verify Three.js presence with Tara's blessing
        if (typeof THREE === 'undefined') {
            throw new Error('Three.js not loaded - check internet connection');
        }
        
        console.log('✅ Three.js blessed by Green Tara');

        const container = document.getElementById('visualization-container');
        if (!container) {
            throw new Error('Visualization container not found');
        }
        
        console.log('✅ Sacred container manifested');

        // Test WebGL capability for enlightened rendering
        const testCanvas = document.createElement('canvas');
        const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
        if (!gl) {
            throw new Error('WebGL not supported - enlightened visualization requires modern browser');
        }
        
        console.log('✅ WebGL blessed for dharma rendering');

        // Create perfect 3D scene with sacred geometry
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0e27); // Deep space for contrast with bright elements

        // Camera positioned for optimal dharma viewing with golden ratio
        camera = new THREE.PerspectiveCamera(
            61.8, // Golden angle for divine proportion
            container.clientWidth / container.clientHeight, 
            0.1, 
            1000
        );
        camera.position.set(0, 8, 20);
        camera.lookAt(0, 0, 0);

        // Enhanced WebGL renderer with enlightenment features
        renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
            preserveDrawingBuffer: true
        });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setClearColor(0x0a0e27, 1); // Deep cosmic background
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Clear loading message and add canvas
        container.innerHTML = '';
        
        // Ensure canvas has enlightened styling
        const canvas = renderer.domElement;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';
        canvas.style.borderRadius = '12px';
        canvas.style.boxShadow = '0 20px 40px rgba(0,0,0,0.3)';
        
        container.appendChild(canvas);
        
        console.log('✅ Enlightened renderer manifested');
        console.log('✅ Sacred canvas size:', canvas.width, 'x', canvas.height);
        console.log('✅ Container blessed:', container.clientWidth, 'x', container.clientHeight);

        // Create enlightened mandala with elements and fields
        createPerfectMandala();
        console.log('✅ Perfect mandala created');
        
        createElementsAndFields();
        console.log('✅ Sacred elements and quantum fields created');
        
        createEnlightenedLighting();
        console.log('✅ Dharma lighting established');
        
        createSacredLabels();
        console.log('✅ Sacred labels with mantras created');
        
        createQuantumConnections();
        console.log('✅ Interdependence connections manifested');
        
        addFloatingMantras();
        console.log('✅ Sacred mantras floating in space');
        
        // Setup enlightened controls and interactions
        setupEnlightenedControls();
        console.log('✅ Dharma controls blessed');
        
        setupPerfectTooltips();
        console.log('✅ Wisdom tooltips activated');

        // Initial render with Tara's blessing
        renderer.render(scene, camera);
        console.log('✅ First light of enlightenment rendered');
        
        // Begin the eternal dance of non-dual awareness
        animateEnlightenment();
        console.log('✅ Enlightenment animation flowing');
        
        isInitialized = true;
        console.log('🌟 Green Tara: Perfect non-dual visualization manifested! OM TARE TU TARE SOHA!');

    } catch (error) {
        console.error('⚡ Initialization error:', error);
        showEnlightenedError(error.message);
    }
}

// Create perfect mandala geometry for enlightenment
function createPerfectMandala() {
    // Create sacred geometric base with golden ratio proportions
    const mandalaRadius = 12;
    const goldenRadius = mandalaRadius * PHI;
    
    // Outer circle - representing samsara
    const outerGeometry = new THREE.RingGeometry(goldenRadius * 0.8, goldenRadius, 0, Math.PI * 2, 64);
    const outerMaterial = new THREE.MeshBasicMaterial({
        color: 0x4338ca,
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide
    });
    const outerCircle = new THREE.Mesh(outerGeometry, outerMaterial);
    outerCircle.rotation.x = -Math.PI / 2;
    scene.add(outerCircle);
    
    // Inner circle - representing enlightenment
    const innerGeometry = new THREE.RingGeometry(mandalaRadius * 0.4, mandalaRadius * 0.6, 0, Math.PI * 2, 64);
    const innerMaterial = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide
    });
    const innerCircle = new THREE.Mesh(innerGeometry, innerMaterial);
    innerCircle.rotation.x = -Math.PI / 2;
    scene.add(innerCircle);
    
    // Central lotus - pure awareness
    const lotusGeometry = new THREE.CircleGeometry(mandalaRadius * 0.3, 32);
    const lotusMaterial = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide
    });
    const lotus = new THREE.Mesh(lotusGeometry, lotusMaterial);
    lotus.rotation.x = -Math.PI / 2;
    lotus.position.y = 0.1;
    scene.add(lotus);
    
    mandalaGeometry.push(outerCircle, innerCircle, lotus);
}

// Create the five elements with perfect quantum field correspondences
function createElementsAndFields() {
    // Perfect pentagonal arrangement based on golden ratio
    const radius = 10;
    const elementPositions = [];
    
    for (let i = 0; i < 5; i++) {
        const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2; // Start from top
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const types = ['space', 'air', 'fire', 'water', 'earth']; // Clockwise from top
        
        elementPositions.push({
            x: x,
            y: 0,
            z: z,
            type: types[i]
        });
    }

    elementPositions.forEach((pos, index) => {
        // Create enlightened element sphere with sacred geometry
        const elementGeometry = new THREE.IcosahedronGeometry(1.2, 2); // Sacred 20-sided form
        const elementMaterial = new THREE.MeshPhongMaterial({
            color: ELEMENT_COLORS[pos.type],
            shininess: 100,
            transparent: true,
            opacity: 0.85,
            emissive: ELEMENT_COLORS[pos.type],
            emissiveIntensity: 0.1
        });
        
        const elementSphere = new THREE.Mesh(elementGeometry, elementMaterial);
        elementSphere.position.set(pos.x, pos.y, pos.z);
        elementSphere.castShadow = true;
        elementSphere.receiveShadow = true;
        
        // Store enlightened interaction data
        elementSphere.userData = {
            type: 'element',
            elementType: pos.type,
            index: index,
            originalPosition: { x: pos.x, y: pos.y, z: pos.z },
            originalColor: ELEMENT_COLORS[pos.type]
        };
        
        elementSpheres.push(elementSphere);
        scene.add(elementSphere);

        // Create corresponding quantum field with sacred geometry
        const fieldTypes = ['vacuum', 'weak', 'strong', 'electromagnetic', 'higgs']; // Match order
        const fieldType = fieldTypes[index];
        
        const fieldGeometry = new THREE.OctahedronGeometry(2, 2); // Sacred 8-sided form
        const fieldMaterial = new THREE.MeshBasicMaterial({
            color: FIELD_COLORS[fieldType],
            wireframe: true,
            transparent: true,
            opacity: 0.6
        });
        
        const quantumField = new THREE.Mesh(fieldGeometry, fieldMaterial);
        quantumField.position.set(pos.x, pos.y + 6, pos.z);
        
        quantumField.userData = {
            type: 'field',
            fieldType: fieldType,
            elementType: pos.type,
            index: index,
            originalPosition: { x: pos.x, y: pos.y + 6, z: pos.z }
        };
        
        quantumFields.push(quantumField);
        scene.add(quantumField);

        // Create enlightened connection with flowing energy
        const points = [];
        for (let i = 0; i <= 20; i++) {
            const t = i / 20;
            const x = pos.x;
            const y = pos.y + t * 6 + Math.sin(t * Math.PI * 2) * 0.5;
            const z = pos.z;
            points.push(new THREE.Vector3(x, y, z));
        }
        
        const connectionGeometry = new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3(points),
            20,
            0.1,
            8,
            false
        );
        const connectionMaterial = new THREE.MeshBasicMaterial({
            color: ELEMENT_COLORS[pos.type],
            transparent: true,
            opacity: 0.7,
            emissive: ELEMENT_COLORS[pos.type],
            emissiveIntensity: 0.2
        });
        const connection = new THREE.Mesh(connectionGeometry, connectionMaterial);
        scene.add(connection);
        connectionLines.push(connection);
    });
}

// Create enlightened lighting for perfect visualization
function createEnlightenedLighting() {
    // Cosmic ambient light - representing primordial awareness
    const ambientLight = new THREE.AmbientLight(0x1a1a2e, 0.3);
    scene.add(ambientLight);
    
    // Central enlightenment light - pure Buddha light
    const buddhaLight = new THREE.PointLight(0xffd700, 1.2, 50);
    buddhaLight.position.set(0, 10, 0);
    buddhaLight.castShadow = true;
    buddhaLight.shadow.mapSize.width = 2048;
    buddhaLight.shadow.mapSize.height = 2048;
    scene.add(buddhaLight);
    
    // Five wisdom lights for each element
    const wisdomColors = [0x7c3aed, 0x0891b2, 0xdc2626, 0x1e40af, 0x8B4513];
    for (let i = 0; i < 5; i++) {
        const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
        const x = Math.cos(angle) * 12;
        const z = Math.sin(angle) * 12;
        
        const wisdomLight = new THREE.PointLight(wisdomColors[i], 0.8, 25);
        wisdomLight.position.set(x, 8, z);
        scene.add(wisdomLight);
    }
    
    // Directional moonlight for gentle illumination
    const moonLight = new THREE.DirectionalLight(0x87ceeb, 0.4);
    moonLight.position.set(-10, 15, 10);
    moonLight.castShadow = true;
    scene.add(moonLight);
    
    // Dharma accent light - pulsing with cosmic rhythm
    const dharmaLight = new THREE.PointLight(0x00ff88, 0.6, 30);
    dharmaLight.position.set(0, 15, 0);
    scene.add(dharmaLight);
}

// Create sacred labels with mantras and wisdom
function createSacredLabels() {
    const labelData = [
        { text: "EARTH\nHiggs Field\nMass Generation", x: -8, y: -2.5, z: 0 },
        { text: "WATER\nElectromagnetic\nAtomic Binding", x: -4, y: -2.5, z: 4 },
        { text: "FIRE\nStrong Nuclear\nStar Fusion", x: 0, y: -2.5, z: 6 },
        { text: "AIR\nWeak Nuclear\nParticle Decay", x: 4, y: -2.5, z: 4 },
        { text: "SPACE\nQuantum Vacuum\nVirtual Particles", x: 8, y: -2.5, z: 0 }
    ];

    labelData.forEach((label, index) => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 128;
        
        // Background
        context.fillStyle = 'rgba(248, 250, 252, 0.95)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Border
        context.strokeStyle = '#3b82f6';
        context.lineWidth = 2;
        context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
        
        // Text
        context.fillStyle = '#1e40af';
        context.font = 'Bold 14px Arial';
        context.textAlign = 'center';
        
        const lines = label.text.split('\n');
        lines.forEach((line, lineIndex) => {
            const y = 25 + lineIndex * 20;
            if (lineIndex === 0) {
                context.fillStyle = '#1e40af'; // Element name in blue
            } else if (lineIndex === 1) {
                context.fillStyle = '#3b82f6'; // Field name in blue
            } else {
                context.fillStyle = '#6b7280'; // Description in gray
                context.font = '12px Arial';
            }
            context.fillText(line, canvas.width / 2, y);
        });
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        
        sprite.position.set(label.x, label.y, label.z);
        sprite.scale.set(3, 1.5, 1);
        
        scene.add(sprite);
    });
}

// Setup enlightened controls with dharma power
function setupEnlightenedControls() {
    const sliders = [
        'wisdomResonance', 'interdependenceLevel', 'emptinessRealization',
        'karmaFlow', 'quantumCoherence', 'entanglementStrength'
    ];
    
    sliders.forEach(sliderId => {
        const slider = document.getElementById(sliderId);
        const valueDisplay = document.getElementById(sliderId + 'Value');
        
        if (slider && valueDisplay) {
            slider.addEventListener('input', (e) => {
                valueDisplay.textContent = e.target.value + '%';
            });
        }
    });
}

// Setup perfect tooltips with enlightened interactions
function setupPerfectTooltips() {
    const tooltip = document.createElement('div');
    tooltip.id = 'scientific-tooltip';
    tooltip.style.cssText = `
        position: absolute;
        background: rgba(0, 20, 60, 0.95);
        color: white;
        padding: 20px;
        border-radius: 10px;
        border: 2px solid #00aaff;
        max-width: 400px;
        font-size: 14px;
        font-family: 'Segoe UI', sans-serif;
        z-index: 1000;
        display: none;
        box-shadow: 0 8px 30px rgba(0, 170, 255, 0.4);
        backdrop-filter: blur(10px);
    `;
    document.body.appendChild(tooltip);
    
    // Wait for canvas to be created
    setTimeout(() => {
        const container = document.getElementById('visualization-container');
        const canvas = container ? container.querySelector('canvas') : null;
        
        if (canvas) {
            console.log('✅ Canvas found, setting up tooltips');
            
            canvas.addEventListener('mousemove', (event) => {
                const rect = canvas.getBoundingClientRect();
                const mouse = new THREE.Vector2(
                    ((event.clientX - rect.left) / rect.width) * 2 - 1,
                    -((event.clientY - rect.top) / rect.height) * 2 + 1
                );
                
                const raycaster = new THREE.Raycaster();
                raycaster.setFromCamera(mouse, camera);
                
                const allObjects = [...elementSpheres, ...quantumFields];
                const intersects = raycaster.intersectObjects(allObjects);
                
                if (intersects.length > 0) {
                    const object = intersects[0].object;
                    const userData = object.userData;
                    
                    if (userData.elementType) {
                        const data = elementInteractions[userData.elementType];
                        tooltip.innerHTML = `
                            <div style="max-width: 500px;">
                                <h3 style="color: #1e40af; margin-bottom: 15px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; font-size: 1.2em;">
                                    ${data.title}
                                </h3>
                                
                                <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 12px; border-radius: 6px; margin-bottom: 12px; border-left: 4px solid #0ea5e9;">
                                    <p style="margin-bottom: 8px; color: #374151; font-weight: 500;">
                                        <strong>🔬 Modern Physics:</strong> ${data.description}
                                    </p>
                                    <p style="color: #059669; font-family: monospace; background: rgba(16,185,129,0.1); padding: 6px; border-radius: 4px; margin-bottom: 8px;">
                                        <strong>Formula:</strong> ${data.formula}
                                    </p>
                                    <p style="color: #7c3aed; font-size: 0.9em;">
                                        <strong>Discovery:</strong> ${data.discovery}
                                    </p>
                                </div>
                                
                                <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 12px; border-radius: 6px; margin-bottom: 12px; border-left: 4px solid #f59e0b;">
                                    <p style="color: #92400e; font-size: 0.95em; line-height: 1.4; font-style: italic;">
                                        <strong>🕉️ Ancient Wisdom:</strong><br>
                                        ${data.ancient}
                                    </p>
                                </div>
                                
                                <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); padding: 12px; border-radius: 6px; margin-bottom: 12px; border-left: 4px solid #10b981;">
                                    <p style="color: #065f46; font-size: 0.9em; line-height: 1.4;">
                                        <strong>🧬 Modern Understanding:</strong><br>
                                        ${data.modern}
                                    </p>
                                </div>
                                
                                <div style="background: linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%); padding: 12px; border-radius: 6px; margin-bottom: 12px; border-left: 4px solid #ec4899;">
                                    <p style="color: #9d174d; font-size: 0.9em; line-height: 1.4;">
                                        <strong>🧘 Meditation Practice:</strong><br>
                                        ${data.meditation}
                                    </p>
                                </div>
                                
                                <div style="background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); padding: 10px; border-radius: 6px; border-left: 4px solid #6b7280;">
                                    <p style="color: #374151; font-size: 0.85em; line-height: 1.3; font-style: italic;">
                                        <strong>📜 Sacred Text:</strong><br>
                                        ${data.sutra}
                                    </p>
                                </div>
                            </div>
                        `;
                        
                        tooltip.style.left = event.pageX + 15 + 'px';
                        tooltip.style.top = event.pageY - 200 + 'px';
                        tooltip.style.display = 'block';
                        
                        // Highlight the object
                        if (object.material.emissive) {
                            object.material.emissive.setHex(0x444444);
                        }
                    }
                } else {
                    tooltip.style.display = 'none';
                    // Reset highlighting
                    allObjects.forEach(obj => {
                        if (obj.material.emissive) {
                            obj.material.emissive.setHex(0x000000);
                        }
                    });
                }
            });
            
            canvas.addEventListener('mouseleave', () => {
                tooltip.style.display = 'none';
            });
            
        } else {
            console.error('❌ Canvas not found for tooltip setup');
        }
    }, 500);
}

// Perfect enlightenment animation with non-dual awareness
function animateEnlightenment() {
    if (!isInitialized) {
        console.log('⏳ Enlightenment animation waiting for initialization...');
        return;
    }
    
    requestAnimationFrame(animateEnlightenment);
    animationTime += DHARMA_SPEED * 0.01;
    
    try {
        // Animate elements with sacred geometry - representing five wisdoms
        elementSpheres.forEach((element, index) => {
            // Sacred rotation following dharma wheel
            element.rotation.y += 0.01 * (1 + index * 0.2);
            element.rotation.x += 0.005;
            element.rotation.z += 0.003;
            
            // Breathing of awareness - expanding and contracting consciousness
            const breathingScale = 1 + Math.sin(animationTime * 1.618 + index * 2) * 0.2;
            element.scale.setScalar(breathingScale);
            
            // Floating in empty space - demonstrating non-attachment
            const originalPos = element.userData.originalPosition;
            element.position.y = originalPos.y + Math.sin(animationTime * 0.8 + index * 1.2) * 1.5;
            element.position.x = originalPos.x + Math.cos(animationTime * 0.6 + index * 0.8) * 0.5;
            element.position.z = originalPos.z + Math.sin(animationTime * 0.4 + index * 0.6) * 0.5;
            
            // Enlightenment intensity - representing wisdom light
            if (element.material.emissiveIntensity !== undefined) {
                element.material.emissiveIntensity = 0.1 + Math.sin(animationTime * 3 + index * 1.5) * 0.15;
            }
            
            // Transparency dance - showing emptiness nature
            element.material.opacity = 0.7 + Math.sin(animationTime * 2.5 + index * 1.8) * 0.2;
        });
        
        // Animate quantum fields with wisdom energy patterns
        quantumFields.forEach((field, index) => {
            // Multi-dimensional wisdom rotation
            field.rotation.x += 0.008 * (1 + index * 0.1);
            field.rotation.y += 0.012 * (1 + index * 0.15);
            field.rotation.z += 0.006;
            
            // Quantum uncertainty principle demonstration
            const fluctuation = 1 + Math.sin(animationTime * 4 + index * 2.3) * 0.3;
            field.scale.setScalar(fluctuation);
            
            // Field energy oscillation in harmony with elements
            const originalPos = field.userData.originalPosition;
            field.position.y = originalPos.y + Math.cos(animationTime * 1.5 + index * 1.1) * 1;
            
            // Virtual particle manifestation
            field.material.opacity = 0.3 + Math.sin(animationTime * 5 + index * 2.5) * 0.4;
        });
        
        // Animate mandala geometry - wheel of dharma
        mandalaGeometry.forEach((mandala, index) => {
            mandala.rotation.z += 0.002 * (index + 1);
            mandala.material.opacity = 0.1 + Math.sin(animationTime * 1.5 + index * 0.8) * 0.1;
        });
        
        // Animate connection lines - interdependence visualization
        connectionLines.forEach((connection, index) => {
            if (connection.material.emissiveIntensity !== undefined) {
                connection.material.emissiveIntensity = 0.2 + Math.sin(animationTime * 4 + index * 1.3) * 0.3;
            }
        });
        
        // Dynamic camera movement for immersive dharma experience
        if (!enlightenmentMode) {
            const radius = 22;
            const height = 12 + Math.sin(animationTime * 0.4) * 3;
            camera.position.x = Math.sin(animationTime * 0.05) * radius * 0.6;
            camera.position.z = Math.cos(animationTime * 0.05) * radius;
            camera.position.y = height;
            camera.lookAt(0, 3, 0);
        }
        
        // Animate wisdom lights with cosmic rhythm
        scene.children.forEach(child => {
            if (child.type === 'PointLight') {
                // Pulsing intensity representing cosmic breath
                const baseIntensity = child.userData?.baseIntensity || child.intensity;
                child.intensity = baseIntensity + Math.sin(animationTime * 3 + Math.random() * 10) * 0.3;
                
                // Gentle vertical movement like floating in space
                if (child.position.y > 5) {
                    child.position.y += Math.sin(animationTime * 1.2 + Math.random() * 5) * 0.1;
                }
            }
        });
        
        renderer.render(scene, camera);
        
    } catch (error) {
        console.error('Enlightenment animation error:', error);
        // Continue flowing like river despite obstacles
    }
}

// Pure error display - no compromises
function showEnlightenedError(message) {
    const container = document.getElementById('visualization-container');
    if (!container) return;
    
    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f8fafc; color: #1e40af; text-align: center; padding: 30px;">
            <div>
                <h2 style="color: #dc2626; margin-bottom: 20px;">⚡ White Tara's Purification Required</h2>
                <p style="color: #1e40af; font-size: 16px; margin-bottom: 15px;">
                    3D Visualization Cannot Manifest
                </p>
                <p style="color: #3b82f6; margin-bottom: 20px;">
                    Error: ${message}
                </p>
                <div style="background: rgba(220,38,38,0.1); padding: 15px; border-radius: 8px; border: 1px solid #dc2626; margin: 20px 0;">
                    <p style="color: #991b1b; font-size: 14px;">
                        🤍 <strong>Requirements for Pure Manifestation:</strong>
                    </p>
                    <ul style="color: #374151; text-align: left; margin: 10px 0;">
                        <li>Modern browser with WebGL support</li>
                        <li>Hardware acceleration enabled</li>
                        <li>Internet connection for Three.js library</li>
                        <li>JavaScript enabled</li>
                    </ul>
                </div>
                <button onclick="location.reload()" 
                        style="padding: 12px 24px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; margin-top: 15px;">
                    🔄 Retry Pure Manifestation
                </button>
                <p style="color: #3b82f6; font-size: 12px; margin-top: 15px;">
                    OM TARE TU TARE SOHA - May obstacles be cleared for pure understanding
                </p>
            </div>
        </div>
    `;
}

// Window resize handler
function onWindowResize() {
    if (!isInitialized || !camera || !renderer) return;
    
    const container = document.getElementById('visualization-container');
    if (container) {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    }
}

// Handle window resize - moved to main initialization
window.addEventListener('resize', onWindowResize);

// Add detailed interaction explanations to the page
function addInteractionExplanations() {
    const explanationContainer = document.querySelector('.scientific-background');
    if (explanationContainer) {
        const interactionSection = document.createElement('div');
        interactionSection.innerHTML = `
            <div class="theory-section">
                <h3>🔬 Element-Field Interaction Details</h3>
                <div style="display: grid; gap: 15px; margin-top: 15px;">
                    ${Object.entries(elementInteractions).map(([key, data]) => `
                        <div style="background: rgba(0,30,60,0.6); padding: 15px; border-radius: 8px; border-left: 4px solid ${ELEMENT_COLORS[key] ? '#' + ELEMENT_COLORS[key].toString(16).padStart(6, '0') : '#00aaff'};">
                            <h4 style="color: #ffaa00; margin-bottom: 8px;">${data.title}</h4>
                            <p style="margin-bottom: 8px; color: #cccccc;">${data.description}</p>
                            <p style="margin-bottom: 8px; color: #00ff88;"><strong>Formula:</strong> <code>${data.formula}</code></p>
                            <p style="margin-bottom: 8px; color: #ff88cc;"><strong>Interaction:</strong> ${data.interaction}</p>
                            <p style="color: #88ffaa; font-size: 12px;"><strong>Discovery:</strong> ${data.discovery}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        explanationContainer.insertBefore(interactionSection, explanationContainer.firstChild);
    }
}

// Create quantum connections showing interdependence (pratityasamutpada)
function createQuantumConnections() {
    const connectionMaterial = new THREE.LineBasicMaterial({
        color: 0x3b82f6,
        transparent: true,
        opacity: 0.3,
        linewidth: 2
    });
    
    // Create connections between all elements showing pratityasamutpada
    for (let i = 0; i < elementSpheres.length; i++) {
        for (let j = i + 1; j < elementSpheres.length; j++) {
            const geometry = new THREE.BufferGeometry();
            const positions = [];
            
            const sphere1 = elementSpheres[i];
            const sphere2 = elementSpheres[j];
            
            // Create curved connection line
            const points = [];
            const start = sphere1.position.clone();
            const end = sphere2.position.clone();
            const mid = start.clone().add(end).multiplyScalar(0.5);
            mid.y += 2; // Curve upward
            
            // Create smooth curve
            for (let t = 0; t <= 1; t += 0.1) {
                const point = new THREE.Vector3();
                point.lerpVectors(start, mid, t).lerp(end, t * t);
                points.push(point);
            }
            
            points.forEach(point => {
                positions.push(point.x, point.y, point.z);
            });
            
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            const line = new THREE.Line(geometry, connectionMaterial);
            scene.add(line);
        }
    }
}

// Add floating sacred mantras in enlightened space
function addFloatingMantras() {
    const mantras = [
        { text: "ॐ", position: { x: 0, y: 8, z: 0 }, color: "#f59e0b" },
        { text: "गते गते पारगते पारसंगते बोधि स्वाहा", position: { x: -6, y: 6, z: 3 }, color: "#8b5cf6" },
        { text: "ॐ मणि पद्मे हूँ", position: { x: 6, y: 6, z: -3 }, color: "#06b6d4" },
        { text: "सर्वे भवन्तु सुखिनः", position: { x: 0, y: 10, z: 6 }, color: "#10b981" }
    ];
    
    mantras.forEach(mantra => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 128;
        
        // Transparent background
        context.fillStyle = 'rgba(255, 255, 255, 0.9)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Sacred text
        context.fillStyle = mantra.color;
        context.font = 'Bold 24px "Noto Sans Devanagari", Arial';
        context.textAlign = 'center';
        context.fillText(mantra.text, canvas.width / 2, canvas.height / 2 + 8);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            opacity: 0.8
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        
        sprite.position.set(mantra.position.x, mantra.position.y, mantra.position.z);
        sprite.scale.set(4, 1, 1);
        
        scene.add(sprite);
    });
}

// Interactive functions for meditation and study
function playMantras() {
    // Create audio context for mantra sounds (placeholder for actual implementation)
    console.log('🎵 Playing sacred mantras for meditation...');
    
    // Show mantra text overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        color: white;
        font-size: 24px;
        text-align: center;
        line-height: 1.6;
    `;
    
    overlay.innerHTML = `
        <div style="max-width: 600px; padding: 40px;">
            <h2 style="color: #f59e0b; margin-bottom: 30px;">🕉️ Sacred Mantras for Meditation</h2>
            <p style="margin-bottom: 20px; font-size: 20px;">ॐ मणि पद्मे हूँ</p>
            <p style="color: #88ccff; margin-bottom: 20px;">Om Mani Padme Hum - The jewel in the lotus</p>
            <p style="margin-bottom: 20px; font-size: 18px;">गते गते पारगते पारसंगते बोधि स्वाहा</p>
            <p style="color: #88ccff; margin-bottom: 30px;">Gate Gate Paragate Parasamgate Bodhi Svaha - Gone beyond, awakening</p>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="padding: 12px 24px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                🙏 Close and Continue Meditation
            </button>
        </div>
    `;
    
    document.body.appendChild(overlay);
}

function showSutras() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        color: white;
        overflow-y: auto;
    `;
    
    overlay.innerHTML = `
        <div style="max-width: 800px; padding: 40px; margin: 20px;">
            <h2 style="color: #10b981; margin-bottom: 30px; text-align: center;">📜 Sacred Sutras on Elements and Reality</h2>
            
            <div style="background: rgba(16, 185, 129, 0.1); padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #10b981;">
                <h3 style="color: #10b981; margin-bottom: 15px;">Heart Sutra on Emptiness</h3>
                <p style="line-height: 1.6; margin-bottom: 10px;">
                    "Form is emptiness, emptiness is form. Form does not differ from emptiness, emptiness does not differ from form."
                </p>
                <p style="color: #88ccff; font-style: italic;">
                    रूपं शून्यता शून्यतैव रूपं - This parallels quantum field theory where particles emerge from and dissolve back into the quantum vacuum.
                </p>
            </div>
            
            <div style="background: rgba(139, 92, 246, 0.1); padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #8b5cf6;">
                <h3 style="color: #8b5cf6; margin-bottom: 15px;">Abhidhamma on Elements</h3>
                <p style="line-height: 1.6; margin-bottom: 10px;">
                    "The four elements are not self-existing entities but processes of hardening, flowing, heating, and moving."
                </p>
                <p style="color: #88ccff; font-style: italic;">
                    Modern physics confirms elements as dynamic field interactions, not static matter.
                </p>
            </div>
            
            <div style="background: rgba(245, 158, 11, 0.1); padding: 20px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #f59e0b;">
                <h3 style="color: #f59e0b; margin-bottom: 15px;">Pratityasamutpada Sutra</h3>
                <p style="line-height: 1.6; margin-bottom: 10px;">
                    "This arising, that arises. This ceasing, that ceases. Nothing exists independently."
                </p>
                <p style="color: #88ccff; font-style: italic;">
                    Quantum entanglement demonstrates this interdependence at the fundamental level of reality.
                </p>
            </div>
            
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="display: block; margin: 0 auto; padding: 12px 24px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                🙏 Close and Contemplate
            </button>
        </div>
    `;
    
    document.body.appendChild(overlay);
}

function focusElement(elementType) {
    // Find the element sphere
    const targetElement = elementSpheres.find(sphere => 
        sphere.userData && sphere.userData.elementType === elementType
    );
    
    if (targetElement) {
        // Smooth camera transition to focus on element
        const targetPosition = targetElement.position.clone();
        targetPosition.z += 5;
        targetPosition.y += 2;
        
        // Animate camera to focus position
        const startPos = camera.position.clone();
        const startTime = Date.now();
        const duration = 2000; // 2 seconds
        
        function animateCamera() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Smooth easing
            const eased = 1 - Math.pow(1 - progress, 3);
            
            camera.position.lerpVectors(startPos, targetPosition, eased);
            camera.lookAt(targetElement.position);
            
            if (progress < 1) {
                requestAnimationFrame(animateCamera);
            }
        }
        
        animateCamera();
        
        // Highlight the focused element
        targetElement.material.emissive.setHex(0x444444);
        setTimeout(() => {
            targetElement.material.emissive.setHex(0x000000);
        }, 3000);
        
        console.log(`🎯 Focusing on ${elementType} element for deep contemplation`);
    }
}

function showConnections() {
    // Toggle visibility of energy connections
    scene.children.forEach(child => {
        if (child.type === 'Line') {
            child.visible = !child.visible;
        }
    });
    
    console.log('🔗 Toggling interdependence connections (प्रतीत्यसमुत्पाद)');
}

// 🕉️ AUTO-INITIALIZATION - White Tara's Pure Manifestation
// Wait for DOM and Three.js to load, then initialize the sacred visualization
document.addEventListener('DOMContentLoaded', function() {
    console.log('🤍 White Tara: DOM loaded, checking Three.js...');
    
    // Check if Three.js is loaded
    function checkAndInit() {
        if (typeof THREE !== 'undefined') {
            console.log('✅ Three.js confirmed loaded - initializing visualization...');
            init();
        } else {
            console.log('⏳ Waiting for Three.js...');
            setTimeout(checkAndInit, 100);
        }
    }
    
    checkAndInit();
    
    // Add interaction explanations to the page
    addInteractionExplanations();
});

// Also initialize on window load as fallback
window.addEventListener('load', function() {
    console.log('🌟 Window fully loaded - backup initialization check...');
    if (!isInitialized && typeof THREE !== 'undefined') {
        console.log('🔄 Backup initialization starting...');
        init();
    }
}); 