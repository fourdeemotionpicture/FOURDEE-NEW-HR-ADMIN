import psycopg2

conn_str_6543 = "postgresql://postgres.psqpvochdmawlgatmmhn:FourDeeErp%402026%21@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require"

def main():
    conn = psycopg2.connect(conn_str_6543)
    cur = conn.cursor()
    
    cur.execute("""
        SELECT id, name, email, role, designation, monthly_salary, phone, account_number, is_active
        FROM public.users
        WHERE is_active = true
        ORDER BY role DESC, name ASC;
    """)
    users = cur.fetchall()
    print("--- ACTIVE EMPLOYEES & USERS ---")
    for u in users:
        print(f"Name: {u[1]} | Role: {u[3]} | Designation: {u[4]} | Email: {u[2]} | Phone: {u[6]}")
        
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
