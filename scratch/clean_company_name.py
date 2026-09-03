import os
import re

root_dir = r"C:\Users\Administrator\Documents\GitHub\FOURDEE-NEW-HR-ADMIN\src"

pattern = re.compile(r"Four\s*Dee\s*Motion\s*Pictures?(?:\s*Private\s*Limited)?(?:s\s*Private\s*Limited)?", re.IGNORECASE)

modified_files = []

for root, dirs, files in os.walk(root_dir):
    for file in files:
        if file.endswith(('.ts', '.tsx', '.js', '.jsx', '.json', '.html', '.md')):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                
            new_content = pattern.sub("Four Dee Motion Pictures Private Limited", content)
            
            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                modified_files.append(filepath)

print(f"Total cleanly standardized files: {len(modified_files)}")
for mf in modified_files:
    print(f"Cleaned: {os.path.relpath(mf, root_dir)}")
