# 🛡️ GateKeeper AI — Smart ANPR Boom Barrier Gate System

### Ultra-Fast Edge AI Computer Vision & Boom Barrier Automation System for Indian HSRP Number Plates

<p align="left">
  <img src="https://img.shields.io/badge/Python-3.9%2B-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/FastAPI-0.100%2B-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/PyTorch-2.0%2B-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white" alt="PyTorch" />
  <img src="https://img.shields.io/badge/OpenCV-4.8%2B-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white" alt="OpenCV" />
  <img src="https://img.shields.io/badge/TailwindCSS-3.3-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="TailwindCSS" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="License" />
</p>

---

## 📖 Overview

**GateKeeper AI** is a production-ready, end-to-end **Automatic Number Plate Recognition (ANPR)** and **Smart Parking / Boom Barrier Gate Management System**. 

Engineered specifically for Indian High-Security Registration Plates (HSRP), the system provides real-time vehicle entry/exit tracking, automated boom barrier gate control via physical hardware serial ports (`COM4`), and live RTO vehicle data verification with persistent SQLite caching.

---

## 🌟 Key Features

### ⚡ 1. Multi-Tier High-Speed Vision Engine
- **Primary Tier (`CharacterCNN`)**: Ultra-lightweight 36-class alphanumeric PyTorch CNN trained specifically on **Charles Wright (HSRP)** typography. Features batch tensor inference with `torch.inference_mode()` executing in **under 1 ms**!
- **Secondary Tier (`EasyOCR Ensemble`)**: High-accuracy fallback for multi-angle, skewed, or dirty plates with dimension-clamped processing (320 × 70) running in **under 30 ms**.
- **Supported Plate Formats**:
  - `AA 00 AA 0000` (e.g. `MH 12 AB 1234`, `RJ 14 CV 0002`)
  - `AA 00 A 0000` (e.g. `MH 12 A 1234`, `DL 01 C 5678`)
  - **Two-Line / Double-Decker Plates** (e.g. `AP 39 MF 5893`)
  - `22 BH 4567 AA` (Bharat Series)
  - `AA 0 A 0000` and `AA 00 0000`

### 🚧 2. Hardware Boom Barrier Control (`COM4` Serial Port)
- Built-in `SerialGateController` transmitting `OPEN\n` and `CLOSE\n` over RS-232 / USB Serial (`COM4` default, 9600 baud).
- **Graceful Standby Fallback**: Seamless simulated standby mode when physical microcontroller / relay hardware is unplugged without crashing the app.
- **REST Endpoints for Hardware Telemetry**: `/api/serial/status`, `/api/serial/send`, and `/api/serial/config`.

### ⏱️ 3. Smart 5-Minute Entry & Exit Rules Engine
- **1st Detection**: Registers vehicle as **`INSIDE`**, unlocks boom barrier, and starts the stay timer.
- **Scanned Under 5 Minutes**: Applies cooldown warning to prevent duplicate gate triggers.
- **Scanned After 5 Minutes**: Automatically records **`COMPLETED`** exit event, logs total stay duration, and lifts the gate for exit.

### 🔍 4. Indian RTO / Vahan Integration (RapidAPI)
- Automatic first-time vehicle verification fetching **Owner Name (masked)**, **Vehicle Model**, **Fuel Type (Petrol, Diesel, EV, CNG)**, and **Registration District**.
- **Permanent SQLite Registry Cache**: Only calls external API on first encounter per plate, reducing API costs to 0 for subsequent visits.

### 📱 5. Responsive Dark-Mode Dashboard & Mobile Streaming
- Built with Tailwind CSS, Lucide icons, and Canvas overlay.
- Adaptive WebSocket frame pump (`isFrameInFlight`) streaming at **30–60 FPS** with 0 frame lag.
- Interactive SVG boom barrier with mechanical angle easing and LED signal indicator.
- Instant QR code modal for mobile phone camera access on local Wi-Fi.

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
smart-anpr-boom-barrier/
├── app.py                      # Core FastAPI app, ANPR Pipeline, GateManager & SQLite ORM
├── requirements.txt            # Python package dependencies
├── .gitignore                  # Git ignore rules for bytecode, databases & uploads
├── .env.example                # Configuration template
├── benchmark_anpr_speed.py     # High-speed ANPR latency & FPS benchmarking script
├── test_anpr.py                # End-to-end unit and integration tests
├── test_serial_and_charles_wright.py # Hardware serial port & Charles Wright OCR verification
├── train_character_cnn.py      # CharacterCNN dataset generator & PyTorch trainer
├── generate_sample_plates.py   # Charles Wright synthetic HSRP plate generator
├── models/
│   ├── ocr_model.pth           # Trained PyTorch CharacterCNN weights (36 classes)
│   └── fonts/
│       └── CharlesWright-Bold.otf # Official Indian HSRP typeface
├── templates/
│   └── index.html              # Modern dark-mode dashboard UI
├── static/
│   ├── css/custom.css          # HSRP styling, mechanical boom barrier CSS
│   ├── js/app.js               # WebSocket stream client, canvas painter, Web Audio
│   └── sample_plates/          # Gallery test plates and sample vehicle bumper images
└── uploads/                    # Directory for cropped plate images saved during gate events
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
Or for custom port (e.g. 8888):
```bash
python -m uvicorn app:app --host 0.0.0.0 --port 8888
```

### Access Dashboard
- **Local PC / Laptop**: [http://localhost:8000](http://localhost:8000) (or port `8888`)
- **Mobile Device (Same Wi-Fi)**: `http://<YOUR_LOCAL_IP>:8000` (e.g. `http://192.168.1.5:8000`)

---

## 🧪 Running Automated Tests & Benchmarks

```bash
# Run ANPR Speed & FPS Benchmark
python benchmark_anpr_speed.py

# Run Full Test Suite (OCR, Regex, DB Sessions, Cooldowns)
python test_anpr.py

# Run Hardware COM4 & Charles Wright Font Tests
python test_serial_and_charles_wright.py
```

---

## 🔌 Hardware Boom Barrier (Serial Port)

To connect an Arduino / ESP32 / Relay module to operate physical boom barriers:
1. Plug the microcontroller into your computer via USB (e.g. assigned as `COM4` on Windows or `/dev/ttyUSB0` on Linux).
2. The system automatically sends:
   - `b"OPEN\n"` when vehicle is authorized to enter or exit.
   - `b"CLOSE\n"` when gate timer expires or cooldown finishes.

---

## 📡 REST & WebSocket API

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `WS` | `/ws/stream` & `/ws` | Real-time video frame ingestion & ANPR telemetry stream |
| `GET` | `/api/stats` | System statistics (entries, exits, gate state, hardware status) |
| `GET` | `/api/system/network-info`| Returns local IP, port, and mobile connection URL |
| `GET` | `/api/sessions/active` | Active vehicle sessions currently inside |
| `GET` | `/api/sessions/history` | Historical completed entry/exit logs |
| `GET` | `/api/serial/status` | Current COM4 hardware connection status |
| `POST`| `/api/serial/send` | Send manual `OPEN` or `CLOSE` command to hardware |
| `POST`| `/api/serial/config` | Change serial port name or baudrate |
| `POST`| `/api/gate/override` | Manual operator gate override (`OPEN` / `CLOSE`) |
| `POST`| `/api/test/upload` | Upload a photo file for immediate ANPR analysis |

---

## 📄 License

This project is open-source and licensed under the **MIT License**.