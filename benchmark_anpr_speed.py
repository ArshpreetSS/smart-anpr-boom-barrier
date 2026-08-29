import time
import os
import cv2
import numpy as np
from app import perform_anpr

def benchmark():
    print("==========================================")
    print("   ANPR HIGH-SPEED PERFORMANCE BENCHMARK   ")
    print("==========================================")
    
    sample_files = [
        "static/sample_plates/mh12ab1234_car.jpg",
        "static/sample_plates/dl01c5678_car.jpg",
        "static/sample_plates/user_kia_rj14_sample.jpg",
        "static/sample_plates/user_double_decker_sample.jpg"
    ]
    
    images = []
    for f in sample_files:
        if os.path.exists(f):
            im = cv2.imread(f)
            if im is not None:
                images.append((f, im))
                
    if not images:
        print("No sample images found to benchmark.")
        return
        
    # Warmup
    print("Warming up inference pipeline...")
    for _, img in images:
        _ = perform_anpr(img)
        
    print("\nRunning benchmark across sample images (50 iterations each)...")
    total_time = 0.0
    total_runs = 0
    
    for filename, img in images:
        times = []
        best_plate = ""
        engine = ""
        
        for _ in range(50):
            t0 = time.perf_counter()
            res = perform_anpr(img)
            t1 = time.perf_counter()
            
            elapsed_ms = (t1 - t0) * 1000.0
            times.append(elapsed_ms)
            if res and not best_plate:
                best_plate = res[0]["formatted_plate"]
                engine = res[0]["engine"]
                
        avg_ms = np.mean(times)
        min_ms = np.min(times)
        fps = 1000.0 / avg_ms
        total_time += np.sum(times)
        total_runs += len(times)
        
        basename = os.path.basename(filename)
        print(f"[{basename[:28]:28}] -> Plate: {best_plate:15} | Avg: {avg_ms:6.2f} ms | Min: {min_ms:6.2f} ms | {fps:5.1f} FPS | Engine: {engine}")
        
    grand_avg_ms = total_time / total_runs
    grand_fps = 1000.0 / grand_avg_ms
    print("------------------------------------------")
    print(f"Overall Average Latency : {grand_avg_ms:.2f} ms / frame")
    print(f"Overall Throughput      : {grand_fps:.1f} FPS (Frames Per Second)")
    print("==========================================\n")

if __name__ == '__main__':
    benchmark()
