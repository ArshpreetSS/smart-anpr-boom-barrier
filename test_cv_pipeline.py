import cv2
import numpy as np

def locate_plate_candidate(image):
    """
    Locates license plate bounding boxes in an image using multi-scale morphological filtering,
    Sobel gradients, thresholding, and contour aspect ratio analysis.
    """
    h, w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # 1. Tophat & Blackhat morphological operations to highlight bright plate on dark background or vice versa
    rect_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (13, 5))
    tophat = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, rect_kernel)
    blackhat = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, rect_kernel)
    enhanced = cv2.add(gray, tophat)
    enhanced = cv2.subtract(enhanced, blackhat)
    
    # 2. Sobel edge detection in X direction (vertical edges of characters and plate borders)
    sobel_x = cv2.Sobel(enhanced, ddepth=cv2.CV_32F, dx=1, dy=0, ksize=-1)
    sobel_x = np.absolute(sobel_x)
    (min_val, max_val) = (np.min(sobel_x), np.max(sobel_x))
    if max_val > min_val:
        sobel_x = 255 * ((sobel_x - min_val) / (max_val - min_val))
    sobel_x = sobel_x.astype("uint8")
    
    # 3. Gaussian Blur & Otsu threshold
    blurred = cv2.GaussianBlur(sobel_x, (5, 5), 0)
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    # 4. Morphological closing to bridge character gaps into solid plate rectangle
    close_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (21, 5))
    closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, close_kernel)
    
    # 5. Clean up small noise
    closed = cv2.erode(closed, None, iterations=2)
    closed = cv2.dilate(closed, None, iterations=2)
    
    # 6. Find contours
    contours, _ = cv2.findContours(closed.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    candidates = []
    for c in contours:
        (x, y, cw, ch) = cv2.boundingRect(c)
        aspect_ratio = cw / float(ch)
        area = cw * ch
        
        # Indian plates generally have aspect ratio between 2.0 and 5.5
        if 2.0 <= aspect_ratio <= 6.0 and area > (w * h * 0.005) and area < (w * h * 0.4):
            # Expand slightly by padding
            pad_x = int(cw * 0.05)
            pad_y = int(ch * 0.08)
            x1 = max(0, x - pad_x)
            y1 = max(0, y - pad_y)
            x2 = min(w, x + cw + pad_x)
            y2 = min(h, y + ch + pad_y)
            score = area
            candidates.append(((x1, y1, x2 - x1, y2 - y1), score))
            
    # Sort by area/score descending
    candidates.sort(key=lambda item: item[1], reverse=True)
    if candidates:
        return [c[0] for c in candidates]
    
    # Fallback if image itself is already a cropped plate (aspect ratio 2.0-5.5)
    img_ar = w / float(h)
    if 1.8 <= img_ar <= 6.5:
        return [(0, 0, w, h)]
        
    return []

def preprocess_and_segment_characters(plate_crop):
    """
    Given a cropped plate BGR image, enhances contrast with CLAHE, binarizes,
    and extracts individual character bounding boxes and 32x32 character crops.
    """
    h, w = plate_crop.shape[:2]
    if h < 40 or w < 100:
        scale = max(2.0, 120.0 / max(1, h))
        plate_crop = cv2.resize(plate_crop, (0, 0), fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        h, w = plate_crop.shape[:2]
        
    gray = cv2.cvtColor(plate_crop, cv2.COLOR_BGR2GRAY)
    
    # CLAHE
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    
    # Adaptive thresholding and Otsu thresholding
    blurred = cv2.GaussianBlur(enhanced, (3, 3), 0)
    thresh_otsu = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    thresh_adapt = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 19, 9)
    
    # Choose binarization based on character area coverage
    thresh = thresh_adapt if np.mean(thresh_adapt == 255) < 0.45 else thresh_otsu
    
    # Find character contours
    contours, _ = cv2.findContours(thresh.copy(), cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    
    char_boxes = []
    for c in contours:
        (x, y, cw, ch) = cv2.boundingRect(c)
        ar = cw / float(ch)
        
        # Alphanumeric character criteria:
        # 1. Height should be between 35% and 92% of plate height
        # 2. Aspect ratio between 0.15 and 1.1
        # 3. Not spanning the entire width
        # 4. Skip leftmost IND strip area if it's too close to border
        if 0.30 * h <= ch <= 0.95 * h and 0.15 <= ar <= 1.15 and cw < 0.35 * w:
            if x < 0.14 * w and cw < 0.12 * w and ch < 0.45 * h:
                continue # Skip small IND letters on blue strip
            char_boxes.append((x, y, cw, ch))
            
    # Remove overlapping / nested boxes (keep larger)
    filtered_boxes = []
    for i, b1 in enumerate(char_boxes):
        keep = True
        for j, b2 in enumerate(char_boxes):
            if i != j:
                # Check if b1 is inside b2
                if b1[0] >= b2[0] and b1[1] >= b2[1] and (b1[0] + b1[2]) <= (b2[0] + b2[2]) and (b1[1] + b1[3]) <= (b2[1] + b2[3]):
                    keep = False
                    break
        if keep:
            filtered_boxes.append(b1)
            
    # Sort left-to-right
    filtered_boxes.sort(key=lambda b: b[0])
    
    char_images = []
    for (x, y, cw, ch) in filtered_boxes:
        char_roi = thresh[y:y+ch, x:x+cw]
        
        # Pad to make square
        max_dim = max(cw, ch)
        pad_top = (max_dim - ch) // 2 + int(max_dim * 0.15)
        pad_bottom = (max_dim - ch) - (max_dim - ch) // 2 + int(max_dim * 0.15)
        pad_left = (max_dim - cw) // 2 + int(max_dim * 0.15)
        pad_right = (max_dim - cw) - (max_dim - cw) // 2 + int(max_dim * 0.15)
        
        padded = cv2.copyMakeBorder(char_roi, pad_top, pad_bottom, pad_left, pad_right, cv2.BORDER_CONSTANT, value=0)
        resized = cv2.resize(padded, (32, 32), interpolation=cv2.INTER_AREA)
        
        # Normalize to [0, 1]
        norm = resized.astype(np.float32) / 255.0
        char_images.append((norm, (x, y, cw, ch)))
        
    return char_images, filtered_boxes

if __name__ == '__main__':
    # Test on a generated car frame
    test_img = cv2.imread('static/sample_plates/mh12ab1234_car.jpg')
    if test_img is not None:
        boxes = locate_plate_candidate(test_img)
        print(f"Plate boxes found in car frame: {boxes}")
        if boxes:
            x, y, w, h = boxes[0]
            crop = test_img[y:y+h, x:x+w]
            chars, char_boxes = preprocess_and_segment_characters(crop)
            print(f"Segmented {len(chars)} character candidates from cropped plate!")
    
    # Test on pure plate crop
    test_plate = cv2.imread('static/sample_plates/mh12ab1234_plate.jpg')
    if test_plate is not None:
        chars, char_boxes = preprocess_and_segment_characters(test_plate)
        print(f"Segmented {len(chars)} character candidates directly from plate crop!")
