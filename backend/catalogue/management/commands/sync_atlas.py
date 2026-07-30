"""Commande de gestion Django pour synchroniser MongoDB Local <-> Atlas sans doublon.

Fonctionnalites :
1. Sauvegarde (Local -> Atlas) : Met a jour ou insere en cloud (upsert) tous les documents locaux.
2. Recuperation (Atlas -> Local) : Importe les nouveaux elements crees sur le cloud sans ecraser les commandes locales.
3. Garantie 0 doublon grace au ciblage strict par _id (ObjectId).
"""

import os
import time
from django.core.management.base import BaseCommand
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, PyMongoError


class Command(BaseCommand):
    help = "Synchronise la base MongoDB locale et le cluster Atlas sans creer de doublon."

    def add_arguments(self, parser):
        parser.add_argument(
            "--loop",
            action="store_true",
            help="Execute la synchronisation en boucle continue (selon SYNC_INTERVAL_SECONDS).",
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
                    "[ERREUR] La variable MONGO_URL_ATLAS dans .env n'est pas configuree correctement.\n"
                    "Veuillez renseigner votre veritable chaine de connexion Atlas (mongodb+srv://...)."
                )
            )
            return

        self.stdout.write(self.style.SUCCESS("[DEMARRAGE] Module de synchronisation Marmite du Kloto..."))
        self.stdout.write(f"[INFO] Base de donnees : {db_name}")

        while True:
            self.synchroniser(local_url, atlas_url, db_name)
            if not options["loop"]:
                break
            intervalle = options["interval"]
            self.stdout.write(self.style.NOTICE(f"[ATTENTE] Prochaine synchronisation dans {intervalle} secondes...\n"))
            time.sleep(intervalle)

    def synchroniser(self, local_url, atlas_url, db_name):
        try:
            local_client = MongoClient(local_url, serverSelectionTimeoutMS=3000)
            atlas_client = MongoClient(atlas_url, serverSelectionTimeoutMS=5000)

            # Verification de connectivite
            local_client.admin.command("ping")
            atlas_client.admin.command("ping")

            local_db = local_client[db_name]
            atlas_db = atlas_client[db_name]

            collections_locales = set(local_db.list_collection_names())
            collections_atlas = set(atlas_db.list_collection_names())
            toutes_collections = (collections_locales | collections_atlas) - {
                "system.indexes",
                "system.views",
            }

            total_upsert_atlas = 0
            total_nouveaux_locaux = 0

            for coll_name in sorted(toutes_collections):
                if coll_name.startswith("system.") or coll_name.startswith("local."):
                    continue

                coll_loc = local_db[coll_name]
                coll_at = atlas_db[coll_name]

                # ETAPE 1 : Local -> Atlas (Sauvegarde sans doublon via upsert)
                loc_docs = list(coll_loc.find())
                for doc in loc_docs:
                    coll_at.replace_one({"_id": doc["_id"]}, doc, upsert=True)
                total_upsert_atlas += len(loc_docs)

                # ETAPE 2 : Atlas -> Local (Recuperation des nouveautes cloud uniquement)
                at_docs = list(coll_at.find())
                for doc in at_docs:
                    if not coll_loc.find_one({"_id": doc["_id"]}):
                        coll_loc.insert_one(doc)
                        total_nouveaux_locaux += 1

            self.stdout.write(
                self.style.SUCCESS(
                    f"[SYNC OK] {len(toutes_collections)} collections synchronisees | "
                    f"Upload -> {total_upsert_atlas} docs verifies vers Atlas | "
                    f"Download <- {total_nouveaux_locaux} nouveaux docs importes en local."
                )
            )

        except ConnectionFailure as e:
            self.stdout.write(
                self.style.WARNING(f"[SYNC PAUSE] Connexion impossible (reseau ou serveur hors ligne) : {e}")
            )
        except PyMongoError as e:
            self.stdout.write(
                self.style.ERROR(f"[SYNC ERREUR] Erreur MongoDB lors de la synchronisation : {e}")
            )
        finally:
            try:
                local_client.close()
                atlas_client.close()
            except Exception:
                pass
