/**
 * GateKeeper AI — Interactive ANPR Camera Feed & Detection Demo
 * High-precision simulation with real repository samples,
 * animated bounding boxes, laser scanning line, OCR confidence tickers,
 * and live RTO Vahan metadata lookup.
 */

(function () {
  'use strict';

  const SAMPLE_VEHICLES = [
    {
      id: 'pb12',
      plate: 'PB 12 AB 1234',
      stateCode: 'PB (Punjab)',
      rto: 'Ropar / Rupnagar',
      owner: 'G******* S****',
      model: 'Tata Nexon EV Max',
      fuel: 'Electric',
      status: 'AUTHORIZED',
      confidence: 99.4,
      latency: '0.82 ms',
      tier: 'CharacterCNN (Tier-1)',
      image: '/static/sample_plates/dl01c5678_car.jpg',
      plateCrop: '/static/sample_plates/dl01c5678_plate.jpg',
      bbox: { top: '38%', left: '22%', width: '56%', height: '48%' },
      plateBox: { top: '68%', left: '41%', width: '18%', height: '8%' }
    },
    {
      id: 'bh22',
      plate: '22 BH 4567 AA',
      stateCode: 'BH (Bharat Series)',
      rto: 'Pan-India Defense / Central',
      owner: 'R***** K****',
      model: 'Mahindra XUV700 AX7',
      fuel: 'Diesel Turbo',
      status: 'AUTHORIZED',
      confidence: 98.7,
      latency: '0.89 ms',
      tier: 'CharacterCNN (Tier-1)',
      image: '/static/sample_plates/22bh4567aa_car.jpg',
      plateCrop: '/static/sample_plates/22bh4567aa_plate.jpg',
      bbox: { top: '32%', left: '20%', width: '60%', height: '52%' },
      plateBox: { top: '67%', left: '40%', width: '20%', height: '9%' }
    },
    {
      id: 'mh12',
      plate: 'MH 12 AB 1234',
      stateCode: 'MH (Maharashtra)',
      rto: 'Pune Central RTO',
      owner: 'A****** P****',
      model: 'Hyundai Creta SX',
      fuel: 'Petrol',
      status: 'AUTHORIZED',
      confidence: 99.1,
      latency: '0.78 ms',
      tier: 'CharacterCNN (Tier-1)',
      image: '/static/sample_plates/mh12ab1234_car.jpg',
      plateCrop: '/static/sample_plates/mh12ab1234_plate.jpg',
      bbox: { top: '34%', left: '21%', width: '58%', height: '50%' },
      plateBox: { top: '69%', left: '42%', width: '17%', height: '8%' }
    },
    {
      id: 'ka03',
      plate: 'KA 03 HA 0001',
      stateCode: 'KA (Karnataka)',
      rto: 'Indiranagar, Bengaluru',
      owner: 'V****** M*****',
      model: 'BMW 330Li M-Sport',
      fuel: 'Petrol',
      status: 'VIP PRIORITY',
      confidence: 99.8,
      latency: '0.94 ms',
      tier: 'CharacterCNN (Tier-1)',
      image: '/static/sample_plates/ka03ha0001_car.jpg',
      plateCrop: '/static/sample_plates/ka03ha0001_plate.jpg',
      bbox: { top: '30%', left: '22%', width: '56%', height: '54%' },
      plateBox: { top: '68%', left: '41%', width: '18%', height: '8%' }
    },
    {
      id: 'rj14',
      plate: 'RJ 14 CV 0002',
      stateCode: 'RJ (Rajasthan)',
      rto: 'Jaipur South RTO',
      owner: 'K**** S****',
      model: 'Kia Seltos GT-Line',
      fuel: 'Diesel',
      status: 'AUTHORIZED',
      confidence: 97.9,
      latency: '24.7 ms',
      tier: 'EasyOCR Ensemble (Tier-2)',
      image: '/static/sample_plates/user_kia_rj14_sample.jpg',
      plateCrop: '/static/sample_plates/user_long_plate_sample.jpg',
      bbox: { top: '28%', left: '16%', width: '68%', height: '58%' },
      plateBox: { top: '70%', left: '39%', width: '22%', height: '9%' }
    },
    {
      id: 'ap39',
      plate: 'AP 39 MF 5893',
      stateCode: 'AP (Andhra Pradesh)',
      rto: 'Tirupati RTO',
      owner: 'B******* R**',
      model: 'Commercial Multi-Axle',
      fuel: 'Diesel',
      status: 'VISITOR',
      confidence: 96.5,
      latency: '26.2 ms',
      tier: 'EasyOCR (Double-Decker)',
      image: '/static/sample_plates/user_double_decker_sample.jpg',
      plateCrop: '/static/sample_plates/user_double_decker_sample.jpg',
      bbox: { top: '22%', left: '18%', width: '64%', height: '62%' },
      plateBox: { top: '62%', left: '36%', width: '26%', height: '14%' }
    }
  ];

  let currentSampleIndex = 0;
  let isScanning = false;

  // DOM Elements
  const feedImg = document.getElementById('demo-feed-image');
  const vehicleBox = document.getElementById('demo-vehicle-box');
  const plateBox = document.getElementById('demo-plate-box');
  const scanLine = document.getElementById('demo-scan-line');
  const readPlate = document.getElementById('demo-readout-plate');
  const readConf = document.getElementById('demo-readout-conf');
  const readStatus = document.getElementById('demo-readout-status');
  const readLatency = document.getElementById('demo-readout-latency');
  const readTier = document.getElementById('demo-readout-tier');
  const readOwner = document.getElementById('demo-readout-owner');
  const readModel = document.getElementById('demo-readout-model');
  const readFuel = document.getElementById('demo-readout-fuel');
  const readRto = document.getElementById('demo-readout-rto');
  const statusBadge = document.getElementById('demo-status-badge');
  const plateSampleList = document.getElementById('demo-sample-buttons');
  const liveClock = document.getElementById('demo-live-clock');

  // Clock Ticker for Camera Feed HUD
  function updateCameraClock() {
    if (!liveClock) return;
    const now = new Date();
    liveClock.textContent = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC+05:30 [CH-01 GATE-NORTH]';
  }
  setInterval(updateCameraClock, 1000);
  updateCameraClock();

  // Populate sample selector chips
  if (plateSampleList) {
    plateSampleList.innerHTML = '';
    SAMPLE_VEHICLES.forEach((item, index) => {
      const btn = document.createElement('button');
      btn.className = `demo-chip px-3 py-1.5 rounded text-xs font-mono transition-all border ${
        index === 0
          ? 'border-emerald-400 bg-emerald-500/10 text-emerald-400 font-bold'
          : 'border-white/10 text-slate-400 hover:text-white hover:border-white/20'
      }`;
      btn.textContent = item.plate;
      btn.addEventListener('click', () => {
        selectSample(index);
      });
      plateSampleList.appendChild(btn);
    });
  }

  // Audio Bip feedback (Web Audio API synth)
  function playBeep(freq = 880, duration = 0.08) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Audio context may be restricted by autoplay policy
    }
  }

  function selectSample(index) {
    if (isScanning) return;
    currentSampleIndex = index;
    const data = SAMPLE_VEHICLES[index];

    // Update active button chip styles
    const buttons = plateSampleList.querySelectorAll('button');
    buttons.forEach((btn, i) => {
      btn.className = `demo-chip px-3 py-1.5 rounded text-xs font-mono transition-all border ${
        i === index
          ? 'border-emerald-400 bg-emerald-500/10 text-emerald-400 font-bold'
          : 'border-white/10 text-slate-400 hover:text-white hover:border-white/20'
      }`;
    });

    // Reset view & begin scanning animation sequence
    runScanSimulation(data);
  }

  function runScanSimulation(data) {
    isScanning = true;

    // Phase 1: Reset readouts
    if (feedImg) feedImg.src = data.image;
    if (vehicleBox) {
      vehicleBox.style.opacity = '0';
      vehicleBox.style.top = data.bbox.top;
      vehicleBox.style.left = data.bbox.left;
      vehicleBox.style.width = data.bbox.width;
      vehicleBox.style.height = data.bbox.height;
    }
    if (plateBox) {
      plateBox.style.opacity = '0';
      plateBox.style.top = data.plateBox.top;
      plateBox.style.left = data.plateBox.left;
      plateBox.style.width = data.plateBox.width;
      plateBox.style.height = data.plateBox.height;
    }
    if (scanLine) scanLine.style.display = 'block';

    if (readPlate) readPlate.textContent = 'SCANNING...';
    if (readConf) readConf.textContent = '—';
    if (readStatus) readStatus.textContent = 'ACQUIRING ROI';
    if (readLatency) readLatency.textContent = '—';
    if (readTier) readTier.textContent = 'ROI SEGMENTATION';
    if (statusBadge) {
      statusBadge.textContent = 'PROCESSING';
      statusBadge.className = 'hud-telemetry-badge text-cyan-400 border-cyan-400/40';
    }

    // Step 2: Vehicle bounding box locks in (0.3s)
    setTimeout(() => {
      if (vehicleBox) vehicleBox.style.opacity = '1';
      if (readStatus) readStatus.textContent = 'VEHICLE DETECTED';
      playBeep(440, 0.05);
    }, 300);

    // Step 3: License plate box locks in & laser scans (0.7s)
    setTimeout(() => {
      if (plateBox) plateBox.style.opacity = '1';
      if (readStatus) readStatus.textContent = 'READING CHARACTERS';
      playBeep(660, 0.05);
    }, 700);

    // Step 4: Full OCR & Vahan resolution (1.2s)
    setTimeout(() => {
      if (scanLine) scanLine.style.display = 'none';

      if (readPlate) readPlate.textContent = data.plate;
      if (readConf) readConf.textContent = `${data.confidence}%`;
      if (readLatency) readLatency.textContent = data.latency;
      if (readTier) readTier.textContent = data.tier;
      if (readStatus) readStatus.textContent = data.status;
      if (readOwner) readOwner.textContent = data.owner;
      if (readModel) readModel.textContent = data.model;
      if (readFuel) readFuel.textContent = data.fuel;
      if (readRto) readRto.textContent = `${data.stateCode} — ${data.rto}`;

      if (statusBadge) {
        statusBadge.textContent = data.status;
        if (data.status.includes('AUTHORIZED')) {
          statusBadge.className = 'hud-telemetry-badge text-emerald-400 border-emerald-400/50 bg-emerald-500/10';
        } else if (data.status.includes('VIP')) {
          statusBadge.className = 'hud-telemetry-badge text-cyan-400 border-cyan-400/50 bg-cyan-500/10';
        } else {
          statusBadge.className = 'hud-telemetry-badge text-amber-400 border-amber-400/50 bg-amber-500/10';
        }
      }

      playBeep(880, 0.12);
      isScanning = false;
    }, 1200);
  }

  // Trigger initial demo on load
  setTimeout(() => {
    runScanSimulation(SAMPLE_VEHICLES[0]);
  }, 400);

  // Expose triggers
  window.triggerAnprRescan = function () {
    runScanSimulation(SAMPLE_VEHICLES[currentSampleIndex]);
  };
})();
