import psycopg2

conn_str = "postgresql://postgres.psqpvochdmawlgatmmhn:FourDeeErp%402026%21@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

def main():
    conn = psycopg2.connect(conn_str)
    cur = conn.cursor()
    
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users';
    """)
    columns = cur.fetchall()
    print("--- Columns in 'users' Table ---")
    for col in columns:
        print(f"{col[0]} ({col[1]})")
        
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
