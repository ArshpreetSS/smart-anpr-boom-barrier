import os
import random
import numpy as np
from PIL import Image, ImageDraw, ImageFont

def get_font(size, bold=True):
    candidates = [
        'models/fonts/CharlesWright-Bold.otf',
        'C:/Windows/Fonts/segoeuib.ttf' if bold else 'C:/Windows/Fonts/segoeui.ttf',
        'C:/Windows/Fonts/arialbd.ttf' if bold else 'C:/Windows/Fonts/arial.ttf',
        'C:/Windows/Fonts/calibrib.ttf' if bold else 'C:/Windows/Fonts/calibri.ttf',
        'C:/Windows/Fonts/consola.ttf',
    ]
    for f in candidates:
        if os.path.exists(f):
            try:
                return ImageFont.truetype(f, size)
            except Exception:
                pass
    return ImageFont.load_default()

def create_hsrp_plate(plate_text, width=420, height=95, is_ev=False):
    """
    Creates an authentic Indian High-Security Registration Plate (HSRP) graphic.
    Standard: White background, black border, blue IND strip on left with Ashok Chakra emblem.
    EV Standard: Green background with white characters.
    """
    bg_color = (15, 120, 50) if is_ev else (255, 255, 255)
    text_color = (255, 255, 255) if is_ev else (15, 15, 15)
    border_color = (200, 200, 200) if is_ev else (20, 20, 20)
    
    img = Image.new('RGB', (width, height), bg_color)
    draw = ImageDraw.Draw(img)
    
    # Outer Border (embossed rim)
    draw.rounded_rectangle([2, 2, width - 3, height - 3], radius=10, outline=border_color, width=4)
    
    # Left IND strip (Blue bar for standard, or darker green for EV)
    ind_width = 48
    ind_bg = (0, 51, 153) if not is_ev else (10, 80, 35)
    draw.rounded_rectangle([4, 4, ind_width, height - 5], radius=6, fill=ind_bg)
    
    # Hologram emblem (simulated Ashok Chakra circle)
    draw.ellipse([14, 15, 34, 35], outline=(150, 200, 255) if not is_ev else (180, 255, 180), width=2)
    draw.ellipse([21, 22, 27, 28], fill=(255, 255, 255))
    
    # IND text on blue strip
    ind_font = get_font(15, bold=True)
    draw.text((11, 48), "IND", fill=(255, 255, 255), font=ind_font)
    
    # Main License Plate Text (Clean DIN-style bold font with spacing)
    plate_font = get_font(42, bold=True)
    display_text = plate_text
    
    bbox = draw.textbbox((0, 0), display_text, font=plate_font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    
    start_x = ind_width + (width - ind_width - text_w) // 2
    start_y = (height - text_h) // 2 - 4
    
    # Embossed shadow
    shadow_color = (210, 210, 210) if not is_ev else (10, 60, 25)
    draw.text((start_x + 1, start_y + 1), display_text, fill=shadow_color, font=plate_font)
    draw.text((start_x, start_y), display_text, fill=text_color, font=plate_font)
    
    return img

def create_car_scene(plate_text, width=640, height=360, is_ev=False, car_color=(35, 45, 60)):
    """
    Creates a simulated camera frame showing front bumper/grille of a car with plate attached.
    """
    img = Image.new('RGB', (width, height), (20, 25, 32))
    draw = ImageDraw.Draw(img)
    
    # Road / Driveway pavement
    draw.polygon([(0, 360), (0, 260), (640, 260), (640, 360)], fill=(40, 45, 52))
    draw.line([(0, 310), (640, 310)], fill=(70, 75, 85), width=3)
    
    # Car Body / Bumper
    draw.polygon([
        (100, 160), (540, 160),
        (580, 260), (560, 300),
        (80, 300), (60, 260)
    ], fill=car_color)
    
    # Radiator Grille
    draw.rounded_rectangle([180, 175, 460, 245], radius=8, fill=(15, 18, 22), outline=(70, 80, 95), width=2)
    for gy in range(185, 240, 10):
        draw.line([(190, gy), (450, gy)], fill=(45, 50, 60), width=2)
        
    # Car Headlights
    draw.polygon([(90, 190), (160, 200), (145, 235), (80, 225)], fill=(220, 235, 255), outline=(100, 120, 150), width=2)
    draw.polygon([(550, 190), (480, 200), (495, 235), (560, 225)], fill=(220, 235, 255), outline=(100, 120, 150), width=2)
    
    # Fog lights
    draw.ellipse([110, 265, 140, 285], fill=(255, 255, 200), outline=(100, 100, 100))
    draw.ellipse([500, 265, 530, 285], fill=(255, 255, 200), outline=(100, 100, 100))
    
    # License Plate Mount Bracket (W: 320, H: 80)
    bracket_w = 320
    bracket_h = 75
    bracket_x = (width - bracket_w) // 2
    bracket_y = 230
    draw.rounded_rectangle([bracket_x, bracket_y, bracket_x + bracket_w, bracket_y + bracket_h], radius=6, fill=(10, 10, 10))
    
    # Paste HSRP Plate onto car bumper
    plate_img = create_hsrp_plate(plate_text, width=bracket_w - 10, height=bracket_h - 10, is_ev=is_ev)
    img.paste(plate_img, (bracket_x + 5, bracket_y + 5))
    
    # Camera HUD overlay (Timestamp, Gate ID)
    hud_font = get_font(13, bold=False)
    draw.text((15, 15), "CAM-01 • MAIN ENTRY GATE • LIVE", fill=(0, 230, 120), font=hud_font)
    draw.text((15, 32), "ANPR SMART BOOM BARRIER v2.4", fill=(160, 175, 200), font=hud_font)
    
    return img

def generate_all_samples():
    output_dir = 'static/sample_plates'
    os.makedirs(output_dir, exist_ok=True)
    
    samples = [
        ("MH 12 AB 1234", "mh12ab1234", False, (45, 55, 75)),
        ("MH 12 A 1234", "mh12a1234", False, (50, 40, 60)),
        ("DL 01 CA 5678", "dl01ca5678", True, (15, 50, 30)),
        ("DL 01 C 5678", "dl01c5678", False, (35, 45, 55)),
        ("KA 05 MN 9999", "ka05mn9999", False, (70, 30, 35)),
        ("HR 26 DQ 5555", "hr26dq5555", False, (60, 60, 65)),
        ("UP 16 CZ 7777", "up16cz7777", False, (25, 45, 60)),
        ("22 BH 4567 AA", "22bh4567aa", False, (20, 20, 20)),
        ("KA 03 HA 0001", "ka03ha0001", False, (18, 18, 24)),
        ("DL 04 CD 9999", "dl04cd9999", False, (90, 80, 70)),
    ]
    
    for plate_str, filename_prefix, is_ev, car_color in samples:
        # 1. Pure plate crop (Width 400, Height 90)
        plate_crop = create_hsrp_plate(plate_str, width=400, height=90, is_ev=is_ev)
        plate_crop.save(os.path.join(output_dir, f"{filename_prefix}_plate.jpg"), quality=95)
        
        # 2. Car scene (realistic camera frame)
        car_frame = create_car_scene(plate_str, is_ev=is_ev, car_color=car_color)
        car_frame.save(os.path.join(output_dir, f"{filename_prefix}_car.jpg"), quality=95)
        
    print(f"Generated {len(samples) * 2} sample demo assets in {output_dir}")

if __name__ == '__main__':
    generate_all_samples()
