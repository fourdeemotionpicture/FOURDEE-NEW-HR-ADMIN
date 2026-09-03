import os
import re

search_terms = [
    re.compile(r"Four Dee Motion Picture", re.IGNORECASE),
    re.compile(r"fourdee motion picture", re.IGNORECASE)
]

root_dir = r"C:\Users\Administrator\Documents\GitHub\FOURDEE-NEW-HR-ADMIN\src"

matches = []

for root, dirs, files in os.walk(root_dir):
    for file in files:
        if file.endswith(('.ts', '.tsx', '.js', '.jsx', '.json', '.html', '.md')):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
                for idx, line in enumerate(lines):
                    for term in search_terms:
                        if term.search(line):
                            matches.append((filepath, idx + 1, line.strip()))
                            break

print(f"Total occurrences found in src: {len(matches)}")
for m in matches:
    try:
        print(f"{m[0]}:{m[1]}")
    except Exception:
        pass
