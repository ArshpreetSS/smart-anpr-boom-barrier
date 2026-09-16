# 🛡️ GateKeeper AI — Smart ANPR Boom Barrier Gate System

### Ultra-Fast Edge AI Computer Vision & Autonomous Boom Barrier Infrastructure for Indian Vehicles

<p align="left">
  <img src="https://img.shields.io/badge/Python-3.9%2B-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/FastAPI-0.100%2B-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Three.js-r128-black?style=for-the-badge&logo=three.js&logoColor=white" alt="Three.js" />
  <img src="https://img.shields.io/badge/PyTorch-2.0%2B-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white" alt="PyTorch" />
  <img src="https://img.shields.io/badge/OpenCV-4.8%2B-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white" alt="OpenCV" />
  <img src="https://img.shields.io/badge/TailwindCSS-3.3-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="TailwindCSS" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="License" />
</p>

---

## 📖 Overview

**GateKeeper AI** is an enterprise-grade, end-to-end **Automatic Number Plate Recognition (ANPR)** and **Autonomous Boom Barrier Gate Management System**.

Engineered specifically for Indian High-Security Registration Plates (HSRP) and Bharat (BH) series vehicles, the platform delivers sub-millisecond character inference, physical hardware relay automation via serial communication (`COM4`), live Parivahan RTO data verification with persistent SQLite caching, and a cinematic 3D WebGL user experience.

---

## 🌟 Key Architecture & Features

### ⚡ 1. Multi-Tier High-Speed Vision Engine
- **Primary Tier (`CharacterCNN`)**: Ultra-lightweight 36-class alphanumeric PyTorch CNN trained specifically on **Charles Wright (HSRP)** typography. Batch tensor inference with `torch.inference_mode()` executes in **under 1 ms**!
- **Secondary Tier (`EasyOCR Ensemble`)**: High-accuracy fallback for multi-angle, skewed, or dirty plates with dimension-clamped processing (320 × 70) executing in **under 30 ms**.
- **Supported Plate Formats**:
  - `AA 00 AA 0000` (e.g. `MH 12 AB 1234`, `RJ 14 CV 0002`)
  - `AA 00 A 0000` (e.g. `MH 12 A 1234`, `DL 01 C 5678`)
  - **Two-Line / Double-Decker Plates** (e.g. `AP 39 MF 5893`)
  - `22 BH 4567 AA` (Bharat Series)
  - `AA 0 A 0000` and `AA 00 0000`

### 🌐 2. Pinned Scroll-Driven 3D Storytelling Experience
- **Cinema-Grade WebGL Narrative**: Scrubbed 6-act scroll progression powered by Three.js, Lenis, and GSAP ScrollTrigger:
  1. `0–20%` — Wide establishing view of the security checkpoint and illuminated roadway.
  2. `20–40%` — Elevated stanchion surveillance view; Liquid Titanium EV approaches with active green laser scanning fan.
  3. `40–60%` — Macro camera push into front bumper; laser scanline sweeps across 4K embossed HSRP plate (`PB 12 AB 1234`).
  4. `60–75%` — Plate morphs into 650 glowing cyber particles assembling into a 5-node AI neural DAG.
  5. `75–90%` — Neural particles stream into barrier actuator; status flips to `ACCESS GRANTED`, signal turns green, and boom barrier arm lifts upright ($80^\circ$).
  6. `90–100%` — Vehicle drives forward through the gate corridor into the facility.
- **Continuous $C^1$ Catmull-Rom Spline**: Synchronous camera position and lookAt sampling for zero-hitching camera motion.
- **Multi-Scene Viewport Throttling**: `IntersectionObserver` controllers automatically pause off-screen 3D render loops to maximize GPU efficiency.

### 🎛️ 3. Security Command Center Operations Console (`/dashboard`)
- **Real-Time Telemetry Status Bar**:
  - `SYSTEM ONLINE` operational badge with radar beacon.
  - `COM4: STANDBY` hardware relay indicator.
  - `RTO Vahan` cloud gateway link status.
  - `AI Engine` dual-tier status, `FPS Counter`, and 24-hour `Live Clock (IST)`.
- **Compact Operations Left Sidebar**: Quick switching across Dashboard, Live Gate, Vehicles Inside, Audit Sessions, Vahan Registry, plus instant Blacklist isolation and CSV log export.
- **Live ANPR Surveillance Viewport**: Dark glass viewport with CRT scanlines, animated laser sweep, and real-time `TARGET LOCK` CV HUD overlay.
- **Smart Boom Barrier Visualizer**: Heavy-duty animated SVG barrier arm with vertical 4-step status progression (`[01 IDLE] -> [02 DETECT] -> [03 VERIFY] -> [04 OPEN]`).
- **Indian Vahan Identity HUD**: Embossed HSRP plate with Ashoka Chakra hologram, multi-frame consensus stabilization bar, and live vehicle dossier card.

### ⚡ 4. Cinematic System Boot & Initialization Sequence
- **Realistic Boot Experience**: Executes on initial visit or browser reload with zero generic loading spinners.
- **Sequence Stages**:
  - `07%` — `INITIALIZING AI CORE...`
  - `24%` — `LOADING COMPUTER VISION...`
  - `48%` — `CONNECTING TO ANPR ENGINE...`
  - `71%` — `INITIALIZING CAMERA...`
  - `82%` — `CONNECTING TO RTO / VAHAN...`
  - `93%` — `CHECKING DATABASE...`
  - `98%` — `CONNECTING TO GATE CONTROLLER...`
  - `100%` — `SYSTEM READY`
- **Technical Accents**: Ambient cyber particles, CRT scanline overlay, corner telemetry metadata, and micro hardware diagnostic log ticker.
- **Adaptive Timing**: Automatically runs in ~1.4s on fresh load and accelerates to ~0.9s on cached reload. Smoothly dissolves away via opacity, scale, blur, and iris clip-path.

### 🚧 5. Hardware Boom Barrier Control (`COM4` Serial Port)
- Built-in `SerialGateController` transmitting `OPEN\n` and `CLOSE\n` over RS-232 / USB Serial (`COM4` default, 9600 baud).
- **Graceful Standby Fallback**: Seamless simulated standby mode when physical microcontroller / relay hardware is unplugged without crashing the app.
- **REST Endpoints for Hardware Telemetry**: `/api/serial/status`, `/api/serial/send`, and `/api/serial/config`.

### ⏱️ 6. Smart 5-Minute Entry & Exit Rules Engine
- **1st Detection**: Registers vehicle as **`INSIDE`**, unlocks boom barrier, and starts stay timer.
- **Scanned Under 5 Minutes**: Applies cooldown warning to prevent duplicate gate triggers.
- **Scanned After 5 Minutes**: Automatically records **`COMPLETED`** exit event, logs total stay duration, and lifts gate for exit.

### 🔍 7. Indian RTO / Vahan Integration (RapidAPI)
- Automatic first-time vehicle verification fetching **Owner Name (masked)**, **Vehicle Model**, **Fuel Type (Petrol, Diesel, EV, CNG)**, and **Registration District**.
- **Permanent SQLite Registry Cache**: Only calls external API on first encounter per plate, reducing API quota usage to 0 for subsequent visits.

---

## ⚡ Performance Benchmarks

Inference times measured on standard CPU:

| Test Sample / Scenario | Detected Plate | Processing Latency | Real-Time Frame Rate | Active Engine Tier |
| :--- | :--- | :---: | :---: | :--- |
| **Standard HSRP Bumper 1** | `MH 12 AB 1234` | **5.58 ms** | **179.2 FPS** | `CharacterCNN (Tier 1)` |
| **Standard HSRP Bumper 2** | `DL 01 C 5678` | **4.25 ms** | **235.3 FPS** | `CharacterCNN (Tier 1)` |
| **Two-Line (Double-Decker)** | `AP 39 MF 5893` | **24.97 ms** | **40.0 FPS** | `EasyOCR Ensemble (Tier 2)` |
| **Real Car Photo with Reflection** | `RJ 14 CV 0002` | **29.74 ms** | **33.6 FPS** | `EasyOCR Ensemble (Tier 2)` |

---

## 📂 Project Structure

```
GateKeeper-AI/
│
├── app.py                            # FastAPI asynchronous application core
├── requirements.txt                  # Python dependencies
├── README.md                         # Project documentation
├── .gitignore
├── .env.example                      # RapidAPI credentials template
│
├── database/
│   └── gate_records.db               # SQLite database (sessions, logs, vehicle registry)
│
├── static/
│   ├── css/
│   │   ├── landing.css               # 3D landing page & cyber command center styling
│   │   └── style.css                 # Operational dashboard styles & HSRP plate components
│   │
│   ├── js/
│   │   ├── system-boot.js            # Cinematic system boot & initialization sequence
│   │   ├── landing-scroll-3d.js      # Scroll-driven 3D WebGL storytelling engine
│   │   ├── landing-architecture-3d.js# 3D connected AI architecture DAG
│   │   ├── landing-security-3d.js    # 3D holographic security shield
│   │   ├── landing-cta-3d.js         # Close-up 3D boom barrier interaction
│   │   ├── landing-demo.js           # Interactive ANPR fleet testing simulator
│   │   ├── landing-app.js            # Navigation, calculator modal, and UI controllers
│   │   └── main.js                   # Dashboard WebSocket streaming & hardware control
│   │
│   ├── sample_plates/                # Real Indian license plate image dataset
│   └── sounds/                       # Audio feedback effects (access granted/denied)
│
├── templates/
│   ├── index.html                    # Futuristic 3D landing page
│   └── dashboard.html                # Security operations command center console
│
├── scripts/
│   ├── benchmark_anpr_speed.py       # ANPR speed and FPS benchmark utility
│   ├── generate_sample_plates.py     # Synthetic Charles Wright HSRP plate generator
│   └── migrate_db.py                 # SQLite database schema migration script
│
└── training/
    └── train_character_cnn.py        # PyTorch CharacterCNN training pipeline
```

---

## 🚀 Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/ArshpreetSS/smart-anpr-boom-barrier.git
cd smart-anpr-boom-barrier
```

### 2. Create and Activate a Virtual Environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux / macOS
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Optional: Configure Environment Variables
Copy `.env.example` to `.env` and fill in your RapidAPI key if you want live Indian RTO data:
```bash
cp .env.example .env
```

---

## 🏃 Running the Application

### Start the Server
```bash
python -m uvicorn app:app --host 0.0.0.0 --port 8000
```

### Access Portals
- **Futuristic 3D Landing Page**: [http://localhost:8000](http://localhost:8000)
- **Security Operations Console**: [http://localhost:8000/dashboard](http://localhost:8000/dashboard)
- **Mobile Device Access (Same Wi-Fi)**: `http://<YOUR_LOCAL_IP>:8000`

---

## 🔌 Hardware Boom Barrier (Serial Port)

To connect an Arduino / ESP32 / Relay module to operate physical boom barriers:
1. Connect the microcontroller via USB (e.g. `COM4` on Windows or `/dev/ttyUSB0` on Linux).
2. The system automatically sends:
   - `b"OPEN\n"` when a vehicle is authorized to enter or exit.
   - `b"CLOSE\n"` when the gate timer expires or cooldown finishes.

---

## 📡 REST & WebSocket API

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `WS` | `/ws/stream` | Real-time video frame ingestion & ANPR telemetry stream |
| `GET` | `/` | Futuristic 3D WebGL landing page |
| `GET` | `/dashboard` | Security operations command center console |
| `GET` | `/api/stats` | Live telemetry (ingress, egress, occupancy, alerts, gate angle) |
| `GET` | `/api/system/network-info`| Local IP, port, and mobile pairing URL |
| `GET` | `/api/sessions/active` | Active vehicle parking sessions currently inside |
| `GET` | `/api/sessions/history` | Historical completed ingress/egress audit ledger |
| `GET` | `/api/serial/status` | Current COM4 hardware connection status |
| `POST`| `/api/serial/send` | Send manual `OPEN` or `CLOSE` command to hardware |
| `POST`| `/api/serial/config` | Change serial port name or baudrate |
| `POST`| `/api/gate/override` | Manual operator gate override (`OPEN` / `CLOSE`) |
| `POST`| `/api/test/upload` | Upload a photo file for immediate ANPR analysis |

---

## 📄 License

This project is open-source and licensed under the **MIT License**.
