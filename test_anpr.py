import os
import sys
import time
import asyncio
import cv2
import httpx
import numpy as np

from app import (
    app,
    SessionLocal,
    VehicleRegistry,
    GateLog,
    gate_manager,
    ocr_engine,
    locate_plates,
    segment_and_extract_characters,
    correct_and_validate_plate,
    perform_anpr
)

def test_ocr_engines():
    print("\n--- TEST 1: Hybrid EasyOCR + PyTorch CharacterCNN OCR Engines ---")
    # 1. Test CharacterCNN
    dummy_char = np.zeros((32, 32), dtype=np.float32)
    dummy_char[4:28, 14:18] = 1.0
    char_pred, conf = ocr_engine.predict_character_cnn(dummy_char)
    print(f"CharacterCNN prediction on test tensor: '{char_pred}' (confidence: {conf:.3f})")
    assert isinstance(char_pred, str)
    assert len(char_pred) == 1
    
    # 2. Test EasyOCR on sample plate crop
    test_plate_path = "static/sample_plates/mh12ab1234_plate.jpg"
    if os.path.exists(test_plate_path):
        plate_img = cv2.imread(test_plate_path)
        easy_text, easy_conf = ocr_engine.read_plate_easyocr(plate_img)
        print(f"EasyOCR prediction on sample plate crop: '{easy_text}' (confidence: {easy_conf:.3f})")
        assert len(easy_text) >= 8
        is_valid, fmt, norm = correct_and_validate_plate(easy_text)
        assert is_valid is True
        print(f"Validated formatted plate: {fmt}")
        
    print("[PASS] Hybrid OCR engines verification passed!")

def test_indian_plate_regex_and_confusion_mapping():
    print("\n--- TEST 2: Indian Plate Regex & Confusion Mapping ---")
    test_cases = [
        ("MH12AB1234", True, "MH 12 AB 1234"),
        ("MH12A1234", True, "MH 12 A 1234"),
        ("DL01CA5678", True, "DL 01 CA 5678"),
        ("DL01C5678", True, "DL 01 C 5678"),
        ("KA05MN9999", True, "KA 05 MN 9999"),
        ("KA05M9999", True, "KA 05 M 9999"),
        ("DL1C1234", True, "DL 1 C 1234"),
        ("MH121234", True, "MH 12 1234"),
        ("22BH4567AA", True, "22 BH 4567 AA"),
        ("MHI2ABIZ34", True, "MH 12 AB 1234"),
        ("MHI2AI234", True, "MH 12 A 1234"),
        ("DL01CA567B", True, "DL 01 CA 5678"),
        ("INVALID123", False, "INVALID123"),
    ]
    
    for raw, expected_valid, expected_fmt in test_cases:
        is_valid, fmt, norm = correct_and_validate_plate(raw)
        print(f"Raw: {raw:12} -> Valid: {str(is_valid):5} | Formatted: {fmt:14} (Expected: {expected_fmt})")
        assert is_valid == expected_valid, f"Failed regex check on {raw}"
        if expected_valid:
            assert fmt == expected_fmt, f"Format mismatch for {raw}: got {fmt}, expected {expected_fmt}"
    print("[PASS] Regex validator & confusion mapping passed for all formats (AA 00 AA 0000, AA 00 A 0000, etc.)!")

def test_database_and_registry():
    print("\n--- TEST 3: Database & Registry Lookups ---")
    db = SessionLocal()
    try:
        reg_count = db.query(VehicleRegistry).count()
        print(f"Total registered vehicles in database: {reg_count}")
        assert reg_count >= 8
        
        v = db.query(VehicleRegistry).filter(VehicleRegistry.plate_number == "MH12AB1234").first()
        assert v is not None
        assert v.owner_name == "Rajesh Sharma"
        assert v.access_status == "AUTHORIZED"
        print(f"Found registered vehicle: {v.plate_number} -> {v.owner_name} ({v.vehicle_model}, {v.access_status})")
    finally:
        db.close()
    print("[PASS] Database & Registry tests passed!")

def test_gate_manager_and_cooldown():
    print("\n--- TEST 4: Gate Barrier Manager & 15s Cooldown ---")
    db = SessionLocal()
    try:
        gate_manager.is_open = False
        gate_manager.cooldowns.clear()
        
        dummy_crop = np.zeros((60, 200, 3), dtype=np.uint8) + 200
        event1 = gate_manager.trigger_gate_event("MH 12 AB 1234", 0.95, dummy_crop, db)
        print(f"Event 1 Action: {event1['action']} | Gate Open: {event1['is_open']}")
        assert event1["is_open"] is True
        assert event1["action"] == "OPENED"
        assert gate_manager.gate_angle == -75.0
        
        event2 = gate_manager.trigger_gate_event("MH 12 AB 1234", 0.95, dummy_crop, db)
        print(f"Event 2 (Immediate Repeat): {event2['action']}")
        assert event2["action"] == "COOLDOWN_ACTIVE"
        
        event3 = gate_manager.trigger_gate_event("KA 03 HA 0001", 0.98, dummy_crop, db)
        print(f"Event 3 (Blacklisted): {event3['action']} | Gate Open: {event3['is_open']}")
        assert event3["action"] == "DENIED"
        assert event3["is_open"] is False
        
        gate_manager.is_open = True
        gate_manager.last_action_time = time.time() - 10.0
        closed = gate_manager.check_auto_close()
        print(f"Auto-close check after 10s elapsed: closed={closed}, is_open={gate_manager.is_open}")
        assert closed is True
        assert gate_manager.is_open is False
    finally:
        db.close()
    print("[PASS] Gate Manager & Cooldown logic passed!")

async def test_fastapi_rest_endpoints():
    print("\n--- TEST 5: FastAPI REST Endpoints ---")
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/stats")
        assert res.status_code == 200
        stats = res.json()
        print(f"Stats API: Total Entries={stats['total_entries']}, OCR Engine={stats.get('ocr_engine')}")
        
        res = await client.get("/api/logs?limit=5")
        assert res.status_code == 200
        logs = res.json()
        print(f"Logs API returned {len(logs)} log entries")
        assert len(logs) > 0
        
        res = await client.get("/api/registry?search=Tesla")
        assert res.status_code == 200
        reg = res.json()
        print(f"Registry search ('Tesla') returned: {reg[0]['owner_name']} - {reg[0]['vehicle_model']}")
        assert len(reg) == 1
        
        res = await client.post("/api/gate/override", data={"action": "OPEN"})
        assert res.status_code == 200
        assert res.json()["is_open"] is True
        
        res = await client.post("/api/gate/override", data={"action": "CLOSE"})
        assert res.status_code == 200
        assert res.json()["is_open"] is False
        
        test_img_path = "static/sample_plates/mh12ab1234_plate.jpg"
        if os.path.exists(test_img_path):
            with open(test_img_path, "rb") as f:
                res = await client.post("/api/test/upload", files={"file": ("plate.jpg", f.read(), "image/jpeg")})
                assert res.status_code == 200
                data = res.json()
                print(f"Upload ANPR API response: {len(data['detections'])} detections found, top plate={data['detections'][0]['plate_text']}")
                assert data['detections'][0]['is_valid'] is True
                
    print("[PASS] FastAPI REST endpoints passed!")

if __name__ == '__main__':
    test_ocr_engines()
    test_indian_plate_regex_and_confusion_mapping()
    test_database_and_registry()
    test_gate_manager_and_cooldown()
    asyncio.run(test_fastapi_rest_endpoints())
    print("\n==========================================")
    print(" ALL BACKEND TESTS PASSED WITH 100% SUCCESS!")
    print("==========================================\n")
