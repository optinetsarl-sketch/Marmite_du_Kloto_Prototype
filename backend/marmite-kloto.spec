# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec — La Marmite du Kloto
Compile le backend Django + frontend React build en un .exe autonome (onedir).
"""

import os
import sys
import importlib

block_cipher = None

# ---- Chemins ----
ROOT = os.path.dirname(os.path.abspath(SPEC))
BACKEND = ROOT  # Le .spec est dans backend/
PROJECT = os.path.dirname(ROOT)
FRONTEND_DIST = os.path.join(BACKEND, "frontend_dist")

# ---- Collecter les données supplémentaires ----
datas = []

# Backend complet (tous les modules Django)
for app in ["config", "catalogue", "ventes", "stock", "caisse", "livraison", "rapports", "utils"]:
    app_path = os.path.join(BACKEND, app)
    if os.path.isdir(app_path):
        datas.append((app_path, os.path.join("backend", app)))

# manage.py
datas.append((os.path.join(BACKEND, "manage.py"), "backend"))

# Frontend build (React) → sera servi par WhiteNoise/Django staticfiles
if os.path.isdir(FRONTEND_DIST):
    datas.append((FRONTEND_DIST, os.path.join("backend", "frontend_dist")))
else:
    print("[WARN] frontend/dist introuvable — lancez 'npm run build' d'abord !")

# Logo
logo_path = os.path.join(PROJECT, "LOGO-Marmite_du_Kloto.jpg")
if os.path.isfile(logo_path):
    datas.append((logo_path, "backend"))

# ---- Hidden imports (modules Django chargés dynamiquement) ----
hiddenimports = [
    # Django core
    "django",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.core.management",
    "django.core.management.commands.migrate",
    "django.core.management.commands.collectstatic",
    "django.core.management.commands.runserver",
    "catalogue.management.commands.sync_atlas",
    "catalogue.management.commands.seed_catalogue",
    "django.template.backends.django",
    # DRF
    "rest_framework",
    "rest_framework.authtoken",
    "rest_framework.authentication",
    "rest_framework.permissions",
    "rest_framework.renderers",
    "rest_framework.pagination",
    "rest_framework.filters",
    # Third party
    "corsheaders",
    "django_filters",
    "django_mongodb_backend",
    "pymongo",
    "dns",
    "dns.resolver",
    "dotenv",
    "pytz",
    "PIL",
    "waitress",
    "waitress.server",
    "whitenoise",
    "whitenoise.middleware",
    "whitenoise.storage",
    "whitenoise.runserver_nostatic",
    # App modules
    "config.settings",
    "config.urls",
    "config.wsgi",
    "config.auth",
    "config.mongo_apps",
    "config.exceptions",
    "config.renderers",
    "config.encoders",
    "catalogue.models",
    "catalogue.views",
    "catalogue.serializers",
    "ventes.models",
    "ventes.views",
    "ventes.serializers",
    "ventes.services",
    "stock.models",
    "stock.views",
    "stock.serializers",
    "caisse.models",
    "caisse.views",
    "caisse.serializers",
    "livraison.models",
    "livraison.views",
    "rapports.views",
    "utils.objectid",
    "utils.dates",
]

a = Analysis(
    [os.path.join(BACKEND, "marmite-server.py")],
    pathex=[BACKEND],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "tkinter", "matplotlib", "numpy", "scipy", "pandas",
        "IPython", "notebook", "jupyter",
        "pytest", "unittest",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="Marmite-du-Kloto",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,  # Exécution silencieuse sans console noire
    icon=os.path.join(PROJECT, "app.ico"),
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="Marmite-du-Kloto",
)
