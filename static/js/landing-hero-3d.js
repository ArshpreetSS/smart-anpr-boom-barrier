/**
 * GateKeeper AI — 3D Smart Boom Barrier Hero Scene
 * High-performance Three.js implementation with realistic procedural vehicle,
 * industrial boom barrier, ANPR camera stanchion, volumetric laser scanning,
 * and autonomous access verification loop.
 */

(function () {
  'use strict';

  // Global container check
  const container = document.getElementById('hero-canvas-container');
  if (!container) return;

  // Configuration & State
  const state = {
    carPositionZ: 17,
    carSpeed: 0,
    barrierAngle: 0, // 0 rad = horizontal, ~1.4 rad = up
    targetBarrierAngle: 0,
    phase: 'APPROACH', // APPROACH, STOPPED_SCAN, DETECTED, VERIFIED, AUTHORIZED, PASSING, RESET
    timer: 0,
    activePlate: 'PB 12 AB 1234',
    viewMode: 'orbit', // orbit, gateCam, driverPOV
    mouseX: 0,
    mouseY: 0,
    targetCameraX: 9.5,
    targetCameraY: 4.6,
    targetCameraZ: 12.0,
    isManualOverride: false
  };

  // Plates list for switching
  const AVAILABLE_PLATES = [
    { number: 'PB 12 AB 1234', state: 'Punjab', type: 'HSRP Standard' },
    { number: '22 BH 4567 AA', state: 'Bharat (BH)', type: 'National Series' },
    { number: 'MH 12 AB 1234', state: 'Maharashtra', type: 'HSRP Standard' },
    { number: 'DL 01 C 5678', state: 'Delhi NCT', type: 'EV / Private' },
    { number: 'RJ 14 CV 0002', state: 'Rajasthan', type: 'HSRP Standard' }
  ];

  // 1. Scene, Camera, Renderer
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x030508, 0.038);

  const initW = container.clientWidth || window.innerWidth;
  const initH = container.clientHeight || Math.max(window.innerHeight, 600);

  const camera = new THREE.PerspectiveCamera(
    42,
    initW / initH,
    0.1,
    200
  );
  camera.position.set(9.5, 4.6, 12.0);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(initW, initH);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement);

  // 2. Lighting System
  const ambientLight = new THREE.AmbientLight(0x0d1627, 1.2);
  scene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(0xf8fafc, 1.8);
  mainLight.position.set(12, 18, 14);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.width = 2048;
  mainLight.shadow.mapSize.height = 2048;
  mainLight.shadow.camera.near = 0.5;
  mainLight.shadow.camera.far = 60;
  mainLight.shadow.camera.left = -15;
  mainLight.shadow.camera.right = 15;
  mainLight.shadow.camera.top = 15;
  mainLight.shadow.camera.bottom = -15;
  mainLight.shadow.bias = -0.0005;
  scene.add(mainLight);

  // High-tech Cyan Rim Light
  const cyanRimLight = new THREE.DirectionalLight(0x00e5ff, 1.4);
  cyanRimLight.position.set(-14, 10, -8);
  scene.add(cyanRimLight);

  // Gate Checkpoint Overhead Spotlight
  const gateSpot = new THREE.SpotLight(0x00ff88, 2.0, 18, Math.PI / 4, 0.4, 1);
  gateSpot.position.set(2.8, 6.0, 2.5);
  gateSpot.target.position.set(0, 0, 3.5);
  scene.add(gateSpot);
  scene.add(gateSpot.target);

  // 3. Ground & Checkpoint Environment
  const groundGroup = new THREE.Group();

  // Roadway Surface
  const roadGeo = new THREE.PlaneGeometry(16, 50);
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x070b13,
    roughness: 0.45,
    metalness: 0.15
  });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.receiveShadow = true;
  groundGroup.add(road);

  // Technical Grid Gridlines on Road
  const gridHelper = new THREE.GridHelper(48, 48, 0x00e5ff, 0x111c2e);
  gridHelper.position.y = 0.01;
  groundGroup.add(gridHelper);

  // Yellow Stop Line at Checkpoint
  const stopLineGeo = new THREE.PlaneGeometry(7.0, 0.4);
  const stopLineMat = new THREE.MeshBasicMaterial({
    color: 0xffaa00,
    side: THREE.DoubleSide
  });
  const stopLine = new THREE.Mesh(stopLineGeo, stopLineMat);
  stopLine.rotation.x = -Math.PI / 2;
  stopLine.position.set(-0.5, 0.02, 3.6);
  groundGroup.add(stopLine);

  // Embedded Inductive Loop Outline
  const loopGeo = new THREE.RingGeometry(1.6, 1.75, 4);
  const loopMat = new THREE.MeshBasicMaterial({
    color: 0x00ff88,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.6
  });
  const loopMesh = new THREE.Mesh(loopGeo, loopMat);
  loopMesh.rotation.x = -Math.PI / 2;
  loopMesh.rotation.z = Math.PI / 4;
  loopMesh.position.set(0, 0.025, 4.2);
  groundGroup.add(loopMesh);

  // Concrete Curbs & Security Island
  const curbGeo = new THREE.BoxGeometry(0.8, 0.35, 30);
  const curbMat = new THREE.MeshStandardMaterial({
    color: 0x1a2233,
    roughness: 0.8,
    metalness: 0.2
  });
  const leftCurb = new THREE.Mesh(curbGeo, curbMat);
  leftCurb.position.set(3.4, 0.175, 0);
  leftCurb.receiveShadow = true;
  leftCurb.castShadow = true;
  groundGroup.add(leftCurb);

  const rightCurb = new THREE.Mesh(curbGeo, curbMat);
  rightCurb.position.set(-4.2, 0.175, 0);
  rightCurb.receiveShadow = true;
  rightCurb.castShadow = true;
  groundGroup.add(rightCurb);

  scene.add(groundGroup);

  // 4. Boom Barrier Assembly
  const barrierGroup = new THREE.Group();
  barrierGroup.position.set(2.8, 0, 1.2);

  // Pedestal Base Cabinet
  const cabinetGeo = new THREE.BoxGeometry(0.7, 1.6, 0.7);
  const cabinetMat = new THREE.MeshStandardMaterial({
    color: 0x0e1420,
    metalness: 0.85,
    roughness: 0.25
  });
  const cabinet = new THREE.Mesh(cabinetGeo, cabinetMat);
  cabinet.position.y = 0.8;
  cabinet.castShadow = true;
  cabinet.receiveShadow = true;
  barrierGroup.add(cabinet);

  // Decorative brushed metal accent plate on cabinet
  const plateAccentGeo = new THREE.BoxGeometry(0.72, 0.4, 0.4);
  const plateAccentMat = new THREE.MeshStandardMaterial({
    color: 0x222e44,
    metalness: 0.95,
    roughness: 0.15
  });
  const plateAccent = new THREE.Mesh(plateAccentGeo, plateAccentMat);
  plateAccent.position.y = 0.95;
  barrierGroup.add(plateAccent);

  // Mini Digital Display Screen on Cabinet
  const displayGeo = new THREE.PlaneGeometry(0.35, 0.2);
  const displayMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
  const displayScreen = new THREE.Mesh(displayGeo, displayMat);
  displayScreen.position.set(-0.36, 1.1, 0);
  displayScreen.rotation.y = -Math.PI / 2;
  barrierGroup.add(displayScreen);

  // Traffic Beacon Light Stanchion
  const beaconHeadGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.35, 16);
  const beaconHeadMat = new THREE.MeshStandardMaterial({ color: 0x050810, metalness: 0.9 });
  const beaconHead = new THREE.Mesh(beaconHeadGeo, beaconHeadMat);
  beaconHead.position.set(0, 1.85, 0);
  barrierGroup.add(beaconHead);

  // Red & Green Status LED Lights
  const lightSphereGeo = new THREE.SphereGeometry(0.065, 16, 16);
  const redSignalMat = new THREE.MeshBasicMaterial({ color: 0xff1133 });
  const greenSignalMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });

  const signalLightMesh = new THREE.Mesh(lightSphereGeo, redSignalMat);
  signalLightMesh.position.set(-0.12, 1.85, 0);
  barrierGroup.add(signalLightMesh);

  // Mechanical Pivot Axle
  const pivotGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.45, 24);
  const pivotMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9, roughness: 0.2 });
  const pivotMesh = new THREE.Mesh(pivotGeo, pivotMat);
  pivotMesh.rotation.z = Math.PI / 2;
  pivotMesh.position.set(-0.35, 1.25, 0);
  barrierGroup.add(pivotMesh);

  // Barrier Arm Pivot Container (rotates around Z-axis)
  const armPivot = new THREE.Group();
  armPivot.position.set(-0.35, 1.25, 0);

  // Barrier Arm Tube (Length ~6.2m spanning across the lane)
  const armLength = 6.2;
  const armGeo = new THREE.CylinderGeometry(0.045, 0.045, armLength, 16);
  armGeo.rotateZ(Math.PI / 2);
  armGeo.translate(-armLength / 2, 0, 0);

  const armMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.5,
    roughness: 0.3
  });
  const barrierArm = new THREE.Mesh(armGeo, armMat);
  barrierArm.castShadow = true;
  armPivot.add(barrierArm);

  // Barrier Arm LED Ribbon (glowing indicator strip along the top)
  const ledStripGeo = new THREE.BoxGeometry(armLength, 0.02, 0.02);
  ledStripGeo.translate(-armLength / 2, 0.05, 0);
  const ledStripMat = new THREE.MeshBasicMaterial({ color: 0xff2244 });
  const ledStrip = new THREE.Mesh(ledStripGeo, ledStripMat);
  armPivot.add(ledStrip);

  barrierGroup.add(armPivot);
  scene.add(barrierGroup);

  // 5. ANPR Camera Stanchion & Scanner Rig
  const cameraRig = new THREE.Group();
  cameraRig.position.set(3.2, 0, 4.8);

  // Main Mounting Pole
  const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 3.4, 16);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = 1.7;
  pole.castShadow = true;
  cameraRig.add(pole);

  // Camera Housing Enclosure
  const camHousingGeo = new THREE.BoxGeometry(0.24, 0.22, 0.55);
  const camHousingMat = new THREE.MeshStandardMaterial({ color: 0x0a0f1d, metalness: 0.85, roughness: 0.2 });
  const camHousing = new THREE.Mesh(camHousingGeo, camHousingMat);
  camHousing.position.set(-0.25, 3.2, 0);
  camHousing.rotation.set(-0.35, -0.4, 0); // Aimed down-left at approaching vehicle bumper
  camHousing.castShadow = true;
  cameraRig.add(camHousing);

  // Optical Glass Lens & Aperture
  const lensGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.06, 24);
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0x00e5ff,
    metalness: 0.95,
    roughness: 0.05,
    emissive: 0x0066aa,
    emissiveIntensity: 0.4
  });
  const lens = new THREE.Mesh(lensGeo, lensMat);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 0, 0.28);
  camHousing.add(lens);

  // Scanning Laser Fan / Sheet (projecting from camera to road)
  const laserGeo = new THREE.ConeGeometry(3.5, 5.0, 16, 1, true, -Math.PI / 4, Math.PI / 2);
  laserGeo.rotateX(-Math.PI / 2);
  const laserMat = new THREE.MeshBasicMaterial({
    color: 0x00ff88,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const scanLaser = new THREE.Mesh(laserGeo, laserMat);
  scanLaser.position.set(-0.25, 3.2, 0);
  scanLaser.rotation.set(-0.35, -0.4, 0);
  cameraRig.add(scanLaser);

  scene.add(cameraRig);

  // 6. Realistic Procedural Indian Vehicle (SUV/Sedan)
  const vehicleGroup = new THREE.Group();

  // Main Vehicle Chassis Body
  const carBodyGeo = new THREE.BoxGeometry(2.1, 0.85, 4.6);
  const carBodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x0a0d14, // Obsidian metallic paint
    metalness: 0.85,
    roughness: 0.22,
    clearcoat: 1.0,
    clearcoatRoughness: 0.15
  });
  const carBody = new THREE.Mesh(carBodyGeo, carBodyMat);
  carBody.position.y = 0.75;
  carBody.castShadow = true;
  carBody.receiveShadow = true;
  vehicleGroup.add(carBody);

  // Aerodynamic Cabin / Greenhouse
  const cabinGeo = new THREE.BoxGeometry(1.85, 0.75, 2.6);
  const cabinMat = new THREE.MeshStandardMaterial({
    color: 0x040609,
    metalness: 0.9,
    roughness: 0.1
  });
  const cabin = new THREE.Mesh(cabinGeo, cabinMat);
  cabin.position.set(0, 1.45, -0.2);
  cabin.castShadow = true;
  vehicleGroup.add(cabin);

  // Tinted Windshield Glass
  const glassGeo = new THREE.PlaneGeometry(1.75, 0.8);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e293b,
    metalness: 0.9,
    roughness: 0.1,
    transmission: 0.6,
    transparent: true,
    opacity: 0.85
  });
  const windshield = new THREE.Mesh(glassGeo, glassMat);
  windshield.position.set(0, 1.4, 1.15);
  windshield.rotation.x = -0.55;
  vehicleGroup.add(windshield);

  // Dual Projector LED Headlights
  const headlightGeo = new THREE.BoxGeometry(0.45, 0.12, 0.08);
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  const leftHeadlight = new THREE.Mesh(headlightGeo, headlightMat);
  leftHeadlight.position.set(0.72, 0.78, 2.31);
  vehicleGroup.add(leftHeadlight);

  const rightHeadlight = new THREE.Mesh(headlightGeo, headlightMat);
  rightHeadlight.position.set(-0.72, 0.78, 2.31);
  vehicleGroup.add(rightHeadlight);

  // Projector Light Cones (Volumetric Beams)
  const beamGeo = new THREE.ConeGeometry(1.4, 8.0, 16, 1, true);
  beamGeo.rotateX(Math.PI / 2);
  beamGeo.translate(0, 0, 4.0);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const leftBeam = new THREE.Mesh(beamGeo, beamMat);
  leftBeam.position.set(0.72, 0.78, 2.3);
  vehicleGroup.add(leftBeam);

  const rightBeam = new THREE.Mesh(beamGeo, beamMat);
  rightBeam.position.set(-0.72, 0.78, 2.3);
  vehicleGroup.add(rightBeam);

  // Rear LED Tail Lights
  const taillightMat = new THREE.MeshBasicMaterial({ color: 0xff1122 });
  const leftTail = new THREE.Mesh(headlightGeo, taillightMat);
  leftTail.position.set(0.72, 0.85, -2.31);
  vehicleGroup.add(leftTail);

  const rightTail = new THREE.Mesh(headlightGeo, taillightMat);
  rightTail.position.set(-0.72, 0.85, -2.31);
  vehicleGroup.add(rightTail);

  // 4 Realistic Alloy Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 24);
  wheelGeo.rotateZ(Math.PI / 2);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111115, roughness: 0.8 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.95, roughness: 0.15 });

  const wheels = [];
  const wheelPositions = [
    [0.98, 0.42, 1.45],
    [-0.98, 0.42, 1.45],
    [0.98, 0.42, -1.45],
    [-0.98, 0.42, -1.45]
  ];

  wheelPositions.forEach((pos) => {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(...pos);

    const tire = new THREE.Mesh(wheelGeo, tireMat);
    tire.castShadow = true;
    wheelGroup.add(tire);

    const rimGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.33, 16);
    rimGeo.rotateZ(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    wheelGroup.add(rim);

    vehicleGroup.add(wheelGroup);
    wheels.push(wheelGroup);
  });

  // Front Indian HSRP License Plate on Bumper
  const plateGroup = new THREE.Group();
  plateGroup.position.set(0, 0.52, 2.33);

  // Plate Base
  const plateMeshGeo = new THREE.PlaneGeometry(0.9, 0.22);
  const plateMeshMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.3,
    metalness: 0.1
  });
  const plateMesh = new THREE.Mesh(plateMeshGeo, plateMeshMat);
  plateGroup.add(plateMesh);

  // Blue IND Strip on Left
  const indStripGeo = new THREE.PlaneGeometry(0.12, 0.22);
  const indStripMat = new THREE.MeshBasicMaterial({ color: 0x0044ff });
  const indStrip = new THREE.Mesh(indStripGeo, indStripMat);
  indStrip.position.set(-0.39, 0, 0.001);
  plateGroup.add(indStrip);

  // Plate Dynamic Canvas Texture (for crisp readable registration)
  const plateCanvas = document.createElement('canvas');
  plateCanvas.width = 512;
  plateCanvas.height = 128;
  const plateCtx = plateCanvas.getContext('2d');

  function updatePlateTexture(text) {
    plateCtx.fillStyle = '#ffffff';
    plateCtx.fillRect(0, 0, 512, 128);

    // Blue IND Bar
    plateCtx.fillStyle = '#0044ff';
    plateCtx.fillRect(0, 0, 68, 128);

    // IND text & Chakra symbol
    plateCtx.fillStyle = '#ffffff';
    plateCtx.font = 'bold 24px Inter, sans-serif';
    plateCtx.textAlign = 'center';
    plateCtx.fillText('IND', 34, 100);

    plateCtx.beginPath();
    plateCtx.arc(34, 45, 16, 0, Math.PI * 2);
    plateCtx.strokeStyle = '#ffffff';
    plateCtx.lineWidth = 3;
    plateCtx.stroke();

    // Plate Registration Number in Indian Charles Wright bold font
    plateCtx.fillStyle = '#111827';
    plateCtx.font = '900 58px Space Grotesk, sans-serif';
    plateCtx.letterSpacing = '6px';
    plateCtx.textAlign = 'center';
    plateCtx.fillText(text, 290, 84);

    // Hologram indicator
    plateCtx.fillStyle = '#60a5fa';
    plateCtx.fillRect(76, 12, 18, 18);

    plateTexture.needsUpdate = true;
  }

  const plateTexture = new THREE.CanvasTexture(plateCanvas);
  plateTexture.minFilter = THREE.LinearFilter;
  const plateTextMat = new THREE.MeshBasicMaterial({
    map: plateTexture,
    transparent: true
  });
  const plateTextPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22), plateTextMat);
  plateTextPlane.position.z = 0.002;
  plateGroup.add(plateTextPlane);

  updatePlateTexture(state.activePlate);

  // 3D License Plate Glowing Detection Bounding Box (wireframe HUD in world space)
  const plateBBoxGeo = new THREE.BufferGeometry();
  const boxW = 1.05;
  const boxH = 0.32;
  const boxPts = [
    new THREE.Vector3(-boxW / 2, -boxH / 2, 0),
    new THREE.Vector3(boxW / 2, -boxH / 2, 0),
    new THREE.Vector3(boxW / 2, boxH / 2, 0),
    new THREE.Vector3(-boxW / 2, boxH / 2, 0),
    new THREE.Vector3(-boxW / 2, -boxH / 2, 0)
  ];
  plateBBoxGeo.setFromPoints(boxPts);
  const plateBBoxMat = new THREE.LineBasicMaterial({
    color: 0x00ff88,
    linewidth: 2,
    transparent: true,
    opacity: 0.0
  });
  const plateBBox = new THREE.Line(plateBBoxGeo, plateBBoxMat);
  plateBBox.position.set(0, 0, 0.01);
  plateGroup.add(plateBBox);

  // Scanline traversing across plate
  const scanLineGeo = new THREE.PlaneGeometry(0.04, 0.3);
  const scanLineMat = new THREE.MeshBasicMaterial({
    color: 0x00ff88,
    transparent: true,
    opacity: 0.0
  });
  const scanLineMesh = new THREE.Mesh(scanLineGeo, scanLineMat);
  scanLineMesh.position.set(0, 0, 0.015);
  plateGroup.add(scanLineMesh);

  vehicleGroup.add(plateGroup);

  // Initial vehicle position
  vehicleGroup.position.set(0, 0, state.carPositionZ);
  scene.add(vehicleGroup);

  // 7. HTML Floating Technical HUD Overlay Controller
  const hudPlateText = document.getElementById('hero-hud-plate');
  const hudStatusText = document.getElementById('hero-hud-status');
  const hudConfidenceText = document.getElementById('hero-hud-confidence');
  const hudStageBadge = document.getElementById('hero-hud-stage');
  const hudPlateDisplay = document.getElementById('hero-hud-plate-display');

  function updateHUD(stage, plate, status, confidence, badgeColor) {
    if (hudStageBadge) hudStageBadge.textContent = stage;
    if (hudPlateText) hudPlateText.textContent = plate;
    if (hudStatusText) hudStatusText.textContent = status;
    if (hudConfidenceText) hudConfidenceText.textContent = confidence;
    if (hudPlateDisplay) hudPlateDisplay.textContent = plate;
  }

  // 8. View Mode Presets
  const CAM_PRESETS = {
    orbit: { x: 9.5, y: 4.6, z: 12.0, lookAt: new THREE.Vector3(0, 1.2, 2.0) },
    gateCam: { x: 3.2, y: 3.3, z: 5.0, lookAt: new THREE.Vector3(0, 0.6, 3.6) },
    driverPOV: { x: 0, y: 1.5, z: 1.8, lookAt: new THREE.Vector3(0, 1.2, -6.0) }
  };

  window.setHeroViewMode = function (mode) {
    if (!CAM_PRESETS[mode]) return;
    state.viewMode = mode;
    state.targetCameraX = CAM_PRESETS[mode].x;
    state.targetCameraY = CAM_PRESETS[mode].y;
    state.targetCameraZ = CAM_PRESETS[mode].z;

    // Update active button styling
    document.querySelectorAll('.view-preset-btn').forEach((btn) => {
      btn.classList.toggle('border-emerald-400', btn.dataset.view === mode);
      btn.classList.toggle('text-emerald-400', btn.dataset.view === mode);
    });
  };

  window.triggerHeroGateCycle = function () {
    state.isManualOverride = true;
    state.phase = 'APPROACH';
    state.carPositionZ = 16.0;
    state.timer = 0;
  };

  window.switchHeroPlate = function (index) {
    const p = AVAILABLE_PLATES[index % AVAILABLE_PLATES.length];
    state.activePlate = p.number;
    updatePlateTexture(p.number);
    updateHUD('SCAN READY', p.number, 'INITIALIZING', '—', 'cyan');
  };

  // 9. Mouse Parallax Listeners
  window.addEventListener('mousemove', (e) => {
    const rect = container.getBoundingClientRect();
    if (e.clientY < rect.top || e.clientY > rect.bottom) return;
    state.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    state.mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  // Resize Handler
  function onWindowResize() {
    if (!container) return;
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || Math.max(window.innerHeight, 600);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onWindowResize);
  setTimeout(onWindowResize, 150);

  // 10. Animation Loop & State Machine
  const clock = new THREE.Clock();
  let scanLineOsc = 0;

  function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    state.timer += delta;

    // Rotate wheels when vehicle is moving
    if (Math.abs(state.carSpeed) > 0.001) {
      wheels.forEach((w) => {
        w.children[0].rotation.x += state.carSpeed * 3.5;
      });
    }

    // STATE MACHINE
    switch (state.phase) {
      case 'APPROACH':
        // Move car towards stop line at z = 3.6
        state.targetBarrierAngle = 0; // Arm down
        ledStripMat.color.setHex(0xff2244); // Red
        signalLightMesh.material = redSignalMat;
        plateBBoxMat.opacity = 0.0;
        scanLineMat.opacity = 0.0;
        scanLaser.material.opacity = 0.08 + Math.sin(state.timer * 6) * 0.04;

        updateHUD('RADAR APPROACH', 'DETECTING...', 'EN ROUTE', '—', 'cyan');

        if (state.carPositionZ > 3.7) {
          state.carSpeed = -4.8 * delta;
          state.carPositionZ += state.carSpeed;
        } else {
          state.carPositionZ = 3.6;
          state.carSpeed = 0;
          state.phase = 'STOPPED_SCAN';
          state.timer = 0;
        }
        break;

      case 'STOPPED_SCAN':
        // Camera laser locks onto plate
        state.carSpeed = 0;
        scanLaser.material.opacity = 0.28 + Math.sin(state.timer * 10) * 0.1;
        plateBBoxMat.opacity = Math.min(state.timer * 2.0, 0.9);

        // Scanline traverses plate horizontally
        scanLineMat.opacity = 0.9;
        scanLineOsc = Math.sin(state.timer * 7) * 0.42;
        scanLineMesh.position.x = scanLineOsc;

        updateHUD('AI OPTICAL SCAN', 'READING HSRP', 'SCANNING...', '84.2%', 'cyan');

        if (state.timer > 1.2) {
          state.phase = 'DETECTED';
          state.timer = 0;
        }
        break;

      case 'DETECTED':
        // Plate recognized
        scanLaser.material.opacity = 0.15;
        plateBBoxMat.color.setHex(0x00e5ff); // Cyan box
        scanLineMat.opacity = 0.4;

        updateHUD('PLATE IDENTIFIED', state.activePlate, 'OCR INFERENCE', '98.7%', 'cyan');

        if (state.timer > 1.0) {
          state.phase = 'AUTHORIZED';
          state.timer = 0;
        }
        break;

      case 'AUTHORIZED':
        // Gate opens: emerald green
        plateBBoxMat.color.setHex(0x00ff88);
        plateBBoxMat.opacity = 0.95;
        scanLineMat.opacity = 0;
        ledStripMat.color.setHex(0x00ff88); // Green barrier arm
        signalLightMesh.material = greenSignalMat;

        state.targetBarrierAngle = 1.38; // ~80 degrees up

        updateHUD('ACCESS GRANTED', state.activePlate, 'AUTHORIZED', '99.4%', 'emerald');

        // Once barrier arm is sufficiently raised, vehicle proceeds
        if (state.barrierAngle > 1.1 && state.timer > 0.8) {
          state.phase = 'PASSING';
          state.timer = 0;
        }
        break;

      case 'PASSING':
        // Vehicle drives forward through the checkpoint
        state.carSpeed = -6.2 * delta;
        state.carPositionZ += state.carSpeed;
        plateBBoxMat.opacity = Math.max(0, 0.9 - state.timer);

        updateHUD('GATE CLEARED', state.activePlate, 'PASSING GATE', 'SESSION OPEN', 'emerald');

        if (state.carPositionZ < -14.0) {
          state.phase = 'RESET';
          state.timer = 0;
        }
        break;

      case 'RESET':
        // Arm lowers back down, car resets position
        state.targetBarrierAngle = 0;
        state.carSpeed = 0;

        if (state.timer > 1.2) {
          state.carPositionZ = 18.0;
          // Alternate plate automatically for continuous showcase
          const currentIdx = AVAILABLE_PLATES.findIndex((p) => p.number === state.activePlate);
          const nextIdx = (currentIdx + 1) % AVAILABLE_PLATES.length;
          state.activePlate = AVAILABLE_PLATES[nextIdx].number;
          updatePlateTexture(state.activePlate);

          state.phase = 'APPROACH';
          state.timer = 0;
        }
        break;
    }

    // Smooth barrier arm lifting with spring/damping
    state.barrierAngle += (state.targetBarrierAngle - state.barrierAngle) * 0.08;
    armPivot.rotation.z = -state.barrierAngle;

    // Apply vehicle position
    vehicleGroup.position.z = state.carPositionZ;

    // Smooth Camera Movement (Parallax + Presets)
    let lookTarget = CAM_PRESETS.orbit.lookAt;

    if (state.viewMode === 'orbit') {
      const px = state.mouseX * 1.8;
      const py = state.mouseY * 1.2;
      camera.position.x += (state.targetCameraX + px - camera.position.x) * 0.05;
      camera.position.y += (state.targetCameraY + py - camera.position.y) * 0.05;
      camera.position.z += (state.targetCameraZ - camera.position.z) * 0.05;
      lookTarget = new THREE.Vector3(0, 1.2, 2.5);
    } else if (state.viewMode === 'gateCam') {
      camera.position.set(3.2, 3.1, 4.6);
      lookTarget = new THREE.Vector3(
        vehicleGroup.position.x,
        0.6,
        Math.min(vehicleGroup.position.z, 5.0)
      );
    } else if (state.viewMode === 'driverPOV') {
      camera.position.set(0, 1.45, vehicleGroup.position.z - 0.2);
      lookTarget = new THREE.Vector3(0, 1.2, vehicleGroup.position.z - 10);
    }

    camera.lookAt(lookTarget);

    renderer.render(scene, camera);
  }

  animate();
})();
