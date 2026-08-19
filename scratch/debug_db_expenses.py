import psycopg2

conn_str = "postgresql://postgres.psqpvochdmawlgatmmhn:FourDeeErp%402026%21@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

def main():
    conn = psycopg2.connect(conn_str)
    cur = conn.cursor()
    
    # Check petty cash count and sum
    cur.execute("SELECT COUNT(*), SUM(CAST(amount AS NUMERIC)) FROM petty_cash")
    pc_count, pc_sum = cur.fetchone()
    print(f"Petty Cash count in DB: {pc_count}, sum: {pc_sum}")
    
    # Check expenses count and sum
    cur.execute("SELECT COUNT(*), SUM(CAST(amount AS NUMERIC)) FROM expenses")
    exp_count, exp_sum = cur.fetchone()
    print(f"Expenses count in DB: {exp_count}, sum: {exp_sum}")
    
    # Print the last 20 entries of petty cash sorted by date and createdAt
    print("\nLast 20 Petty Cash Entries in DB:")
    print("--------------------------------------------------")
    print(f"{'Date':<12} | {'Amount':<10} | {'Type':<10} | {'Balance After':<15} | {'Notes'}")
    print("--------------------------------------------------")
    cur.execute("SELECT date, amount, type, balance_after, notes FROM petty_cash ORDER BY date DESC, created_at DESC LIMIT 20")
    for row in cur.fetchall():
        print(f"{str(row[0]):<12} | {str(row[1]):<10} | {row[2]:<10} | {str(row[3]):<15} | {row[4]}")
        
    # Print the last 20 expenses in DB
    print("\nLast 20 Expenses in DB:")
    print("--------------------------------------------------")
    print(f"{'Date':<12} | {'Amount':<10} | {'Paid To':<20} | {'Notes'}")
    print("--------------------------------------------------")
    cur.execute("SELECT date, amount, paid_to, notes FROM expenses ORDER BY date DESC, created_at DESC LIMIT 20")
    for row in cur.fetchall():
        print(f"{str(row[0]):<12} | {str(row[1]):<10} | {row[2]:<20} | {row[3]}")
        
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
