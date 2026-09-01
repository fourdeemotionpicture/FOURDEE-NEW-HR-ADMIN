import psycopg2

conn_str = "postgresql://postgres.psqpvochdmawlgatmmhn:FourDeeErp%402026%21@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

def main():
    conn = psycopg2.connect(conn_str)
    cur = conn.cursor()
    
    print("Checking and adding missing columns in public.users...")
    
    cur.execute("""
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS personal_email VARCHAR(255);
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS dob DATE;
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS biometric_id INTEGER;
    """)
    conn.commit()
    
    # Check columns in public.users specifically
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users'
        ORDER BY ordinal_position;
    """)
    columns = cur.fetchall()
    print("\n--- Columns in public.users ---")
    for col in columns:
        print(f"Col: {col[0]} ({col[1]})")
        
    cur.close()
    conn.close()
    print("\nMigration completed successfully!")

if __name__ == "__main__":
    main()
