import sqlite3
import os

def migrate():
    db_path = "database/gate_records.db" if os.path.exists("database/gate_records.db") else "gate_records.db"
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    
    # 1. Check gate_logs columns
    c.execute("PRAGMA table_info(gate_logs)")
    columns = [row[1] for row in c.fetchall()]
    if "event_type" not in columns:
        c.execute("ALTER TABLE gate_logs ADD COLUMN event_type VARCHAR(30) DEFAULT 'ENTRY'")
        print("Added column: gate_logs.event_type")
    if "stay_duration" not in columns:
        c.execute("ALTER TABLE gate_logs ADD COLUMN stay_duration VARCHAR(50)")
        print("Added column: gate_logs.stay_duration")
        
    # 2. Check vehicle_registry columns
    c.execute("PRAGMA table_info(vehicle_registry)")
    reg_columns = [row[1] for row in c.fetchall()]
    if "source" not in reg_columns:
        c.execute("ALTER TABLE vehicle_registry ADD COLUMN source VARCHAR(30) DEFAULT 'MANUAL'")
        print("Added column: vehicle_registry.source")
        
    conn.commit()
    conn.close()
    print(f"Database schema migration completed on {db_path}!")

if __name__ == '__main__':
    migrate()
