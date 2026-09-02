import psycopg2

conn_str_6543 = "postgresql://postgres.psqpvochdmawlgatmmhn:FourDeeErp%402026%21@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require"

def main():
    try:
        conn = psycopg2.connect(conn_str_6543)
        cur = conn.cursor()
        
        cur.execute("""
            SELECT id, name, email, password_hash, role, designation, account_number, ifsc_code
            FROM public.users
            WHERE email = 'sujith@fourdee.com';
        """)
        row = cur.fetchone()
        print("Connected to Port 6543 successfully! User fetched:", row)
        
        cur.close()
        conn.close()
    except Exception as e:
        print("Error connecting to 6543:", e)

if __name__ == "__main__":
    main()
