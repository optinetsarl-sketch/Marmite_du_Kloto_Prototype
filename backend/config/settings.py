"""Configuration Django — La Marmite du Kloto."""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv("SECRET_KEY", "dev-insecure-a-remplacer-en-production")
DEBUG = os.getenv("DEBUG", "1") == "1"
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "*").split(",") if os.getenv("ALLOWED_HOSTS") else ["*"]

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOWED_ORIGINS = os.getenv(
    "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",")

INSTALLED_APPS = [
    "config.mongo_apps.MongoAdminConfig",
    "config.mongo_apps.MongoAuthConfig",
    "config.mongo_apps.MongoContentTypesConfig",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
    "django_filters",
    "catalogue",
    "ventes",
    "stock",
    "caisse",
    "livraison",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

FRONTEND_DIST = BASE_DIR / "frontend_dist"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [FRONTEND_DIST] if FRONTEND_DIST.exists() else [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# MongoDB via django-mongodb-backend (connecteur officiel MongoDB).
# Use MongoDB in production, but switch to an in‑memory SQLite database when running the test suite.
if "test" in sys.argv:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }
    MIGRATION_MODULES = {
        "catalogue": None,
        "ventes": None,
        "stock": None,
        "caisse": None,
        "livraison": None,
        "rapports": None,
        "admin": None,
        "auth": None,
        "contenttypes": None,
        "sessions": None,
        "authtoken": None,
    }
else:
    def get_mongo_connection_url():
        local_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
        atlas_url = os.getenv("MONGO_URL_ATLAS")
        try:
            from pymongo import MongoClient
            client = MongoClient(local_url, serverSelectionTimeoutMS=1200)
            client.admin.command("ping")
            print(f"[OK] [MongoDB] Connexion LOCALE active : {local_url}")
            return local_url
        except Exception as e:
            if atlas_url and "srv://" in atlas_url and "<" not in atlas_url:
                print(f"[WARN] [MongoDB] Local indisponible ({e}). Basculement automatique vers ATLAS !")
                return atlas_url
            print(f"[INFO] [MongoDB] Utilisation par defaut (local) : {local_url}")
            return local_url

    DATABASES = {
        "default": {
            "ENGINE": "django_mongodb_backend",
            "HOST": get_mongo_connection_url(),
            "NAME": os.getenv("DB_NAME", "marmite_kloto_db"),
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
]

LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "Africa/Lome"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [FRONTEND_DIST] if FRONTEND_DIST.exists() else []
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}
WHITENOISE_INDEX_FILE = True
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

if "test" in sys.argv:
    DEFAULT_AUTO_FIELD = "django.db.models.AutoField"
else:
    DEFAULT_AUTO_FIELD = "django_mongodb_backend.fields.ObjectIdAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 500,
    "EXCEPTION_HANDLER": "config.exceptions.gestionnaire",
    "DEFAULT_RENDERER_CLASSES": [
        "config.renderers.MongoJSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ],
    "COERCE_DECIMAL_TO_STRING": False,
}

CORS_ALLOWED_ORIGINS = os.getenv(
    "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",")

# Coordonnées imprimées sur les reçus, factures et bons.
ETABLISSEMENT = {
    "nom": "La Marmite du Kloto",
    "activite": "Bar-Resto",
    "adresse": "Avedji, non loin de la Côte d'Or",
    "telephone": "+228 91 04 27 02",
}
