import cv2
import easyocr
import torch
import numpy as np
import re
from app import correct_and_validate_plate

reader = easyocr.Reader(['en'], gpu=torch.cuda.is_available(), verbose=False)

def ocr_plate_crop(crop):
    h, w = crop.shape[:2]
    # Resize to standard height ~120px
    target_h = 120
    scale = target_h / float(h)
    resized = cv2.resize(crop, (int(w * scale), target_h), interpolation=cv2.INTER_CUBIC)
    
    # Pad borders with 20px white border
    padded = cv2.copyMakeBorder(resized, 20, 20, 25, 25, cv2.BORDER_CONSTANT, value=[255, 255, 255])
    
    # EasyOCR recognition
    results = reader.readtext(padded, allowlist='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', detail=1)
    
    combined_text = ""
    conf_list = []
    for bbox, text, conf in results:
        clean = re.sub(r'[^A-Za-z0-9]', '', text).upper()
        if clean not in ['IND', 'IN']:
            combined_text += clean
            conf_list.append(conf)
            
    is_valid, fmt, norm = correct_and_validate_plate(combined_text)
    avg_conf = (sum(conf_list) / len(conf_list)) if conf_list else 0.0
    return combined_text, is_valid, fmt, avg_conf

if __name__ == '__main__':
    plates = [
        'static/sample_plates/mh12ab1234_plate.jpg',
        'static/sample_plates/dl01ca5678_plate.jpg',
        'static/sample_plates/ka05mn9999_plate.jpg',
        'static/sample_plates/hr26dq5555_plate.jpg',
        'static/sample_plates/up16cz7777_plate.jpg',
        'static/sample_plates/22bh4567aa_plate.jpg',
        'static/sample_plates/ka03ha0001_plate.jpg',
        'static/sample_plates/dl04cd9999_plate.jpg',
    ]
    
    for p in plates:
        img = cv2.imread(p)
        raw, valid, fmt, conf = ocr_plate_crop(img)
        print(f"{p:45} -> Raw: {raw:14} | Valid: {str(valid):5} | Formatted: {fmt:14} | Conf: {conf:.2f}")
