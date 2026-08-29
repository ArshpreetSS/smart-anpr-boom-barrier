/**
 * GateKeeper AI - ANPR Smart Boom Barrier Client Controller
 * Features: EasyOCR + PyTorch CNN streaming, 5-minute Entry/Exit session tracking,
 * RapidAPI Indian RTO Gateway with permanent SQLite single-call caching,
 * mobile camera switcher, QR Code connect, and live stay duration counters.
 */

// Sound Synthesizer via Web Audio API
class AudioFX {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playAccessGranted() {
        if (this.isMuted) return;
        this.init();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.12); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.24); // G5

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.6);
    }

    playAccessDenied() {
        if (this.isMuted) return;
        this.init();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.setValueAtTime(140, now + 0.15);
        osc.frequency.setValueAtTime(160, now + 0.3);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.55);
    }

    playGateMove() {
        if (this.isMuted) return;
        this.init();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.8);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.85);
    }
}

const audioFX = new AudioFX();

// Global State
const state = {
    ws: null,
    wsConnected: false,
    activeSource: 'webcam', // 'webcam', 'simulator', 'gallery', 'upload'
    currentFacingMode: 'environment', // 'environment' (back camera) or 'user' (front)
    stream: null,
    isStreaming: false,
    sendInterval: null,
    simulatorInterval: null,
    sampleList: [],
    logs: [],
    activeSessions: [],
    registeredVehicles: [],
    rtoConfig: null,
    gateOpen: false,
    lastLoggedId: null,
    fps: 0,
    currentPlateDetails: null,
    networkInfo: null
};

// DOM Elements
const elements = {
    video: document.getElementById('webcam-video'),
    canvas: document.getElementById('feed-canvas'),
    wsStatus: document.getElementById('ws-status-badge'),
    wsDot: document.getElementById('ws-status-dot'),
    fpsCounter: document.getElementById('fps-counter'),
    gateStateBadge: document.getElementById('gate-state-badge'),
    gateStateText: document.getElementById('gate-state-text'),
    gateMessage: document.getElementById('gate-message'),
    barrierArm: document.getElementById('barrier-arm-svg'),
    ledRed: document.getElementById('led-red-light'),
    ledGreen: document.getElementById('led-green-light'),
    
    // Telemetry Elements
    hsrpPlateContainer: document.getElementById('hsrp-plate-box'),
    hsrpPlateText: document.getElementById('hsrp-plate-text'),
    badgeStatus: document.getElementById('badge-access-status'),
    badgeEventType: document.getElementById('badge-event-type'),
    valOwner: document.getElementById('val-owner-name'),
    valModel: document.getElementById('val-vehicle-model'),
    valFuel: document.getElementById('val-fuel-type'),
    valCity: document.getElementById('val-reg-city'),
    valGateAction: document.getElementById('val-gate-action'),
    valDuration: document.getElementById('val-stay-duration'),
    consensusBar: document.getElementById('consensus-progress-bar'),
    consensusText: document.getElementById('consensus-count-text'),
    
    // Stats
    statEntries: document.getElementById('stat-total-entries'),
    statExits: document.getElementById('stat-total-exits'),
    statInside: document.getElementById('stat-currently-inside'),
    statInsideBadge: document.getElementById('badge-inside-count'),
    statDenied: document.getElementById('stat-denied-count'),
    
    // Tables
    activeSessionsContainer: document.getElementById('active-sessions-container'),
    activeSessionsEmpty: document.getElementById('active-sessions-empty'),
    logsTableBody: document.getElementById('logs-table-body'),
    logSearchInput: document.getElementById('log-search-input'),
    logFilterStatus: document.getElementById('log-filter-status'),
    registryTableBody: document.getElementById('registry-table-body'),
    registrySearchInput: document.getElementById('registry-search-input'),
    
    // RapidAPI Elements
    rtoStatusPill: document.getElementById('rto-status-pill'),
    rtoConfigModal: document.getElementById('rto-config-modal'),
    rtoApiKeyInput: document.getElementById('rto-api-key-input'),
    rtoApiHostInput: document.getElementById('rto-api-host-input'),
    rtoCacheHitsText: document.getElementById('rto-cache-hits-text'),
    rtoQueriesText: document.getElementById('rto-queries-text'),
    rtoTestResultBox: document.getElementById('rto-test-result-box'),
    
    // Modals
    imageModal: document.getElementById('image-preview-modal'),
    modalImg: document.getElementById('modal-preview-img'),
    modalTitle: document.getElementById('modal-preview-title'),
    qrModal: document.getElementById('qr-connect-modal'),
    qrContainer: document.getElementById('qr-code-display'),
    mobileUrlText: document.getElementById('mobile-url-display')
};

const ctx = elements.canvas.getContext('2d');

// Initialize Application
async function initApp() {
    setupWebSocket();
    setupEventListeners();
    await fetchNetworkInfo();
    await fetchRTOConfig();
    await loadSamplePlates();
    await refreshStats();
    await refreshActiveSessions();
    await refreshLogs();
    await refreshRegistry();
    
    setInterval(updateSessionStayTimers, 1000);
    
    startWebcam().catch(() => {
        console.log("Webcam unavailable or blocked. Switching to virtual car simulator.");
        switchSource('simulator');
    });
}

// -------------------------------------------------------------
// WebSocket Setup & Streaming
// -------------------------------------------------------------
function setupWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/stream`;
    
    elements.wsStatus.innerText = 'Connecting...';
    elements.wsDot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-pulse';
    
    state.ws = new WebSocket(wsUrl);

    state.ws.onopen = () => {
        state.wsConnected = true;
        elements.wsStatus.innerText = 'AI Engine Connected';
        elements.wsDot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-ping';
        startFrameCaptureLoop();
    };

    state.ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleServerResponse(data);
        } catch (e) {
            console.error("Error parsing WS message", e);
        }
    };

    state.ws.onclose = () => {
        state.wsConnected = false;
        elements.wsStatus.innerText = 'Reconnecting...';
        elements.wsDot.className = 'w-2 h-2 rounded-full bg-rose-500 animate-pulse';
        clearInterval(state.sendInterval);
        setTimeout(setupWebSocket, 2000);
    };
}

let isFrameInFlight = false;

function sendNextFrame() {
    if (!state.wsConnected || state.ws.readyState !== WebSocket.OPEN || isFrameInFlight) return;
    
    let frameData = null;
    if (state.activeSource === 'webcam' && elements.video.readyState === elements.video.HAVE_ENOUGH_DATA) {
        const vw = elements.video.videoWidth || 640;
        const vh = elements.video.videoHeight || 480;
        const scale = Math.min(1.0, 640 / vw);
        const tw = Math.round(vw * scale);
        const th = Math.round(vh * scale);
        
        elements.canvas.width = tw;
        elements.canvas.height = th;
        ctx.drawImage(elements.video, 0, 0, tw, th);
        frameData = elements.canvas.toDataURL('image/jpeg', 0.60);
    } else if (state.activeSource === 'simulator' || state.activeSource === 'gallery') {
        if (elements.canvas.width > 0 && elements.canvas.height > 0) {
            frameData = elements.canvas.toDataURL('image/jpeg', 0.70);
        }
    }
    
    if (frameData) {
        isFrameInFlight = true;
        state.ws.send(frameData);
    }
}

function startFrameCaptureLoop() {
    clearInterval(state.sendInterval);
    isFrameInFlight = false;
    state.sendInterval = setInterval(() => {
        sendNextFrame();
    }, 16);
}

// -------------------------------------------------------------
// Server Response Handler (ANPR, Bounding Box & Gate Telemetry)
// -------------------------------------------------------------
function handleServerResponse(data) {
    isFrameInFlight = false;
    if (data.fps !== undefined) {
        state.fps = data.fps;
        elements.fpsCounter.innerText = `${data.fps} FPS`;
    }

    if (state.activeSource === 'webcam' && elements.video.readyState === elements.video.HAVE_ENOUGH_DATA) {
        ctx.drawImage(elements.video, 0, 0, elements.canvas.width, elements.canvas.height);
    }

    if (data.detections && data.detections.length > 0) {
        data.detections.forEach(det => drawBoundingBox(det));
    }

    if (data.consensus_count !== undefined) {
        const count = data.consensus_count;
        const pct = Math.min(100, Math.round((count / 2) * 100));
        elements.consensusBar.style.width = `${pct}%`;
        elements.consensusText.innerText = `${count} / 2 Frames Consensus`;
        elements.consensusBar.className = count >= 2
            ? 'h-full bg-emerald-500 rounded-full transition-all duration-300'
            : 'h-full bg-indigo-500 rounded-full transition-all duration-300';
    }

    if (data.gate_state) {
        updateGateBarrierUI(data.gate_state.is_open, data.gate_state.status_message);
    }

    if (data.gate_event && data.gate_event.telemetry) {
        const t = data.gate_event.telemetry;
        updateTelemetryCard(t);

        if (t.id && t.id !== state.lastLoggedId) {
            state.lastLoggedId = t.id;
            if (data.gate_event.action === 'OPENED') {
                audioFX.playAccessGranted();
            } else if (data.gate_event.action === 'DENIED') {
                audioFX.playAccessDenied();
            }
            refreshLogs();
            refreshActiveSessions();
            refreshRegistry();
            refreshStats();
            fetchRTOConfig();
        }
    } else if (data.last_telemetry && Object.keys(data.last_telemetry).length > 0) {
        updateTelemetryCard(data.last_telemetry);
    }
}

// -------------------------------------------------------------
// Canvas Bounding Box Painter
// -------------------------------------------------------------
function drawBoundingBox(detection) {
    const [x, y, w, h] = detection.box;
    const isValid = detection.is_valid;
    const plateText = detection.plate_text || detection.raw_text;
    const conf = Math.round((detection.confidence || 0) * 100);
    const engine = detection.engine || 'OCR';

    const strokeColor = isValid ? '#10b981' : '#f59e0b';
    ctx.fillStyle = isValid ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)';
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x, y, w, h);

    const cornerLen = Math.min(15, Math.floor(w * 0.25));
    ctx.lineWidth = 4;
    ctx.strokeStyle = isValid ? '#34d399' : '#fbbf24';

    ctx.beginPath();
    ctx.moveTo(x, y + cornerLen); ctx.lineTo(x, y); ctx.lineTo(x + cornerLen, y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + w - cornerLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cornerLen);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, y + h - cornerLen); ctx.lineTo(x, y + h); ctx.lineTo(x + cornerLen, y + h);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + w - cornerLen, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cornerLen);
    ctx.stroke();

    const labelText = `${plateText} • ${conf}% (${engine})`;
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    const textMetrics = ctx.measureText(labelText);
    const labelW = textMetrics.width + 16;
    const labelH = 22;
    const labelY = Math.max(0, y - labelH - 4);

    ctx.fillStyle = isValid ? '#065f46' : '#92400e';
    ctx.fillRect(x, labelY, labelW, labelH);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, labelY, labelW, labelH);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(labelText, x + 8, labelY + 15);
}

// -------------------------------------------------------------
// Boom Barrier Animation Controller
// -------------------------------------------------------------
function updateGateBarrierUI(isOpen, message) {
    if (state.gateOpen !== isOpen) {
        state.gateOpen = isOpen;
        audioFX.playGateMove();
    }

    if (isOpen) {
        elements.barrierArm.classList.add('open');
        elements.barrierArm.setAttribute('transform', 'rotate(-75, 65, 140)');

        elements.ledGreen.className = 'w-4 h-4 rounded-full bg-emerald-400 led-green transition-all';
        elements.ledRed.className = 'w-4 h-4 rounded-full bg-red-950 opacity-40 transition-all';

        elements.gateStateBadge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 transition-all';
        elements.gateStateText.innerText = 'GATE OPEN (-75°)';
    } else {
        elements.barrierArm.classList.remove('open');
        elements.barrierArm.setAttribute('transform', 'rotate(0, 65, 140)');

        elements.ledRed.className = 'w-4 h-4 rounded-full bg-red-500 led-red transition-all';
        elements.ledGreen.className = 'w-4 h-4 rounded-full bg-emerald-950 opacity-40 transition-all';

        elements.gateStateBadge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1.5 transition-all';
        elements.gateStateText.innerText = 'GATE CLOSED (0°)';
    }

    if (message) {
        elements.gateMessage.innerText = message;
    }
}

// -------------------------------------------------------------
// Live Telemetry & Vahan Registry Card
// -------------------------------------------------------------
function updateTelemetryCard(t) {
    if (!t || !t.plate_number) return;

    elements.hsrpPlateText.innerText = t.plate_number;

    const isEV = t.fuel_type && t.fuel_type.toUpperCase() === 'EV';
    elements.hsrpPlateContainer.className = isEV
        ? 'hsrp-plate hsrp-plate-ev px-4 py-2 text-xl sm:text-2xl font-mono'
        : 'hsrp-plate px-4 py-2 text-xl sm:text-2xl font-mono';

    const status = (t.access_status || 'UNKNOWN').toUpperCase();
    let badgeClass = 'px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ';
    if (status === 'VIP') badgeClass += 'bg-purple-500/20 text-purple-300 border border-purple-500/40';
    else if (status === 'AUTHORIZED') badgeClass += 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
    else if (status === 'BLACKLISTED') badgeClass += 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse';
    else badgeClass += 'bg-sky-500/20 text-sky-300 border border-sky-500/40';
    
    elements.badgeStatus.className = badgeClass;
    elements.badgeStatus.innerText = status;

    const eventType = t.event_type || 'ENTRY';
    if (eventType === 'EXIT') {
        elements.badgeEventType.className = 'px-2.5 py-1 rounded-md text-xs font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40';
        elements.badgeEventType.innerText = 'DEPARTURE (EXIT)';
    } else {
        elements.badgeEventType.className = 'px-2.5 py-1 rounded-md text-xs font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
        elements.badgeEventType.innerText = 'ARRIVAL (ENTRY)';
    }

    elements.valOwner.innerText = t.owner_name || '—';
    elements.valModel.innerText = t.vehicle_model || '—';
    elements.valFuel.innerText = t.fuel_type || '—';
    elements.valCity.innerText = t.registration_city || '—';
    elements.valDuration.innerText = t.stay_duration || 'Inside Premises';
    elements.valGateAction.innerText = t.gate_action || (state.gateOpen ? 'OPENED' : 'CLOSED');
    elements.valGateAction.className = t.gate_action === 'DENIED' ? 'text-rose-400 font-semibold' : 'text-emerald-400 font-semibold';
}

// -------------------------------------------------------------
// Source Switcher & Mobile Camera
// -------------------------------------------------------------
async function switchSource(source) {
    state.activeSource = source;
    clearInterval(state.simulatorInterval);

    document.querySelectorAll('.source-tab-btn').forEach(btn => {
        if (btn.dataset.source === source) {
            btn.className = 'source-tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white shadow-sm transition-all';
        } else {
            btn.className = 'source-tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-all';
        }
    });

    if (source === 'webcam') {
        document.getElementById('webcam-controls').classList.remove('hidden');
        document.getElementById('gallery-container').classList.add('hidden');
        await startWebcam();
    } else if (source === 'simulator') {
        document.getElementById('webcam-controls').classList.add('hidden');
        document.getElementById('gallery-container').classList.add('hidden');
        stopWebcam();
        startVirtualSimulator();
    } else if (source === 'gallery') {
        document.getElementById('webcam-controls').classList.add('hidden');
        document.getElementById('gallery-container').classList.remove('hidden');
        stopWebcam();
    } else if (source === 'upload') {
        document.getElementById('webcam-controls').classList.add('hidden');
        document.getElementById('gallery-container').classList.add('hidden');
        stopWebcam();
        document.getElementById('file-upload-input').click();
    }
}

async function startWebcam() {
    try {
        if (state.stream) {
            state.stream.getTracks().forEach(t => t.stop());
        }
        state.stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: state.currentFacingMode },
                width: { ideal: 640 },
                height: { ideal: 480 }
            },
            audio: false
        });
        elements.video.srcObject = state.stream;
        await elements.video.play();
        state.isStreaming = true;
    } catch (err) {
        console.warn("Could not access webcam:", err);
        throw err;
    }
}

function stopWebcam() {
    if (state.stream) {
        state.stream.getTracks().forEach(t => t.stop());
        state.stream = null;
    }
    elements.video.srcObject = null;
    state.isStreaming = false;
}

async function flipCamera() {
    state.currentFacingMode = state.currentFacingMode === 'environment' ? 'user' : 'environment';
    if (state.activeSource === 'webcam') {
        await startWebcam();
    }
}

function startVirtualSimulator() {
    if (state.sampleList.length === 0) return;
    const carSamples = state.sampleList.filter(s => s.type === 'car');
    if (carSamples.length === 0) return;

    let idx = 0;
    const loadNext = () => {
        const sample = carSamples[idx % carSamples.length];
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            elements.canvas.width = img.width;
            elements.canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
        };
        img.src = sample.url;
        idx++;
    };

    loadNext();
    state.simulatorInterval = setInterval(loadNext, 4500);
}

// -------------------------------------------------------------
// RapidAPI RTO Gateway Config & Diagnostic Tester
// -------------------------------------------------------------
async function fetchRTOConfig() {
    try {
        const res = await fetch('/api/rto/config');
        state.rtoConfig = await res.json();
        
        if (elements.rtoStatusPill) {
            if (state.rtoConfig.is_configured) {
                elements.rtoStatusPill.className = 'px-2.5 py-1 rounded-md text-[11px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5';
                elements.rtoStatusPill.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> LIVE RAPIDAPI RTO`;
            } else {
                elements.rtoStatusPill.className = 'px-2.5 py-1 rounded-md text-[11px] font-bold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5';
                elements.rtoStatusPill.innerHTML = `<span class="w-2 h-2 rounded-full bg-cyan-400"></span> LOCAL CACHE / HEURISTIC`;
            }
        }

        if (elements.rtoCacheHitsText) elements.rtoCacheHitsText.innerText = state.rtoConfig.cache_hits;
        if (elements.rtoQueriesText) elements.rtoQueriesText.innerText = state.rtoConfig.queries_made;
        if (elements.rtoApiHostInput) elements.rtoApiHostInput.value = state.rtoConfig.rapidapi_host;
    } catch (e) {
        console.error("Failed to load RTO config", e);
    }
}

async function saveRTOConfig(apiKey, host) {
    try {
        const formData = new FormData();
        formData.append('rapidapi_key', apiKey);
        if (host) formData.append('rapidapi_host', host);

        const res = await fetch('/api/rto/config', { method: 'POST', body: formData });
        if (res.ok) {
            await fetchRTOConfig();
            alert("RapidAPI credentials saved! First-time vehicles will be looked up live and cached permanently.");
            closeRTOModal();
        }
    } catch (e) {
        console.error("Save RTO config error", e);
    }
}

async function testRTOLookup(plateNumber) {
    if (!plateNumber) return;
    const box = elements.rtoTestResultBox;
    if (box) {
        box.classList.remove('hidden');
        box.innerHTML = `<p class="text-xs text-indigo-400 animate-pulse">Querying Vahan resolver for ${plateNumber}...</p>`;
    }

    try {
        const formData = new FormData();
        formData.append('plate_number', plateNumber);
        const res = await fetch('/api/rto/test-lookup', { method: 'POST', body: formData });
        const d = await res.json();
        
        if (box) {
            box.innerHTML = `
                <div class="space-y-1.5 text-xs">
                    <div class="flex items-center justify-between border-b border-slate-700 pb-1">
                        <span class="font-mono font-bold text-slate-100">${d.plate_number}</span>
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${d.was_cached_before ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400'}">${d.source}</span>
                    </div>
                    <p class="text-slate-300 font-medium">Owner: <span class="text-slate-100 font-bold">${d.owner_name}</span></p>
                    <p class="text-slate-400">Model: <span class="text-slate-200">${d.vehicle_model}</span> (${d.fuel_type})</p>
                    <p class="text-slate-400">RTO City: <span class="text-slate-200">${d.registration_city}</span></p>
                    <p class="text-[11px] font-mono text-cyan-400 mt-1">${d.message}</p>
                </div>
            `;
        }
        await refreshRegistry();
        await refreshStats();
        await fetchRTOConfig();
    } catch (e) {
        if (box) box.innerHTML = `<p class="text-xs text-rose-400">Lookup failed: ${e.message}</p>`;
    }
}

function showRTOModal() {
    elements.rtoConfigModal.classList.remove('hidden');
}

function closeRTOModal() {
    elements.rtoConfigModal.classList.add('hidden');
}

// -------------------------------------------------------------
// Currently Inside Sessions & 5-Min Timer Tracker
// -------------------------------------------------------------
async function refreshActiveSessions() {
    try {
        const res = await fetch('/api/sessions/active');
        state.activeSessions = await res.json();
        renderActiveSessions();
        elements.statInsideBadge.innerText = state.activeSessions.length;
        elements.statInside.innerText = state.activeSessions.length;
    } catch (e) {
        console.error("Failed to load active sessions", e);
    }
}

function renderActiveSessions() {
    const container = elements.activeSessionsContainer;
    if (!container) return;
    container.innerHTML = '';

    if (state.activeSessions.length === 0) {
        elements.activeSessionsEmpty.classList.remove('hidden');
        return;
    } else {
        elements.activeSessionsEmpty.classList.add('hidden');
    }

    state.activeSessions.forEach(s => {
        const card = document.createElement('div');
        card.className = 'glass-card rounded-xl p-4 border border-slate-800 hover:border-indigo-500/50 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4';

        const thumb = s.entry_plate_image || '/static/sample_plates/mh12ab1234_plate.jpg';
        const exitReadyBadge = s.can_exit_now
            ? `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">Eligible for Exit (5m+ elapsed)</span>`
            : `<span class="px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Entered recently</span>`;

        card.innerHTML = `
            <div class="flex items-center space-x-3.5">
                <img src="${thumb}" alt="Plate" class="h-10 w-24 object-cover rounded border border-slate-700 cursor-pointer" onclick="showImageModal('${thumb}', '${s.plate_number}')">
                <div>
                    <div class="flex items-center space-x-2">
                        <span class="font-mono font-bold text-base text-slate-100">${s.plate_number}</span>
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 uppercase">${s.access_status}</span>
                    </div>
                    <p class="text-xs text-slate-300 font-medium">${s.owner_name} • <span class="text-slate-400">${s.vehicle_model}</span></p>
                    <p class="text-[11px] text-slate-500">Entered: ${s.entry_time}</p>
                </div>
            </div>

            <div class="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end">
                <div class="text-right">
                    <div class="text-xs font-mono font-bold text-cyan-400" id="timer-session-${s.id}">${s.stay_formatted}</div>
                    <div class="mt-0.5">${exitReadyBadge}</div>
                </div>
                <button onclick="manualCheckout(${s.id})" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:text-white transition-colors">
                    Checkout
                </button>
            </div>
        `;

        container.appendChild(card);
    });
}

function updateSessionStayTimers() {
    const now = new Date();
    state.activeSessions.forEach(s => {
        const el = document.getElementById(`timer-session-${s.id}`);
        if (!el) return;
        const entryDate = new Date(s.entry_time + " UTC");
        const diffMs = Math.max(0, now - entryDate);
        const mins = Math.floor(diffMs / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        el.innerText = `${mins}m ${secs}s`;
    });
}

async function manualCheckout(sessionId) {
    try {
        const res = await fetch(`/api/sessions/${sessionId}/checkout`, { method: 'POST' });
        await refreshActiveSessions();
        await refreshLogs();
        await refreshStats();
    } catch (e) {
        console.error("Checkout failed:", e);
    }
}

// -------------------------------------------------------------
// QR Code Generator & Mobile Network Info
// -------------------------------------------------------------
async function fetchNetworkInfo() {
    try {
        const res = await fetch('/api/system/network-info');
        state.networkInfo = await res.json();
        if (elements.mobileUrlText) {
            elements.mobileUrlText.innerText = state.networkInfo.mobile_url;
        }
        renderQRCode(state.networkInfo.mobile_url);
    } catch (e) {
        console.error("Failed to load network info", e);
    }
}

function renderQRCode(url) {
    const container = elements.qrContainer;
    if (!container || typeof QRCode === 'undefined') return;
    container.innerHTML = '';
    new QRCode(container, {
        text: url,
        width: 180,
        height: 180,
        colorDark: "#020617",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
}

function showQRModal() {
    elements.qrModal.classList.remove('hidden');
}

function closeQRModal() {
    elements.qrModal.classList.add('hidden');
}

// -------------------------------------------------------------
// Sample Plates & REST Handlers
// -------------------------------------------------------------
async function loadSamplePlates() {
    try {
        const res = await fetch('/api/demo/samples');
        state.sampleList = await res.json();
        renderSampleGallery();
    } catch (e) {
        console.error("Failed to load sample plates", e);
    }
}

function renderSampleGallery() {
    const container = document.getElementById('gallery-grid');
    if (!container) return;
    container.innerHTML = '';

    state.sampleList.forEach(sample => {
        const card = document.createElement('div');
        card.className = 'group relative rounded-lg overflow-hidden border border-slate-800 bg-slate-900/60 hover:border-indigo-500/60 cursor-pointer transition-all duration-200';
        const title = sample.filename.replace('_car.jpg', '').replace('_plate.jpg', '').toUpperCase();
        
        card.innerHTML = `
            <img src="${sample.url}" alt="${title}" class="w-full h-20 object-cover group-hover:scale-105 transition-transform duration-300">
            <div class="p-1.5 text-center bg-slate-950/80">
                <span class="text-[11px] font-mono font-bold text-slate-300 group-hover:text-indigo-400 truncate block">${title}</span>
                <span class="text-[9px] text-slate-500 uppercase">${sample.type === 'car' ? 'Car Frame' : 'Plate Crop'}</span>
            </div>
        `;

        card.onclick = () => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                elements.canvas.width = img.width;
                elements.canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
            };
            img.src = sample.url;
        };

        container.appendChild(card);
    });
}

async function refreshStats() {
    try {
        const res = await fetch('/api/stats');
        const d = await res.json();
        elements.statEntries.innerText = d.total_entries;
        elements.statExits.innerText = d.total_exits;
        elements.statInside.innerText = d.currently_inside;
        elements.statDenied.innerText = d.denied_count;

        const serialText = document.getElementById('serial-status-text');
        const serialBadge = document.getElementById('serial-status-badge');
        if (d.serial_status && serialText && serialBadge) {
            if (d.serial_status.is_connected) {
                serialText.innerText = `${d.serial_status.port}: CONNECTED`;
                serialBadge.className = 'px-2.5 py-1 rounded-full text-xs font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1.5';
            } else {
                serialText.innerText = `${d.serial_status.port}: STANDBY`;
                serialBadge.className = 'px-2.5 py-1 rounded-full text-xs font-mono bg-slate-800/80 border border-slate-700/60 flex items-center gap-1.5 text-slate-300';
            }
        }
    } catch (e) {
        console.error("Error fetching stats:", e);
    }
}

async function refreshLogs() {
    try {
        const res = await fetch('/api/logs?limit=50');
        state.logs = await res.json();
        renderLogsTable();
    } catch (e) {
        console.error("Error fetching logs:", e);
    }
}

function renderLogsTable() {
    const tbody = elements.logsTableBody;
    const filter = elements.logFilterStatus.value;
    const search = elements.logSearchInput.value.trim().toLowerCase();

    tbody.innerHTML = '';

    const filtered = state.logs.filter(log => {
        if (filter !== 'ALL' && log.event_type !== filter && log.access_status !== filter && log.gate_action !== filter) return false;
        if (search) {
            const matchPlate = log.plate_number.toLowerCase().includes(search);
            const matchOwner = log.owner_name.toLowerCase().includes(search);
            const matchModel = log.vehicle_model.toLowerCase().includes(search);
            if (!matchPlate && !matchOwner && !matchModel) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-500 text-sm">No entry/exit logs found</td></tr>`;
        return;
    }

    filtered.forEach(log => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors text-xs sm:text-sm';

        let eventBadge = '';
        if (log.event_type === 'EXIT') {
            eventBadge = `<span class="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">EXIT</span>`;
        } else if (log.event_type === 'SECURITY_ALERT') {
            eventBadge = `<span class="px-2 py-0.5 rounded text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">ALERT</span>`;
        } else {
            eventBadge = `<span class="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">ENTRY</span>`;
        }

        const thumbUrl = log.plate_image_path || '/static/sample_plates/mh12ab1234_plate.jpg';
        const stayStr = log.stay_duration || (log.event_type === 'ENTRY' ? 'Entering' : '—');

        tr.innerHTML = `
            <td class="py-3 px-3 sm:px-4 font-mono text-slate-400 whitespace-nowrap">${log.timestamp}</td>
            <td class="py-3 px-3 sm:px-4">${eventBadge}</td>
            <td class="py-3 px-3 sm:px-4">
                <img src="${thumbUrl}" alt="Crop" class="h-7 w-20 object-cover rounded border border-slate-700 cursor-pointer" onclick="showImageModal('${thumbUrl}', '${log.plate_number}')">
            </td>
            <td class="py-3 px-3 sm:px-4 font-mono font-bold text-slate-100">${log.plate_number}</td>
            <td class="py-3 px-3 sm:px-4 text-slate-300 font-medium">${log.owner_name} <span class="text-slate-500 block text-[11px]">${log.vehicle_model}</span></td>
            <td class="py-3 px-3 sm:px-4 text-slate-400 font-mono text-xs">${stayStr}</td>
            <td class="py-3 px-3 sm:px-4">
                <span class="text-xs px-2 py-0.5 rounded font-bold ${log.gate_action === 'DENIED' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}">${log.gate_action}</span>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

async function refreshRegistry() {
    try {
        const query = elements.registrySearchInput ? elements.registrySearchInput.value.trim() : '';
        const url = query ? `/api/registry?search=${encodeURIComponent(query)}` : '/api/registry';
        const res = await fetch(url);
        state.registeredVehicles = await res.json();
        renderRegistryTable();
    } catch (e) {
        console.error("Failed to load registry", e);
    }
}

function renderRegistryTable() {
    const tbody = elements.registryTableBody;
    if (!tbody) return;
    tbody.innerHTML = '';

    if (state.registeredVehicles.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-slate-500 text-sm">No vehicles found in Vahan directory</td></tr>`;
        return;
    }

    state.registeredVehicles.forEach(v => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors text-xs sm:text-sm';
        
        let statusBadge = `<span class="px-2 py-0.5 rounded font-bold text-xs bg-emerald-500/20 text-emerald-400">${v.access_status}</span>`;
        if (v.access_status === 'VIP') statusBadge = `<span class="px-2 py-0.5 rounded font-bold text-xs bg-purple-500/20 text-purple-300">VIP</span>`;
        else if (v.access_status === 'BLACKLISTED') statusBadge = `<span class="px-2 py-0.5 rounded font-bold text-xs bg-rose-500/20 text-rose-300">BLACKLISTED</span>`;

        let sourceBadge = `<span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-800 text-slate-400">${v.source || 'MANUAL'}</span>`;
        if (v.source === 'RAPIDAPI') sourceBadge = `<span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">RAPIDAPI</span>`;

        tr.innerHTML = `
            <td class="py-3 px-4 font-mono font-bold text-slate-100">${v.plate_number}</td>
            <td class="py-3 px-4 font-medium text-slate-200">${v.owner_name}</td>
            <td class="py-3 px-4 text-slate-400">${v.vehicle_model}</td>
            <td class="py-3 px-4 text-indigo-400 font-mono text-xs">${v.fuel_type}</td>
            <td class="py-3 px-4 text-slate-400">${v.registration_city}</td>
            <td class="py-3 px-4">${sourceBadge}</td>
            <td class="py-3 px-4">${statusBadge}</td>
        `;
        tbody.appendChild(tr);
    });
}

function showImageModal(imgUrl, title) {
    elements.modalImg.src = imgUrl;
    elements.modalTitle.innerText = `Plate Snapshot: ${title}`;
    elements.imageModal.classList.remove('hidden');
}

function closeImageModal() {
    elements.imageModal.classList.add('hidden');
}

async function triggerManualOverride(action) {
    try {
        const formData = new FormData();
        formData.append('action', action);
        const res = await fetch('/api/gate/override', { method: 'POST', body: formData });
        const data = await res.json();
        updateGateBarrierUI(data.is_open, data.message);
        refreshLogs();
        refreshStats();
    } catch (e) {
        console.error("Manual override failed:", e);
    }
}

function exportLogsToCSV() {
    if (state.logs.length === 0) return;
    let csv = "ID,Timestamp,Event Type,Plate Number,Owner Name,Vehicle Model,Fuel,City,Status,Action,Stay Duration\n";
    state.logs.forEach(l => {
        csv += `"${l.id}","${l.timestamp}","${l.event_type}","${l.plate_number}","${l.owner_name}","${l.vehicle_model}","${l.fuel_type}","${l.registration_city}","${l.access_status}","${l.gate_action}","${l.stay_duration}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `gatekeeper_audit_logs_${Date.now()}.csv`;
    link.click();
}

// -------------------------------------------------------------
// UI Navigation Tabs & Event Listeners
// -------------------------------------------------------------
function setupEventListeners() {
    document.querySelectorAll('.nav-view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetView = btn.dataset.view;
            
            document.querySelectorAll('.nav-view-btn').forEach(b => {
                b.className = b.dataset.view === targetView
                    ? 'nav-view-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 text-white shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2'
                    : 'nav-view-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-all flex items-center gap-2';
            });

            document.querySelectorAll('.view-panel').forEach(panel => {
                if (panel.id === `view-${targetView}`) panel.classList.remove('hidden');
                else panel.classList.add('hidden');
            });
        });
    });

    document.querySelectorAll('.source-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchSource(btn.dataset.source));
    });

    document.getElementById('btn-flip-camera').addEventListener('click', flipCamera);
    document.getElementById('btn-open-qr').addEventListener('click', showQRModal);
    document.getElementById('qr-modal-close-btn').addEventListener('click', closeQRModal);
    elements.qrModal.addEventListener('click', (e) => {
        if (e.target === elements.qrModal) closeQRModal();
    });

    // RTO Modal Triggers
    const btnOpenRTO = document.getElementById('btn-open-rto-config');
    if (btnOpenRTO) btnOpenRTO.addEventListener('click', showRTOModal);
    const btnCloseRTO = document.getElementById('rto-modal-close-btn');
    if (btnCloseRTO) btnCloseRTO.addEventListener('click', closeRTOModal);
    if (elements.rtoConfigModal) {
        elements.rtoConfigModal.addEventListener('click', (e) => {
            if (e.target === elements.rtoConfigModal) closeRTOModal();
        });
    }

    // Save RapidAPI Key Form
    const rtoForm = document.getElementById('rto-config-form');
    if (rtoForm) {
        rtoForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveRTOConfig(elements.rtoApiKeyInput.value, elements.rtoApiHostInput.value);
        });
    }

    // RapidAPI Sandbox Test Button
    const btnTestRTO = document.getElementById('btn-test-rto-lookup');
    if (btnTestRTO) {
        btnTestRTO.addEventListener('click', () => {
            const inputPlate = document.getElementById('rto-test-plate-input').value.trim();
            if (inputPlate) testRTOLookup(inputPlate);
        });
    }

    // Manual Gate Override
    document.getElementById('btn-manual-open').addEventListener('click', () => triggerManualOverride('OPEN'));
    document.getElementById('btn-manual-close').addEventListener('click', () => triggerManualOverride('CLOSE'));

    // Audio Mute Toggle
    document.getElementById('btn-mute-toggle').addEventListener('click', function() {
        audioFX.isMuted = !audioFX.isMuted;
        this.innerHTML = audioFX.isMuted 
            ? `<i data-lucide="volume-x" class="w-4 h-4 text-rose-400"></i>`
            : `<i data-lucide="volume-2" class="w-4 h-4 text-slate-300"></i>`;
        lucide.createIcons();
    });

    // Logs Search & Filters
    elements.logSearchInput.addEventListener('input', renderLogsTable);
    elements.logFilterStatus.addEventListener('change', renderLogsTable);
    document.getElementById('btn-export-csv').addEventListener('click', exportLogsToCSV);
    document.getElementById('btn-refresh-logs').addEventListener('click', () => {
        refreshLogs();
        refreshStats();
        refreshActiveSessions();
    });

    // Registry Search
    if (elements.registrySearchInput) {
        elements.registrySearchInput.addEventListener('input', refreshRegistry);
    }

    // Add Vehicle Form Submit
    const addVehicleForm = document.getElementById('add-vehicle-form');
    if (addVehicleForm) {
        addVehicleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(addVehicleForm);
            try {
                const res = await fetch('/api/registry', { method: 'POST', body: formData });
                if (res.ok) {
                    addVehicleForm.reset();
                    await refreshRegistry();
                    await refreshStats();
                    alert("Vehicle registered successfully into Vahan database!");
                }
            } catch (err) {
                console.error("Add vehicle failed", err);
            }
        });
    }

    // Custom File & Camera Upload
    const fileInput = document.getElementById('file-upload-input');
    const mobileCameraInput = document.getElementById('mobile-camera-capture');

    const handleFileUpload = async (file) => {
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/test/upload', { method: 'POST', body: formData });
            const data = await res.json();
            
            const img = new Image();
            img.onload = () => {
                elements.canvas.width = img.width;
                elements.canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                if (data.detections) {
                    data.detections.forEach(det => drawBoundingBox(det));
                }
            };
            img.src = URL.createObjectURL(file);

            if (data.gate_event && data.gate_event.telemetry) {
                updateTelemetryCard(data.gate_event.telemetry);
                updateGateBarrierUI(data.gate_event.is_open, data.gate_event.message);
                if (data.gate_event.action === 'OPENED') audioFX.playAccessGranted();
                else if (data.gate_event.action === 'DENIED') audioFX.playAccessDenied();
                refreshLogs();
                refreshActiveSessions();
                refreshRegistry();
                refreshStats();
                fetchRTOConfig();
            }
        } catch (err) {
            console.error("Upload error:", err);
        }
    };

    fileInput.addEventListener('change', (e) => handleFileUpload(e.target.files[0]));
    if (mobileCameraInput) {
        mobileCameraInput.addEventListener('change', (e) => handleFileUpload(e.target.files[0]));
    }

    document.getElementById('modal-close-btn').addEventListener('click', closeImageModal);
    elements.imageModal.addEventListener('click', (e) => {
        if (e.target === elements.imageModal) closeImageModal();
    });
}

document.addEventListener('DOMContentLoaded', initApp);
