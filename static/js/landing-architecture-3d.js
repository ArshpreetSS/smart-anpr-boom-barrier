/**
 * GateKeeper AI — 3D System Architecture Neural Visualizer
 * Section: "BUILT TO SEE. BUILT TO DECIDE."
 * Interactive 3D DAG network with pulsing photon splines,
 * raycaster node inspection, and real-time latency telemetry.
 */

(function () {
  'use strict';

  const container = document.getElementById('architecture-canvas-container');
  if (!container) return;

  // 1. Scene, Camera, Renderer
  const initW = container.clientWidth || window.innerWidth;
  const initH = container.clientHeight || 540;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    48,
    initW / initH,
    0.1,
    100
  );
  camera.position.set(0, 2.2, 14.5);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(initW, initH);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // 2. Lighting
  const ambLight = new THREE.AmbientLight(0x0f172a, 1.5);
  scene.add(ambLight);

  const ptLight1 = new THREE.PointLight(0x00ff88, 2.5, 25);
  ptLight1.position.set(-4, 4, 4);
  scene.add(ptLight1);

  const ptLight2 = new THREE.PointLight(0x00e5ff, 2.5, 25);
  ptLight2.position.set(4, 2, 4);
  scene.add(ptLight2);

  // 3. Node Definitions
  const NODES_DATA = [
    {
      id: 'vision',
      title: 'Computer Vision',
      role: 'Input Shutter & ROI Isolation',
      latency: '1.2 ms',
      spec: '4K Ultra-HD 60FPS feed, dynamic license plate bounding box tracking & dimension clamping',
      pos: [-6.2, 1.2, 0],
      color: 0x00e5ff
    },
    {
      id: 'cnn',
      title: 'CharacterCNN',
      role: 'Tier-1 Deep Neural OCR',
      latency: '0.85 ms',
      spec: '36-class PyTorch model trained on Charles Wright Indian typography. Batch tensor inference in <1ms',
      pos: [-2.6, 3.2, 1.2],
      color: 0x00ff88
    },
    {
      id: 'easyocr',
      title: 'EasyOCR',
      role: 'Tier-2 Ensemble Engine',
      latency: '24.9 ms',
      spec: 'Multi-angle CRAFT detection & ResNet recognition for dirty, skewed, or double-decker plates',
      pos: [-2.6, -1.0, -1.2],
      color: 0x38bdf8
    },
    {
      id: 'fastapi',
      title: 'FastAPI',
      role: 'Async Core Orchestrator',
      latency: '0.4 ms',
      spec: 'High-concurrency Python ASGI pipeline routing telemetry, rules evaluation, and security checks',
      pos: [0.8, 1.4, 0],
      color: 0x00ff88
    },
    {
      id: 'websockets',
      title: 'WebSockets',
      role: 'Real-Time Frame Streamer',
      latency: '3.1 ms',
      spec: 'Full-duplex frame pump streaming 30-60 FPS live HUD overlay with zero buffer lag',
      pos: [4.4, 3.4, 1.4],
      color: 0x00e5ff
    },
    {
      id: 'verification',
      title: 'Vehicle Verification',
      role: 'RTO & Security Clearance',
      latency: '1.8 ms',
      spec: 'Indian Vahan / RTO gateway lookup with local whitelist, VIP priority, and blacklist evaluation',
      pos: [4.2, -0.8, -1.4],
      color: 0xf59e0b
    },
    {
      id: 'database',
      title: 'Database',
      role: 'Persistent Ledger & Cache',
      latency: '0.2 ms',
      spec: 'SQLite ACID storage with 5-minute cooldown rules, permanent RTO cache, and audit history',
      pos: [7.8, -0.4, -0.8],
      color: 0xa855f7
    },
    {
      id: 'barrier',
      title: 'Smart Barrier',
      role: 'Physical COM4 Hardware Controller',
      latency: '12.0 ms',
      spec: 'RS-232 / USB Serial pulse driver (9600 baud) triggering mechanical servo boom gate lift',
      pos: [8.0, 3.2, 1.0],
      color: 0x00ff88
    }
  ];

  // 4. Edges / Data Conduits (Pairs of Node IDs)
  const EDGES_DATA = [
    ['vision', 'cnn'],
    ['vision', 'easyocr'],
    ['cnn', 'fastapi'],
    ['easyocr', 'fastapi'],
    ['fastapi', 'websockets'],
    ['fastapi', 'verification'],
    ['verification', 'database'],
    ['fastapi', 'database'],
    ['fastapi', 'barrier']
  ];

  const nodesGroup = new THREE.Group();
  const edgesGroup = new THREE.Group();
  const particlesGroup = new THREE.Group();

  const nodeMeshes = {};
  const interactiveObjects = [];

  // Helper to create glowing text sprites
  function makeTextSprite(message, colorHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(7, 12, 22, 0.85)';
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 2;
    ctx.roundRect(4, 4, 376, 88, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px Space Grotesk, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(message, 192, 54);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(2.4, 0.6, 1.0);
    return sprite;
  }

  // Create Nodes
  NODES_DATA.forEach((data) => {
    const nodeObj = new THREE.Group();
    nodeObj.position.set(...data.pos);

    // Core Sphere
    const coreGeo = new THREE.SphereGeometry(0.55, 32, 32);
    const coreMat = new THREE.MeshStandardMaterial({
      color: data.color,
      emissive: data.color,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.8
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.userData = data;
    nodeObj.add(coreMesh);
    interactiveObjects.push(coreMesh);

    // Outer Gyroscope Wireframe Ring
    const ringGeo = new THREE.TorusGeometry(0.85, 0.02, 16, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color: data.color, wireframe: false });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 3;
    nodeObj.add(ringMesh);

    // Floating Node Label Sprite
    const labelSprite = makeTextSprite(data.title, data.color === 0x00ff88 ? '#00ff88' : '#00e5ff');
    labelSprite.position.set(0, 1.1, 0);
    nodeObj.add(labelSprite);

    nodesGroup.add(nodeObj);
    nodeMeshes[data.id] = { group: nodeObj, core: coreMesh, ring: ringMesh, data: data };
  });

  scene.add(nodesGroup);

  // Create Curved Edges & Data Splines
  const splines = [];

  EDGES_DATA.forEach(([srcId, dstId]) => {
    const src = nodeMeshes[srcId].data.pos;
    const dst = nodeMeshes[dstId].data.pos;

    // Curved control point for cyber look
    const midX = (src[0] + dst[0]) / 2;
    const midY = (src[1] + dst[1]) / 2 + 0.4;
    const midZ = (src[2] + dst[2]) / 2;

    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(...src),
      new THREE.Vector3(midX, midY, midZ),
      new THREE.Vector3(...dst)
    );

    splines.push(curve);

    const points = curve.getPoints(36);
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x1e3a5f,
      transparent: true,
      opacity: 0.65,
      linewidth: 1.5
    });
    const line = new THREE.Line(lineGeo, lineMat);
    edgesGroup.add(line);
  });

  scene.add(edgesGroup);

  // Animated Data Particles traversing along the splines
  const NUM_PARTICLES = 28;
  const particleData = [];

  for (let i = 0; i < NUM_PARTICLES; i++) {
    const pGeo = new THREE.SphereGeometry(0.09, 12, 12);
    const pMat = new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? 0x00ff88 : 0x00e5ff
    });
    const pMesh = new THREE.Mesh(pGeo, pMat);
    particlesGroup.add(pMesh);

    particleData.push({
      mesh: pMesh,
      splineIndex: i % splines.length,
      progress: Math.random(),
      speed: 0.22 + Math.random() * 0.18
    });
  }

  scene.add(particlesGroup);

  // 5. Raycaster for Interactive Node Inspection
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2(-999, -999);
  let hoveredNode = null;

  // DOM Elements for Inspector Card
  const inspectorTitle = document.getElementById('arch-inspector-title');
  const inspectorRole = document.getElementById('arch-inspector-role');
  const inspectorLatency = document.getElementById('arch-inspector-latency');
  const inspectorSpec = document.getElementById('arch-inspector-spec');

  function updateInspector(data) {
    if (inspectorTitle) inspectorTitle.textContent = data.title;
    if (inspectorRole) inspectorRole.textContent = data.role;
    if (inspectorLatency) inspectorLatency.textContent = data.latency;
    if (inspectorSpec) inspectorSpec.textContent = data.spec;
  }

  container.addEventListener('mousemove', (e) => {
    const rect = container.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;
  });

  container.addEventListener('click', () => {
    if (hoveredNode) {
      updateInspector(hoveredNode.userData);
      // Pulse shockwave
      hoveredNode.scale.set(1.4, 1.4, 1.4);
    }
  });

  // Select first node by default
  updateInspector(NODES_DATA[0]);

  // Window Resize
  function onResize() {
    if (!container) return;
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || 540;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);
  setTimeout(onResize, 150);

  // 6. Animation Loop with Viewport Visibility Observer
  const clock = new THREE.Clock();
  let isVisible = false;
  let isLoopRunning = false;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      isVisible = entry.isIntersecting;
      if (isVisible && !isLoopRunning) {
        isLoopRunning = true;
        clock.getDelta(); // reset delta so delta isn't huge on resume
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

    // Rotate outer gyroscope rings
    Object.values(nodeMeshes).forEach(({ ring, group }, idx) => {
      ring.rotation.z += 0.015;
      ring.rotation.x += 0.008;
      // Gentle floating bob
      group.position.y += Math.sin(time * 2.0 + idx) * 0.0015;
    });

    // Animate data photon particles traversing splines
    particleData.forEach((p) => {
      p.progress += p.speed * delta;
      if (p.progress > 1.0) {
        p.progress = 0;
        p.splineIndex = (p.splineIndex + 1) % splines.length;
      }
      const curve = splines[p.splineIndex];
      const point = curve.getPointAt(p.progress);
      p.mesh.position.copy(point);
    });

    // Raycast for hover highlights
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(interactiveObjects);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      if (hoveredNode !== hit) {
        if (hoveredNode) hoveredNode.scale.set(1.0, 1.0, 1.0);
        hoveredNode = hit;
        hoveredNode.scale.set(1.25, 1.25, 1.25);
        updateInspector(hit.userData);
      }
    } else {
      if (hoveredNode) {
        hoveredNode.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
        if (hoveredNode.scale.x <= 1.02) hoveredNode = null;
      }
    }

    // Subtle gentle camera sway
    camera.position.x = Math.sin(time * 0.3) * 0.4;
    camera.position.y = 2.2 + Math.cos(time * 0.25) * 0.25;
    camera.lookAt(0.5, 1.4, 0);

    renderer.render(scene, camera);
  }
})();
