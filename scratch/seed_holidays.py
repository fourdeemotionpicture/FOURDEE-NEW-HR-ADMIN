import psycopg2

conn_str = "postgresql://postgres.psqpvochdmawlgatmmhn:FourDeeErp%402026%21@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

holidays_list = [
    # 2026 Holidays
    ("Independence Day", "2026-08-15", "National Holiday", 2026),
    ("Onam", "2026-08-26", "Festival Holiday", 2026),
    ("Vinayagar Chaturthi", "2026-09-14", "Festival Holiday", 2026),
    ("Ayudha Pooja", "2026-10-19", "Festival Holiday", 2026),
    ("Vijayadasami", "2026-10-20", "Festival Holiday", 2026),
    ("Deepavali", "2026-11-08", "Festival Holiday", 2026),
    ("Christmas", "2026-12-25", "Festival Holiday", 2026),
    
    # 2027 Holidays
    ("New Year's Day", "2027-01-01", "New Year Holiday", 2027),
    ("Pongal", "2027-01-15", "Festival Holiday", 2027),
    ("Uzhavar Thirunal / Mattu Pongal", "2027-01-16", "Festival Holiday", 2027),
    ("Tamil New Year", "2027-04-14", "Festival Holiday", 2027),
    ("May Day", "2027-05-01", "International Workers' Day", 2027),
    ("Independence Day", "2027-08-15", "National Holiday", 2027),
    ("Onam", "2027-09-12", "Festival Holiday", 2027),
]

def main():
    conn = psycopg2.connect(conn_str)
    cur = conn.cursor()
    
    print("Seeding official holidays into database...")
    for name, date_str, desc, year in holidays_list:
        cur.execute("""
            INSERT INTO holidays (name, date, description, year, created_at, updated_at)
            VALUES (%s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (date) DO UPDATE 
            SET name = EXCLUDED.name, 
                description = EXCLUDED.description, 
                year = EXCLUDED.year,
                updated_at = NOW();
        """, (name, date_str, desc, year))
        print(f"Upserted holiday: {date_str} - {name} ({year})")
        
    conn.commit()
    
    # Query all holidays
    cur.execute("SELECT date, name, year FROM holidays ORDER BY date ASC;")
    records = cur.fetchall()
    print("\n--- Current Registered Holidays ---")
    for r in records:
        print(f"{r[0]} | {r[1]} ({r[2]})")
        
    cur.close()
    conn.close()
    print("\nAll holidays seeded successfully!")

if __name__ == "__main__":
    main()
