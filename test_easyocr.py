import re
import cv2
import numpy as np
import easyocr
import torch

from app import (
    locate_plates,
    segment_and_extract_characters,
    correct_and_validate_plate,
    ocr_engine
)

print("Initializing EasyOCR reader...")
reader = easyocr.Reader(['en'], gpu=torch.cuda.is_available(), verbose=False)

def hybrid_anpr(image_bgr: np.ndarray):
    """
    Ensemble OCR Engine combining:
    1. EasyOCR text detection & sequence recognition
    2. PyTorch CharacterCNN character segmentation
    3. Indian License Plate Grammar & Heuristic Confusion Mapper
    """
    h, w = image_bgr.shape[:2]
    results = []
    
    # --- METHOD 1: EasyOCR on Whole Frame & Detected Plate Sub-Regions ---
    # Convert BGR to RGB for EasyOCR
    rgb_img = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    
    # Run EasyOCR with alphanumeric allowlist
    easy_results = reader.readtext(
        rgb_img,
        allowlist='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        paragraph=False,
        width_ths=0.7,
        height_ths=0.7
    )
    
    for bbox, text, conf in easy_results:
        clean_text = re.sub(r'[^A-Za-z0-9]', '', text).upper()
        # Skip UI overlay text
        if any(skip_word in clean_text for skip_word in ['CAM', 'GATE', 'ANPR', 'BOOM', 'BARRIER', 'LIVE']):
            continue
            
        is_valid, fmt, norm = correct_and_validate_plate(clean_text)
        
        # Extract bounding box rectangle [x, y, w, h]
        pts = np.array(bbox, dtype=np.int32)
        bx = int(np.min(pts[:, 0]))
        by = int(np.min(pts[:, 1]))
        bw = int(np.max(pts[:, 0]) - bx)
        bh = int(np.max(pts[:, 1]) - by)
        
        if is_valid or len(clean_text) >= 6:
            results.append({
                "box": [bx, by, bw, bh],
                "raw_text": text,
                "plate_text": fmt if is_valid else clean_text,
                "formatted_plate": fmt,
                "normalized_plate": norm,
                "is_valid": is_valid,
                "confidence": round(float(conf), 3),
                "engine": "EasyOCR"
            })
            
    # --- METHOD 2: PyTorch CharacterCNN on Morphological Plate Regions ---
    plate_boxes = locate_plates(image_bgr)
    for (px, py, pw, ph) in plate_boxes:
        plate_crop = image_bgr[py:py+ph, px:px+pw]
        char_imgs, char_boxes = segment_and_extract_characters(plate_crop)
        if len(char_imgs) >= 4:
            raw_chars = ""
            conf_sum = 0.0
            for c_img in char_imgs:
                c, c_conf = ocr_engine.predict_character(c_img)
                raw_chars += c
                conf_sum += c_conf
                
            mean_conf = conf_sum / len(char_imgs)
            is_valid, fmt, norm = correct_and_validate_plate(raw_chars)
            
            # If valid, or if no EasyOCR detections found
            results.append({
                "box": [int(px), int(py), int(pw), int(ph)],
                "raw_text": raw_chars,
                "plate_text": fmt if is_valid else norm,
                "formatted_plate": fmt,
                "normalized_plate": norm,
                "is_valid": is_valid,
                "confidence": round(float(mean_conf), 3),
                "engine": "CharacterCNN"
            })
            
    # Sort results: valid plates first, then highest confidence
    results.sort(key=lambda item: (1 if item["is_valid"] else 0, item["confidence"]), reverse=True)
    return results

if __name__ == '__main__':
    samples = [
        'static/sample_plates/mh12ab1234_car.jpg',
        'static/sample_plates/dl01ca5678_car.jpg',
        'static/sample_plates/ka05mn9999_car.jpg',
        'static/sample_plates/hr26dq5555_car.jpg',
        'static/sample_plates/up16cz7777_car.jpg',
        'static/sample_plates/22bh4567aa_car.jpg',
        'static/sample_plates/ka03ha0001_car.jpg',
    ]
    
    for s in samples:
        img = cv2.imread(s)
        if img is not None:
            res = hybrid_anpr(img)
            top = res[0] if res else None
            print(f"File: {s:45} -> Detected: {top['plate_text'] if top else 'None'} (Valid: {top['is_valid'] if top else False}, Engine: {top['engine'] if top else 'N/A'}, Conf: {top['confidence'] if top else 0})")
