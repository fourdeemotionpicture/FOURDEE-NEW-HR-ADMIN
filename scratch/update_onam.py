import psycopg2

conn_str = "postgresql://postgres.psqpvochdmawlgatmmhn:FourDeeErp%402026%21@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

def main():
    conn = psycopg2.connect(conn_str)
    cur = conn.cursor()
    
    # 1. Remove 2026-08-27 if exists
    cur.execute("DELETE FROM holidays WHERE date = '2026-08-27';")
    
    # 2. Insert/Update 2026-08-26 as Onam
    cur.execute("""
        INSERT INTO holidays (name, date, description, year, created_at, updated_at)
        VALUES ('Onam', '2026-08-26', 'Festival Holiday', 2026, NOW(), NOW())
        ON CONFLICT (date) DO UPDATE
        SET name = 'Onam', description = 'Festival Holiday', year = 2026, updated_at = NOW();
    """)
    
    conn.commit()
    
    # Query all holidays to verify
    cur.execute("SELECT date, name, year FROM holidays ORDER BY date ASC;")
    records = cur.fetchall()
    print("\n--- Updated Registered Holidays ---")
    for r in records:
        print(f"{r[0]} | {r[1]} ({r[2]})")
        
    cur.close()
    conn.close()
    print("\nOnam date updated to 2026-08-26 successfully!")

if __name__ == "__main__":
    main()
