import os
import django

os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'
django.setup()

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from pymongo import MongoClient
from catalogue.management.commands.sync_atlas import create_atlas_client
from django.core.management import call_command

print("[RESET] Réinitialisation des mots de passe par défaut...")

# 1. Utiliser ORM Django local
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

print("[OK] Comptes 'admin' (pass: admin1234) et 'gerant' (pass: gerant1234) mis à jour en local.")

# 2. Mettre à jour MongoDB Atlas directement
atlas_url = os.getenv("MONGO_URL_ATLAS")
if atlas_url:
    atlas_client = create_atlas_client(atlas_url)
    if atlas_client:
        atlas_db = atlas_client["marmite_kloto_db"]
        admin_hash = admin_u.password
        gerant_hash = gerant_u.password

        atlas_db["auth_user"].update_many(
            {"username": "admin"},
            {"$set": {"password": admin_hash, "is_superuser": True, "is_staff": True, "synced": True}}
        )
        atlas_db["auth_user"].update_many(
            {"username": "gerant"},
            {"$set": {"password": gerant_hash, "is_superuser": False, "is_staff": False, "synced": True}}
        )
        print("[OK] Base Cloud MongoDB Atlas mise à jour avec succès.")
        atlas_client.close()

# 3. Lancer une synchronisation Atlas complète
print("[SYNC] Lancement de la synchronisation bidirectionnelle...")
call_command("sync_atlas")
print("[TERMINÉ] Réinitialisation et synchronisation terminées avec succès.")
