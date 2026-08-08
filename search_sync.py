import os

target_dir = r"C:\MES  PROJET_APP\mon-nouveau-projet-main\backend"

for root, dirs, files in os.walk(target_dir):
    for f in files:
        if f.endswith(".py"):
            path = os.path.join(root, f)
            with open(path, "r", encoding="utf-8", errors="ignore") as file:
                lines = file.readlines()
                for i, line in enumerate(lines):
                    if "sync" in line.lower() or "atlas" in line.lower():
                        print(f"{f}:{i+1}: {line.strip()[:100]}")
