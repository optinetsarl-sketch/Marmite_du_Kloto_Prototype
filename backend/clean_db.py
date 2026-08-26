import os
import sys
from pymongo import MongoClient
import subprocess

def run_cmd(cmd):
    print(f"Running: {cmd}")
    subprocess.run(cmd, shell=True, check=True)

# 1. Drop the local MongoDB database
client = MongoClient("mongodb://localhost:27017")
db_name = os.getenv("DB_NAME", "marmite_kloto_db")
print(f"Dropping database: {db_name}")
client.drop_database(db_name)
print("Database dropped successfully.")

# 2. Run migrations
python_exec = os.path.join(".venv", "Scripts", "python.exe")
run_cmd(f"{python_exec} manage.py migrate")

# 3. Seed catalogue
run_cmd(f"{python_exec} manage.py seed_catalogue")

# 4. Create default users
run_cmd(f"{python_exec} reset_passwords_fast.py")

print("Database cleaned and reseeded successfully!")
