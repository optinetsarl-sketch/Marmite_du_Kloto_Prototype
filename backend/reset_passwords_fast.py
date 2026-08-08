import os
import django

os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'
django.setup()

from django.contrib.auth import get_user_model
from pymongo import MongoClient
from catalogue.management.commands.sync_atlas import create_atlas_client

print("[START] Fast reset...")

# 1. Update via Django ORM (Local DB)
User = get_user_model()
admin_u = User.objects.filter(username="admin").first()
if not admin_u:
    admin_u = User.objects.create_superuser("admin", "admin@marmite.local", "admin1234")
else:
    admin_u.set_password("admin1234")
    admin_u.save()

gerant_u = User.objects.filter(username="gerant").first()
if not gerant_u:
    gerant_u = User.objects.create_user("gerant", "gerant@marmite.local", "gerant1234")
else:
    gerant_u.set_password("gerant1234")
    gerant_u.save()

fachou_u = User.objects.filter(username="fachou").first()
if not fachou_u:
    fachou_u = User.objects.create_superuser("fachou", "fachou@marmite.local", "hounfarida")
else:
    fachou_u.set_password("hounfarida")
    fachou_u.save()

print("[OK LOCAL] Admin: admin1234 | Fachou: hounfarida | Gerant: gerant1234")

# 2. Update Cloud MongoDB Atlas directly
atlas_url = os.getenv("MONGO_URL_ATLAS")
if atlas_url and "<" not in atlas_url and "srv://" in atlas_url:
    try:
        atlas_client = create_atlas_client(atlas_url)
        if atlas_client:
            atlas_db = atlas_client["marmite_kloto_db"]
            atlas_db["auth_user"].update_many(
                {"username": "admin"},
                {"$set": {"password": admin_u.password, "is_superuser": True, "is_staff": True, "synced": True}}
            )
            atlas_db["auth_user"].update_many(
                {"username": "fachou"},
                {"$set": {"password": fachou_u.password, "is_superuser": True, "is_staff": True, "synced": True}}
            )
            atlas_db["auth_user"].update_many(
                {"username": "gerant"},
                {"$set": {"password": gerant_u.password, "is_superuser": False, "is_staff": False, "synced": True}}
            )
            atlas_client.close()
            print("[OK ATLAS] Cloud Atlas passwords updated successfully.")
    except Exception as e:
        print(f"[WARN ATLAS] {e}")

print("[FINISHED]")
