import os

replacements = [
    ("Four Dee Motion Picture - Office ERP", "Four Dee Motion Pictures Private Limited - Office ERP"),
    ("Four Dee Motion Picture ERP Team", "Four Dee Motion Pictures Private Limited ERP Team"),
    ("Four Dee Motion Picture ERP Portal", "Four Dee Motion Pictures Private Limited ERP Portal"),
    ("Four Dee Motion Picture ERP", "Four Dee Motion Pictures Private Limited ERP"),
    ("Four Dee Motion Picture Management", "Four Dee Motion Pictures Private Limited Management"),
    ("Four Dee Motion Picture. All rights reserved", "Four Dee Motion Pictures Private Limited. All rights reserved"),
    ("Four Dee Motion Picture", "Four Dee Motion Pictures Private Limited"),
    ("Four Dee Motion Pictures -", "Four Dee Motion Pictures Private Limited -"),
]

root_dir = r"C:\Users\Administrator\Documents\GitHub\FOURDEE-NEW-HR-ADMIN\src"

modified_files = []

for root, dirs, files in os.walk(root_dir):
    for file in files:
        if file.endswith(('.ts', '.tsx', '.js', '.jsx', '.json', '.html', '.md')):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                
            orig_content = content
            for old, new in replacements:
                content = content.replace(old, new)
                
            if content != orig_content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)
                modified_files.append(filepath)

print(f"Total modified files: {len(modified_files)}")
for mf in modified_files:
    print(f"Updated: {os.path.relpath(mf, root_dir)}")
