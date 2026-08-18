import os
import sys
import subprocess

def main():
    print("==================================================")
    print("Setting up Biometric Bridge to run on Windows Startup...")
    print("==================================================")
    
    # 1. Paths
    startup_dir = os.path.join(os.environ["APPDATA"], "Microsoft", "Windows", "Start Menu", "Programs", "Startup")
    shortcut_path = os.path.join(startup_dir, "ESSL_Biometric_Bridge.lnk")
    
    bridge_dir = os.path.dirname(os.path.abspath(__file__))
    target_path = os.path.join(bridge_dir, "run_bridge.bat")
    
    if not os.path.exists(target_path):
        print(f"Error: Could not find run_bridge.bat at {target_path}")
        return
        
    print(f"Target file: {target_path}")
    print(f"Startup folder: {startup_dir}")
    
    # 2. Create shortcut using PowerShell
    try:
        ps_cmd = f'$s = (New-Object -ComObject WScript.Shell).CreateShortcut("{shortcut_path}"); $s.TargetPath = "{target_path}"; $s.WorkingDirectory = "{bridge_dir}"; $s.Save()'
        subprocess.run(["powershell", "-Command", ps_cmd], check=True)
        print("\nSUCCESS: Shortcut created in Windows Startup folder!")
        print("The biometric bridge will now start automatically in the background every time the PC turns on.")
    except Exception as e:
        print(f"\nFailed to create shortcut: {e}")
        print("Please copy run_bridge.bat shortcut manually to startup folder.")

if __name__ == "__main__":
    main()
