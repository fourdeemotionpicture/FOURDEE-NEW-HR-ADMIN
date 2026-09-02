import psycopg2

conn_str = "postgresql://postgres.psqpvochdmawlgatmmhn:FourDeeErp%402026%21@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

def main():
    conn = psycopg2.connect(conn_str)
    cur = conn.cursor()
    
    # Check columns in public.users
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users'
        ORDER BY ordinal_position;
    """)
    cols = cur.fetchall()
    print("--- Columns in public.users ---")
    for c in cols:
        print(f"Col: {c[0]} ({c[1]})")
        
    # Execute the EXACT Drizzle query that failed
    print("\n--- Testing Exact Drizzle Query ---")
    try:
        cur.execute("""
            SELECT "id", "name", "email", "password_hash", "role", "designation", "monthly_salary", "dob", "biometric_id", "personal_email", "phone", "account_number", "ifsc_code", "is_active", "created_at", "updated_at" 
            FROM "users" 
            WHERE "users"."email" = 'sujith@fourdee.com' 
            LIMIT 1;
        """)
        row = cur.fetchone()
        print("Success! Row fetched:", row)
    except Exception as e:
        print("Error executing query:", e)
        
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
