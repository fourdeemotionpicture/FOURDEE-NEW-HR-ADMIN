import psycopg2

conn_str_6543 = "postgresql://postgres.psqpvochdmawlgatmmhn:FourDeeErp%402026%21@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require"

def main():
    conn = psycopg2.connect(conn_str_6543)
    cur = conn.cursor()
    
    print("1. Updating Surjith Thangavel name and designation...")
    cur.execute("""
        UPDATE public.users 
        SET name = 'Surjith Thangavel',
            designation = 'Media Manager – Digital Marketing & Branding',
            updated_at = NOW()
        WHERE email = 'sujith@fourdee.com' OR name ILIKE '%Sujith%' OR name ILIKE '%Surjith%'
        RETURNING id, name, email, designation;
    """)
    rows = cur.fetchall()
    for r in rows:
        print(f"Updated: {r[1]} ({r[2]}) -> {r[3]}")
        
    print("\n2. Updating Vallarasu V designation...")
    cur.execute("""
        UPDATE public.users 
        SET name = 'Vallarasu V',
            designation = 'Writer (Creative Team)',
            updated_at = NOW()
        WHERE email = 'vallarasu@fourdee.com' OR name ILIKE '%Vallarasu%'
        RETURNING id, name, email, designation;
    """)
    rows = cur.fetchall()
    for r in rows:
        print(f"Updated: {r[1]} ({r[2]}) -> {r[3]}")
        
    print("\n3. Updating Mithun Lingan designation...")
    cur.execute("""
        UPDATE public.users 
        SET designation = 'Writer (Creative Team)',
            updated_at = NOW()
        WHERE email = 'mithun@fourdee.com' OR name ILIKE '%Mithun%'
        RETURNING id, name, email, designation;
    """)
    rows = cur.fetchall()
    for r in rows:
        print(f"Updated: {r[1]} ({r[2]}) -> {r[3]}")
        
    conn.commit()
    
    # Query all users
    cur.execute("SELECT id, name, email, role, designation FROM public.users ORDER BY name ASC;")
    all_users = cur.fetchall()
    print("\n--- Current Users in Database ---")
    for u in all_users:
        print(f"{u[1]} | {u[3]} | {u[4]} | {u[2]}")
        
    cur.close()
    conn.close()
    print("\nDatabase records updated successfully!")

if __name__ == "__main__":
    main()
