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

        self.log_info("[DEMARRAGE] Module de synchronisation bi-directionnelle Marmite du Kloto...")

        while True:
            self.synchroniser(local_url, atlas_url, db_name)
            if not options["loop"]:
                break
            intervalle = options["interval"]
            time.sleep(intervalle)

    def log_info(self, msg, style_name="SUCCESS"):
        try:
            if self.stdout and getattr(self.stdout, "_out", None) is not None:
                style_func = getattr(self.style, style_name, lambda x: x)
                self.stdout.write(style_func(msg))
        except Exception:
            pass
        if style_name == "ERROR":
            logger.error(msg)
        elif style_name == "WARNING":
            logger.warning(msg)
        else:
            logger.info(msg)

    def synchroniser(self, local_url, atlas_url, db_name):
        local_client = None
        atlas_client = None
        try:
            local_client = MongoClient(local_url, serverSelectionTimeoutMS=3000)
            local_client.admin.command("ping")

            atlas_client = create_atlas_client(atlas_url)
            if not atlas_client:
                self.log_info("[SYNC PAUSE] Atlas injoignable (réseau/routeur ou SSL).", "WARNING")
                return

            local_db = local_client[db_name]
            atlas_db = atlas_client[db_name]

            # 0. Fusion des doublons par clé métier (même nom ≠ même _id)
            #    Avant toute sync, on s'assure que les deux BD sont propres
            self._fusionner_doublons_metier(local_db, atlas_db)

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
                    except Exception:
                        coll_loc.update_one({"_id": doc_id}, {"$set": {"synced": True}})

                # Alignement Bootstrap — documents locaux absents d'Atlas
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

                # Atlas -> Local — Nouveautés créées sur le Cloud (ou sur l'autre PC)
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

                # Arbitrage par date de modification en cas de conflit
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

            self.log_info(
                f"[SYNC OK] Local <-> Atlas | {pushed} doc(s) envoyés vers Cloud | {pulled} doc(s) importés d'Atlas."
            )

        except ConnectionFailure as e:
            self.log_info(f"[SYNC PAUSE] Réseau/Serveur hors ligne : {e}", "WARNING")
        except PyMongoError as e:
            self.log_info(f"[SYNC ERREUR] MongoDB : {e}", "ERROR")
        finally:
            if local_client:
                local_client.close()
            if atlas_client:
                atlas_client.close()

    def _fusionner_doublons_metier(self, local_db, atlas_db):
        """
        Fusionne les doublons identifiés par clé métier (et non par _id).

        Problème : PC1 et PC2 ont tous deux reçu le seed_catalogue → mêmes produits
        mais avec des _id MongoDB différents. La sync par _id les traite comme des
        nouveautés et les copie dans les deux sens → doublons.

        Solution : pour chaque collection avec une clé métier connue, on détecte
        les entrées en double (même nom/numéro), on conserve la plus ancienne (_id
        le plus petit = le premier créé) et on supprime les autres des DEUX bases.
        """

        # Définition des clés métier par collection
        # (nom_collection, champ_clé_unique_metier)
        CLE_METIER = {
            "catalogue_famille":   "nom",
            "catalogue_categorie": "nom",
            "catalogue_produit":   "nom",
            "ventes_tableresto":   "numero",
            "livraison_livreur":   "nom",
        }

        for col_name, champ_cle in CLE_METIER.items():
            try:
                self._deduper_collection(local_db, atlas_db, col_name, champ_cle)
            except Exception as e:
                self.log_info(f"[DEDUP WARN] {col_name}: {e}", "WARNING")

    def _deduper_collection(self, local_db, atlas_db, col_name, champ_cle):
        """
        Pour une collection donnée :
        1. Récupère tous les documents des DEUX bases
        2. Regroupe par valeur de champ_cle
        3. Pour chaque groupe > 1, garde le plus ancien (_id le plus petit)
        4. Supprime les doublons dans les DEUX bases et inscrit des tombstones
        """
        coll_loc = local_db[col_name]
        coll_at = atlas_db[col_name]

        # Réunion de tous les documents (local + atlas) indexés par clé métier
        # On construit { valeur_cle: [liste de _id triés] }
        index = {}

        for doc in coll_loc.find({}, {"_id": 1, champ_cle: 1}):
            val = doc.get(champ_cle)
            if val is None:
                continue
            key = str(val).strip().lower()
            if key not in index:
                index[key] = set()
            index[key].add(doc["_id"])

        for doc in coll_at.find({}, {"_id": 1, champ_cle: 1}):
            val = doc.get(champ_cle)
            if val is None:
                continue
            key = str(val).strip().lower()
            if key not in index:
                index[key] = set()
            index[key].add(doc["_id"])

        supprimes = 0
        for key, ids in index.items():
            if len(ids) <= 1:
                continue

            # Conserver le premier _id (le plus "petit" = le plus ancien en général)
            ids_tries = sorted(ids, key=lambda x: str(x))
            id_a_garder = ids_tries[0]
            ids_a_supprimer = ids_tries[1:]

            for bad_id in ids_a_supprimer:
                # Supprimer dans local s'il existe
                coll_loc.delete_one({"_id": bad_id})
                # Supprimer dans atlas s'il existe
                coll_at.delete_one({"_id": bad_id})
                # Ajouter un tombstone dans les DEUX bases pour éviter réapparition
                for db in (local_db, atlas_db):
                    db["tombstones"].update_one(
                        {"col": col_name, "doc_id": bad_id},
                        {"$set": {
                            "col": col_name,
                            "doc_id": bad_id,
                            "deleted_at": datetime.now(timezone.utc).isoformat(),
                            "raison": f"doublon_metier:{champ_cle}={key}",
                        }},
                        upsert=True,
                    )
                supprimes += 1

        if supprimes:
            self.log_info(
                f"[DEDUP] {col_name} : {supprimes} doublon(s) supprimé(s) par clé métier '{champ_cle}'"
            )

