import os
import asyncio
import httpx
from app import app, SessionLocal, VehicleRegistry, rto_service

async def test_rto_single_query_caching():
    print("\n--- TEST 1: First-Time Lookup vs Local Database Caching ---")
    db = SessionLocal()
    try:
        test_plate = "GJ01XY7788"
        
        # Ensure plate is not in DB initially
        db.query(VehicleRegistry).filter(VehicleRegistry.plate_number == test_plate).delete()
        db.commit()
        
        initial_cache_hits = rto_service.cache_hits
        
        # 1. First Time Lookup
        print(f"Step 1: First time lookup for '{test_plate}'...")
        veh1 = rto_service.lookup_or_create_vehicle(test_plate, db)
        assert veh1 is not None
        assert veh1.plate_number == test_plate
        print(f"Result 1: Owner='{veh1.owner_name}', City='{veh1.registration_city}', Source='{veh1.source}'")
        
        # Verify it was saved to DB
        in_db = db.query(VehicleRegistry).filter(VehicleRegistry.plate_number == test_plate).first()
        assert in_db is not None
        
        # 2. Second Time Lookup -> MUST BE SERVED FROM CACHE! (0 external calls)
        print(f"\nStep 2: Second time lookup for '{test_plate}' (Simulating same car arriving again)...")
        veh2 = rto_service.lookup_or_create_vehicle(test_plate, db)
        assert veh2.plate_number == test_plate
        assert rto_service.cache_hits == initial_cache_hits + 1
        print(f"Result 2: Served from Cache! Cache Hits={rto_service.cache_hits} (Zero external calls consumed)")
        
    finally:
        db.close()
    print("[PASS] Single-call caching logic verified 100%!")

async def test_rto_rest_api():
    print("\n--- TEST 2: RapidAPI RTO REST APIs & Diagnostic Sandbox ---")
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Config API
        r_conf = await client.get("/api/rto/config")
        assert r_conf.status_code == 200
        conf_data = r_conf.json()
        print(f"RTO Config: Status={conf_data['status']}, Cached Count={conf_data['cached_vehicles_count']}")
        
        # Test Lookup Endpoint for Existing plate (Cache Hit)
        r_test_cache = await client.post("/api/rto/lookup-test", data={"plate_number": "MH12AB1234"})
        assert r_test_cache.status_code == 200
        data_cache = r_test_cache.json()
        print(f"Lookup Existing 'MH12AB1234': CachedBefore={data_cache['was_cached_before']}, Owner={data_cache['owner_name']}")
        assert data_cache['was_cached_before'] is True
        
        # Test Lookup Endpoint for New plate (First Time)
        new_test_plate = "RJ14MN1122"
        r_test_new = await client.post("/api/rto/lookup-test", data={"plate_number": new_test_plate})
        assert r_test_new.status_code == 200
        data_new = r_test_new.json()
        print(f"Lookup New '{new_test_plate}': CachedBefore={data_new['was_cached_before']}, City={data_new['registration_city']}")
        assert "Jaipur" in data_new['registration_city'] or "Rajasthan" in data_new['registration_city']
        
        # Saving API credentials
        r_save = await client.post("/api/rto/config", data={"rapidapi_key": "test_mock_key_12345", "rapidapi_host": "rto-vehicle-information-india.p.rapidapi.com"})
        assert r_save.status_code == 200
        print("RapidAPI credentials save test: OK")

    print("[PASS] RapidAPI REST Endpoints verified!")

if __name__ == '__main__':
    asyncio.run(test_rto_single_query_caching())
    asyncio.run(test_rto_rest_api())
    print("\n==========================================")
    print(" ALL RAPIDAPI RTO TESTS PASSED WITH 100% SUCCESS!")
    print("==========================================\n")
