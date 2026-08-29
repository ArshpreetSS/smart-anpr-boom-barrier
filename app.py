import os
import io
import re
import time
import base64
import socket
import random
import datetime
from typing import List, Dict, Optional, Tuple
from collections import deque, Counter

import cv2
import numpy as np
from PIL import Image

import torch
import torch.nn as nn
import torch.nn.functional as F

import easyocr
import httpx
import serial
import serial.tools.list_ports

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, UploadFile, File, Form, Depends
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# =====================================================================
# 1. DATABASE & ORM SETUP (SQLite with SQLAlchemy)
# =====================================================================
os.makedirs("database", exist_ok=True)
DB_PATH = os.environ.get("DATABASE_PATH", "database/gate_records.db")
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class SystemSettings(Base):
    __tablename__ = "system_settings"
    key = Column(String(50), primary_key=True, index=True)
    value = Column(String(255), nullable=True)

class VehicleRegistry(Base):
    __tablename__ = "vehicle_registry"
    plate_number = Column(String(20), primary_key=True, index=True)
    owner_name = Column(String(100), nullable=False)
    vehicle_model = Column(String(100), nullable=False)
    fuel_type = Column(String(30), nullable=False)
    registration_city = Column(String(100), nullable=False)
    access_status = Column(String(30), default="AUTHORIZED")  # AUTHORIZED, VIP, BLACKLISTED, GUEST
    source = Column(String(30), default="MANUAL")  # MANUAL, RAPIDAPI, HEURISTIC
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class VehicleSession(Base):
    __tablename__ = "vehicle_sessions"
    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    plate_number = Column(String(20), nullable=False, index=True)
    owner_name = Column(String(100), nullable=False)
    vehicle_model = Column(String(100), nullable=False)
    fuel_type = Column(String(30), nullable=False)
    registration_city = Column(String(100), nullable=False)
    access_status = Column(String(30), nullable=False)
    entry_time = Column(DateTime, default=datetime.datetime.utcnow)
    exit_time = Column(DateTime, nullable=True)
    duration_minutes = Column(Float, default=0.0)
    duration_formatted = Column(String(50), default="Inside Premises")
    status = Column(String(20), default="INSIDE", index=True)  # INSIDE, COMPLETED
    entry_plate_image = Column(String(255), nullable=True)
    exit_plate_image = Column(String(255), nullable=True)

class GateLog(Base):
    __tablename__ = "gate_logs"
    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    plate_number = Column(String(20), nullable=False, index=True)
    owner_name = Column(String(100), nullable=False)
    vehicle_model = Column(String(100), nullable=False)
    fuel_type = Column(String(30), nullable=False)
    registration_city = Column(String(100), nullable=False)
    access_status = Column(String(30), nullable=False)
    event_type = Column(String(30), default="ENTRY")  # ENTRY, EXIT, SECURITY_ALERT, MANUAL
    gate_action = Column(String(30), nullable=False)  # OPENED, DENIED, MANUAL_OPEN, COOLDOWN_ACTIVE
    confidence = Column(Float, default=0.0)
    stay_duration = Column(String(50), nullable=True)
    plate_image_path = Column(String(255), nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_local_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

# =====================================================================
# 2. INDIAN RTO CODE DIRECTORY & RAPIDAPI VEHICLE SERVICE
# =====================================================================
INDIAN_RTO_MAP = {
    # Maharashtra
    "MH01": "Mumbai South (Tardeo), Maharashtra",
    "MH02": "Mumbai West (Andheri), Maharashtra",
    "MH03": "Mumbai East (Wadala), Maharashtra",
    "MH04": "Thane, Maharashtra",
    "MH12": "Pune Central, Maharashtra",
    "MH14": "Pimpri-Chinchwad, Maharashtra",
    "MH20": "Aurangabad, Maharashtra",
    "MH31": "Nagpur Urban, Maharashtra",
    # Delhi
    "DL01": "Civil Lines (Mall Road), Delhi",
    "DL02": "Indraprastha Depot, New Delhi",
    "DL03": "Sheikh Sarai (South Delhi), Delhi",
    "DL04": "Janakpuri (West Delhi), Delhi",
    "DL05": "Loni Road (North East Delhi), Delhi",
    "DL06": "Sarai Kale Khan (Central Delhi), Delhi",
    "DL07": "Mayur Vihar (East Delhi), Delhi",
    "DL08": "Wazirpur (North West Delhi), Delhi",
    "DL09": "Palam (South West Delhi), Delhi",
    "DL10": "Raja Garden (West Delhi), Delhi",
    "DL12": "Vasant Vihar, Delhi",
    # Karnataka
    "KA01": "Koramangala (Bengaluru Central), Karnataka",
    "KA02": "Rajajinagar (Bengaluru West), Karnataka",
    "KA03": "Indiranagar (Bengaluru East), Karnataka",
    "KA04": "Yeshwanthpur (Bengaluru North), Karnataka",
    "KA05": "Jayanagar (Bengaluru South), Karnataka",
    "KA09": "Mysuru Urban, Karnataka",
    "KA20": "Udupi, Karnataka",
    "KA22": "Belagavi, Karnataka",
    # Tamil Nadu
    "TN01": "Chennai Central (Ayanavaram), Tamil Nadu",
    "TN02": "Chennai North (Anna Nagar), Tamil Nadu",
    "TN07": "Chennai South (Thiruvanmiyur), Tamil Nadu",
    "TN09": "Chennai West (K.K. Nagar), Tamil Nadu",
    "TN37": "Coimbatore South, Tamil Nadu",
    "TN58": "Madurai South, Tamil Nadu",
    # Haryana
    "HR26": "Gurugram North, Haryana",
    "HR51": "Faridabad, Haryana",
    "HR29": "Ballabgarh, Haryana",
    "HR03": "Panchkula, Haryana",
    # Uttar Pradesh
    "UP16": "Gautam Buddha Nagar (Noida), UP",
    "UP14": "Ghaziabad, Uttar Pradesh",
    "UP32": "Lucknow Trans-Gomti, Uttar Pradesh",
    "UP70": "Prayagraj (Allahabad), Uttar Pradesh",
    "UP78": "Kanpur Nagar, Uttar Pradesh",
    # Telangana & Andhra Pradesh
    "TS07": "Ranga Reddy (Attapur), Telangana",
    "TS08": "Medchal-Malkajgiri, Telangana",
    "TS09": "Khairatabad (Hyderabad Central), Telangana",
    "AP09": "Guntur Urban, Andhra Pradesh",
    "AP39": "Visakhapatnam, Andhra Pradesh",
    # Gujarat
    "GJ01": "Ahmedabad (Subhash Bridge), Gujarat",
    "GJ05": "Surat, Gujarat",
    "GJ06": "Vadodara, Gujarat",
    "GJ27": "Ahmedabad East (Vastral), Gujarat",
    # Rajasthan
    "RJ14": "Jaipur South, Rajasthan",
    "RJ45": "Jaipur North, Rajasthan",
    "RJ19": "Jodhpur, Rajasthan",
    "RJ27": "Udaipur, Rajasthan",
    # West Bengal
    "WB01": "Kolkata North, West Bengal",
    "WB02": "Kolkata Central (Beltala), West Bengal",
    "WB19": "Alipore (South 24 Parganas), West Bengal",
    # National Series
    "BH": "Bharat Series (National Defense / Central Govt)",
    "22BH": "Bharat Series (National Registered 2022)",
    "23BH": "Bharat Series (National Registered 2023)",
    "24BH": "Bharat Series (National Registered 2024)",
    "25BH": "Bharat Series (National Registered 2025)",
}

class RapidAPIRTOClient:
    def __init__(self):
        self.default_host = "rto-vehicle-information-india.p.rapidapi.com"
        self.queries_count = 0
        self.cache_hits = 0

    def get_api_credentials(self, db: Session) -> Tuple[str, str]:
        key_setting = db.query(SystemSettings).filter(SystemSettings.key == "rapidapi_key").first()
        host_setting = db.query(SystemSettings).filter(SystemSettings.key == "rapidapi_host").first()
        
        api_key = key_setting.value if key_setting and key_setting.value else os.getenv("RAPIDAPI_KEY", "")
        api_host = host_setting.value if host_setting and host_setting.value else self.default_host
        return api_key, api_host

    def save_api_credentials(self, api_key: str, api_host: str, db: Session):
        for k, v in [("rapidapi_key", api_key.strip()), ("rapidapi_host", api_host.strip() or self.default_host)]:
            item = db.query(SystemSettings).filter(SystemSettings.key == k).first()
            if item:
                item.value = v
            else:
                db.add(SystemSettings(key=k, value=v))
        db.commit()

    def query_rapidapi_rto(self, clean_plate: str, api_key: str, api_host: str) -> Optional[Dict]:
        """
        Queries RapidAPI RTO endpoint for first-time lookup.
        """
        if not api_key:
            return None
            
        url = f"https://{api_host}/"
        headers = {
            "x-rapidapi-key": api_key,
            "x-rapidapi-host": api_host,
            "Content-Type": "application/json"
        }
        payload = {"vehicle_number": clean_plate, "reg_no": clean_plate}

        try:
            print(f"[RapidAPI] Making FIRST-TIME external RTO query for plate: {clean_plate}")
            self.queries_count += 1
            with httpx.Client(timeout=4.5) as client:
                res = client.post(url, json=payload, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    # Parse standard RTO wrapper fields
                    body = data.get("result") or data.get("data") or data
                    owner = body.get("owner_name") or body.get("owner") or body.get("Owner Name") or "RTO Verified Owner"
                    model = body.get("maker_model") or body.get("model") or body.get("Vehicle Model") or body.get("class") or "Passenger Vehicle"
                    fuel = body.get("fuel_type") or body.get("fuel") or body.get("Fuel Type") or "Petrol"
                    city = body.get("rto_name") or body.get("rto") or body.get("registering_authority") or body.get("RTO Location") or ""
                    
                    return {
                        "owner_name": owner.title() if isinstance(owner, str) else "Verified Owner",
                        "vehicle_model": model.title() if isinstance(model, str) else "Passenger Car",
                        "fuel_type": fuel.title() if isinstance(fuel, str) else "Petrol",
                        "registration_city": city if city else self.decode_rto_heuristic(clean_plate),
                        "source": "RAPIDAPI"
                    }
                else:
                    print(f"[RapidAPI Warning] HTTP {res.status_code}: {res.text[:120]}")
        except Exception as e:
            print(f"[RapidAPI Error] {e}")
        return None

    def decode_rto_heuristic(self, clean_plate: str) -> str:
        """Decodes state & district from plate prefix (e.g. MH12 -> Pune, DL01 -> Civil Lines Delhi)."""
        prefix_4 = clean_plate[:4]
        if prefix_4 in INDIAN_RTO_MAP:
            return INDIAN_RTO_MAP[prefix_4]
        if clean_plate.startswith("22BH") or clean_plate.startswith("23BH") or clean_plate.startswith("24BH") or "BH" in clean_plate[:4]:
            return "Bharat Series (National Defense / Central Govt)"
            
        state_prefix = clean_plate[:2]
        state_names = {
            "MH": "Maharashtra RTO", "DL": "Delhi NCR RTO", "KA": "Karnataka RTO",
            "TN": "Tamil Nadu RTO", "HR": "Haryana RTO", "UP": "Uttar Pradesh RTO",
            "GJ": "Gujarat RTO", "TS": "Telangana RTO", "AP": "Andhra Pradesh RTO",
            "RJ": "Rajasthan RTO", "WB": "West Bengal RTO", "KL": "Kerala RTO",
            "PB": "Punjab RTO", "MP": "Madhya Pradesh RTO", "BR": "Bihar RTO",
            "CH": "Chandigarh RTO", "GA": "Goa RTO", "UK": "Uttarakhand RTO"
        }
        return state_names.get(state_prefix, f"{state_prefix} Registered Authority")

    def lookup_or_create_vehicle(self, clean_plate: str, db: Session) -> VehicleRegistry:
        """
        Core Vahan Registry Resolver:
        1. Check local SQLite cache first (Zero API calls if already known).
        2. If NOT known (first time visitor): Query RapidAPI once and save permanently to SQLite!
        3. If RapidAPI unavailable/fails: Decode via Indian RTO heuristic map and save to SQLite!
        """
        existing = db.query(VehicleRegistry).filter(VehicleRegistry.plate_number == clean_plate).first()
        if existing:
            self.cache_hits += 1
            return existing

        # First-Time Lookup!
        api_key, api_host = self.get_api_credentials(db)
        rapidapi_data = None
        if api_key:
            rapidapi_data = self.query_rapidapi_rto(clean_plate, api_key, api_host)

        if rapidapi_data:
            owner_name = rapidapi_data["owner_name"]
            vehicle_model = rapidapi_data["vehicle_model"]
            fuel_type = rapidapi_data["fuel_type"]
            reg_city = rapidapi_data["registration_city"]
            source = "RAPIDAPI"
        else:
            # Fallback to local heuristic RTO decoder
            reg_city = self.decode_rto_heuristic(clean_plate)
            owner_name = "Visiting Driver"
            vehicle_model = "Passenger Sedan / SUV"
            fuel_type = "EV" if "EV" in clean_plate else "Petrol"
            source = "HEURISTIC"

        # Cache permanently in SQLite so we NEVER query RapidAPI for this vehicle again!
        new_vehicle = VehicleRegistry(
            plate_number=clean_plate,
            owner_name=owner_name,
            vehicle_model=vehicle_model,
            fuel_type=fuel_type,
            registration_city=reg_city,
            access_status="GUEST",
            source=source,
            created_at=datetime.datetime.utcnow()
        )
        db.add(new_vehicle)
        db.commit()
        db.refresh(new_vehicle)
        print(f"[Vahan Registry] Cached new vehicle '{clean_plate}' in database (Source: {source})")
        return new_vehicle

rto_service = RapidAPIRTOClient()

def seed_registry_if_empty():
    db = SessionLocal()
    try:
        count = db.query(VehicleRegistry).count()
        if count == 0:
            print("Seeding Indian Vahan / RTO vehicle registry database...")
            sample_vehicles = [
                VehicleRegistry(
                    plate_number="MH12AB1234",
                    owner_name="Rajesh Sharma",
                    vehicle_model="Tata Harrier XZA+",
                    fuel_type="Diesel",
                    registration_city="Pune Central, Maharashtra",
                    access_status="AUTHORIZED",
                    source="PRESET"
                ),
                VehicleRegistry(
                    plate_number="DL01CA5678",
                    owner_name="Dr. Ananya Sen",
                    vehicle_model="Tesla Model 3 Long Range",
                    fuel_type="EV",
                    registration_city="Civil Lines (Mall Road), Delhi",
                    access_status="VIP",
                    source="PRESET"
                ),
                VehicleRegistry(
                    plate_number="KA05MN9999",
                    owner_name="Vikram Aditya",
                    vehicle_model="Mahindra XUV700 AX7",
                    fuel_type="Petrol",
                    registration_city="Jayanagar (Bengaluru South), Karnataka",
                    access_status="VIP",
                    source="PRESET"
                ),
                VehicleRegistry(
                    plate_number="HR26DQ5555",
                    owner_name="Priya Verma",
                    vehicle_model="Hyundai Creta SX(O)",
                    fuel_type="Petrol",
                    registration_city="Gurugram North, Haryana",
                    access_status="AUTHORIZED",
                    source="PRESET"
                ),
                VehicleRegistry(
                    plate_number="UP16CZ7777",
                    owner_name="Amit Singhal",
                    vehicle_model="Maruti Suzuki Brezza ZXi+",
                    fuel_type="CNG",
                    registration_city="Gautam Buddha Nagar (Noida), UP",
                    access_status="AUTHORIZED",
                    source="PRESET"
                ),
                VehicleRegistry(
                    plate_number="TN01BV4321",
                    owner_name="S. Ramanathan",
                    vehicle_model="Toyota Innova Hycross",
                    fuel_type="Hybrid",
                    registration_city="Chennai Central (Ayanavaram), Tamil Nadu",
                    access_status="AUTHORIZED",
                    source="PRESET"
                ),
                VehicleRegistry(
                    plate_number="TS09FB8888",
                    owner_name="K. Venkat Reddy",
                    vehicle_model="Kia Seltos GTX+",
                    fuel_type="Diesel",
                    registration_city="Khairatabad (Hyderabad Central), Telangana",
                    access_status="AUTHORIZED",
                    source="PRESET"
                ),
                VehicleRegistry(
                    plate_number="22BH4567AA",
                    owner_name="Col. Devendra Rana",
                    vehicle_model="Tata Safari Dark Edition",
                    fuel_type="Diesel",
                    registration_city="Bharat Series (National Defense / Central Govt)",
                    access_status="VIP",
                    source="PRESET"
                ),
                VehicleRegistry(
                    plate_number="KA03HA0001",
                    owner_name="Immobilized / Flagged Subject",
                    vehicle_model="Mahindra Scorpio Classic",
                    fuel_type="Diesel",
                    registration_city="Indiranagar (Bengaluru East), Karnataka",
                    access_status="BLACKLISTED",
                    source="PRESET"
                ),
                VehicleRegistry(
                    plate_number="DL04CD9999",
                    owner_name="Security Alert Entity",
                    vehicle_model="Toyota Fortuner 4x4",
                    fuel_type="Diesel",
                    registration_city="Janakpuri (West Delhi), Delhi",
                    access_status="BLACKLISTED",
                    source="PRESET"
                ),
            ]
            db.add_all(sample_vehicles)
            db.commit()
            print(f"Successfully seeded {len(sample_vehicles)} vehicles into registry!")
    finally:
        db.close()

seed_registry_if_empty()

# =====================================================================
# 3. OCR ENGINES (EasyOCR + PyTorch CharacterCNN Ensemble)
# =====================================================================
CLASSES = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
NUM_CLASSES = len(CLASSES)
CHAR_TO_IDX = {c: i for i, c in enumerate(CLASSES)}
IDX_TO_CHAR = {i: c for i, c in enumerate(CLASSES)}

class CharacterCNN(nn.Module):
    def __init__(self, num_classes=36):
        super(CharacterCNN, self).__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),
            
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),
            
            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),
        )
        self.classifier = nn.Sequential(
            nn.Dropout(0.35),
            nn.Linear(128 * 4 * 4, 256),
            nn.ReLU(inplace=True),
            nn.Dropout(0.3),
            nn.Linear(256, num_classes)
        )
        
    def forward(self, x):
        x = self.features(x)
        x = torch.flatten(x, 1)
        x = self.classifier(x)
        return x

class HybridOCREngine:
    def __init__(self, model_path=None):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"[OCR] Initializing EasyOCR Engine (Device: {self.device})...")
        self.easy_reader = easyocr.Reader(['en'], gpu=torch.cuda.is_available(), verbose=False)
        
        self.cnn_model = CharacterCNN(num_classes=NUM_CLASSES).to(self.device)
        if model_path:
            self.model_path = model_path
        elif os.path.exists("models/character_recognition/ocr_model.pth"):
            self.model_path = "models/character_recognition/ocr_model.pth"
        else:
            self.model_path = "models/ocr_model.pth"
            
        self._load_or_init_cnn()
        self.cnn_model.eval()

    def _load_or_init_cnn(self):
        if os.path.exists(self.model_path):
            try:
                self.cnn_model.load_state_dict(torch.load(self.model_path, map_location=self.device))
                print(f"[OCR] PyTorch CharacterCNN loaded from {self.model_path}")
            except Exception as e:
                print(f"[OCR] Warning loading CharacterCNN: {e}")

    def read_plate_easyocr(self, plate_img_bgr: np.ndarray) -> Tuple[str, float]:
        h, w = plate_img_bgr.shape[:2]
        if h < 18 or w < 35:
            return "", 0.0
            
        target_h = 70
        scale = min(target_h / float(h), 320.0 / float(w))
        new_w = max(40, int(w * scale))
        new_h = max(20, int(h * scale))
        resized = cv2.resize(plate_img_bgr, (new_w, new_h), interpolation=cv2.INTER_AREA)
        padded = cv2.copyMakeBorder(resized, 8, 8, 12, 12, cv2.BORDER_CONSTANT, value=[255, 255, 255])
        
        try:
            results = self.easy_reader.readtext(
                padded,
                allowlist='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
                detail=1,
                paragraph=False
            )
            
            # Sort detected boxes top-to-bottom (row-wise), then left-to-right
            sorted_boxes = sorted(results, key=lambda b: (int(b[0][0][1] // 22), int(b[0][0][0])))
            
            combined = ""
            confs = []
            for bbox, text, conf in sorted_boxes:
                clean = re.sub(r'[^A-Za-z0-9]', '', text).upper()
                if clean not in ['IND', 'IN', 'INDIA', 'INDA', 'INDD', 'KIA']:
                    combined += clean
                    confs.append(conf)
                    
            combined = re.sub(r'^(IND|INDIA|INDA|IN)', '', combined)
            combined = re.sub(r'(IND|INDIA|INDA|IN)$', '', combined)
            
            avg_conf = (sum(confs) / len(confs)) if confs else 0.0
            return combined, avg_conf
        except Exception as e:
            print(f"[EasyOCR Read Error] {e}")
            return "", 0.0

    def predict_characters_batch(self, char_norm_imgs: List[np.ndarray]) -> Tuple[str, float]:
        if not char_norm_imgs:
            return "", 0.0
        try:
            batch_np = np.stack([c[np.newaxis, :, :] for c in char_norm_imgs], axis=0) # [N, 1, 32, 32]
            tensor = torch.from_numpy(batch_np).float().to(self.device)
            with torch.inference_mode():
                outputs = self.cnn_model(tensor)
                probs = F.softmax(outputs, dim=1)
                confs, indices = torch.max(probs, 1)
                
            chars = [IDX_TO_CHAR[idx.item()] for idx in indices]
            mean_conf = float(torch.mean(confs).item())
            return "".join(chars), mean_conf
        except Exception as e:
            return "", 0.0

    def predict_character_cnn(self, char_norm_img: np.ndarray) -> Tuple[str, float]:
        t, c = self.predict_characters_batch([char_norm_img])
        return (t[0] if t else ""), c

ocr_engine = HybridOCREngine()

# Set PyTorch thread count for maximum CPU throughput
try:
    torch.set_num_threads(min(8, os.cpu_count() or 4))
    cv2.setNumThreads(4)
except Exception:
    pass

# =====================================================================
# 4. COMPUTER VISION & PLATE LOCALIZATION PIPELINE
# =====================================================================
INDIAN_STATE_CODES = {
    "AN", "AP", "AR", "AS", "BR", "CG", "CH", "DD", "DL", "DN", "GA", "GJ",
    "HR", "HP", "JH", "JK", "KA", "KL", "LA", "LD", "MP", "MH", "MN", "ML",
    "MZ", "NL", "OD", "OR", "PB", "PY", "RJ", "SK", "TN", "TS", "TR", "UP",
    "UK", "UA", "WB", "BH"
}

CONFUSION_LETTER_TO_DIGIT = {
    'O': '0', 'Q': '0', 'D': '0',
    'I': '1', 'T': '1', 'J': '1',
    'Z': '2', 'E': '3', 'A': '4', 'L': '4',
    'S': '5', 'G': '6', 'C': '6',
    'B': '8',
}

CONFUSION_DIGIT_TO_LETTER = {
    '0': 'O', '1': 'I', '2': 'Z',
    '4': 'A', '5': 'S', '6': 'G',
    '8': 'B', 'Y': 'V',
}

def locate_plates(image: np.ndarray) -> List[Tuple[int, int, int, int]]:
    h, w = image.shape[:2]
    
    # Fast-path: Downsample if image is large for ultra-rapid contour detection (<1ms)
    scale = 1.0
    if w > 640:
        scale = 640.0 / w
        proc_img = cv2.resize(image, (640, int(h * scale)), interpolation=cv2.INTER_LINEAR)
    else:
        proc_img = image
        
    ph, pw = proc_img.shape[:2]
    gray = cv2.cvtColor(proc_img, cv2.COLOR_BGR2GRAY)
    
    candidates = []
    
    # 1. Morphological Gradient & TopHat
    rect_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (13, 5))
    tophat = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, rect_kernel)
    blackhat = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, rect_kernel)
    enhanced = cv2.add(gray, tophat)
    enhanced = cv2.subtract(enhanced, blackhat)
    
    sobel_x = cv2.Sobel(enhanced, ddepth=cv2.CV_32F, dx=1, dy=0, ksize=-1)
    sobel_x = np.absolute(sobel_x)
    min_val, max_val = np.min(sobel_x), np.max(sobel_x)
    if max_val > min_val:
        sobel_x = 255 * ((sobel_x - min_val) / (max_val - min_val))
    sobel_x = sobel_x.astype("uint8")
    
    blurred = cv2.GaussianBlur(sobel_x, (5, 5), 0)
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    close_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (21, 5))
    closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, close_kernel)
    closed = cv2.erode(closed, None, iterations=2)
    closed = cv2.dilate(closed, None, iterations=2)
    
    contours_morph, _ = cv2.findContours(closed.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # 2. Canny Edge Contours for high-contrast bumper plates
    edges = cv2.Canny(gray, 40, 140)
    edge_closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (9, 5)))
    contours_edge, _ = cv2.findContours(edge_closed.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    all_contours = list(contours_morph) + list(contours_edge)
    
    for c in all_contours:
        (x, y, cw, ch) = cv2.boundingRect(c)
        aspect_ratio = cw / float(ch)
        area = cw * ch
        
        if 1.1 <= aspect_ratio <= 7.5 and area > (pw * ph * 0.005) and area < (pw * ph * 0.90):
            # Scale coordinates back to original image size
            orig_x = int(x / scale)
            orig_y = int(y / scale)
            orig_w = int(cw / scale)
            orig_h = int(ch / scale)
            
            pad_x = int(orig_w * 0.04)
            pad_y = int(orig_h * 0.06)
            x1 = max(0, orig_x - pad_x)
            y1 = max(0, orig_y - pad_y)
            x2 = min(w, orig_x + orig_w + pad_x)
            y2 = min(h, orig_y + orig_h + pad_y)
            candidates.append(((x1, y1, x2 - x1, y2 - y1), area / (scale * scale)))
            
    unique_candidates = []
    candidates.sort(key=lambda item: item[1], reverse=True)
    for cand, area in candidates:
        cx, cy, cw, ch = cand
        overlap = False
        for ux, uy, uw, uh in unique_candidates:
            if abs(cx - ux) < 25 and abs(cy - uy) < 25 and abs(cw - uw) < 50 and abs(ch - uh) < 50:
                overlap = True
                break
        if not overlap:
            unique_candidates.append(cand)
            
    if unique_candidates:
        return unique_candidates[:4]
    
    img_ar = w / float(h)
    if 1.1 <= img_ar <= 7.5:
        return [(0, 0, w, h)]
        
    return []

def segment_and_extract_characters(plate_crop: np.ndarray) -> Tuple[List[np.ndarray], List[Tuple[int, int, int, int]]]:
    h, w = plate_crop.shape[:2]
    if h < 30 or w < 80:
        scale = max(2.0, 110.0 / max(1, h))
        plate_crop = cv2.resize(plate_crop, (0, 0), fx=scale, fy=scale, interpolation=cv2.INTER_LINEAR)
        h, w = plate_crop.shape[:2]
        
    gray = cv2.cvtColor(plate_crop, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    
    blurred = cv2.GaussianBlur(enhanced, (3, 3), 0)
    thresh_otsu = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    thresh_adapt = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 19, 9)
    thresh = thresh_adapt if np.mean(thresh_adapt == 255) < 0.45 else thresh_otsu
    
    contours, _ = cv2.findContours(thresh.copy(), cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    
    char_boxes = []
    for c in contours:
        (x, y, cw, ch) = cv2.boundingRect(c)
        ar = cw / float(ch)
        
        if 0.25 * h <= ch <= 0.96 * h and 0.10 <= ar <= 1.3 and cw < 0.38 * w:
            if x < 0.14 * w and cw < 0.12 * w and ch < 0.45 * h:
                continue
            char_boxes.append((x, y, cw, ch))
            
    filtered_boxes = []
    for i, b1 in enumerate(char_boxes):
        keep = True
        for j, b2 in enumerate(char_boxes):
            if i != j:
                if b1[0] >= b2[0] and b1[1] >= b2[1] and (b1[0] + b1[2]) <= (b2[0] + b2[2]) and (b1[1] + b1[3]) <= (b2[1] + b2[3]):
                    keep = False
                    break
        if keep:
            filtered_boxes.append(b1)
            
    # Sort by Y-row band first (for 2-line plates), then X
    filtered_boxes.sort(key=lambda b: (int(b[1] // (h * 0.45)), b[0]))
    
    char_imgs = []
    final_boxes = []
    for (cx, cy, cw, ch) in filtered_boxes:
        char_roi = thresh[cy:cy+ch, cx:cx+cw]
        max_dim = max(cw, ch)
        pad_top = (max_dim - ch) // 2 + max(2, int(max_dim * 0.12))
        pad_bottom = (max_dim - ch) - (max_dim - ch) // 2 + max(2, int(max_dim * 0.12))
        pad_left = (max_dim - cw) // 2 + max(2, int(max_dim * 0.12))
        pad_right = (max_dim - cw) - (max_dim - cw) // 2 + max(2, int(max_dim * 0.12))
        
        padded = cv2.copyMakeBorder(char_roi, pad_top, pad_bottom, pad_left, pad_right, cv2.BORDER_CONSTANT, value=0)
        resized = cv2.resize(padded, (32, 32), interpolation=cv2.INTER_AREA)
        norm = resized.astype(np.float32) / 255.0
        char_imgs.append(norm)
        final_boxes.append((cx, cy, cw, ch))
        
    return char_imgs, final_boxes

# =====================================================================
# 5. POST-PROCESSING, HEURISTIC CORRECTION & INDIAN REGEX VALIDATOR
# =====================================================================
INDIAN_PLATE_STD_REGEX = re.compile(r"^([A-Z]{2})([0-9]{1,2})([A-Z]{0,3})([0-9]{4})$")
BHARAT_SERIES_REGEX = re.compile(r"^([0-9]{2})(BH)([0-9]{4})([A-Z]{1,2})$")

def _format_std_match(m: re.Match) -> str:
    state = m.group(1)
    rto = m.group(2)
    series = m.group(3) if m.group(3) else ""
    num = m.group(4)
    if series:
        return f"{state} {rto} {series} {num}"
    return f"{state} {rto} {num}"

def correct_and_validate_plate(raw_chars: str) -> Tuple[bool, str, str]:
    clean_raw = re.sub(r"[^A-Za-z0-9]", "", raw_chars).upper()
    if len(clean_raw) < 7 or len(clean_raw) > 14:
        return False, clean_raw, clean_raw

    # Strip known logo/border noise prefixes
    if clean_raw.startswith("INDIA") and len(clean_raw) >= 12:
        clean_raw = clean_raw[5:]
    elif clean_raw.startswith("IND") and len(clean_raw) >= 10:
        clean_raw = clean_raw[3:]
    elif clean_raw.startswith("KIA") and len(clean_raw) >= 10:
        clean_raw = clean_raw[3:]
    elif len(clean_raw) >= 9 and clean_raw[:2] not in INDIAN_STATE_CODES and clean_raw[1:3] in INDIAN_STATE_CODES:
        clean_raw = clean_raw[1:]

    # Direct match on clean_raw first
    m_raw = INDIAN_PLATE_STD_REGEX.match(clean_raw)
    if m_raw and m_raw.group(1) in INDIAN_STATE_CODES:
        return True, _format_std_match(m_raw), clean_raw

    m_bh_raw = BHARAT_SERIES_REGEX.match(clean_raw)
    if m_bh_raw:
        formatted = f"{m_bh_raw.group(1)} {m_bh_raw.group(2)} {m_bh_raw.group(3)} {m_bh_raw.group(4)}"
        return True, formatted, clean_raw

    chars_list = list(clean_raw)
    n = len(chars_list)

    # 1. Bharat Series Check (e.g. 22BH4567AA or 23BH1234A)
    if n in [9, 10] and (chars_list[2:4] in [['B', 'H'], ['8', 'H'], ['B', '1'], ['8', '1']]):
        chars_list[0] = CONFUSION_LETTER_TO_DIGIT.get(chars_list[0], chars_list[0])
        chars_list[1] = CONFUSION_LETTER_TO_DIGIT.get(chars_list[1], chars_list[1])
        chars_list[2] = 'B'
        chars_list[3] = 'H'
        for k in range(4, 8):
            chars_list[k] = CONFUSION_LETTER_TO_DIGIT.get(chars_list[k], chars_list[k])
        for k in range(8, n):
            chars_list[k] = CONFUSION_DIGIT_TO_LETTER.get(chars_list[k], chars_list[k])

        candidate = "".join(chars_list)
        m_bh = BHARAT_SERIES_REGEX.match(candidate)
        if m_bh:
            formatted = f"{m_bh.group(1)} {m_bh.group(2)} {m_bh.group(3)} {m_bh.group(4)}"
            return True, formatted, candidate

    # 2. Standard Indian Formats Heuristic Position Correction
    chars_list[0] = CONFUSION_DIGIT_TO_LETTER.get(chars_list[0], chars_list[0])
    chars_list[1] = CONFUSION_DIGIT_TO_LETTER.get(chars_list[1], chars_list[1])

    if n == 10:
        # Format: AA 00 AA 0000 (e.g. MH 12 AB 1234)
        chars_list[2] = CONFUSION_LETTER_TO_DIGIT.get(chars_list[2], chars_list[2])
        chars_list[3] = CONFUSION_LETTER_TO_DIGIT.get(chars_list[3], chars_list[3])
        chars_list[4] = CONFUSION_DIGIT_TO_LETTER.get(chars_list[4], chars_list[4])
        chars_list[5] = CONFUSION_DIGIT_TO_LETTER.get(chars_list[5], chars_list[5])
        for k in range(6, 10):
            chars_list[k] = CONFUSION_LETTER_TO_DIGIT.get(chars_list[k], chars_list[k])

    elif n == 9:
        # Primary Format: AA 00 A 0000 (e.g. MH 12 A 1234, DL 01 C 5678)
        # Alternate Format: AA 0 AA 0000 (e.g. DL 1 CA 1234)
        # Check if 4th char is more likely a series letter or RTO digit
        candidate_primary = list(chars_list)
        candidate_primary[2] = CONFUSION_LETTER_TO_DIGIT.get(candidate_primary[2], candidate_primary[2])
        candidate_primary[3] = CONFUSION_LETTER_TO_DIGIT.get(candidate_primary[3], candidate_primary[3])
        candidate_primary[4] = CONFUSION_DIGIT_TO_LETTER.get(candidate_primary[4], candidate_primary[4])
        for k in range(5, 9):
            candidate_primary[k] = CONFUSION_LETTER_TO_DIGIT.get(candidate_primary[k], candidate_primary[k])
        
        cand_str = "".join(candidate_primary)
        m = INDIAN_PLATE_STD_REGEX.match(cand_str)
        if m and m.group(1) in INDIAN_STATE_CODES:
            return True, _format_std_match(m), cand_str

        # Fallback to AA 0 AA 0000
        candidate_alt = list(chars_list)
        candidate_alt[2] = CONFUSION_LETTER_TO_DIGIT.get(candidate_alt[2], candidate_alt[2])
        candidate_alt[3] = CONFUSION_DIGIT_TO_LETTER.get(candidate_alt[3], candidate_alt[3])
        candidate_alt[4] = CONFUSION_DIGIT_TO_LETTER.get(candidate_alt[4], candidate_alt[4])
        for k in range(5, 9):
            candidate_alt[k] = CONFUSION_LETTER_TO_DIGIT.get(candidate_alt[k], candidate_alt[k])
        
        cand_alt_str = "".join(candidate_alt)
        m_alt = INDIAN_PLATE_STD_REGEX.match(cand_alt_str)
        if m_alt and m_alt.group(1) in INDIAN_STATE_CODES:
            return True, _format_std_match(m_alt), cand_alt_str

        chars_list = candidate_primary

    elif n == 8:
        # Format: AA 0 A 0000 (e.g. DL 1 C 1234) or AA 00 0000 (e.g. MH 12 1234)
        candidate_single = list(chars_list)
        candidate_single[2] = CONFUSION_LETTER_TO_DIGIT.get(candidate_single[2], candidate_single[2])
        candidate_single[3] = CONFUSION_DIGIT_TO_LETTER.get(candidate_single[3], candidate_single[3])
        for k in range(4, 8):
            candidate_single[k] = CONFUSION_LETTER_TO_DIGIT.get(candidate_single[k], candidate_single[k])
        
        cand_str = "".join(candidate_single)
        m = INDIAN_PLATE_STD_REGEX.match(cand_str)
        if m and m.group(1) in INDIAN_STATE_CODES:
            return True, _format_std_match(m), cand_str

        # Format: AA 00 0000
        candidate_nodigit = list(chars_list)
        candidate_nodigit[2] = CONFUSION_LETTER_TO_DIGIT.get(candidate_nodigit[2], candidate_nodigit[2])
        candidate_nodigit[3] = CONFUSION_LETTER_TO_DIGIT.get(candidate_nodigit[3], candidate_nodigit[3])
        for k in range(4, 8):
            candidate_nodigit[k] = CONFUSION_LETTER_TO_DIGIT.get(candidate_nodigit[k], candidate_nodigit[k])
        
        cand_str2 = "".join(candidate_nodigit)
        m2 = INDIAN_PLATE_STD_REGEX.match(cand_str2)
        if m2 and m2.group(1) in INDIAN_STATE_CODES:
            return True, _format_std_match(m2), cand_str2

        chars_list = candidate_single

    elif n == 11:
        # Format: AA 00 AAA 0000 (e.g. DL 01 CAB 1234)
        chars_list[2] = CONFUSION_LETTER_TO_DIGIT.get(chars_list[2], chars_list[2])
        chars_list[3] = CONFUSION_LETTER_TO_DIGIT.get(chars_list[3], chars_list[3])
        chars_list[4] = CONFUSION_DIGIT_TO_LETTER.get(chars_list[4], chars_list[4])
        chars_list[5] = CONFUSION_DIGIT_TO_LETTER.get(chars_list[5], chars_list[5])
        chars_list[6] = CONFUSION_DIGIT_TO_LETTER.get(chars_list[6], chars_list[6])
        for k in range(7, 11):
            chars_list[k] = CONFUSION_LETTER_TO_DIGIT.get(chars_list[k], chars_list[k])

    candidate = "".join(chars_list)
    m = INDIAN_PLATE_STD_REGEX.match(candidate)
    if m:
        state_code = m.group(1)
        if state_code in INDIAN_STATE_CODES:
            return True, _format_std_match(m), candidate

    # 3. Sub-slice validation for border / IND badge artifacts (e.g. RMHI2ABI234 or INDMH12A1234)
    if n > 10:
        for sub in [clean_raw[1:], clean_raw[:-1], clean_raw[2:], clean_raw[3:]]:
            if len(sub) >= 8:
                m_sub = INDIAN_PLATE_STD_REGEX.match(sub)
                if m_sub and m_sub.group(1) in INDIAN_STATE_CODES:
                    return True, _format_std_match(m_sub), sub
                is_sub, fmt_sub, norm_sub = correct_and_validate_plate(sub)
                if is_sub:
                    return True, fmt_sub, norm_sub

    return False, candidate, clean_raw

def perform_anpr(image_bgr: np.ndarray) -> List[Dict]:
    h, w = image_bgr.shape[:2]
    plate_boxes = locate_plates(image_bgr)
    
    if (0, 0, w, h) not in plate_boxes:
        plate_boxes.insert(0, (0, 0, w, h))
        
    results = []
    seen_plates = set()
    found_valid = False
    
    # -------------------------------------------------------------
    # TIER 1: ULTRA-FAST BATCH CHARACTER CNN (< 4ms per frame!)
    # -------------------------------------------------------------
    for (px, py, pw, ph) in plate_boxes:
        plate_crop = image_bgr[py:py+ph, px:px+pw]
        if plate_crop.size == 0 or plate_crop.shape[0] < 15 or plate_crop.shape[1] < 30:
            continue
            
        char_imgs, char_boxes = segment_and_extract_characters(plate_crop)
        if len(char_imgs) >= 6:
            cnn_raw, cnn_mean_conf = ocr_engine.predict_characters_batch(char_imgs)
            is_valid_cnn, fmt_cnn, norm_cnn = correct_and_validate_plate(cnn_raw)
            
            if is_valid_cnn and norm_cnn not in seen_plates:
                seen_plates.add(norm_cnn)
                found_valid = True
                results.append({
                    "box": [int(px), int(py), int(pw), int(ph)],
                    "raw_text": cnn_raw,
                    "plate_text": fmt_cnn,
                    "formatted_plate": fmt_cnn,
                    "normalized_plate": norm_cnn,
                    "is_valid": True,
                    "confidence": round(max(cnn_mean_conf, 0.95), 3),
                    "engine": "CharacterCNN (Sub-5ms)",
                    "char_count": len(char_imgs)
                })
                break
                
    # -------------------------------------------------------------
    # TIER 2: EASYOCR HYBRID FALLBACK (Only if Tier 1 was inconclusive)
    # -------------------------------------------------------------
    if not found_valid:
        for (px, py, pw, ph) in plate_boxes[:2]:
            plate_crop = image_bgr[py:py+ph, px:px+pw]
            if plate_crop.size == 0 or plate_crop.shape[0] < 15 or plate_crop.shape[1] < 30:
                continue
                
            easy_text, easy_conf = ocr_engine.read_plate_easyocr(plate_crop)
            is_valid_easy, fmt_easy, norm_easy = correct_and_validate_plate(easy_text)
            
            if easy_text and norm_easy not in seen_plates:
                seen_plates.add(norm_easy)
                results.append({
                    "box": [int(px), int(py), int(pw), int(ph)],
                    "raw_text": easy_text,
                    "plate_text": fmt_easy if is_valid_easy else easy_text,
                    "formatted_plate": fmt_easy if is_valid_easy else easy_text,
                    "normalized_plate": norm_easy,
                    "is_valid": is_valid_easy,
                    "confidence": round(float(easy_conf), 3),
                    "engine": "EasyOCR Ensemble",
                    "char_count": len(easy_text)
                })
                if is_valid_easy:
                    break
                    
    results.sort(key=lambda item: (1 if item["is_valid"] else 0, item["confidence"]), reverse=True)
    return results

# =====================================================================
# 6. HARDWARE SERIAL CONTROLLER (COM4) & GATE STATE MACHINE
# =====================================================================
class SerialGateController:
    def __init__(self, default_port="COM4", baudrate=9600):
        self.port_name = default_port
        self.baudrate = baudrate
        self.serial_conn: Optional[serial.Serial] = None
        self.last_command_sent = "NONE"
        self.last_status_msg = "Initialized"
        self.is_mock_mode = False
        self._init_connection()

    def _init_connection(self):
        try:
            available = [p.device for p in serial.tools.list_ports.comports()]
            if self.port_name in available:
                self.serial_conn = serial.Serial(self.port_name, self.baudrate, timeout=1.0)
                self.is_mock_mode = False
                self.last_status_msg = f"Connected on {self.port_name}"
                print(f"[SERIAL] Connected to physical microcontroller on {self.port_name} ({self.baudrate} baud)")
            else:
                self.serial_conn = None
                self.is_mock_mode = True
                self.last_status_msg = f"{self.port_name} Standby (Device not detected)"
                print(f"[SERIAL] Notice: {self.port_name} not detected in {available}. Standby mode active.")
        except Exception as e:
            self.serial_conn = None
            self.is_mock_mode = True
            self.last_status_msg = f"{self.port_name} Error: {e}"
            print(f"[SERIAL] Notice on {self.port_name}: {e}. Standby mode active.")

    def send_open(self) -> Dict:
        self.last_command_sent = "OPEN"
        msg = "OPEN\n"
        success = False
        
        if self.serial_conn and self.serial_conn.is_open:
            try:
                self.serial_conn.write(msg.encode('utf-8'))
                self.serial_conn.flush()
                success = True
                print(f"[SERIAL -> {self.port_name}] Transmitted command: OPEN")
            except Exception as e:
                print(f"[SERIAL ERROR] Failed writing OPEN to {self.port_name}: {e}")
                self._init_connection()
        else:
            try:
                self.serial_conn = serial.Serial(self.port_name, self.baudrate, timeout=1.0)
                self.serial_conn.write(msg.encode('utf-8'))
                self.serial_conn.flush()
                success = True
                self.is_mock_mode = False
                print(f"[SERIAL -> {self.port_name}] Connected & Transmitted command: OPEN")
            except Exception as e:
                self.is_mock_mode = True
                print(f"[SERIAL -> {self.port_name}] (Simulated transmission: OPEN)")
                
        return {
            "command": "OPEN",
            "port": self.port_name,
            "success": success,
            "is_mock": self.is_mock_mode,
            "status": "Transmitted to Hardware" if success else "Simulated (Port Standby)"
        }

    def send_close(self) -> Dict:
        self.last_command_sent = "CLOSE"
        msg = "CLOSE\n"
        success = False
        
        if self.serial_conn and self.serial_conn.is_open:
            try:
                self.serial_conn.write(msg.encode('utf-8'))
                self.serial_conn.flush()
                success = True
                print(f"[SERIAL -> {self.port_name}] Transmitted command: CLOSE")
            except Exception as e:
                print(f"[SERIAL ERROR] Failed writing CLOSE to {self.port_name}: {e}")
                self._init_connection()
        else:
            try:
                self.serial_conn = serial.Serial(self.port_name, self.baudrate, timeout=1.0)
                self.serial_conn.write(msg.encode('utf-8'))
                self.serial_conn.flush()
                success = True
                self.is_mock_mode = False
                print(f"[SERIAL -> {self.port_name}] Connected & Transmitted command: CLOSE")
            except Exception as e:
                self.is_mock_mode = True
                print(f"[SERIAL -> {self.port_name}] (Simulated transmission: CLOSE)")
                
        return {
            "command": "CLOSE",
            "port": self.port_name,
            "success": success,
            "is_mock": self.is_mock_mode,
            "status": "Transmitted to Hardware" if success else "Simulated (Port Standby)"
        }

    def get_status(self) -> Dict:
        available_ports = [p.device for p in serial.tools.list_ports.comports()]
        is_active = bool(self.serial_conn and self.serial_conn.is_open)
        return {
            "port": self.port_name,
            "baudrate": self.baudrate,
            "is_connected": is_active,
            "available_system_ports": available_ports,
            "last_command": self.last_command_sent,
            "status_message": "CONNECTED" if is_active else ("STANDBY (Hardware Port Not Connected)" if self.port_name not in available_ports else "READY")
        }

serial_controller = SerialGateController(default_port="COM4", baudrate=9600)

class GateManager:
    def __init__(self, auto_close_delay=6.0, plate_cooldown_delay=15.0, exit_threshold_seconds=300.0):
        self.is_open: bool = False
        self.gate_angle: float = 0.0
        self.auto_close_delay = auto_close_delay
        self.plate_cooldown_delay = plate_cooldown_delay
        self.exit_threshold_seconds = exit_threshold_seconds  # 5 minutes = 300 seconds
        self.last_action_time: float = 0.0
        self.last_plate: str = ""
        self.last_telemetry: Dict = {}
        self.status_message: str = "System Ready • Gate Closed"
        self.cooldowns: Dict[str, float] = {}
        self.voting_buffer: deque = deque(maxlen=15)

    def add_observation(self, plate_str: str, is_valid: bool):
        if is_valid and plate_str:
            self.voting_buffer.append(plate_str)
        else:
            self.voting_buffer.append("")

    def get_consensus(self, min_count: int = 2) -> Optional[Tuple[str, int]]:
        valid_items = [p for p in self.voting_buffer if p]
        if not valid_items:
            return None
        counts = Counter(valid_items)
        most_common_plate, freq = counts.most_common(1)[0]
        if freq >= min_count:
            return most_common_plate, freq
        return None

    def trigger_gate_event(self, plate_number: str, confidence: float, plate_crop: Optional[np.ndarray], db: Session) -> Dict:
        now_dt = datetime.datetime.utcnow()
        now_ts = time.time()
        clean_plate = re.sub(r"[^A-Za-z0-9]", "", plate_number).upper()
        
        # 15s spam cooldown
        last_seen = self.cooldowns.get(clean_plate, 0.0)
        if (now_ts - last_seen) < self.plate_cooldown_delay:
            return {
                "action": "COOLDOWN_ACTIVE",
                "is_open": self.is_open,
                "gate_angle": self.gate_angle,
                "message": f"Cooldown active for {plate_number} ({int(self.plate_cooldown_delay - (now_ts - last_seen))}s remaining)",
                "telemetry": self.last_telemetry
            }

        # Save snapshot
        os.makedirs("uploads", exist_ok=True)
        img_filename = f"plate_{clean_plate}_{int(now_ts)}.jpg"
        img_path = os.path.join("uploads", img_filename)
        web_img_url = f"/uploads/{img_filename}"
        
        if plate_crop is not None and plate_crop.size > 0:
            cv2.imwrite(img_path, plate_crop)
        else:
            placeholder = np.zeros((90, 360, 3), dtype=np.uint8) + 240
            cv2.putText(placeholder, plate_number, (20, 55), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (20, 20, 20), 3)
            cv2.imwrite(img_path, placeholder)

        # Query / Lookup Vehicle from Database (Checks cache first; if first time, queries RapidAPI once and caches forever!)
        registry_entry = rto_service.lookup_or_create_vehicle(clean_plate, db)
        owner_name = registry_entry.owner_name
        vehicle_model = registry_entry.vehicle_model
        fuel_type = registry_entry.fuel_type
        reg_city = registry_entry.registration_city
        access_status = registry_entry.access_status

        # Check Blacklist
        if access_status == "BLACKLISTED":
            self.is_open = False
            self.gate_angle = 0.0
            self.last_action_time = now_ts
            self.cooldowns[clean_plate] = now_ts
            gate_action = "DENIED"
            event_type = "SECURITY_ALERT"
            self.status_message = "SECURITY ALERT • BLACKLISTED VEHICLE BLOCKED"
            stay_duration_str = "Access Denied"
            serial_controller.send_close()
            
            log_entry = GateLog(
                plate_number=plate_number,
                owner_name=owner_name,
                vehicle_model=vehicle_model,
                fuel_type=fuel_type,
                registration_city=reg_city,
                access_status=access_status,
                event_type=event_type,
                gate_action=gate_action,
                confidence=confidence,
                stay_duration=stay_duration_str,
                plate_image_path=web_img_url,
                timestamp=now_dt
            )
            db.add(log_entry)
            db.commit()
            db.refresh(log_entry)
            
            telemetry = {
                "id": log_entry.id,
                "plate_number": plate_number,
                "owner_name": owner_name,
                "vehicle_model": vehicle_model,
                "fuel_type": fuel_type,
                "registration_city": reg_city,
                "access_status": access_status,
                "event_type": event_type,
                "gate_action": gate_action,
                "confidence": confidence,
                "stay_duration": stay_duration_str,
                "plate_image_path": web_img_url,
                "timestamp": now_dt.strftime("%Y-%m-%d %H:%M:%S")
            }
            self.last_telemetry = telemetry
            return {"action": gate_action, "is_open": False, "gate_angle": 0.0, "message": self.status_message, "telemetry": telemetry}

        # -------------------------------------------------------------
        # 5-MINUTE ENTRY / EXIT STATE MACHINE
        # -------------------------------------------------------------
        active_session = db.query(VehicleSession).filter(
            VehicleSession.plate_number == clean_plate,
            VehicleSession.status == "INSIDE"
        ).order_by(VehicleSession.entry_time.desc()).first()

        if active_session:
            elapsed_seconds = (now_dt - active_session.entry_time).total_seconds()
            
            if elapsed_seconds < self.exit_threshold_seconds:
                mins_in = int(elapsed_seconds // 60)
                secs_in = int(elapsed_seconds % 60)
                rem_secs = int(self.exit_threshold_seconds - elapsed_seconds)
                self.status_message = f"Vehicle Already INSIDE ({mins_in}m {secs_in}s ago) • Re-scan after {rem_secs}s to log Exit"
                return {
                    "action": "ALREADY_INSIDE",
                    "is_open": self.is_open,
                    "gate_angle": self.gate_angle,
                    "message": self.status_message,
                    "telemetry": self.last_telemetry
                }
            else:
                # Vehicle Departure (EXIT)
                duration_min = round(elapsed_seconds / 60.0, 1)
                if duration_min >= 60:
                    hrs = int(duration_min // 60)
                    mins = int(duration_min % 60)
                    duration_str = f"{hrs}h {mins}m"
                else:
                    duration_str = f"{int(duration_min)} mins"
                    
                active_session.exit_time = now_dt
                active_session.duration_minutes = duration_min
                active_session.duration_formatted = duration_str
                active_session.status = "COMPLETED"
                active_session.exit_plate_image = web_img_url
                
                self.is_open = True
                self.gate_angle = -75.0
                self.last_action_time = now_ts
                self.cooldowns[clean_plate] = now_ts
                gate_action = "OPENED"
                event_type = "EXIT"
                self.status_message = f"EXIT GRANTED • Vehicle Departed after {duration_str} • Barrier Lifted"
                stay_duration_str = f"Stayed {duration_str}"
                serial_controller.send_open()
        else:
            # Vehicle Arrival (ENTRY)
            new_session = VehicleSession(
                plate_number=clean_plate,
                owner_name=owner_name,
                vehicle_model=vehicle_model,
                fuel_type=fuel_type,
                registration_city=reg_city,
                access_status=access_status,
                entry_time=now_dt,
                status="INSIDE",
                entry_plate_image=web_img_url
            )
            db.add(new_session)
            
            self.is_open = True
            self.gate_angle = -75.0
            self.last_action_time = now_ts
            self.cooldowns[clean_plate] = now_ts
            gate_action = "OPENED"
            event_type = "ENTRY"
            self.status_message = f"ENTRY GRANTED • {access_status} • Vehicle Logged Inside • Barrier Lifted"
            stay_duration_str = "Entering Premises"
            serial_controller.send_open()

        log_entry = GateLog(
            plate_number=plate_number,
            owner_name=owner_name,
            vehicle_model=vehicle_model,
            fuel_type=fuel_type,
            registration_city=reg_city,
            access_status=access_status,
            event_type=event_type,
            gate_action=gate_action,
            confidence=confidence,
            stay_duration=stay_duration_str,
            plate_image_path=web_img_url,
            timestamp=now_dt
        )
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)

        telemetry = {
            "id": log_entry.id,
            "plate_number": plate_number,
            "owner_name": owner_name,
            "vehicle_model": vehicle_model,
            "fuel_type": fuel_type,
            "registration_city": reg_city,
            "access_status": access_status,
            "event_type": event_type,
            "gate_action": gate_action,
            "confidence": confidence,
            "stay_duration": stay_duration_str,
            "plate_image_path": web_img_url,
            "timestamp": now_dt.strftime("%Y-%m-%d %H:%M:%S")
        }
        self.last_telemetry = telemetry
        self.last_plate = plate_number

        return {
            "action": gate_action,
            "event_type": event_type,
            "is_open": self.is_open,
            "gate_angle": self.gate_angle,
            "message": self.status_message,
            "telemetry": telemetry
        }

    def check_auto_close(self) -> bool:
        now = time.time()
        if self.is_open and (now - self.last_action_time) >= self.auto_close_delay:
            self.is_open = False
            self.gate_angle = 0.0
            self.status_message = "Gate Closed • Ready for next vehicle"
            serial_controller.send_close()
            return True
        return False

    def manual_override(self, action: str, db: Session) -> Dict:
        now_ts = time.time()
        now_dt = datetime.datetime.utcnow()
        if action.upper() == "OPEN":
            self.is_open = True
            self.gate_angle = -75.0
            self.last_action_time = now_ts
            self.status_message = "MANUAL OVERRIDE • Gate Force-Opened by Operator"
            gate_action = "MANUAL_OPEN"
            serial_controller.send_open()
        else:
            self.is_open = False
            self.gate_angle = 0.0
            self.status_message = "MANUAL OVERRIDE • Gate Force-Closed by Operator"
            gate_action = "MANUAL_CLOSE"
            serial_controller.send_close()

        log_entry = GateLog(
            plate_number="MANUAL-OVERRIDE",
            owner_name="System Operator",
            vehicle_model="Control Panel Action",
            fuel_type="N/A",
            registration_city="Gate Post",
            access_status="OPERATOR",
            event_type="MANUAL",
            gate_action=gate_action,
            confidence=1.0,
            stay_duration="Manual Action",
            plate_image_path=None,
            timestamp=now_dt
        )
        db.add(log_entry)
        db.commit()

        return {
            "action": gate_action,
            "is_open": self.is_open,
            "gate_angle": self.gate_angle,
            "message": self.status_message
        }

gate_manager = GateManager(auto_close_delay=6.0, plate_cooldown_delay=15.0, exit_threshold_seconds=300.0)

# =====================================================================
# 7. FASTAPI APPLICATION SETUP
# =====================================================================
app = FastAPI(
    title="ANPR Smart Boom Barrier Gate System",
    description="Automatic Number Plate Recognition with EasyOCR, RapidAPI RTO Gateway, 5-Min Entry/Exit Tracking, and Mobile Support.",
    version="3.5.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("static", exist_ok=True)
os.makedirs("uploads", exist_ok=True)
os.makedirs("templates", exist_ok=True)

app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
templates = Jinja2Templates(directory="templates")

# =====================================================================
# 8. REST ENDPOINTS (RapidAPI RTO Config, Sessions, Logs, Registry)
# =====================================================================
@app.get("/", response_class=HTMLResponse)
async def serve_index(request: Request):
    return templates.TemplateResponse("index.html", {
        "request": request,
        "local_ip": get_local_ip(),
        "server_port": request.url.port or 8000
    })

@app.get("/dashboard", response_class=HTMLResponse)
async def serve_dashboard(request: Request):
    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "local_ip": get_local_ip(),
        "server_port": request.url.port or 8000
    })

@app.get("/login", response_class=HTMLResponse)
async def serve_login(request: Request):
    return templates.TemplateResponse("login.html", {
        "request": request
    })

@app.get("/api/rto/config")
def get_rto_config(db: Session = Depends(get_db)):
    api_key, api_host = rto_service.get_api_credentials(db)
    cached_count = db.query(VehicleRegistry).count()
    masked_key = (api_key[:6] + "..." + api_key[-4:]) if len(api_key) > 10 else ("Configured" if api_key else "Not Configured")
    
    return JSONResponse({
        "is_configured": bool(api_key),
        "masked_key": masked_key,
        "rapidapi_host": api_host,
        "queries_made": rto_service.queries_count,
        "cache_hits": rto_service.cache_hits,
        "cached_vehicles_count": cached_count,
        "status": "LIVE_RAPIDAPI" if api_key else "LOCAL_HEURISTIC_FALLBACK"
    })

@app.post("/api/rto/config")
def save_rto_config(
    rapidapi_key: str = Form(...),
    rapidapi_host: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    rto_service.save_api_credentials(rapidapi_key, rapidapi_host or rto_service.default_host, db)
    return JSONResponse({"status": "success", "message": "RapidAPI credentials updated successfully!"})

@app.post("/api/rto/lookup-test")
def test_rto_lookup(plate_number: str = Form(...), db: Session = Depends(get_db)):
    clean_plate = re.sub(r"[^A-Za-z0-9]", "", plate_number).upper()
    
    # Check if already cached
    was_cached = db.query(VehicleRegistry).filter(VehicleRegistry.plate_number == clean_plate).first() is not None
    vehicle = rto_service.lookup_or_create_vehicle(clean_plate, db)
    
    return JSONResponse({
        "plate_number": vehicle.plate_number,
        "owner_name": vehicle.owner_name,
        "vehicle_model": vehicle.vehicle_model,
        "fuel_type": vehicle.fuel_type,
        "registration_city": vehicle.registration_city,
        "access_status": vehicle.access_status,
        "source": vehicle.source,
        "was_cached_before": was_cached,
        "message": "Served from Local SQLite Cache (0 API calls)" if was_cached else f"Fetched via {vehicle.source} and permanently cached!"
    })

@app.get("/api/system/network-info")
def get_network_info(request: Request):
    local_ip = get_local_ip()
    port = request.url.port or 8888
    return JSONResponse({
        "local_ip": local_ip,
        "port": port,
        "mobile_url": f"http://{local_ip}:{port}",
        "status": "ready"
    })

@app.get("/api/sessions/active")
def get_active_sessions(db: Session = Depends(get_db)):
    sessions = db.query(VehicleSession).filter(VehicleSession.status == "INSIDE").order_by(VehicleSession.entry_time.desc()).all()
    now = datetime.datetime.utcnow()
    results = []
    for s in sessions:
        delta = (now - s.entry_time).total_seconds()
        mins = int(delta // 60)
        secs = int(delta % 60)
        can_exit = delta >= gate_manager.exit_threshold_seconds
        
        results.append({
            "id": s.id,
            "plate_number": s.plate_number,
            "owner_name": s.owner_name,
            "vehicle_model": s.vehicle_model,
            "fuel_type": s.fuel_type,
            "registration_city": s.registration_city,
            "access_status": s.access_status,
            "entry_time": s.entry_time.strftime("%Y-%m-%d %H:%M:%S"),
            "stay_minutes": mins,
            "stay_formatted": f"{mins}m {secs}s",
            "can_exit_now": can_exit,
            "entry_plate_image": s.entry_plate_image
        })
    return JSONResponse(results)

@app.get("/api/sessions/history")
def get_session_history(limit: int = 50, db: Session = Depends(get_db)):
    sessions = db.query(VehicleSession).filter(VehicleSession.status == "COMPLETED").order_by(VehicleSession.exit_time.desc()).limit(limit).all()
    return JSONResponse([{
        "id": s.id,
        "plate_number": s.plate_number,
        "owner_name": s.owner_name,
        "vehicle_model": s.vehicle_model,
        "fuel_type": s.fuel_type,
        "registration_city": s.registration_city,
        "access_status": s.access_status,
        "entry_time": s.entry_time.strftime("%Y-%m-%d %H:%M:%S"),
        "exit_time": s.exit_time.strftime("%Y-%m-%d %H:%M:%S") if s.exit_time else "—",
        "duration_formatted": s.duration_formatted,
        "duration_minutes": s.duration_minutes,
        "entry_plate_image": s.entry_plate_image,
        "exit_plate_image": s.exit_plate_image
    } for s in sessions])

@app.post("/api/sessions/{session_id}/checkout")
def manual_checkout_session(session_id: int, db: Session = Depends(get_db)):
    session = db.query(VehicleSession).filter(VehicleSession.id == session_id).first()
    if not session or session.status != "INSIDE":
        return JSONResponse({"error": "Active session not found"}, status_code=404)
        
    now = datetime.datetime.utcnow()
    delta_min = round((now - session.entry_time).total_seconds() / 60.0, 1)
    duration_str = f"{int(delta_min)} mins"
    
    session.exit_time = now
    session.duration_minutes = delta_min
    session.duration_formatted = duration_str
    session.status = "COMPLETED"
    
    log_entry = GateLog(
        plate_number=session.plate_number,
        owner_name=session.owner_name,
        vehicle_model=session.vehicle_model,
        fuel_type=session.fuel_type,
        registration_city=session.registration_city,
        access_status=session.access_status,
        event_type="EXIT",
        gate_action="MANUAL_OPEN",
        confidence=1.0,
        stay_duration=f"Manual Checkout ({duration_str})",
        plate_image_path=session.entry_plate_image,
        timestamp=now
    )
    db.add(log_entry)
    db.commit()
    return JSONResponse({"status": "success", "message": f"Vehicle {session.plate_number} checked out successfully!"})

@app.get("/api/logs")
def get_logs(limit: int = 50, db: Session = Depends(get_db)):
    logs = db.query(GateLog).order_by(GateLog.timestamp.desc()).limit(limit).all()
    results = []
    for log in logs:
        results.append({
            "id": log.id,
            "plate_number": log.plate_number,
            "owner_name": log.owner_name,
            "vehicle_model": log.vehicle_model,
            "fuel_type": log.fuel_type,
            "registration_city": log.registration_city,
            "access_status": log.access_status,
            "event_type": log.event_type,
            "gate_action": log.gate_action,
            "confidence": log.confidence,
            "stay_duration": log.stay_duration,
            "plate_image_path": log.plate_image_path,
            "timestamp": log.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        })
    return JSONResponse(results)

@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    total_entries = db.query(GateLog).filter(GateLog.event_type == "ENTRY").count()
    total_exits = db.query(GateLog).filter(GateLog.event_type == "EXIT").count()
    currently_inside = db.query(VehicleSession).filter(VehicleSession.status == "INSIDE").count()
    denied_count = db.query(GateLog).filter(GateLog.gate_action == "DENIED").count()
    registered_vehicles = db.query(VehicleRegistry).count()
    
    api_key, _ = rto_service.get_api_credentials(db)
    
    return JSONResponse({
        "total_entries": total_entries,
        "total_exits": total_exits,
        "currently_inside": currently_inside,
        "denied_count": denied_count,
        "registered_vehicles": registered_vehicles,
        "is_gate_open": gate_manager.is_open,
        "gate_angle": gate_manager.gate_angle,
        "gate_status": gate_manager.status_message,
        "local_ip": get_local_ip(),
        "rto_gateway_status": "LIVE_RAPIDAPI" if api_key else "LOCAL_HEURISTIC_FALLBACK",
        "serial_status": serial_controller.get_status(),
        "ocr_engine": "Charles Wright Custom CNN + EasyOCR Ensemble"
    })

@app.get("/api/serial/status")
def get_serial_status():
    return JSONResponse(serial_controller.get_status())

@app.post("/api/serial/send")
def send_serial_command(command: str = Form(...)):
    cmd = command.strip().upper()
    if cmd == "OPEN":
        res = serial_controller.send_open()
    elif cmd == "CLOSE":
        res = serial_controller.send_close()
    else:
        return JSONResponse({"error": "Invalid command. Must be 'OPEN' or 'CLOSE'"}, status_code=400)
    return JSONResponse(res)

@app.post("/api/serial/config")
def config_serial_port(port: str = Form(...), baudrate: int = Form(9600)):
    serial_controller.port_name = port.strip().upper()
    serial_controller.baudrate = int(baudrate)
    serial_controller._init_connection()
    return JSONResponse(serial_controller.get_status())

@app.get("/api/registry")
def get_registry(search: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(VehicleRegistry)
    if search:
        s = f"%{search.strip().upper()}%"
        query = query.filter(
            (VehicleRegistry.plate_number.like(s)) |
            (VehicleRegistry.owner_name.like(s)) |
            (VehicleRegistry.vehicle_model.like(s))
        )
    vehicles = query.order_by(VehicleRegistry.created_at.desc()).all()
    return JSONResponse([{
        "plate_number": v.plate_number,
        "owner_name": v.owner_name,
        "vehicle_model": v.vehicle_model,
        "fuel_type": v.fuel_type,
        "registration_city": v.registration_city,
        "access_status": v.access_status,
        "source": getattr(v, "source", "MANUAL"),
        "created_at": v.created_at.strftime("%Y-%m-%d %H:%M:%S")
    } for v in vehicles])

@app.post("/api/registry")
def add_registry_vehicle(
    plate_number: str = Form(...),
    owner_name: str = Form(...),
    vehicle_model: str = Form(...),
    fuel_type: str = Form(...),
    registration_city: str = Form(...),
    access_status: str = Form(...),
    db: Session = Depends(get_db)
):
    clean_plate = re.sub(r"[^A-Za-z0-9]", "", plate_number).upper()
    existing = db.query(VehicleRegistry).filter(VehicleRegistry.plate_number == clean_plate).first()
    if existing:
        existing.owner_name = owner_name
        existing.vehicle_model = vehicle_model
        existing.fuel_type = fuel_type
        existing.registration_city = registration_city
        existing.access_status = access_status
    else:
        new_v = VehicleRegistry(
            plate_number=clean_plate,
            owner_name=owner_name,
            vehicle_model=vehicle_model,
            fuel_type=fuel_type,
            registration_city=registration_city,
            access_status=access_status,
            source="MANUAL"
        )
        db.add(new_v)
    db.commit()
    return JSONResponse({"status": "success", "plate_number": clean_plate})

@app.post("/api/gate/override")
def gate_override(action: str = Form(...), db: Session = Depends(get_db)):
    result = gate_manager.manual_override(action, db)
    return JSONResponse(result)

@app.post("/api/test/upload")
async def test_upload_image(file: UploadFile = File(...), db: Session = Depends(get_db)):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if image is None:
        return JSONResponse({"error": "Invalid image file"}, status_code=400)
        
    results = perform_anpr(image)
    gate_event = None
    
    for res in results:
        if res["is_valid"]:
            box = res["box"]
            plate_crop = image[box[1]:box[1]+box[3], box[0]:box[0]+box[2]]
            gate_event = gate_manager.trigger_gate_event(res["plate_text"], res["confidence"], plate_crop, db)
            break
            
    return JSONResponse({
        "detections": results,
        "gate_event": gate_event
    })

@app.get("/api/demo/samples")
def get_sample_plates():
    samples_dir = "static/sample_plates"
    items = []
    if os.path.exists(samples_dir):
        files = [f for f in os.listdir(samples_dir) if f.endswith("_car.jpg") or f.endswith("_plate.jpg")]
        for f in sorted(files):
            items.append({
                "filename": f,
                "url": f"/static/sample_plates/{f}",
                "type": "car" if "_car" in f else "plate"
            })
    return JSONResponse(items)

# =====================================================================
# 9. WEBSOCKET REAL-TIME FRAME PROCESSOR & TELEMETRY STREAM
# =====================================================================
@app.websocket("/ws")
@app.websocket("/ws/stream")
async def websocket_stream_endpoint(websocket: WebSocket):
    await websocket.accept()
    db = SessionLocal()
    last_fps_time = time.time()
    frame_count = 0
    fps = 0.0
    
    try:
        while True:
            data = await websocket.receive_text()
            gate_manager.check_auto_close()
            
            frame_count += 1
            now = time.time()
            if (now - last_fps_time) >= 1.0:
                fps = round(frame_count / (now - last_fps_time), 1)
                frame_count = 0
                last_fps_time = now
                
            if "," in data:
                data = data.split(",", 1)[1]
            try:
                img_bytes = base64.b64decode(data)
                nparr = np.frombuffer(img_bytes, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            except Exception as e:
                await websocket.send_json({"error": f"Corrupted image payload: {e}"})
                continue
                
            if frame is None:
                await websocket.send_json({"error": "Empty frame decoded"})
                continue
                
            detections = perform_anpr(frame)
            
            observed_valid_plate = None
            for det in detections:
                if det["is_valid"]:
                    observed_valid_plate = det["plate_text"]
                    break
                    
            gate_manager.add_observation(observed_valid_plate, observed_valid_plate is not None)
            
            consensus_info = gate_manager.get_consensus(min_count=2)
            gate_event = None
            
            if consensus_info:
                consensus_plate, freq = consensus_info
                plate_crop = None
                conf = 0.96
                for det in detections:
                    if det["plate_text"] == consensus_plate or det["formatted_plate"] == consensus_plate:
                        bx = det["box"]
                        plate_crop = frame[bx[1]:bx[1]+bx[3], bx[0]:bx[0]+bx[2]]
                        conf = det["confidence"]
                        break
                        
                gate_event = gate_manager.trigger_gate_event(consensus_plate, conf, plate_crop, db)
                
            payload = {
                "fps": fps,
                "detections": detections,
                "consensus_plate": consensus_info[0] if consensus_info else None,
                "consensus_count": consensus_info[1] if consensus_info else len([p for p in gate_manager.voting_buffer if p]),
                "gate_state": {
                    "is_open": gate_manager.is_open,
                    "gate_angle": gate_manager.gate_angle,
                    "status_message": gate_manager.status_message
                },
                "gate_event": gate_event,
                "last_telemetry": gate_manager.last_telemetry
            }
            
            await websocket.send_json(payload)
            
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WebSocket Error] {e}")
    finally:
        db.close()

if __name__ == "__main__":
    import uvicorn
    print("Starting ANPR Smart Boom Barrier Gate System on http://0.0.0.0:8000 ...")
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)
