import sys
from datetime import datetime
from zk import ZK

DEVICE_IP = "192.168.1.201"
DEVICE_PORT = 4370

def main():
    print("Connecting to biometric device to read all punches for debugging...")
    zk = ZK(DEVICE_IP, port=DEVICE_PORT, timeout=15, force_udp=False, ommit_ping=True)
    conn = None
    try:
        conn = zk.connect()
        conn.disable_device()
        
        # Get machine time
        try:
            device_time = conn.get_time()
            print(f"Current clock time on the biometric machine: {device_time}")
        except Exception as te:
            print(f"Could not read machine time: {te}")
            
        print("Reading all attendance records from device...")
        records = conn.get_attendance()
        print(f"Total records stored on device: {len(records)}")
        
        # Sort records by timestamp descending to see the latest scans
        sorted_records = sorted(records, key=lambda r: r.timestamp, reverse=True)
        
        print("\nLast 20 scans recorded on the machine:")
        print("--------------------------------------------------")
        print(f"{'Index':<6} | {'User ID':<8} | {'Timestamp':<20} | {'Status/Punch':<12}")
        print("--------------------------------------------------")
        for idx, r in enumerate(sorted_records[:20]):
            print(f"{idx+1:<6} | {r.user_id:<8} | {r.timestamp.strftime('%Y-%m-%d %H:%M:%S'):<20} | {r.punch:<12}")
        print("--------------------------------------------------")
        
        conn.enable_device()
    except Exception as e:
        print(f"Error connecting or reading: {e}")
    finally:
        if conn:
            try:
                conn.disconnect()
            except:
                pass
            print("Disconnected.")

if __name__ == "__main__":
    main()
