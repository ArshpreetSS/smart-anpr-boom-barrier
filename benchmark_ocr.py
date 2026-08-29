import time
import cv2
import easyocr
import torch
from app import locate_plates, segment_and_extract_characters, ocr_engine, correct_and_validate_plate

print("Loading EasyOCR...")
reader = easyocr.Reader(['en'], gpu=torch.cuda.is_available(), verbose=False)

img = cv2.imread('static/sample_plates/mh12ab1234_plate.jpg')

# 1. Test EasyOCR on plate crop
t0 = time.time()
res = reader.readtext(img, allowlist='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ')
t1 = time.time()
print(f"EasyOCR on cropped plate ({((t1-t0)*1000):.1f}ms): {res}")

# 2. Test CharacterCNN
t0 = time.time()
char_imgs, _ = segment_and_extract_characters(img)
raw_cnn = "".join([ocr_engine.predict_character(c)[0] for c in char_imgs])
is_valid, fmt, norm = correct_and_validate_plate(raw_cnn)
t1 = time.time()
print(f"CharacterCNN on cropped plate ({((t1-t0)*1000):.1f}ms): raw='{raw_cnn}', validated='{fmt}'")
