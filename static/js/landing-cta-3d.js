/**
 * GateKeeper AI — 3D Close-Up Boom Barrier CTA Scene
 * Section: "MAKE EVERY ENTRY INTELLIGENT."
 * Intimate cinematic perspective of the heavy-duty boom barrier pedestal and arm.
 * Arm automatically lifts in slow-motion as user scrolls into the CTA section.
 */

(function () {
  'use strict';

  const container = document.getElementById('cta-canvas-container');
  if (!container) return;

  // 1. Scene, Camera, Renderer
  const initW = container.clientWidth || window.innerWidth;
  const initH = container.clientHeight || 500;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x030508, 0.045);

  const camera = new THREE.PerspectiveCamera(
    38,
    initW / initH,
    0.1,
    100
  );
  camera.position.set(3.8, 1.8, 4.8);
  camera.lookAt(-0.6, 1.4, 0.2);

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
  container.appendChild(renderer.domElement);

  // 2. Cinematic Lighting
  const ambLight = new THREE.AmbientLight(0x09101d, 1.5);
  scene.add(ambLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
  keyLight.position.set(6, 8, 8);
  keyLight.castShadow = true;
  scene.add(keyLight);

  const emeraldGlow = new THREE.PointLight(0x00ff88, 3.5, 12);
  emeraldGlow.position.set(0.5, 1.6, 1.0);
  scene.add(emeraldGlow);

  const cyanRim = new THREE.DirectionalLight(0x00e5ff, 1.6);
  cyanRim.position.set(-6, 4, -4);
  scene.add(cyanRim);

  // 3. Ground Plane
  const groundGeo = new THREE.PlaneGeometry(24, 24);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x050810,
    roughness: 0.35,
    metalness: 0.2
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // 4. Heavy-Duty Pedestal Assembly
  const pedestalGroup = new THREE.Group();
  pedestalGroup.position.set(0.6, 0, 0);

  // Main Housing
  const bodyGeo = new THREE.BoxGeometry(0.85, 1.8, 0.85);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x0c1322,
    roughness: 0.2,
    metalness: 0.85
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.9;
  body.castShadow = true;
  body.receiveShadow = true;
  pedestalGroup.add(body);

  // Chrome mechanical pivot hub
  const hubGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.5, 32);
  hubGeo.rotateZ(Math.PI / 2);
  const hubMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.15,
    metalness: 0.95
  });
  const hub = new THREE.Mesh(hubGeo, hubMat);
  hub.position.set(-0.45, 1.35, 0);
  pedestalGroup.add(hub);

  // Barrier Arm Pivot
  const armPivot = new THREE.Group();
  armPivot.position.set(-0.45, 1.35, 0);

  // High-Grade Barrier Arm
  const armLength = 7.5;
  const armGeo = new THREE.CylinderGeometry(0.048, 0.048, armLength, 24);
  armGeo.rotateZ(Math.PI / 2);
  armGeo.translate(-armLength / 2, 0, 0);
  const armMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.25,
    metalness: 0.4
  });
  const arm = new THREE.Mesh(armGeo, armMat);
  arm.castShadow = true;
  armPivot.add(arm);

  // Glowing LED Strip along arm
  const ledGeo = new THREE.BoxGeometry(armLength, 0.02, 0.02);
  ledGeo.translate(-armLength / 2, 0.055, 0);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
  const led = new THREE.Mesh(ledGeo, ledMat);
  armPivot.add(led);

  pedestalGroup.add(armPivot);
  scene.add(pedestalGroup);

  // Ambient floating dust particles
  const DUST_COUNT = 60;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST_COUNT * 3);
  for (let i = 0; i < DUST_COUNT; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 8;
    dustPos[i * 3 + 1] = Math.random() * 3.5;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 8;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    size: 0.04,
    color: 0x00e5ff,
    transparent: true,
    opacity: 0.6
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  // 5. Scroll Trigger & Interactive State
  let targetAngle = 0; // 0 = closed, ~1.4 rad = open
  let currentAngle = 0;
  let isVisible = false;
  let isLoopRunning = false;

  // IntersectionObserver to detect when user reaches CTA section
  const ctaSection = document.getElementById('cta-section');
  if (ctaSection) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isVisible = entry.isIntersecting;
          if (entry.isIntersecting) {
            targetAngle = 1.38; // Gate smoothly opens!
            ledMat.color.setHex(0x00ff88);
            emeraldGlow.color.setHex(0x00ff88);
            if (!isLoopRunning) {
              isLoopRunning = true;
              requestAnimationFrame(animate);
            }
          } else {
            targetAngle = 0;
            ledMat.color.setHex(0xff3344);
            emeraldGlow.color.setHex(0xff3344);
          }
        });
      },
      { threshold: 0.1 }
    );
    observer.observe(ctaSection);
  }

  // Mouse tilt
  let mouseX = 0;
  let mouseY = 0;
  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  // Window Resize
  function onResize() {
    if (!container) return;
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || 500;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);
  setTimeout(onResize, 150);

  // 6. Animation Loop
  const clock = new THREE.Clock();

  function animate() {
    if (!isVisible) {
      isLoopRunning = false;
      return;
    }
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    // Smooth barrier arm lifting with elastic spring easing
    currentAngle += (targetAngle - currentAngle) * 0.06;
    armPivot.rotation.z = -currentAngle;

    // Subtle floating dust
    dust.rotation.y = time * 0.02;

    // Camera micro parallax
    camera.position.x = 3.8 + mouseX * 0.35;
    camera.position.y = 1.8 + mouseY * 0.25;
    camera.lookAt(-0.6, 1.4, 0.2);

    renderer.render(scene, camera);
  }
})();
