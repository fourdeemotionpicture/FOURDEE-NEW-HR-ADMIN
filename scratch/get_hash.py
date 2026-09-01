import psycopg2

conn_str = "postgresql://postgres.psqpvochdmawlgatmmhn:FourDeeErp%402026%21@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

def main():
    conn = psycopg2.connect(conn_str)
    cur = conn.cursor()
    
    cur.execute("SELECT id, name, email, password_hash FROM users WHERE email = 'sujith@fourdee.com';")
    row = cur.fetchone()
    if row:
        user_id, name, email, p_hash = row
        print(f"User: {name}, Email: {email}, Hash: {p_hash}")
            
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
