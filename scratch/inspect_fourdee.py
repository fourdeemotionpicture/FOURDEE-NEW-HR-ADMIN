import os
import re

search_term = re.compile(r"Four\s*Dee", re.IGNORECASE)
root_dir = r"C:\Users\Administrator\Documents\GitHub\FOURDEE-NEW-HR-ADMIN\src"

matches = []

for root, dirs, files in os.walk(root_dir):
    for file in files:
        if file.endswith(('.ts', '.tsx', '.js', '.jsx', '.json', '.html', '.md')):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
                for idx, line in enumerate(lines):
                    if search_term.search(line):
                        matches.append((filepath, idx + 1, line.strip()))

print(f"Total occurrences: {len(matches)}")
for m in matches:
    print(f"{os.path.relpath(m[0], root_dir)}:{m[1]} -> {m[2][:100]}")
