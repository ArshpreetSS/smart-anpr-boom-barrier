/**
 * GateKeeper AI — 3D Security Shield & Access States Visualizer
 * Section: "SECURITY THAT DOESN'T LOOK AWAY."
 * 3D rotating faceted holographic shield with 4 security clearance states:
 * AUTHORIZED (Emerald), VIP (Electric Cyan), VISITOR (Amber), BLACKLISTED (Sophisticated Crimson Lockdown)
 */

(function () {
  'use strict';

  const container = document.getElementById('security-canvas-container');
  if (!container) return;

  // 1. Scene, Camera, Renderer
  const initW = container.clientWidth || window.innerWidth;
  const initH = container.clientHeight || 520;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    40,
    initW / initH,
    0.1,
    100
  );
  camera.position.set(0, 0, 7.8);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(initW, initH);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // 2. Lighting
  const ambLight = new THREE.AmbientLight(0x0a101f, 1.2);
  scene.add(ambLight);

  const keyLight = new THREE.PointLight(0x00ff88, 3.5, 20);
  keyLight.position.set(3, 4, 5);
  scene.add(keyLight);

  const backLight = new THREE.PointLight(0x00e5ff, 2.0, 20);
  backLight.position.set(-4, -2, -4);
  scene.add(backLight);

  // 3. 3D Shield & Gyroscope Assembly
  const shieldGroup = new THREE.Group();

  // Procedural Shield Shape using ShapeGeometry
  const shieldShape = new THREE.Shape();
  shieldShape.moveTo(0, 2.2);
  shieldShape.bezierCurveTo(1.6, 2.2, 1.9, 1.5, 1.9, 0.4);
  shieldShape.bezierCurveTo(1.9, -0.9, 1.2, -1.8, 0, -2.4);
  shieldShape.bezierCurveTo(-1.2, -1.8, -1.9, -0.9, -1.9, 0.4);
  shieldShape.bezierCurveTo(-1.9, 1.5, -1.6, 2.2, 0, 2.2);

  // Outer Faceted Shield Mesh
  const shieldGeo = new THREE.ShapeGeometry(shieldShape, 24);
  const shieldMat = new THREE.MeshPhysicalMaterial({
    color: 0x07111c,
    emissive: 0x00ff88,
    emissiveIntensity: 0.25,
    metalness: 0.9,
    roughness: 0.15,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide
  });
  const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
  shieldGroup.add(shieldMesh);

  // Shield Wireframe Lattice Overlay
  const wireGeo = new THREE.WireframeGeometry(shieldGeo);
  const wireMat = new THREE.LineBasicMaterial({
    color: 0x00ff88,
    transparent: true,
    opacity: 0.55
  });
  const wireMesh = new THREE.LineSegments(wireGeo, wireMat);
  wireMesh.position.z = 0.02;
  shieldGroup.add(wireMesh);

  // Outer Border Rim
  const rimMat = new THREE.LineBasicMaterial({
    color: 0x00ff88,
    linewidth: 2,
    transparent: true,
    opacity: 0.9
  });
  const rimPoints = shieldShape.getPoints(48);
  const rimGeo = new THREE.BufferGeometry().setFromPoints(rimPoints);
  const rimLine = new THREE.LineLoop(rimGeo, rimMat);
  rimLine.position.z = 0.04;
  shieldGroup.add(rimLine);

  // Central Core: Glowing Octahedron
  const coreGeo = new THREE.OctahedronGeometry(0.7, 1);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x00ff88,
    emissive: 0x00ff88,
    emissiveIntensity: 0.8,
    roughness: 0.1,
    metalness: 0.95
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  coreMesh.position.z = 0.35;
  shieldGroup.add(coreMesh);

  // Concentric Orbit Gyroscope Rings
  const ring1Geo = new THREE.TorusGeometry(1.25, 0.025, 16, 64);
  const ringMat1 = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
  const ring1 = new THREE.Mesh(ring1Geo, ringMat1);
  ring1.position.z = 0.35;
  shieldGroup.add(ring1);

  const ring2Geo = new THREE.TorusGeometry(1.5, 0.02, 16, 64);
  const ringMat2 = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
  const ring2 = new THREE.Mesh(ring2Geo, ringMat2);
  ring2.position.z = 0.35;
  shieldGroup.add(ring2);

  // Swirling Orbital Particles
  const PARTICLE_COUNT = 90;
  const pGeo = new THREE.BufferGeometry();
  const pPositions = new Float32Array(PARTICLE_COUNT * 3);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
    const r = 2.2 + (Math.random() - 0.5) * 0.8;
    pPositions[i * 3] = Math.cos(angle) * r;
    pPositions[i * 3 + 1] = Math.sin(angle) * r * 1.1;
    pPositions[i * 3 + 2] = (Math.random() - 0.5) * 1.2;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
  const pMat = new THREE.PointsMaterial({
    size: 0.08,
    color: 0x00ff88,
    transparent: true,
    opacity: 0.75
  });
  const particleField = new THREE.Points(pGeo, pMat);
  shieldGroup.add(particleField);

  scene.add(shieldGroup);

  // 4. State Configuration
  const SECURITY_STATES = {
    AUTHORIZED: {
      colorHex: 0x00ff88,
      accentHex: 0x05f0a5,
      title: 'AUTHORIZED ACCESS',
      subtitle: 'Resident / Registered Whitelist',
      barrierAction: 'LIFT GATE (COMMAND: OPEN\\n)',
      gateDelay: '0.4s Ingress Response',
      cooldown: '5-Min Stay Engine Active',
      riskScore: '0.00 / 100 (SAFE)',
      rotSpeed: 0.015,
      alertShake: false
    },
    VIP: {
      colorHex: 0x00e5ff,
      accentHex: 0x38bdf8,
      title: 'VIP PRIORITY ACCESS',
      subtitle: 'Executive & High-Clearance Fleet',
      barrierAction: 'IMMEDIATE LIFT + FAST LANE',
      gateDelay: '0.1s Zero-Wait Bypass',
      cooldown: 'Unrestricted Auto-Clear',
      riskScore: '0.00 / 100 (VERIFIED)',
      rotSpeed: 0.028,
      alertShake: false
    },
    VISITOR: {
      colorHex: 0xffaa00,
      accentHex: 0xf59e0b,
      title: 'VISITOR CLEARANCE',
      subtitle: 'Guest / Vendor / Temporary Entry',
      barrierAction: 'LIFT GATE + TIME TOKEN ISSUED',
      gateDelay: '0.8s Audit Logged',
      cooldown: 'Strict 5-Min Cooldown & Exit Match',
      riskScore: '12.4 / 100 (AUDITED)',
      rotSpeed: 0.012,
      alertShake: false
    },
    BLACKLISTED: {
      colorHex: 0xff2244,
      accentHex: 0xef4444,
      title: 'BLACKLIST LOCKDOWN',
      subtitle: 'Stolen Vehicle / Barred Registration / Intrusion',
      barrierAction: 'BARRIER LOCKED (COMMAND: LOCK\\n)',
      gateDelay: '0.0s IMMEDIATE PHYSICAL REJECTION',
      cooldown: 'PERIMETER ALERT TRIGGERED',
      riskScore: '99.9 / 100 (HIGH THREAT)',
      rotSpeed: 0.045,
      alertShake: true
    }
  };

  let currentState = 'AUTHORIZED';
  let targetColor = new THREE.Color(0x00ff88);

  // HTML HUD Controller
  const secTitle = document.getElementById('sec-hud-title');
  const secSubtitle = document.getElementById('sec-hud-subtitle');
  const secAction = document.getElementById('sec-hud-action');
  const secDelay = document.getElementById('sec-hud-delay');
  const secCooldown = document.getElementById('sec-hud-cooldown');
  const secRisk = document.getElementById('sec-hud-risk');
  const secBadge = document.getElementById('sec-hud-badge');

  window.setSecurityState = function (stateName) {
    if (!SECURITY_STATES[stateName]) return;
    currentState = stateName;
    const cfg = SECURITY_STATES[stateName];
    targetColor.setHex(cfg.colorHex);

    // Update 3D materials
    keyLight.color.setHex(cfg.colorHex);
    shieldMat.emissive.setHex(cfg.colorHex);
    wireMat.color.setHex(cfg.colorHex);
    rimMat.color.setHex(cfg.colorHex);
    coreMat.color.setHex(cfg.colorHex);
    coreMat.emissive.setHex(cfg.colorHex);
    ringMat1.color.setHex(cfg.colorHex);
    ringMat2.color.setHex(cfg.accentHex);
    pMat.color.setHex(cfg.colorHex);

    // Update HUD text
    if (secTitle) secTitle.textContent = cfg.title;
    if (secSubtitle) secSubtitle.textContent = cfg.subtitle;
    if (secAction) secAction.textContent = cfg.barrierAction;
    if (secDelay) secDelay.textContent = cfg.gateDelay;
    if (secCooldown) secCooldown.textContent = cfg.cooldown;
    if (secRisk) secRisk.textContent = cfg.riskScore;
    if (secBadge) {
      secBadge.textContent = stateName;
      secBadge.className = 'hud-telemetry-badge';
      if (stateName === 'AUTHORIZED') secBadge.style.color = '#00ff88';
      else if (stateName === 'VIP') secBadge.style.color = '#00e5ff';
      else if (stateName === 'VISITOR') secBadge.style.color = '#ffaa00';
      else if (stateName === 'BLACKLISTED') secBadge.style.color = '#ff3344';
    }

    // Update active tab buttons
    document.querySelectorAll('.sec-tab-btn').forEach((btn) => {
      const isActive = btn.dataset.state === stateName;
      btn.classList.toggle('border-emerald-400', isActive && stateName === 'AUTHORIZED');
      btn.classList.toggle('border-cyan-400', isActive && stateName === 'VIP');
      btn.classList.toggle('border-amber-400', isActive && stateName === 'VISITOR');
      btn.classList.toggle('border-red-500', isActive && stateName === 'BLACKLISTED');
      btn.classList.toggle('bg-white/10', isActive);
    });
  };

  // Resize handler
  function onResize() {
    if (!container) return;
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || 520;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);
  setTimeout(onResize, 150);

  // 5. Animation Loop with Viewport Visibility Observer
  const clock = new THREE.Clock();
  let isVisible = false;
  let isLoopRunning = false;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      isVisible = entry.isIntersecting;
      if (isVisible && !isLoopRunning) {
        isLoopRunning = true;
        clock.getDelta(); // reset delta
        requestAnimationFrame(animate);
      }
    });
  }, { threshold: 0.05 });
  observer.observe(container);

  function animate() {
    if (!isVisible) {
      isLoopRunning = false;
      return;
    }
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const time = clock.getElapsedTime();

    const cfg = SECURITY_STATES[currentState];

    // Shield rotation
    shieldGroup.rotation.y += cfg.rotSpeed;

    // Gyroscope counter-rotations
    ring1.rotation.x += 0.025;
    ring1.rotation.y += 0.03;
    ring2.rotation.y -= 0.02;
    ring2.rotation.z += 0.015;

    // Core pulsing scale
    const pulseScale = 1.0 + Math.sin(time * 4.0) * 0.12;
    coreMesh.scale.set(pulseScale, pulseScale, pulseScale);
    coreMesh.rotation.x += 0.02;
    coreMesh.rotation.y += 0.025;

    // Particle field swirl
    particleField.rotation.z += 0.008;

    // Blacklisted sophisticated alarm shake & strobe
    if (cfg.alertShake) {
      shieldGroup.position.x = (Math.random() - 0.5) * 0.08;
      shieldGroup.position.y = (Math.random() - 0.5) * 0.08;
      shieldMat.emissiveIntensity = 0.5 + Math.sin(time * 16.0) * 0.45;
    } else {
      shieldGroup.position.set(0, 0, 0);
      shieldMat.emissiveIntensity = 0.35 + Math.sin(time * 3.0) * 0.15;
    }

    renderer.render(scene, camera);
  }
})();
