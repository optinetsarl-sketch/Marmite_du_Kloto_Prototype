import os
import sys
import threading
import logging
from django.apps import AppConfig

logger = logging.getLogger(__name__)

_sync_thread_started = False


def _demarrer_synchro_atlas():
    global _sync_thread_started
    if _sync_thread_started:
        return
    _sync_thread_started = True

    def _loop():
        import time
        from django.core.management import call_command
        time.sleep(3)
        while True:
            atlas_url = os.getenv("MONGO_URL_ATLAS")
            if atlas_url and "<" not in atlas_url and "srv://" in atlas_url:
                try:
                    call_command("sync_atlas")
                except Exception as err:
                    logger.error(f"Sync Atlas background error: {err}")
            intervalle = int(os.getenv("SYNC_INTERVAL_SECONDS", "15"))
            time.sleep(intervalle)

    t = threading.Thread(target=_loop, daemon=True, name="SyncAtlasDaemon")
    t.start()


class CatalogueConfig(AppConfig):
    default_auto_field = 'django_mongodb_backend.fields.ObjectIdAutoField'
    name = 'catalogue'

    def ready(self):
        # Ne lancer la synchro automatique que lors de l'exécution d'un serveur (runserver, waitress, exe)
        cmd = " ".join(sys.argv).lower()
        if "runserver" in cmd or getattr(sys, "frozen", False) or "marmite-server" in sys.argv[0] or "gunicorn" in cmd:
            if os.environ.get("RUN_MAIN") == "true" or getattr(sys, "frozen", False) or "marmite-server" in sys.argv[0]:
                _demarrer_synchro_atlas()
            elif not os.environ.get("RUN_MAIN") and "runserver" not in cmd:
                _demarrer_synchro_atlas()
