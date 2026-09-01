import psycopg2

conn_str = "postgresql://postgres.psqpvochdmawlgatmmhn:FourDeeErp%402026%21@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

def main():
    conn = psycopg2.connect(conn_str)
    cur = conn.cursor()
    
    cur.execute("SELECT id, name, email, role, is_active, password_hash FROM users;")
    records = cur.fetchall()
    print("--- USERS in Database ---")
    for r in records:
        print(f"ID: {r[0]}, Name: {r[1]}, Email: {r[2]}, Role: {r[3]}, Active: {r[4]}, Hash: {r[5][:15]}...")
        
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
