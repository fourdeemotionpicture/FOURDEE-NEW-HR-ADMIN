import psycopg2

conn_str = "postgresql://postgres.psqpvochdmawlgatmmhn:FourDeeErp%402026%21@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

def main():
    conn = psycopg2.connect(conn_str)
    cur = conn.cursor()
    
    print("1. Adding account_number and ifsc_code columns to public.users...")
    cur.execute("""
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS account_number VARCHAR(50);
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(50);
    """)
    conn.commit()
    
    # 2. Update employee records with their bank details and phone numbers
    bank_data = [
        {
            "name_pattern": "%Vallarasu%",
            "account_number": "121101000056684",
            "ifsc_code": "IOBA0001211",
            "phone": "8220471188"
        },
        {
            "name_pattern": "%Mithun%",
            "account_number": "50100010101592",
            "ifsc_code": "HDFC0000444",
            "phone": "9003052897"
        },
        {
            "name_pattern": "%Karthik%",
            "account_number": "02061610044689",
            "ifsc_code": "HDFC0003742",
            "phone": "9962080501"
        },
        {
            "name_pattern": "%Sujith%",
            "account_number": "50100466411981",
            "ifsc_code": "HDFC0000847",
            "phone": "8667038564"
        },
        {
            "name_pattern": "%Praveen%",
            "account_number": "147201000013692",
            "ifsc_code": "IOBA0001472",
            "phone": "9176565675"
        },
        {
            "name_pattern": "%Shafi%",
            "account_number": "802910510000014",
            "ifsc_code": "BKID0008029",
            "phone": "6374414384"
        }
    ]
    
    print("\n2. Updating employee bank details...")
    for item in bank_data:
        cur.execute("""
            UPDATE public.users 
            SET account_number = %s,
                ifsc_code = %s,
                phone = %s,
                updated_at = NOW()
            WHERE name ILIKE %s
            RETURNING id, name, account_number, ifsc_code, phone;
        """, (item["account_number"], item["ifsc_code"], item["phone"], item["name_pattern"]))
        rows = cur.fetchall()
        for r in rows:
            print(f"Updated User: {r[1]} | A/c: {r[2]} | IFSC: {r[3]} | Phone: {r[4]}")
            
    conn.commit()
    
    # Verify all users
    cur.execute("SELECT id, name, email, account_number, ifsc_code, phone FROM public.users ORDER BY name ASC;")
    all_users = cur.fetchall()
    print("\n--- Current Users in Database with Bank Details ---")
    for u in all_users:
        print(f"{u[1]} ({u[2]}) -> A/C: {u[3]}, IFSC: {u[4]}, Phone: {u[5]}")
        
    cur.close()
    conn.close()
    print("\nBank details migration completed successfully!")

if __name__ == "__main__":
    main()
