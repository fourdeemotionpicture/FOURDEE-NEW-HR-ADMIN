import os
import re

root_dir = r"C:\Users\Administrator\Documents\GitHub\FOURDEE-NEW-HR-ADMIN\src"

patterns = [
    re.compile(r'owner_admin'),
    re.compile(r'super_admin'),
]

matches = []

for root, dirs, files in os.walk(root_dir):
    for file in files:
        if file.endswith(('.tsx')):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
                for idx, line in enumerate(lines):
                    for pat in patterns:
                        if pat.search(line):
                            matches.append((filepath, idx + 1, line.strip()))
                            break

print(f"Total UI checks found: {len(matches)}")
for m in matches:
    print(f"{os.path.relpath(m[0], root_dir)}:{m[1]} -> {m[2]}")
