import httpx
import json
from app import SessionLocal, SystemSettings, rto_service

api_key = "3d866bc711msh4f7591bc1787e17p1bcc52jsna3800983d91e"

# Save to SQLite database
db = SessionLocal()
try:
    rto_service.save_api_credentials(api_key, "rto-vehicle-information-india.p.rapidapi.com", db)
    print("API Key saved to SQLite database successfully!")
finally:
    db.close()

# Test common RapidAPI Indian RTO hosts to identify which API service the key is subscribed to
endpoints_to_test = [
    {
        "host": "rto-vehicle-information-india.p.rapidapi.com",
        "url": "https://rto-vehicle-information-india.p.rapidapi.com/",
        "method": "POST",
        "payload": {"vehicle_number": "DL01CA5678", "reg_no": "DL01CA5678"}
    },
    {
        "host": "vehicle-rc-information.p.rapidapi.com",
        "url": "https://vehicle-rc-information.p.rapidapi.com/",
        "method": "POST",
        "payload": {"vehicle_number": "DL01CA5678"}
    },
    {
        "host": "rto-vehicle-details.p.rapidapi.com",
        "url": "https://rto-vehicle-details.p.rapidapi.com/api/v1/vehicle/DL01CA5678",
        "method": "GET",
        "payload": None
    },
    {
        "host": "rto-vehicle-information4.p.rapidapi.com",
        "url": "https://rto-vehicle-information4.p.rapidapi.com/vehicle-details",
        "method": "POST",
        "payload": {"reg_no": "DL01CA5678"}
    },
    {
        "host": "rto-vehicle-information-verification-india.p.rapidapi.com",
        "url": "https://rto-vehicle-information-verification-india.p.rapidapi.com/",
        "method": "POST",
        "payload": {"vehicle_number": "DL01CA5678"}
    }
]

print("\nTesting user's RapidAPI key across endpoints...")
for ep in endpoints_to_test:
    headers = {
        "x-rapidapi-key": api_key,
        "x-rapidapi-host": ep["host"],
        "Content-Type": "application/json"
    }
    try:
        with httpx.Client(timeout=6.0) as client:
            if ep["method"] == "POST":
                res = client.post(ep["url"], json=ep["payload"], headers=headers)
            else:
                res = client.get(ep["url"], headers=headers)
                
            print(f"\nHost: {ep['host']}")
            print(f"Status Code: {res.status_code}")
            print(f"Response: {res.text[:250]}")
            
            if res.status_code == 200:
                print(f"--> [SUCCESS] Subscribed and working on {ep['host']}!")
                # Update configured host to the working one
                db = SessionLocal()
                try:
                    rto_service.save_api_credentials(api_key, ep["host"], db)
                finally:
                    db.close()
    except Exception as e:
        print(f"Host {ep['host']} error: {e}")
