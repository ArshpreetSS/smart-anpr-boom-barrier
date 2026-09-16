/**
 * GateKeeper AI — Master Pinned Scroll-Driven 3D Storytelling Engine
 * 
 * Performance & Fluidity Architecture:
 * - Continuous C1 Catmull-Rom camera crane & dolly spline
 * - High-end Procedural Performance EV (Liquid Titanium Silver Metallic finish)
 * - Anti-glitch HSRP Plate with zero-depth particle occlusion
 * - Calibrated cinematic framing: Act 2 wide surveillance, Act 3 macro plate lock
 * - Single-pass low-latency progress damping (p += (target - p) * 0.12)
 * - Viewport IntersectionObserver to pause rendering when off-screen
 */

(function () {
  'use strict';

  window.addEventListener('DOMContentLoaded', initScrollExperience);

  function initScrollExperience() {
    const scrollContainer = document.getElementById('cinematic-scroll-container');
    const pinnedViewport = document.getElementById('pinned-viewport');
    const canvasContainer = document.getElementById('cinematic-3d-canvas');

    if (!scrollContainer || !pinnedViewport || !canvasContainer) return;

    // Register GSAP plugins
    if (window.gsap && window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
    }

    // Initialize Lenis smooth scroll
    let lenis = null;
    if (typeof window.Lenis !== 'undefined') {
      try {
        lenis = new Lenis({
          duration: 1.0,
          easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          smoothWheel: true,
          syncTouch: false,
          touchMultiplier: 1.2
        });

        lenis.on('scroll', ScrollTrigger.update);

        gsap.ticker.add((time) => {
          lenis.raf(time * 1000);
        });
        gsap.ticker.lagSmoothing(0);
      } catch (e) {
        console.warn('Lenis fallback:', e);
      }
    }

    // =========================================================================
    // 1. THREE.JS SCENE SETUP
    // =========================================================================
    const initW = pinnedViewport.clientWidth || window.innerWidth;
    const initH = pinnedViewport.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030508, 0.032);

    const camera = new THREE.PerspectiveCamera(40, initW / initH, 0.1, 200);

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
    renderer.toneMappingExposure = 1.2;
    canvasContainer.appendChild(renderer.domElement);

    // =========================================================================
    // 2. LIGHTING RIG (Optimized for Metallic Automotive Specular Highlights)
    // =========================================================================
    const ambientLight = new THREE.AmbientLight(0x0e1726, 1.5);
    scene.add(ambientLight);

    const mainKeyLight = new THREE.DirectionalLight(0xf8fafc, 2.2);
    mainKeyLight.position.set(12, 18, 14);
    mainKeyLight.castShadow = true;
    mainKeyLight.shadow.mapSize.width = 2048;
    mainKeyLight.shadow.mapSize.height = 2048;
    mainKeyLight.shadow.bias = -0.0005;
    scene.add(mainKeyLight);

    const cyanRimLight = new THREE.DirectionalLight(0x00e5ff, 1.6);
    cyanRimLight.position.set(-14, 10, -8);
    scene.add(cyanRimLight);

    const gateSpot = new THREE.SpotLight(0x00ff88, 2.6, 26, Math.PI / 4, 0.35, 1);
    gateSpot.position.set(2.8, 6.0, 2.0);
    gateSpot.target.position.set(0, 0, 3.6);
    scene.add(gateSpot);
    scene.add(gateSpot.target);

    // =========================================================================
    // 3. ROADWAY & CHECKPOINT INFRASTRUCTURE
    // =========================================================================
    const roadGeo = new THREE.PlaneGeometry(18, 70);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x070b13,
      roughness: 0.45,
      metalness: 0.15
    });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.receiveShadow = true;
    scene.add(road);

    const gridHelper = new THREE.GridHelper(60, 60, 0x00e5ff, 0x101a2c);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // Stop Line at z = 3.6
    const stopLineGeo = new THREE.PlaneGeometry(7.2, 0.45);
    const stopLineMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, side: THREE.DoubleSide });
    const stopLine = new THREE.Mesh(stopLineGeo, stopLineMat);
    stopLine.rotation.x = -Math.PI / 2;
    stopLine.position.set(-0.5, 0.02, 3.6);
    scene.add(stopLine);

    // Inductive Loop Sensor
    const loopGeo = new THREE.RingGeometry(1.6, 1.75, 4);
    const loopMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, side: THREE.DoubleSide, transparent: true, opacity: 0.65 });
    const loopMesh = new THREE.Mesh(loopGeo, loopMat);
    loopMesh.rotation.x = -Math.PI / 2;
    loopMesh.rotation.z = Math.PI / 4;
    loopMesh.position.set(0, 0.025, 4.2);
    scene.add(loopMesh);

    // Curbs
    const curbGeo = new THREE.BoxGeometry(0.85, 0.35, 36);
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x161f30, roughness: 0.8, metalness: 0.2 });

    const leftCurb = new THREE.Mesh(curbGeo, curbMat);
    leftCurb.position.set(3.5, 0.175, 0);
    scene.add(leftCurb);

    const rightCurb = new THREE.Mesh(curbGeo, curbMat);
    rightCurb.position.set(-4.5, 0.175, 0);
    scene.add(rightCurb);

    // =========================================================================
    // 4. SMART BOOM BARRIER
    // =========================================================================
    const barrierGroup = new THREE.Group();
    barrierGroup.position.set(2.8, 0, 1.2);

    const cabinetGeo = new THREE.BoxGeometry(0.72, 1.65, 0.72);
    const cabinetMat = new THREE.MeshStandardMaterial({ color: 0x0d1422, metalness: 0.85, roughness: 0.25 });
    const cabinet = new THREE.Mesh(cabinetGeo, cabinetMat);
    cabinet.position.y = 0.825;
    cabinet.castShadow = true;
    barrierGroup.add(cabinet);

    const plateAccentGeo = new THREE.BoxGeometry(0.74, 0.45, 0.45);
    const plateAccent = new THREE.Mesh(plateAccentGeo, new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.95 }));
    plateAccent.position.y = 0.98;
    barrierGroup.add(plateAccent);

    // Traffic Signal Beacon (Red -> Green)
    const beaconHeadGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.35, 16);
    const beaconHead = new THREE.Mesh(beaconHeadGeo, new THREE.MeshStandardMaterial({ color: 0x050810, metalness: 0.9 }));
    beaconHead.position.set(0, 1.9, 0);
    barrierGroup.add(beaconHead);

    const signalLightGeo = new THREE.SphereGeometry(0.08, 16, 16);
    const redLightMat = new THREE.MeshBasicMaterial({ color: 0xff1133 });
    const greenLightMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    const signalLightMesh = new THREE.Mesh(signalLightGeo, redLightMat);
    signalLightMesh.position.set(-0.13, 1.9, 0);
    barrierGroup.add(signalLightMesh);

    // Pivot Axle
    const pivotGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.45, 24);
    pivotGeo.rotateZ(Math.PI / 2);
    const pivotMesh = new THREE.Mesh(pivotGeo, new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.95 }));
    pivotMesh.position.set(-0.35, 1.25, 0);
    barrierGroup.add(pivotMesh);

    // Arm Pivot Group
    const armPivot = new THREE.Group();
    armPivot.position.set(-0.35, 1.25, 0);

    const armLength = 6.4;
    const armGeo = new THREE.CylinderGeometry(0.045, 0.045, armLength, 16);
    armGeo.rotateZ(Math.PI / 2);
    armGeo.translate(-armLength / 2, 0, 0);
    const barrierArm = new THREE.Mesh(armGeo, new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.4, roughness: 0.3 }));
    barrierArm.castShadow = true;
    armPivot.add(barrierArm);

    // LED Strip along Arm
    const ledStripGeo = new THREE.BoxGeometry(armLength, 0.02, 0.02);
    ledStripGeo.translate(-armLength / 2, 0.05, 0);
    const ledStripMat = new THREE.MeshBasicMaterial({ color: 0xff2244 });
    const ledStrip = new THREE.Mesh(ledStripGeo, ledStripMat);
    armPivot.add(ledStrip);

    barrierGroup.add(armPivot);
    scene.add(barrierGroup);

    // =========================================================================
    // 5. HIGH-PRECISION ANPR CAMERA STANCHION
    // =========================================================================
    const cameraRig = new THREE.Group();
    cameraRig.position.set(2.8, 0, 1.8);

    const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 3.4, 16);
    const pole = new THREE.Mesh(poleGeo, new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 }));
    pole.position.y = 1.7;
    pole.castShadow = true;
    cameraRig.add(pole);

    const camHousingGeo = new THREE.BoxGeometry(0.24, 0.22, 0.55);
    const camHousing = new THREE.Mesh(camHousingGeo, new THREE.MeshStandardMaterial({ color: 0x0a0f1d, metalness: 0.9 }));
    camHousing.position.set(-0.25, 3.1, 0);
    camHousing.rotation.set(0.38, 0.65, 0);
    cameraRig.add(camHousing);

    const lensGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.06, 24);
    lensGeo.rotateX(Math.PI / 2);
    const lens = new THREE.Mesh(lensGeo, new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x0066aa, emissiveIntensity: 0.5 }));
    lens.position.set(0, 0, 0.28);
    camHousing.add(lens);

    // Laser Sheet Fan projecting onto incoming vehicle
    const laserGeo = new THREE.ConeGeometry(3.2, 5.5, 16, 1, true, -Math.PI / 4, Math.PI / 2);
    laserGeo.rotateX(Math.PI / 2);
    const laserMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const scanLaser = new THREE.Mesh(laserGeo, laserMat);
    scanLaser.position.set(-0.25, 3.1, 0);
    scanLaser.rotation.set(0.38, 0.65, 0);
    cameraRig.add(scanLaser);

    scene.add(cameraRig);

    // =========================================================================
    // 6. PROCEDURAL VEHICLE (CYBER LIQUID TITANIUM METALLIC PERFORMANCE EV)
    // =========================================================================
    const vehicleGroup = new THREE.Group();

    // High-end liquid titanium metallic finish (replaces dark silhouette)
    const carPaintMat = new THREE.MeshPhysicalMaterial({
      color: 0x9fb5c9,          // Cool metallic titanium / platinum silver
      metalness: 0.90,
      roughness: 0.16,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      reflectivity: 0.95
    });

    const darkCarbonMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.55,
      metalness: 0.8
    });

    const glossGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0a101d,
      metalness: 0.95,
      roughness: 0.05,
      transmission: 0.35,
      transparent: true,
      opacity: 0.92,
      clearcoat: 1.0
    });

    // Lower Aerodynamic Chassis & Side Skirts
    const chassisGeo = new THREE.BoxGeometry(2.12, 0.22, 4.6);
    const chassisMesh = new THREE.Mesh(chassisGeo, darkCarbonMat);
    chassisMesh.position.y = 0.42;
    chassisMesh.castShadow = true;
    vehicleGroup.add(chassisMesh);

    // Main Sculpted Body (Liquid Titanium)
    const carBodyGeo = new THREE.BoxGeometry(2.1, 0.65, 4.5);
    const carBody = new THREE.Mesh(carBodyGeo, carPaintMat);
    carBody.position.y = 0.82;
    carBody.castShadow = true;
    vehicleGroup.add(carBody);

    // Sloping Front Hood Panel (aerodynamic wedge towards nose)
    const hoodGeo = new THREE.BoxGeometry(2.06, 0.22, 1.4);
    const hoodMesh = new THREE.Mesh(hoodGeo, carPaintMat);
    hoodMesh.position.set(0, 0.96, -1.55);
    hoodMesh.rotation.x = 0.11;
    vehicleGroup.add(hoodMesh);

    // Front Aerodynamic Bumper Fascia
    const bumperGeo = new THREE.BoxGeometry(2.14, 0.32, 0.4);
    const bumperMesh = new THREE.Mesh(bumperGeo, carPaintMat);
    bumperMesh.position.set(0, 0.52, -2.25);
    vehicleGroup.add(bumperMesh);

    // Carbon Splitter at base of front nose
    const splitterGeo = new THREE.BoxGeometry(2.16, 0.08, 0.45);
    const splitterMesh = new THREE.Mesh(splitterGeo, darkCarbonMat);
    splitterMesh.position.set(0, 0.34, -2.28);
    vehicleGroup.add(splitterMesh);

    // Front Air Intake Grille (Black insert framing the license plate)
    const grilleGeo = new THREE.BoxGeometry(1.5, 0.24, 0.06);
    const grilleMesh = new THREE.Mesh(grilleGeo, new THREE.MeshStandardMaterial({ color: 0x05070c, roughness: 0.85 }));
    grilleMesh.position.set(0, 0.50, -2.43);
    vehicleGroup.add(grilleMesh);

    // Sleek Fastback Cabin (Dark Tinted Panoramic Glasshouse)
    const cabinGeo = new THREE.BoxGeometry(1.82, 0.68, 2.5);
    const cabin = new THREE.Mesh(cabinGeo, glossGlassMat);
    cabin.position.set(0, 1.40, 0.15);
    vehicleGroup.add(cabin);

    // Titanium Roof Frame / Arch
    const roofGeo = new THREE.BoxGeometry(1.72, 0.08, 2.3);
    const roofMesh = new THREE.Mesh(roofGeo, carPaintMat);
    roofMesh.position.set(0, 1.74, 0.15);
    vehicleGroup.add(roofMesh);

    // Front Windshield (sloped forward toward -Z)
    const windshield = new THREE.Mesh(new THREE.PlaneGeometry(1.76, 0.85), glossGlassMat);
    windshield.position.set(0, 1.42, -1.06);
    windshield.rotation.x = 0.62;
    vehicleGroup.add(windshield);

    // Rear Window (sloped fastback toward +Z)
    const rearWindow = new THREE.Mesh(new THREE.PlaneGeometry(1.76, 0.78), glossGlassMat);
    rearWindow.position.set(0, 1.40, 1.36);
    rearWindow.rotation.x = -0.58;
    vehicleGroup.add(rearWindow);

    // Side Mirrors with Cyber Cyan Accent
    const mirrorGeo = new THREE.BoxGeometry(0.24, 0.10, 0.16);
    const leftMirror = new THREE.Mesh(mirrorGeo, carPaintMat);
    leftMirror.position.set(1.15, 1.25, -0.75);
    vehicleGroup.add(leftMirror);

    const rightMirror = new THREE.Mesh(mirrorGeo, carPaintMat);
    rightMirror.position.set(-1.15, 1.25, -0.75);
    vehicleGroup.add(rightMirror);

    // Front Matrix LED Horizon Lightbar & Headlights
    const lightbarGeo = new THREE.BoxGeometry(2.04, 0.06, 0.08);
    const lightbarMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const lightbar = new THREE.Mesh(lightbarGeo, lightbarMat);
    lightbar.position.set(0, 0.86, -2.43);
    vehicleGroup.add(lightbar);

    const headlightGeo = new THREE.BoxGeometry(0.42, 0.14, 0.08);
    const leftHeadlight = new THREE.Mesh(headlightGeo, lightbarMat);
    leftHeadlight.position.set(0.76, 0.78, -2.43);
    vehicleGroup.add(leftHeadlight);

    const rightHeadlight = new THREE.Mesh(headlightGeo, lightbarMat);
    rightHeadlight.position.set(-0.76, 0.78, -2.43);
    vehicleGroup.add(rightHeadlight);

    // Cyan Laser Projector Core inside Headlights
    const lensCoreGeo = new THREE.BoxGeometry(0.18, 0.06, 0.04);
    const lensCoreMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const leftLens = new THREE.Mesh(lensCoreGeo, lensCoreMat);
    leftLens.position.set(0.76, 0.78, -2.46);
    vehicleGroup.add(leftLens);

    const rightLens = new THREE.Mesh(lensCoreGeo, lensCoreMat);
    rightLens.position.set(-0.76, 0.78, -2.46);
    vehicleGroup.add(rightLens);

    // Forward Light Cones (Volumetric Beam)
    const beamGeo = new THREE.ConeGeometry(1.6, 9.0, 16, 1, true);
    beamGeo.rotateX(-Math.PI / 2);
    beamGeo.translate(0, 0, -4.5);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const leftBeam = new THREE.Mesh(beamGeo, beamMat);
    leftBeam.position.set(0.76, 0.78, -2.45);
    vehicleGroup.add(leftBeam);

    const rightBeam = new THREE.Mesh(beamGeo, beamMat);
    rightBeam.position.set(-0.76, 0.78, -2.45);
    vehicleGroup.add(rightBeam);

    // Rear Connected Cyber Red Lightbar
    const rearBarGeo = new THREE.BoxGeometry(2.04, 0.08, 0.08);
    const rearBarMat = new THREE.MeshBasicMaterial({ color: 0xff1133 });
    const rearBar = new THREE.Mesh(rearBarGeo, rearBarMat);
    rearBar.position.set(0, 0.86, 2.29);
    vehicleGroup.add(rearBar);

    // Wheels (Dual-Tone Turbine Alloy Rims with Cyan Calipers)
    const wheels = [];
    const wheelPositions = [
      [1.02, 0.42, -1.45],
      [-1.02, 0.42, -1.45],
      [1.02, 0.42, 1.45],
      [-1.02, 0.42, 1.45]
    ];
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 24);
    wheelGeo.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x12161f, roughness: 0.85 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.15 });
    const innerRimMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 });
    const caliperMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });

    wheelPositions.forEach((pos) => {
      const wGroup = new THREE.Group();
      wGroup.position.set(...pos);

      // Rotating wheel element
      const rotGroup = new THREE.Group();

      const tire = new THREE.Mesh(wheelGeo, tireMat);
      tire.castShadow = true;
      rotGroup.add(tire);

      const rimOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.33, 16).rotateZ(Math.PI / 2), rimMat);
      rotGroup.add(rimOuter);

      const rimInner = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.34, 5).rotateZ(Math.PI / 2), innerRimMat);
      rotGroup.add(rimInner);

      wGroup.add(rotGroup);

      // Stationary Neon Cyan Brake Caliper inside wheel
      const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.08), caliperMat);
      caliper.position.set(pos[0] > 0 ? -0.06 : 0.06, 0.18, 0);
      wGroup.add(caliper);

      vehicleGroup.add(wGroup);
      wheels.push(rotGroup);
    });

    // =========================================================================
    // 7. HIGH-RESOLUTION INDIAN HSRP LICENSE PLATE
    // Mounted facing camera along -Z (local rotation.y = Math.PI)
    // =========================================================================
    const plateGroup = new THREE.Group();
    plateGroup.position.set(0, 0.52, -2.48);
    plateGroup.rotation.y = Math.PI; // Face toward incoming camera

    // High-Resolution 1024x256 Indian HSRP Plate Texture
    const plateCanvas = document.createElement('canvas');
    plateCanvas.width = 1024;
    plateCanvas.height = 256;
    const pctx = plateCanvas.getContext('2d');

    // Plate background with metallic silver-white gradient
    const plateGrad = pctx.createLinearGradient(0, 0, 0, 256);
    plateGrad.addColorStop(0, '#f8fafc');
    plateGrad.addColorStop(0.5, '#ffffff');
    plateGrad.addColorStop(1, '#e2e8f0');
    pctx.fillStyle = plateGrad;
    pctx.fillRect(0, 0, 1024, 256);

    // Embossed black outer border
    pctx.lineWidth = 12;
    pctx.strokeStyle = '#0f172a';
    pctx.strokeRect(8, 8, 1008, 240);

    // Blue IND International Section (Left Strip)
    pctx.fillStyle = '#0047cc';
    pctx.fillRect(14, 14, 136, 228);

    // Ashoka Chakra Hologram Stamp (Chrome Silver)
    pctx.beginPath();
    pctx.arc(82, 80, 36, 0, Math.PI * 2);
    pctx.strokeStyle = '#93c5fd';
    pctx.lineWidth = 5;
    pctx.stroke();

    pctx.beginPath();
    pctx.arc(82, 80, 10, 0, Math.PI * 2);
    pctx.fillStyle = '#93c5fd';
    pctx.fill();

    // 24 Chakra Spokes
    for (let s = 0; s < 12; s++) {
      const angle = (s * Math.PI) / 6;
      pctx.beginPath();
      pctx.moveTo(82 + Math.cos(angle) * 12, 80 + Math.sin(angle) * 12);
      pctx.lineTo(82 + Math.cos(angle) * 34, 80 + Math.sin(angle) * 34);
      pctx.strokeStyle = '#bfdbfe';
      pctx.lineWidth = 2.5;
      pctx.stroke();
    }

    // Bold "IND" Country Identifier
    pctx.fillStyle = '#ffffff';
    pctx.font = '900 48px "Space Grotesk", "Inter", sans-serif';
    pctx.textAlign = 'center';
    pctx.fillText('IND', 82, 185);

    // Micro Laser Etched Serial Code under IND
    pctx.font = '600 14px "JetBrains Mono", monospace';
    pctx.fillStyle = '#93c5fd';
    pctx.fillText('AA20485918', 82, 220);

    // Indian Registration Plate Number
    pctx.fillStyle = '#0a0d14';
    pctx.font = '900 115px "Space Grotesk", "JetBrains Mono", sans-serif';
    pctx.textAlign = 'center';
    pctx.fillText('PB 12 AB 1234', 590, 168);

    // Corner Mounting Screws (Realistic Allen Bolts)
    function drawScrew(x, y) {
      pctx.beginPath();
      pctx.arc(x, y, 9, 0, Math.PI * 2);
      pctx.fillStyle = '#94a3b8';
      pctx.fill();
      pctx.strokeStyle = '#475569';
      pctx.lineWidth = 2;
      pctx.stroke();

      pctx.beginPath();
      pctx.moveTo(x - 5, y);
      pctx.lineTo(x + 5, y);
      pctx.moveTo(x, y - 5);
      pctx.lineTo(x, y + 5);
      pctx.strokeStyle = '#1e293b';
      pctx.lineWidth = 2.5;
      pctx.stroke();
    }
    drawScrew(175, 40);
    drawScrew(985, 40);
    drawScrew(175, 216);
    drawScrew(985, 216);

    const plateTex = new THREE.CanvasTexture(plateCanvas);
    plateTex.minFilter = THREE.LinearFilter;
    plateTex.magFilter = THREE.LinearFilter;
    if (renderer.capabilities && renderer.capabilities.getMaxAnisotropy) {
      plateTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    }

    const plateMat = new THREE.MeshBasicMaterial({
      map: plateTex,
      transparent: true,
      opacity: 1.0
    });
    const plateMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.23), plateMat);
    plateMesh.position.z = 0;
    plateGroup.add(plateMesh);

    // 3D Neon Bounding Box
    const bw = 1.06;
    const bh = 0.34;
    const bGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-bw / 2, -bh / 2, 0),
      new THREE.Vector3(bw / 2, -bh / 2, 0),
      new THREE.Vector3(bw / 2, bh / 2, 0),
      new THREE.Vector3(-bw / 2, bh / 2, 0),
      new THREE.Vector3(-bw / 2, -bh / 2, 0)
    ]);
    const bboxMat = new THREE.LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0 });
    const plateBBox = new THREE.Line(bGeo, bboxMat);
    plateBBox.position.z = 0.008; // In front of plate face
    plateGroup.add(plateBBox);

    // Laser Scanline Sweeper
    const scanLineGeo = new THREE.PlaneGeometry(0.04, 0.32);
    const scanLineMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0 });
    const scanLineMesh = new THREE.Mesh(scanLineGeo, scanLineMat);
    scanLineMesh.position.z = 0.005; // In front of plate face
    plateGroup.add(scanLineMesh);

    vehicleGroup.add(plateGroup);
    vehicleGroup.position.set(0, 0, 26.0);
    scene.add(vehicleGroup);

    // =========================================================================
    // 8. 3D PARTICLE NETWORK & 5 AI NODES (Morph during 54% -> 74%)
    // ANTI-GLITCH FIX: depthWrite: false & visible: false prevent black box artifacts
    // =========================================================================
    function createGlowPointTexture() {
      const pCan = document.createElement('canvas');
      pCan.width = 64;
      pCan.height = 64;
      const ctx = pCan.getContext('2d');
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.25, 'rgba(0, 255, 136, 0.85)');
      grad.addColorStop(0.65, 'rgba(0, 229, 255, 0.30)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(pCan);
    }

    const NUM_PARTICLES = 650;
    const particlePositions = new Float32Array(NUM_PARTICLES * 3);
    const particleInitialPos = [];
    const particleTargetPos = [];

    // 5 Floating AI Nodes positioned between stopped car (z=3.6) and barrier (z=1.2)
    const AI_NODES = [
      { name: 'CAMERA', pos: new THREE.Vector3(-2.6, 2.6, 2.4), color: 0x00e5ff },
      { name: 'COMPUTER VISION', pos: new THREE.Vector3(-1.3, 3.3, 2.2), color: 0x00ff88 },
      { name: 'ANPR', pos: new THREE.Vector3(0.0, 2.8, 2.0), color: 0x00e5ff },
      { name: 'VEHICLE VERIFICATION', pos: new THREE.Vector3(1.3, 3.3, 2.2), color: 0xffaa00 },
      { name: 'GATE CONTROL', pos: new THREE.Vector3(2.6, 2.6, 2.4), color: 0x00ff88 }
    ];

    // Plate world coordinates when stopped at stop line (vehicleGroup.z = 6.08, 6.08 - 2.48 = 3.60)
    for (let i = 0; i < NUM_PARTICLES; i++) {
      const px = (Math.random() - 0.5) * 0.92;
      const py = 0.52 + (Math.random() - 0.5) * 0.23;
      const pz = 3.58;
      particleInitialPos.push(new THREE.Vector3(px, py, pz));

      const node = AI_NODES[i % AI_NODES.length];
      const scatter = 0.38;
      const tx = node.pos.x + (Math.random() - 0.5) * scatter;
      const ty = node.pos.y + (Math.random() - 0.5) * scatter;
      const tz = node.pos.z + (Math.random() - 0.5) * scatter;
      particleTargetPos.push(new THREE.Vector3(tx, ty, tz));

      particlePositions[i * 3] = px;
      particlePositions[i * 3 + 1] = py;
      particlePositions[i * 3 + 2] = pz;
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.12,
      map: createGlowPointTexture(),
      color: 0x00ff88,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false, // CRITICAL FIX: NEVER write depth buffer for transparent particles
      depthTest: true
    });
    const morphParticles = new THREE.Points(particleGeo, particleMat);
    morphParticles.visible = false; // CRITICAL FIX: hidden until Act 4 morph phase
    scene.add(morphParticles);

    // AI Node Holographic Spheres & Gyro Rings
    const nodeMeshesGroup = new THREE.Group();
    const nodeSphereMeshes = [];

    AI_NODES.forEach((node) => {
      const nGroup = new THREE.Group();
      nGroup.position.copy(node.pos);

      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 24, 24),
        new THREE.MeshStandardMaterial({ color: node.color, emissive: node.color, emissiveIntensity: 0.8, metalness: 0.8, roughness: 0.2 })
      );
      nGroup.add(sphere);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.36, 0.015, 12, 32),
        new THREE.MeshBasicMaterial({ color: node.color })
      );
      ring.rotation.x = Math.PI / 3;
      nGroup.add(ring);

      nGroup.scale.set(0, 0, 0);
      nodeMeshesGroup.add(nGroup);
      nodeSphereMeshes.push(nGroup);
    });
    scene.add(nodeMeshesGroup);

    // Curved Data Splines connecting AI nodes
    const splinesGroup = new THREE.Group();
    for (let i = 0; i < AI_NODES.length - 1; i++) {
      const p1 = AI_NODES[i].pos;
      const p2 = AI_NODES[i + 1].pos;
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      mid.y += 0.25;
      const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
      const points = curve.getPoints(24);
      const cGeo = new THREE.BufferGeometry().setFromPoints(points);
      const cLine = new THREE.Line(cGeo, new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0 }));
      splinesGroup.add(cLine);
    }
    scene.add(splinesGroup);

    // =========================================================================
    // 9. CONTINUOUS C1 CATMULL-ROM CAMERA CRANE & DOLLY PATHS
    // Calibrated cinematic perspectives:
    // Act 1 (0.00): Wide establishing view
    // Act 2 (0.35): Elevated stanchion surveillance (car on right, open text on left)
    // Act 3 (0.48): Macro front plate push (plate on left, open card on right)
    // Act 4 (0.65): High neural constellation orbit
    // Act 5 (0.82): Barrier stanchion lift & green beacon
    // Act 6 (0.95): Drive-through gate corridor
    // =========================================================================
    const CAM_POS_POINTS = [
      new THREE.Vector3(8.5, 4.8, 16.0),   // p ~ 0.00: Wide establishing view
      new THREE.Vector3(5.8, 3.8, 11.5),   // p ~ 0.18: Vehicle enters down roadway
      new THREE.Vector3(4.2, 3.2, 8.4),    // p ~ 0.35: Act 2 surveillance stanchion view (dist ~6.9m)
      new THREE.Vector3(-1.4, 0.78, 1.6),  // p ~ 0.48: Act 3 macro plate lock (dist ~2.6m, plate left)
      new THREE.Vector3(-2.4, 3.2, 0.4),   // p ~ 0.65: Act 4 neural network constellation orbit
      new THREE.Vector3(3.6, 2.2, 4.0),    // p ~ 0.82: Act 5 barrier lift & green beacon
      new THREE.Vector3(0.0, 1.6, 2.4),    // p ~ 0.95: Act 6 vehicle rolls under gate
      new THREE.Vector3(0.0, 1.5, -6.0)    // p ~ 1.00: Fly-through into facility corridor
    ];

    const CAM_LOOK_POINTS = [
      new THREE.Vector3(0.0, 1.2, 2.5),    // Look at gate checkpoint
      new THREE.Vector3(0.4, 1.1, 4.5),    // Track incoming vehicle
      new THREE.Vector3(-0.4, 0.9, 3.8),   // Look down at front bumper & stop line
      new THREE.Vector3(0.25, 0.52, 3.6),  // Focus on front HSRP plate (framed on left side)
      new THREE.Vector3(0.0, 2.5, 2.2),    // Focus on center of floating neural DAG
      new THREE.Vector3(0.4, 1.5, 1.2),    // Focus on lifting boom barrier arm
      new THREE.Vector3(0.0, 1.3, -8.0),   // Look down corridor as car drives through
      new THREE.Vector3(0.0, 1.3, -24.0)   // Look into infinite cyber tunnel
    ];

    const camPath = new THREE.CatmullRomCurve3(CAM_POS_POINTS, false, 'catmullrom', 0.5);
    const lookPath = new THREE.CatmullRomCurve3(CAM_LOOK_POINTS, false, 'catmullrom', 0.5);

    // =========================================================================
    // 10. CONTINUOUS KINEMATICS: VEHICLE MOTION & BARRIER LIFT
    // =========================================================================
    function getVehicleZ(p) {
      if (p < 0.15) return 26.0;
      if (p < 0.40) {
        // Approaches and comes to a buttery soft stop at stop line (bumper at z = 3.60)
        const t = (p - 0.15) / 0.25;
        // Quintic smootherstep: 6t^5 - 15t^4 + 10t^3
        const s = t * t * t * (t * (t * 6 - 15) + 10);
        return 26.0 - s * (26.0 - 6.08);
      }
      if (p < 0.88) {
        return 6.08; // Stationary at stop line during OCR, neural scan, and gate lift
      }
      // p >= 0.88: Accelerates through open gate
      const t = (p - 0.88) / 0.12;
      const s = t * t * (3 - 2 * t);
      return 6.08 - s * 24.0; // Drives forward to -17.92
    }

    function getBarrierAngle(p) {
      if (p < 0.74) return 0;
      if (p < 0.88) {
        const t = (p - 0.74) / 0.14;
        const s = t * t * t * (t * (t * 6 - 15) + 10);
        return s * 1.40; // 1.40 rad ~ 80 degrees upright
      }
      return 1.40;
    }

    // =========================================================================
    // 11. DOM STORY ACTS CONTROLLER
    // =========================================================================
    const act1 = document.getElementById('story-act-1');
    const act2 = document.getElementById('story-act-2');
    const act3 = document.getElementById('story-act-3');
    const act4 = document.getElementById('story-act-4');
    const act5 = document.getElementById('story-act-5');
    const trackerThumb = document.getElementById('scroll-tracker-thumb');
    const trackerStage = document.getElementById('scroll-tracker-stage');
    const trackerPercent = document.getElementById('scroll-tracker-percent');

    function applyLayerState(el, opacity, translateY) {
      if (!el) return;
      translateY = translateY || 0;
      const isVisible = opacity > 0.005;
      el.style.opacity = isVisible ? opacity.toFixed(3) : '0';
      el.style.pointerEvents = opacity > 0.5 ? 'auto' : 'none';
      el.style.transform = 'translate3d(0, ' + translateY.toFixed(1) + 'px, 0)';
      el.style.visibility = isVisible ? 'visible' : 'hidden';
    }

    // Smooth sine-squared bell curve for gentle zero-slope entry/exit
    function bellCurve(p, minP, maxP) {
      if (p <= minP || p >= maxP) return 0;
      const t = (p - minP) / (maxP - minP);
      const s = Math.sin(t * Math.PI);
      return s * s;
    }

    // =========================================================================
    // 12. UNIFIED RENDER & PHYSICS LOOP
    // =========================================================================
    let targetScrollProgress = 0;
    let smoothedProgress = 0;
    const collapsePivot = new THREE.Vector3(2.45, 1.25, 1.2);

    ScrollTrigger.create({
      trigger: scrollContainer,
      pin: pinnedViewport,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => {
        targetScrollProgress = self.progress;
      }
    });

    let isHeroVisible = true;
    const heroObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        isHeroVisible = entry.isIntersecting;
        if (isHeroVisible) {
          requestAnimationFrame(renderFrame);
        }
      });
    }, { threshold: 0.01 });
    heroObserver.observe(scrollContainer);

    function renderFrame() {
      if (!isHeroVisible) return;
      requestAnimationFrame(renderFrame);

      // Single-pass low-latency progress damping (responsive, fluid, zero jitter)
      smoothedProgress += (targetScrollProgress - smoothedProgress) * 0.12;
      const p = Math.max(0, Math.min(1, smoothedProgress));

      // 1. Continuous C1 Camera Position & LookAt Sampling
      const camPos = camPath.getPoint(p);
      const camLook = lookPath.getPoint(p);
      camera.position.copy(camPos);
      camera.lookAt(camLook);

      // 2. Vehicle Kinematics & Wheel Rotation
      const vZ = getVehicleZ(p);
      vehicleGroup.position.z = vZ;

      // Deterministic wheel roll (distance traveled / radius)
      const rollAngle = (26.0 - vZ) / 0.42;
      wheels.forEach((w) => {
        w.rotation.x = -rollAngle;
      });

      // 3. Boom Barrier Arm & Signal Beacon
      const barrierAngle = getBarrierAngle(p);
      armPivot.rotation.z = -barrierAngle;

      if (p >= 0.76) {
        signalLightMesh.material = greenLightMat;
        ledStripMat.color.setHex(0x00ff88);
      } else {
        signalLightMesh.material = redLightMat;
        ledStripMat.color.setHex(0xff2244);
      }

      // 4. Laser Scanning Fan & License Plate Bounding Box
      if (p >= 0.22 && p <= 0.58) {
        const t = (p - 0.22) / 0.36;
        scanLaser.material.opacity = Math.sin(t * Math.PI) * 0.35;
      } else {
        scanLaser.material.opacity = 0;
      }

      if (p >= 0.40 && p <= 0.58) {
        const t = (p - 0.40) / 0.18;
        const bOp = Math.sin(t * Math.PI);
        bboxMat.opacity = bOp;
        scanLineMat.opacity = bOp * 0.95;
        scanLineMesh.position.x = Math.sin(p * 60) * 0.38;
      } else {
        bboxMat.opacity = 0;
        scanLineMat.opacity = 0;
      }

      // 5. Plate Particle Morph & 5 AI Nodes
      const positions = particleGeo.attributes.position.array;

      if (p < 0.54) {
        morphParticles.visible = false;
        plateMat.opacity = 1.0;
        particleMat.opacity = 0.0;
        nodeMeshesGroup.scale.set(0, 0, 0);
        splinesGroup.children.forEach((l) => (l.material.opacity = 0));
      } else if (p >= 0.54 && p <= 0.74) {
        // Morph from plate out to 5 AI nodes
        morphParticles.visible = true;
        const t = (p - 0.54) / 0.20;
        const s = t * t * (3 - 2 * t);

        plateMat.opacity = Math.max(0, 1.0 - t * 2.0);
        particleMat.opacity = Math.min(0.95, t * 2.2);

        for (let i = 0; i < NUM_PARTICLES; i++) {
          const init = particleInitialPos[i];
          const target = particleTargetPos[i];

          positions[i * 3] = init.x + (target.x - init.x) * s;
          positions[i * 3 + 1] = init.y + (target.y - init.y) * s + Math.sin(s * Math.PI + i) * 0.12;
          positions[i * 3 + 2] = init.z + (target.z - init.z) * s;
        }
        particleGeo.attributes.position.needsUpdate = true;

        const nodeScale = Math.min(1.0, s * 1.35);
        nodeMeshesGroup.scale.set(nodeScale, nodeScale, nodeScale);
        splinesGroup.children.forEach((l) => {
          l.material.opacity = Math.min(0.85, s * 1.2);
        });
      } else if (p > 0.74 && p <= 0.88) {
        // Implode from 5 AI nodes down to barrier pivot actuator
        morphParticles.visible = true;
        const t = (p - 0.74) / 0.14;
        const s = t * t * (3 - 2 * t);

        particleMat.opacity = Math.max(0, (1 - s) * 0.95);

        for (let i = 0; i < NUM_PARTICLES; i++) {
          const target = particleTargetPos[i];
          positions[i * 3] = target.x + (collapsePivot.x - target.x) * s;
          positions[i * 3 + 1] = target.y + (collapsePivot.y - target.y) * s;
          positions[i * 3 + 2] = target.z + (collapsePivot.z - target.z) * s;
        }
        particleGeo.attributes.position.needsUpdate = true;

        const nodeScale = Math.max(0, (1 - s));
        nodeMeshesGroup.scale.set(nodeScale, nodeScale, nodeScale);
        splinesGroup.children.forEach((l) => {
          l.material.opacity = Math.max(0, (1 - s) * 0.85);
        });

        plateMat.opacity = Math.min(1.0, t * 1.5);
      } else {
        morphParticles.visible = false;
        particleMat.opacity = 0.0;
        nodeMeshesGroup.scale.set(0, 0, 0);
        splinesGroup.children.forEach((l) => (l.material.opacity = 0));
        plateMat.opacity = 1.0;
      }

      // Rotate node rings subtly
      nodeSphereMeshes.forEach((n) => {
        if (n.children[1]) n.children[1].rotation.z += 0.015;
      });

      // 6. DOM Story Act Text Overlays
      // Act 1 (0% to 18%)
      const act1Op = Math.max(0, 1.0 - p / 0.18);
      applyLayerState(act1, act1Op, -p * 60);

      // Act 2 (20% to 38%)
      applyLayerState(act2, bellCurve(p, 0.20, 0.38), (0.29 - p) * 45);

      // Act 3 (40% to 58%)
      applyLayerState(act3, bellCurve(p, 0.40, 0.58), (0.49 - p) * 45);

      // Act 4 (60% to 74%)
      applyLayerState(act4, bellCurve(p, 0.60, 0.74), (0.67 - p) * 45);

      // Act 5 (76% to 90%)
      applyLayerState(act5, bellCurve(p, 0.76, 0.90), (0.83 - p) * 45);

      // 7. Update Tracker HUD
      if (trackerThumb) trackerThumb.style.height = (p * 100).toFixed(1) + '%';
      if (trackerPercent) trackerPercent.textContent = Math.round(p * 100) + '%';
      if (trackerStage) {
        if (p < 0.20) trackerStage.textContent = '[01 INIT]';
        else if (p < 0.40) trackerStage.textContent = '[02 TARGET]';
        else if (p < 0.60) trackerStage.textContent = '[03 SCAN]';
        else if (p < 0.75) trackerStage.textContent = '[04 NEURAL]';
        else if (p < 0.90) trackerStage.textContent = '[05 AUTH]';
        else trackerStage.textContent = '[06 INGRESS]';
      }

      // 8. Single Unified Render
      renderer.render(scene, camera);
    }

    renderFrame();

    // Window Resize Handler
    function onResize() {
      const w = pinnedViewport.clientWidth || window.innerWidth;
      const h = pinnedViewport.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      ScrollTrigger.refresh();
    }
    window.addEventListener('resize', onResize);
    setTimeout(onResize, 200);
  }
})();
