import psycopg2

conn_str = "postgresql://postgres.psqpvochdmawlgatmmhn:FourDeeErp%402026%21@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

def main():
    conn = psycopg2.connect(conn_str)
    cur = conn.cursor()
    
    # 1. Create leave_requests table
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS leave_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      type VARCHAR(50) NOT NULL,
      reason TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      reviewed_by UUID REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    """
    print("Creating leave_requests table...")
    cur.execute(create_table_sql)
    
    # 2. Check if table was created successfully
    cur.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'leave_requests')")
    exists = cur.fetchone()[0]
    print(f"Table 'leave_requests' exists: {exists}")
    
    conn.commit()
    cur.close()
    conn.close()
    print("Database migration complete!")

if __name__ == "__main__":
    main()
