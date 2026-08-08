"""Point d'entrée PyInstaller — La Marmite du Kloto.

Lance le serveur Django (waitress) et sert le frontend React build depuis
le même port 8000.  Ce fichier est le "entry point" du .exe autonome.
"""

import os
import sys
import io

# Empêcher les crashs si sys.stdout ou sys.stderr est None (mode GUI noconsole PyInstaller)
if sys.stdout is None:
    sys.stdout = io.StringIO()
if sys.stderr is None:
    sys.stderr = io.StringIO()

import webbrowser
import threading

# Importations explicites pour PyInstaller
try:
    import whitenoise
    import whitenoise.middleware
    import whitenoise.storage
except ImportError:
    pass

try:
    import waitress
except ImportError:
    pass

# ---- Adapter les chemins quand on tourne depuis un .exe PyInstaller ----
if getattr(sys, "frozen", False):
    # Dossier _internal (onedir mode)
    BUNDLE_DIR = os.path.dirname(sys.executable)
    INTERNAL = os.path.join(BUNDLE_DIR, "_internal")
    # Le code source backend est dans _internal/backend
    BACKEND_DIR = os.path.join(INTERNAL, "backend")
    os.chdir(BACKEND_DIR)
    sys.path.insert(0, BACKEND_DIR)
    # Charger .env depuis le dossier racine du deploy (à côté de l'exe)
    ENV_PATH = os.path.join(BUNDLE_DIR, ".env")
    if os.path.isfile(ENV_PATH):
        from dotenv import load_dotenv
        load_dotenv(ENV_PATH)
else:
    BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
    os.chdir(BACKEND_DIR)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# Désactiver le mode DEBUG en production
os.environ.setdefault("DEBUG", "0")
# Autoriser localhost pour le serveur embarqué
os.environ.setdefault("ALLOWED_HOSTS", "localhost,127.0.0.1")

# ---- Initialiser Django ----
import django
django.setup()

from django.core.management import call_command

# Appliquer les migrations au démarrage (sécurité)
try:
    call_command("migrate", "--run-syncdb", verbosity=0)
except Exception as e:
    print(f"[WARN] Migration : {e}")

# Créer les utilisateurs par défaut et semer le catalogue si la BD est vide
try:
    from django.contrib.auth import get_user_model
    from catalogue.models import Produit
    User = get_user_model()
    if not User.objects.filter(username="admin").exists():
        User.objects.create_superuser("admin", "admin@marmite.local", "admin1234")
        print("[OK] Utilisateur admin cree (admin / admin1234)")
    if not User.objects.filter(username="fachou").exists():
        User.objects.create_superuser("fachou", "fachou@marmite.local", "hounfarida")
        print("[OK] Utilisateur fachou cree (fachou / hounfarida)")
    if not User.objects.filter(username="gerant").exists():
        User.objects.create_user("gerant", "gerant@marmite.local", "gerant1234")
        print("[OK] Utilisateur gerant cree (gerant / gerant1234)")
    if Produit.objects.count() == 0:
        call_command("seed_catalogue")
        print("[OK] Catalogue reensemence avec succes")
except Exception as e:
    print(f"[WARN] Auto-initialisation BD : {e}")

# Nettoyer les doublons de produits/catégories au démarrage (correction migration Atlas)
try:
    call_command("deduplicate_catalogue", verbosity=0)
except Exception as e:
    print(f"[WARN] Deduplicate catalogue : {e}")

# ---- Collecter les fichiers statiques ----
try:
    call_command("collectstatic", "--noinput", verbosity=0)
except Exception:
    pass

# ---- Ouvrir le navigateur après un délai ----
def open_browser():
    import time
    time.sleep(3)
    webbrowser.open("http://localhost:8050")

threading.Thread(target=open_browser, daemon=True).start()

# ---- Démarrer le serveur ----
HOST = "127.0.0.1"
PORT = 8050

print(f"\n{'='*50}")
print(f"  La Marmite du Kloto - Serveur autonome")
print(f"  http://{HOST}:{PORT}")
print(f"{'='*50}\n")

try:
    # Tenter waitress (recommandé pour Windows en production)
    from waitress import serve
    from config.wsgi import application
    print(f"[OK] Serveur waitress demarre sur {HOST}:{PORT}")
    serve(application, host=HOST, port=PORT, threads=4)
except ImportError:
    # Fallback sur le serveur Django intégré
    print("[INFO] waitress non installe, utilisation du serveur Django integre")
    call_command("runserver", f"{HOST}:{PORT}", "--noreload")
