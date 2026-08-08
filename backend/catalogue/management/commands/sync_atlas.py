"""Commande de gestion Django pour synchroniser MongoDB Local <-> Atlas (Bi-directionnelle, Robuste, sans doublon).

Inspiré de la méthode d'alignement MongoDB Local <-> Atlas :
1. Stratégies SSL multiples (TLS 1.2/1.3 fallback) pour garantir la connexion quel que soit le FAI/routeur.
2. Envoi incrémental Local -> Atlas (upsert des documents modifiés ou nouveaux).
3. Récupération incrémentale Atlas -> Local (import des nouveautés et mises à jour récentes).
4. Gestion des suppressions via la collection 'tombstones' pour éviter que les éléments supprimés ne réapparaissent.
5. Garantie 0 doublon grâce à l'identifiant unique _id (ObjectId).
"""

import os
import time
import logging
from datetime import datetime, timezone
from django.core.management.base import BaseCommand
from pymongo import MongoClient, ReplaceOne
from pymongo.errors import ConnectionFailure, PyMongoError, DuplicateKeyError

logger = logging.getLogger(__name__)


def _make_ssl_ctx_tls12():
    import ssl
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    try:
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        ctx.maximum_version = ssl.TLSVersion.TLSv1_2
    except Exception:
        pass
    try:
        ctx.set_ciphers("DEFAULT:@SECLEVEL=0")
    except Exception:
        pass
    return ctx


def _make_ssl_ctx_tls13():
    import ssl
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    try:
        ctx.minimum_version = ssl.TLSVersion.TLSv1_3
    except Exception:
        pass
    return ctx


def get_ssl_strategies():
    strategies = [
        {"tls": True, "tlsAllowInvalidCertificates": True, "tlsAllowInvalidHostnames": True},
        {"ssl_context": _make_ssl_ctx_tls12()},
        {"ssl_context": _make_ssl_ctx_tls13()},
        {"tls": False},
    ]
    try:
        import certifi
        strategies.insert(0, {"tls": True, "tlsCAFile": certifi.where()})
    except ImportError:
        pass
    return strategies


def create_atlas_client(atlas_url, timeout_ms=5000):
    """Essaie de connecter Atlas avec plusieurs stratégies SSL. Retourne le client opérationnel."""
    for i, ssl_opts in enumerate(get_ssl_strategies()):
        try:
            client = MongoClient(atlas_url, serverSelectionTimeoutMS=timeout_ms, **ssl_opts)
            client.admin.command("ping")
            return client
        except Exception:
            continue
    return None


class Command(BaseCommand):
    help = "Synchronisation Bi-directionnelle MongoDB Local <-> Atlas avec Fallback SSL et Tombstones"

    def add_arguments(self, parser):
        parser.add_argument(
            "--loop",
            action="store_true",
            help="Exécute la synchronisation en boucle continue.",
        )
        parser.add_argument(
            "--interval",
            type=int,
            default=int(os.getenv("SYNC_INTERVAL_SECONDS", "15")),
            help="Intervalle en secondes entre deux synchronisations en mode --loop.",
        )

    def handle(self, *args, **options):
        local_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
        atlas_url = os.getenv("MONGO_URL_ATLAS")
        db_name = os.getenv("DB_NAME", "marmite_kloto_db")

        if not atlas_url or "<" in atlas_url or "srv://" not in atlas_url:
            self.stdout.write(
                self.style.ERROR(
                    "[ERREUR] MONGO_URL_ATLAS manquant ou invalide dans .env."
                )
            )
            return

        self.stdout.write(self.style.SUCCESS("[DEMARRAGE] Module de synchronisation bi-directionnelle Marmite du Kloto..."))

        while True:
            self.synchroniser(local_url, atlas_url, db_name)
            if not options["loop"]:
                break
            intervalle = options["interval"]
            time.sleep(intervalle)

    def synchroniser(self, local_url, atlas_url, db_name):
        local_client = None
        atlas_client = None
        try:
            local_client = MongoClient(local_url, serverSelectionTimeoutMS=3000)
            local_client.admin.command("ping")

            atlas_client = create_atlas_client(atlas_url)
            if not atlas_client:
                self.stdout.write(self.style.WARNING("[SYNC PAUSE] Atlas injoignable (réseau/routeur ou SSL)."))
                return

            local_db = local_client[db_name]
            atlas_db = atlas_client[db_name]

            # 1. Gestion des Tombstones (Propager les suppressions bidirectionnelles)
            atlas_tombstones = set()
            for t in atlas_db["tombstones"].find({}, {"col": 1, "doc_id": 1, "_id": 0}):
                atlas_tombstones.add((t["col"], t["doc_id"]))
                exists = local_db["tombstones"].find_one({"col": t["col"], "doc_id": t["doc_id"]})
                if not exists:
                    local_db["tombstones"].replace_one(
                        {"col": t["col"], "doc_id": t["doc_id"]},
                        {"col": t["col"], "doc_id": t["doc_id"], "deleted_at": t.get("deleted_at")},
                        upsert=True
                    )
                    local_db[t["col"]].delete_one({"_id": t["doc_id"]})

            local_tombstones = set()
            for t in local_db["tombstones"].find({}, {"col": 1, "doc_id": 1, "_id": 0}):
                local_tombstones.add((t["col"], t["doc_id"]))
                atlas_db[t["col"]].delete_one({"_id": t["doc_id"]})

            # 2. Traitement des Collections
            collections_locales = set(local_db.list_collection_names())
            collections_atlas = set(atlas_db.list_collection_names())
            toutes_collections = (collections_locales | collections_atlas) - {
                "system.indexes",
                "system.views",
                "tombstones",
            }

            pushed = 0
            pulled = 0

            for col_name in sorted(toutes_collections):
                if col_name.startswith("system.") or col_name.startswith("local."):
                    continue

                coll_loc = local_db[col_name]
                coll_at = atlas_db[col_name]

                # Local -> Atlas (Pousser les documents modifiés ou non encore synchronisés)
                loc_docs = list(coll_loc.find({"synced": {"$ne": True}}))
                for doc in loc_docs:
                    doc_id = doc.get("_id")
                    if (col_name, doc_id) in atlas_tombstones:
                        continue
                    try:
                        coll_at.replace_one({"_id": doc_id}, doc, upsert=True)
                        coll_loc.update_one({"_id": doc_id}, {"$set": {"synced": True}})
                        pushed += 1
                    except DuplicateKeyError:
                        if "username" in doc:
                            try:
                                coll_at.update_one({"username": doc["username"]}, {"$set": doc}, upsert=True)
                            except Exception:
                                pass
                        coll_loc.update_one({"_id": doc_id}, {"$set": {"synced": True}})
                    except Exception as err_doc:
                        coll_loc.update_one({"_id": doc_id}, {"$set": {"synced": True}})

                # Alignement Bootstrap (absents d'Atlas)
                local_ids = set(coll_loc.distinct("_id"))
                atlas_ids = set(coll_at.distinct("_id"))
                missing_in_atlas = local_ids - atlas_ids
                for doc_id in missing_in_atlas:
                    if (col_name, doc_id) in atlas_tombstones:
                        continue
                    doc = coll_loc.find_one({"_id": doc_id})
                    if doc:
                        try:
                            coll_at.replace_one({"_id": doc_id}, doc, upsert=True)
                            coll_loc.update_one({"_id": doc_id}, {"$set": {"synced": True}})
                            pushed += 1
                        except DuplicateKeyError:
                            if "username" in doc:
                                try:
                                    coll_at.update_one({"username": doc["username"]}, {"$set": doc}, upsert=True)
                                except Exception:
                                    pass
                            coll_loc.update_one({"_id": doc_id}, {"$set": {"synced": True}})
                        except Exception:
                            coll_loc.update_one({"_id": doc_id}, {"$set": {"synced": True}})

                # Atlas -> Local (Nouveautés créées sur le Cloud)
                missing_in_local = atlas_ids - local_ids
                for doc_id in missing_in_local:
                    if (col_name, doc_id) in local_tombstones:
                        continue
                    doc = coll_at.find_one({"_id": doc_id})
                    if doc:
                        try:
                            doc_copy = {**doc, "synced": True}
                            if col_name == "auth_user" and "username" in doc:
                                existing = coll_loc.find_one({"username": doc["username"]})
                                if existing:
                                    coll_loc.update_one({"username": doc["username"]}, {"$set": doc_copy})
                                    continue
                            coll_loc.replace_one({"_id": doc_id}, doc_copy, upsert=True)
                            pulled += 1
                        except Exception:
                            pass

                # Arbitrage par date de modification s'il y a conflit
                for doc_id in (local_ids & atlas_ids):
                    if (col_name, doc_id) in local_tombstones or (col_name, doc_id) in atlas_tombstones:
                        continue
                    loc_doc = coll_loc.find_one({"_id": doc_id})
                    at_doc = coll_at.find_one({"_id": doc_id})
                    if loc_doc and at_doc:
                        loc_updated = str(loc_doc.get("updated_at") or loc_doc.get("modifie_le") or "")
                        at_updated = str(at_doc.get("updated_at") or at_doc.get("modifie_le") or "")
                        if at_updated and at_updated > loc_updated:
                            try:
                                merged = {**at_doc, "synced": True}
                                coll_loc.replace_one({"_id": doc_id}, merged, upsert=True)
                                pulled += 1
                            except Exception:
                                pass

            self.stdout.write(
                self.style.SUCCESS(
                    f"[SYNC OK] Local <-> Atlas | {pushed} doc(s) envoyés vers Cloud | {pulled} doc(s) importés d'Atlas."
                )
            )

        except ConnectionFailure as e:
            self.stdout.write(self.style.WARNING(f"[SYNC PAUSE] Réseau/Serveur hors ligne : {e}"))
        except PyMongoError as e:
            self.stdout.write(self.style.ERROR(f"[SYNC ERREUR] MongoDB : {e}"))
        finally:
            if local_client:
                local_client.close()
            if atlas_client:
                atlas_client.close()
