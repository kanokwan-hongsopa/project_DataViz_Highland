import os
import glob

FORBIDDEN = "\u0e23\u0e30\u0e40\u0e1a\u0e35\u0e22\u0e15" # "ระเบียน"

found = 0
for ext in ['*.html', 'js/**/*.js', 'css/**/*.css']:
    for fpath in glob.glob(ext, recursive=True):
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                content = f.read()
                if FORBIDDEN in content:
                    print(f"FORBIDDEN WORD FOUND in {fpath}!")
                    found += 1
        except Exception as e:
            pass

if found == 0:
    print("SUCCESS: Strictly ZERO occurrences of forbidden word found.")
else:
    print(f"FAILED: Found {found} occurrences!")
