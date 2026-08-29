import os
import asyncio
import cv2
import httpx
import numpy as np
from PIL import ImageFont, Image, ImageDraw

from app import (
    app,
    SessionLocal,
    ocr_engine,
    gate_manager,
    serial_controller,
    correct_and_validate_plate
)

def test_charles_wright_ocr_recognition():
    print("\n--- TEST 1: Charles Wright Font OCR Recognition ---")
    font_path = "models/fonts/CharlesWright-Bold.otf"
    assert os.path.exists(font_path), "Charles Wright font file missing!"
    
    font = ImageFont.truetype(font_path, 42)
    test_plates = ["MH 12 AB 1234", "MH 12 A 1234", "DL 01 C 5678", "KA 05 MN 9999"]
    
    for plate in test_plates:
        img = Image.new('RGB', (400, 90), (255, 255, 255))
        d = ImageDraw.Draw(img)
        d.text((40, 20), plate, fill=(0, 0, 0), font=font)
        
        cv_img = np.array(img)[:, :, ::-1] # RGB to BGR
        easy_text, conf = ocr_engine.read_plate_easyocr(cv_img)
        is_valid, fmt, norm = correct_and_validate_plate(easy_text)
        
        print(f"Plate: '{plate}' -> OCR: '{easy_text}' -> Validated: '{fmt}' (Confidence: {conf:.2f})")
        assert is_valid is True, f"Failed recognizing Charles Wright plate {plate}"
        assert fmt == plate, f"Mismatch: expected {plate}, got {fmt}"
        
    print("[PASS] Charles Wright OCR recognition verified 100%!")

def test_serial_com4_transmission():
    print("\n--- TEST 2: COM4 Serial Port Hardware Controller ---")
    # Test send_open
    open_res = serial_controller.send_open()
    print(f"Serial OPEN result: command={open_res['command']}, port={open_res['port']}, status={open_res['status']}")
    assert open_res['command'] == "OPEN"
    assert open_res['port'] == "COM4"
    assert serial_controller.last_command_sent == "OPEN"
    
    # Test send_close
    close_res = serial_controller.send_close()
    print(f"Serial CLOSE result: command={close_res['command']}, port={close_res['port']}, status={close_res['status']}")
    assert close_res['command'] == "CLOSE"
    assert close_res['port'] == "COM4"
    assert serial_controller.last_command_sent == "CLOSE"
    
    status = serial_controller.get_status()
    print(f"Serial Port Status: Port={status['port']}, Baudrate={status['baudrate']}, StatusMsg={status['status_message']}")
    assert status['port'] == "COM4"
    assert status['baudrate'] == 9600
    print("[PASS] Serial COM4 transmission controller verified 100%!")

async def test_serial_rest_endpoints():
    print("\n--- TEST 3: Serial REST Endpoints ---")
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        r_status = await client.get("/api/serial/status")
        assert r_status.status_code == 200
        data = r_status.json()
        print(f"GET /api/serial/status -> Port: {data['port']}, Last Command: {data['last_command']}")
        
        r_send_open = await client.post("/api/serial/send", data={"command": "OPEN"})
        assert r_send_open.status_code == 200
        assert r_send_open.json()['command'] == "OPEN"
        print("POST /api/serial/send OPEN -> OK")
        
        r_send_close = await client.post("/api/serial/send", data={"command": "CLOSE"})
        assert r_send_close.status_code == 200
        assert r_send_close.json()['command'] == "CLOSE"
        print("POST /api/serial/send CLOSE -> OK")
        
    print("[PASS] Serial REST endpoints verified 100%!")

if __name__ == '__main__':
    test_charles_wright_ocr_recognition()
    test_serial_com4_transmission()
    asyncio.run(test_serial_rest_endpoints())
    print("\n==========================================")
    print(" ALL CHARLES WRIGHT & SERIAL COM4 TESTS PASSED!")
    print("==========================================\n")
