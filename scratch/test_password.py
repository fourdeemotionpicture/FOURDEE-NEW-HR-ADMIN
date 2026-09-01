import psycopg2
import bcrypt

conn_str = "postgresql://postgres.psqpvochdmawlgatmmhn:FourDeeErp%402026%21@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

def main():
    conn = psycopg2.connect(conn_str)
    cur = conn.cursor()
    
    cur.execute("SELECT id, name, email, password_hash FROM users WHERE email = 'sujith@fourdee.com';")
    row = cur.fetchone()
    if row:
        user_id, name, email, p_hash = row
        print(f"User: {name}, Email: {email}, Hash: {p_hash}")
        
        # Test passwords
        for pwd in ["Sujith@123", "admin123", "password", "sujith123", "123456"]:
            matched = bcrypt.checkpw(pwd.encode('utf-8'), p_hash.encode('utf-8'))
            print(f"Password '{pwd}': {matched}")
            
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
