import psycopg2

conn_str = "postgresql://postgres.psqpvochdmawlgatmmhn:FourDeeErp%402026%21@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

def main():
    conn = psycopg2.connect(conn_str)
    cur = conn.cursor()
    
    # 1. Add personal_email and phone to users table if they don't exist
    print("Checking and adding personal_email and phone columns to users...")
    cur.execute("""
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'personal_email') THEN
            ALTER TABLE users ADD COLUMN personal_email VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'phone') THEN
            ALTER TABLE users ADD COLUMN phone VARCHAR(50);
        END IF;
    END $$;
    """)

    # 2. Create holidays table
    print("Creating holidays table...")
    cur.execute("""
    CREATE TABLE IF NOT EXISTS holidays (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      date DATE NOT NULL UNIQUE,
      description TEXT,
      year INTEGER NOT NULL DEFAULT 2026,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    """)
    
    # 3. Check if table was created successfully
    cur.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'holidays')")
    exists = cur.fetchone()[0]
    print(f"Table 'holidays' exists: {exists}")
    
    conn.commit()
    cur.close()
    conn.close()
    print("Database migration complete!")

if __name__ == "__main__":
    main()
