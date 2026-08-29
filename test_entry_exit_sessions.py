import os
import time
import datetime
import asyncio
import httpx
import numpy as np

from app import (
    app,
    SessionLocal,
    VehicleRegistry,
    VehicleSession,
    GateLog,
    gate_manager
)

async def test_entry_exit_5min_rule():
    print("\n--- TEST: 5-Minute Entry / Exit Session Tracking Logic ---")
    db = SessionLocal()
    try:
        # Clear existing sessions for clean test
        db.query(VehicleSession).delete()
        db.commit()
        gate_manager.cooldowns.clear()
        
        test_plate = "MH 12 AB 1234"
        dummy_crop = np.zeros((60, 200, 3), dtype=np.uint8) + 220
        
        # 1. First Scan -> Should be an ENTRY event
        event1 = gate_manager.trigger_gate_event(test_plate, 0.95, dummy_crop, db)
        print(f"Scan 1 (Arrival): action={event1['action']}, event_type={event1.get('event_type')}, message={event1['message']}")
        assert event1['action'] == "OPENED"
        assert event1.get('event_type') == "ENTRY"
        
        active_sess = db.query(VehicleSession).filter(VehicleSession.plate_number == "MH12AB1234", VehicleSession.status == "INSIDE").first()
        assert active_sess is not None
        print(f"Active Session created in DB: ID={active_sess.id}, Status={active_sess.status}, EntryTime={active_sess.entry_time}")
        
        # 2. Second Scan (Simulate 1 minute elapsed < 5 mins) -> Should be ALREADY_INSIDE / Cooldown
        gate_manager.cooldowns.clear() # clear 15s spam cooldown to test 5min session threshold
        event2 = gate_manager.trigger_gate_event(test_plate, 0.95, dummy_crop, db)
        print(f"Scan 2 (1m elapsed): action={event2['action']}, message={event2['message']}")
        assert event2['action'] == "ALREADY_INSIDE"
        
        # 3. Third Scan (Simulate 12 minutes elapsed >= 5 mins) -> Should be an EXIT event!
        active_sess.entry_time = datetime.datetime.utcnow() - datetime.timedelta(minutes=12)
        db.commit()
        gate_manager.cooldowns.clear()
        
        event3 = gate_manager.trigger_gate_event(test_plate, 0.96, dummy_crop, db)
        print(f"Scan 3 (12m elapsed): action={event3['action']}, event_type={event3.get('event_type')}, message={event3['message']}")
        assert event3['action'] == "OPENED"
        assert event3.get('event_type') == "EXIT"
        
        # Verify session is now COMPLETED
        sess_completed = db.query(VehicleSession).filter(VehicleSession.id == active_sess.id).first()
        assert sess_completed.status == "COMPLETED"
        assert sess_completed.exit_time is not None
        assert sess_completed.duration_minutes >= 11.0
        print(f"Completed Session: Duration={sess_completed.duration_formatted} ({sess_completed.duration_minutes} mins)")
        
    finally:
        db.close()
    print("[PASS] 5-Minute Entry / Exit State Machine verified 100% successfully!")

async def test_rest_endpoints():
    print("\n--- TEST: REST APIs (Active Sessions, Network Info, Stats) ---")
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        r_net = await client.get("/api/system/network-info")
        assert r_net.status_code == 200
        net_info = r_net.json()
        print(f"Network Info: Local IP={net_info['local_ip']}, Mobile URL={net_info['mobile_url']}")
        assert len(net_info['local_ip']) > 0
        
        r_sess = await client.get("/api/sessions/active")
        assert r_sess.status_code == 200
        print(f"Active Sessions count: {len(r_sess.json())}")
        
        r_hist = await client.get("/api/sessions/history")
        assert r_hist.status_code == 200
        print(f"Session History count: {len(r_hist.json())}")
        
        r_stats = await client.get("/api/stats")
        assert r_stats.status_code == 200
        stats = r_stats.json()
        print(f"Stats: Entries={stats['total_entries']}, Exits={stats['total_exits']}, Inside={stats['currently_inside']}")
        
    print("[PASS] REST endpoints verified!")

if __name__ == '__main__':
    asyncio.run(test_entry_exit_5min_rule())
    asyncio.run(test_rest_endpoints())
    print("\n==========================================")
    print(" ALL ENTRY/EXIT TESTS PASSED WITH 100% SUCCESS!")
    print("==========================================\n")
