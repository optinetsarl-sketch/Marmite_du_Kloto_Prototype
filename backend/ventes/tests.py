from django.contrib.auth.models import User
from django.core.management import call_command
from rest_framework.test import APITestCase

from caisse.models import SessionCaisse
from catalogue.models import Produit
from stock.models import MouvementStock

from .models import Commande, TableResto


class ParcoursVenteTest(APITestCase):
    """Le parcours complet d'une vente : réception, ardoise, encaissement, rapports."""

    @classmethod
    def setUpTestData(cls):
        call_command("seed_catalogue")

    def setUp(self):
        self.client.force_authenticate(User.objects.create_user("gerant", password="x"))
        self.castel = Produit.objects.get(nom="Castel")
        self.poulet = Produit.objects.get(nom="Poulet braisé")

    def _reception(self, produit, quantite):
        return self.client.post(
            "/api/mouvements-stock/reception/",
            {"produit": produit.pk, "quantite": quantite, "prix_unitaire": 500,
             "fournisseur": "Brasserie BB"},
            format="json",
        )

    def test_reception_augmente_le_stock(self):
        self.assertEqual(self.castel.stock, 0)
        reponse = self._reception(self.castel, 48)
        self.assertEqual(reponse.status_code, 201)
        self.assertEqual(self.castel.stock, 48)

    def test_vente_deduit_le_stock_du_bar_mais_pas_la_cuisine(self):
        self._reception(self.castel, 48)
        commande = Commande.objects.create(table=TableResto.objects.get(numero=3), couverts=4)

        self.client.post(
            f"/api/commandes/{commande.pk}/lignes/",
            {"produit": self.castel.pk, "quantite": 5}, format="json",
        )
        # Plat à prix libre : le prix doit être fourni, il n'a pas de standard.
        self.client.post(
            f"/api/commandes/{commande.pk}/lignes/",
            {"produit": self.poulet.pk, "quantite": 2, "prix_unitaire": 5000}, format="json",
        )
        self.assertEqual(commande.total, 5 * 700 + 2 * 5000)

        reponse = self.client.post(
            f"/api/commandes/{commande.pk}/encaisser/",
            {"paiements": [{"mode": "especes", "montant": 13500, "montant_recu": 15000}]},
            format="json",
        )
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data["monnaie_a_rendre"], 1500)

        commande.refresh_from_db()
        self.assertEqual(commande.statut, Commande.STATUT_PAYEE)
        self.assertEqual(commande.numero_recu, 1)
        self.assertEqual(self.castel.stock, 43)
        self.assertIsNone(self.poulet.stock)

    def test_plat_sans_prix_est_refuse(self):
        commande = Commande.objects.create()
        reponse = self.client.post(
            f"/api/commandes/{commande.pk}/lignes/",
            {"produit": self.poulet.pk, "quantite": 1}, format="json",
        )
        self.assertEqual(reponse.status_code, 400)

    def test_paiement_incomplet_est_refuse(self):
        commande = Commande.objects.create()
        self.client.post(
            f"/api/commandes/{commande.pk}/lignes/",
            {"produit": self.castel.pk, "quantite": 4}, format="json",
        )
        reponse = self.client.post(
            f"/api/commandes/{commande.pk}/encaisser/",
            {"paiements": [{"mode": "especes", "montant": 1000}]}, format="json",
        )
        self.assertEqual(reponse.status_code, 400)
        self.assertEqual(MouvementStock.objects.filter(motif="vente").count(), 0)

    def test_paiement_mixte(self):
        commande = Commande.objects.create()
        self.client.post(
            f"/api/commandes/{commande.pk}/lignes/",
            {"produit": self.castel.pk, "quantite": 10}, format="json",
        )
        reponse = self.client.post(
            f"/api/commandes/{commande.pk}/encaisser/",
            {"paiements": [
                {"mode": "especes", "montant": 4000},
                {"mode": "tmoney", "montant": 3000},
            ]},
            format="json",
        )
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(commande.paiements.count(), 2)
        # La réponse doit porter les paiements : c'est elle qui imprime le reçu.
        self.assertEqual(len(reponse.data["paiements"]), 2)
        self.assertEqual({p["mode"] for p in reponse.data["paiements"]}, {"especes", "tmoney"})

    def test_double_encaissement_refuse(self):
        commande = Commande.objects.create()
        self.client.post(
            f"/api/commandes/{commande.pk}/lignes/",
            {"produit": self.castel.pk, "quantite": 1}, format="json",
        )
        corps = {"paiements": [{"mode": "especes", "montant": 700}]}
        self.client.post(f"/api/commandes/{commande.pk}/encaisser/", corps, format="json")
        seconde = self.client.post(f"/api/commandes/{commande.pk}/encaisser/", corps, format="json")
        self.assertEqual(seconde.status_code, 400)
        self.assertEqual(self.castel.stock, -1)  # une seule sortie, pas deux

    def test_ardoise_ouvre_puis_retrouve_la_meme_commande(self):
        table = TableResto.objects.get(numero=12)
        premiere = self.client.post(f"/api/tables/{table.pk}/ardoise/", {}, format="json")
        self.assertEqual(premiere.status_code, 200)
        seconde = self.client.post(f"/api/tables/{table.pk}/ardoise/", {}, format="json")
        self.assertEqual(premiere.data["id"], seconde.data["id"])
        self.assertEqual(Commande.objects.filter(table=table).count(), 1)

    def test_ligne_non_modifiable_apres_encaissement(self):
        commande = Commande.objects.create()
        ligne = self.client.post(
            f"/api/commandes/{commande.pk}/lignes/",
            {"produit": self.castel.pk, "quantite": 2}, format="json",
        ).data
        self.client.post(
            f"/api/commandes/{commande.pk}/encaisser/",
            {"paiements": [{"mode": "especes", "montant": 1400}]}, format="json",
        )
        self.assertEqual(self.client.delete(f"/api/lignes/{ligne['id']}/").status_code, 400)

    def test_etat_des_tables(self):
        table = TableResto.objects.get(numero=7)
        self.assertEqual(table.etat, "libre")
        Commande.objects.create(table=table)
        self.assertEqual(TableResto.objects.get(numero=7).etat, "occ")

    def test_plat_part_automatiquement_en_cuisine(self):
        commande = Commande.objects.create(table=TableResto.objects.get(numero=5))
        self.assertEqual(commande.statut, Commande.STATUT_OUVERTE)

        self.client.post(
            f"/api/commandes/{commande.pk}/lignes/",
            {"produit": self.poulet.pk, "quantite": 2, "prix_unitaire": 5000}, format="json",
        )
        commande.refresh_from_db()
        self.assertEqual(commande.statut, Commande.STATUT_EN_CUISINE)
        file = self.client.get("/api/commandes/?pour_cuisine=1").data["results"]
        self.assertIn(str(commande.pk), [c["id"] for c in file])

    def test_boisson_seule_ne_va_pas_en_cuisine(self):
        commande = Commande.objects.create(table=TableResto.objects.get(numero=6))
        self.client.post(
            f"/api/commandes/{commande.pk}/lignes/",
            {"produit": self.castel.pk, "quantite": 3}, format="json",
        )
        commande.refresh_from_db()
        self.assertEqual(commande.statut, Commande.STATUT_OUVERTE)

    def test_plat_ajoute_apres_coup_relance_la_cuisine(self):
        commande = Commande.objects.create(table=TableResto.objects.get(numero=9))
        self.client.post(
            f"/api/commandes/{commande.pk}/lignes/",
            {"produit": self.poulet.pk, "quantite": 1, "prix_unitaire": 5000}, format="json",
        )
        self.client.post(
            f"/api/commandes/{commande.pk}/changer_statut/", {"statut": "prete"}, format="json"
        )
        # Un dessert commandé en fin de repas est du travail neuf.
        self.client.post(
            f"/api/commandes/{commande.pk}/lignes/",
            {"produit": self.poulet.pk, "quantite": 1, "prix_unitaire": 6000}, format="json",
        )
        commande.refresh_from_db()
        self.assertEqual(commande.statut, Commande.STATUT_EN_CUISINE)

    def test_cuisine_prete_ne_met_pas_la_table_a_encaisser(self):
        """Le défaut historique : « prêt en cuisine » faisait passer la table en
        attente de paiement alors que le client mangeait encore."""
        table = TableResto.objects.get(numero=11)
        commande = Commande.objects.create(table=table)
        self.client.post(
            f"/api/commandes/{commande.pk}/lignes/",
            {"produit": self.poulet.pk, "quantite": 1, "prix_unitaire": 5000}, format="json",
        )
        self.client.post(
            f"/api/commandes/{commande.pk}/changer_statut/", {"statut": "prete"}, format="json"
        )
        self.assertEqual(TableResto.objects.get(numero=11).etat, "occ")

        self.client.post(f"/api/commandes/{commande.pk}/demander_addition/", {}, format="json")
        self.assertEqual(TableResto.objects.get(numero=11).etat, "pay")

    def test_tableau_de_bord_calcule_le_net(self):
        session = SessionCaisse.objects.create(fond_initial=50000)
        commande = Commande.objects.create()
        self.client.post(
            f"/api/commandes/{commande.pk}/lignes/",
            {"produit": self.castel.pk, "quantite": 10}, format="json",
        )
        self.client.post(
            f"/api/commandes/{commande.pk}/encaisser/",
            {"paiements": [{"mode": "especes", "montant": 7000}]}, format="json",
        )
        self.client.post(
            "/api/depenses/",
            {"categorie": "transport", "montant": 2000, "description": "Taxi marché"},
            format="json",
        )

        bord = self.client.get("/api/rapports/tableau-de-bord/").data
        self.assertEqual(bord["revenus"]["bar"], 7000)
        self.assertEqual(bord["revenus"]["cuisine"], 0)
        self.assertEqual(bord["depenses"], 2000)
        self.assertEqual(bord["resultat_net"], 5000)
        self.assertEqual(bord["nb_commandes"], 1)

        session.refresh_from_db()
        self.assertEqual(session.montant_theorique, 50000 + 7000 - 2000)

    def test_synchroniser_cree_et_reconcilie_les_lignes(self):
        commande = Commande.objects.create(table=TableResto.objects.get(numero=3))
        # Validation initiale du panier : 3 Castel + 2 Poulet.
        reponse = self.client.post(
            f"/api/commandes/{commande.pk}/synchroniser/",
            {"lignes": [
                {"produit": self.castel.pk, "quantite": 3},
                {"produit": self.poulet.pk, "quantite": 2, "prix_unitaire": 5000},
            ]},
            format="json",
        )
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(commande.total, 3 * 700 + 2 * 5000)
        # Le plat est parti seul en cuisine.
        commande.refresh_from_db()
        self.assertEqual(commande.statut, Commande.STATUT_EN_CUISINE)

        # On modifie le panier : 5 Castel, plus de Poulet. La reconciliation
        # ajuste la quantité et supprime la ligne disparue.
        self.client.post(
            f"/api/commandes/{commande.pk}/synchroniser/",
            {"lignes": [{"produit": self.castel.pk, "quantite": 5}]},
            format="json",
        )
        self.assertEqual(commande.lignes.count(), 1)
        self.assertEqual(commande.total, 5 * 700)

    def test_synchroniser_preserve_letat_cuisine_dun_plat_inchange(self):
        commande = Commande.objects.create(table=TableResto.objects.get(numero=4))
        self.client.post(
            f"/api/commandes/{commande.pk}/synchroniser/",
            {"lignes": [{"produit": self.poulet.pk, "quantite": 1, "prix_unitaire": 5000}]},
            format="json",
        )
        self.client.post(
            f"/api/commandes/{commande.pk}/changer_statut/", {"statut": "prete"}, format="json"
        )
        # On ajoute une boisson : le plat déjà prêt ne doit pas repartir en cuisine.
        self.client.post(
            f"/api/commandes/{commande.pk}/synchroniser/",
            {"lignes": [
                {"produit": self.poulet.pk, "quantite": 1, "prix_unitaire": 5000},
                {"produit": self.castel.pk, "quantite": 2},
            ]},
            format="json",
        )
        commande.refresh_from_db()
        self.assertEqual(commande.statut, Commande.STATUT_PRETE)

    def test_synchroniser_refuse_apres_encaissement(self):
        commande = Commande.objects.create()
        self.client.post(
            f"/api/commandes/{commande.pk}/synchroniser/",
            {"lignes": [{"produit": self.castel.pk, "quantite": 1}]}, format="json",
        )
        self.client.post(
            f"/api/commandes/{commande.pk}/encaisser/",
            {"paiements": [{"mode": "especes", "montant": 700}]}, format="json",
        )
        refus = self.client.post(
            f"/api/commandes/{commande.pk}/synchroniser/",
            {"lignes": [{"produit": self.castel.pk, "quantite": 9}]}, format="json",
        )
        self.assertEqual(refus.status_code, 400)

    def test_annuler_une_commande_en_preparation(self):
        table = TableResto.objects.get(numero=8)
        commande = Commande.objects.create(table=table)
        self.client.post(
            f"/api/commandes/{commande.pk}/lignes/",
            {"produit": self.poulet.pk, "quantite": 1, "prix_unitaire": 5000}, format="json",
        )
        reponse = self.client.post(f"/api/commandes/{commande.pk}/annuler/", {}, format="json")
        self.assertEqual(reponse.status_code, 200)
        commande.refresh_from_db()
        self.assertEqual(commande.statut, Commande.STATUT_ANNULEE)
        # La table est libérée, la commande sort de la cuisine.
        self.assertEqual(TableResto.objects.get(numero=8).etat, "libre")
        self.assertEqual(len(self.client.get("/api/commandes/?pour_cuisine=1").data["results"]), 0)

    def test_annuler_refuse_une_commande_payee(self):
        commande = Commande.objects.create()
        self.client.post(
            f"/api/commandes/{commande.pk}/lignes/",
            {"produit": self.castel.pk, "quantite": 1}, format="json",
        )
        self.client.post(
            f"/api/commandes/{commande.pk}/encaisser/",
            {"paiements": [{"mode": "especes", "montant": 700}]}, format="json",
        )
        self.assertEqual(
            self.client.post(f"/api/commandes/{commande.pk}/annuler/", {}, format="json").status_code,
            400,
        )

    def test_commande_annulee_hors_rapports(self):
        commande = Commande.objects.create()
        self.client.post(
            f"/api/commandes/{commande.pk}/lignes/",
            {"produit": self.castel.pk, "quantite": 10}, format="json",
        )
        self.client.post(f"/api/commandes/{commande.pk}/annuler/", {}, format="json")
        self.assertEqual(self.client.get("/api/rapports/revenus/").data["revenus"]["total"], 0)

    def test_api_protegee_sans_token(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get("/api/produits/").status_code, 401)
