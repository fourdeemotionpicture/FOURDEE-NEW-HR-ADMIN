import psycopg2

conn_str = "postgresql://postgres.psqpvochdmawlgatmmhn:FourDeeErp%402026%21@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

def main():
    conn = psycopg2.connect(conn_str)
    cur = conn.cursor()
    
    cur.execute("""
        SELECT id, name, email, password_hash, role, designation, monthly_salary, dob, biometric_id, personal_email, phone, is_active, created_at, updated_at
        FROM public.users
        WHERE email = 'sujith@fourdee.com'
        LIMIT 1;
    """)
    row = cur.fetchone()
    print("Fetched user:", row)
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
