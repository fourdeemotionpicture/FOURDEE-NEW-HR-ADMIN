import sys
import os
import time
import json
import urllib.request
from datetime import datetime

# 1. Automatically install pyzk dependency if missing
try:
    from zk import ZK, const
except ImportError:
    print("Installing required library 'pyzk'...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pyzk"])
    from zk import ZK, const

# 2. Configuration Settings (Change these to match your office network)
DEVICE_IP = "192.168.1.201"      # The local IP address of your eSSL machine
DEVICE_PORT = 4370               # Default port is 4370
WEBSITE_URL = "https://fourdee-new-hr-admin-taupe.vercel.app/api/attendance/biometric"
SECRET_KEY = "FourDeeBiometricSecret2026!"

LAST_RUN_FILE = "last_timestamp.txt"

def get_last_timestamp():
    if os.path.exists(LAST_RUN_FILE):
        with open(LAST_RUN_FILE, "r") as f:
            return f.read().strip()
    return "2000-01-01 00:00:00"

def save_last_timestamp(ts_str):
    with open(LAST_RUN_FILE, "w") as f:
        f.write(ts_str)

def send_punches_to_website(punches):
    if not punches:
        return True
    
    data = json.dumps({"punches": punches}).encode("utf-8")
    req = urllib.request.Request(
        WEBSITE_URL,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {SECRET_KEY}"
        },
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            print(f"Successfully uploaded {len(punches)} punches to website! Server response: {res_body}")
            return True
    except Exception as e:
        print(f"Failed to connect or upload punches to website: {e}")
        return False

def main():
    print("--------------------------------------------------")
    print(f"Starting eSSL Biometric Bridge to HR Portal...")
    print(f"Device: {DEVICE_IP}:{DEVICE_PORT}")
    print(f"Target Portal: {WEBSITE_URL}")
    print("--------------------------------------------------")

    zk = ZK(DEVICE_IP, port=DEVICE_PORT, timeout=15, force_udp=False, ommit_ping=True)
    conn = None
    
    try:
        print("Connecting to biometric machine...")
        conn = zk.connect()
        print("Connection successful! Disabling device keyboard during read...")
        conn.disable_device()
        
        # Get all attendance records from device
        print("Reading attendance records...")
        attendance_records = conn.get_attendance()
        
        last_ts = get_last_timestamp()
        last_ts_dt = datetime.strptime(last_ts, "%Y-%m-%d %H:%M:%S")
        
        punches = []
        latest_ts_dt = last_ts_dt
        
        for record in attendance_records:
            # record.timestamp is a datetime object
            rec_ts_str = record.timestamp.strftime("%Y-%m-%d %H:%M:%S")
            if record.timestamp > last_ts_dt:
                punches.append({
                    "userId": str(record.user_id),
                    "timestamp": rec_ts_str
                })
                if record.timestamp > latest_ts_dt:
                    latest_ts_dt = record.timestamp
        
        print(f"Found {len(punches)} new punches since {last_ts}.")
        
        if punches:
            # Send punches to the Vercel app
            success = send_punches_to_website(punches)
            if success:
                save_last_timestamp(latest_ts_dt.strftime("%Y-%m-%d %H:%M:%S"))
        else:
            print("No new scans detected.")

        conn.enable_device()
        print("Device keyboard re-enabled. Sync completed successfully.")
        
    except Exception as e:
        print(f"Error occurred during sync execution: {e}")
    finally:
        if conn:
            try:
                conn.disconnect()
                print("Disconnected from biometric device.")
            except:
                pass

if __name__ == "__main__":
    # Run loop every 5 minutes (300 seconds)
    while True:
        try:
            main()
        except KeyboardInterrupt:
            print("\nBridge stopped by user.")
            sys.exit(0)
        except Exception as ex:
            print(f"Loop error: {ex}")
            
        print("Waiting 5 minutes for next sync cycle...")
        time.sleep(300)
