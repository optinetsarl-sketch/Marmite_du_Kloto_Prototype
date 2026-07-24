from django.contrib.auth.models import User
from django.core.management import call_command
from rest_framework.test import APITestCase

from catalogue.models import Categorie, Famille, Produit
from ventes.models import Commande, TableResto


class CatalogueTest(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_catalogue")

    def setUp(self):
        self.client.force_authenticate(User.objects.create_user("gerant", password="x"))
        self.castel = Produit.objects.get(nom="Castel")

    def test_creation_dun_plat(self):
        cuisine = Categorie.objects.get(nom="Cuisine")
        reponse = self.client.post(
            "/api/produits/",
            {"nom": "Ablo", "categorie": cuisine.pk, "prix_libre": True, "gere_stock": False},
            format="json",
        )
        self.assertEqual(reponse.status_code, 201)
        self.assertIsNone(reponse.data["prix_standard"])

    def test_suppression_produit_vendu_renvoie_409_pas_500(self):
        """Le vrai fail : sans gestionnaire, la ProtectedError remontait en 500."""
        commande = Commande.objects.create()
        self.client.post(
            f"/api/commandes/{commande.pk}/lignes/",
            {"produit": self.castel.pk, "quantite": 2}, format="json",
        )
        reponse = self.client.delete(f"/api/produits/{self.castel.pk}/")
        self.assertEqual(reponse.status_code, 409)
        self.assertIn("Suppression impossible", reponse.data["detail"])
        self.assertTrue(Produit.objects.filter(pk=self.castel.pk).exists())

    def test_suppression_produit_jamais_vendu_ok(self):
        libre = Produit.objects.create(
            nom="Éphémère", categorie=self.castel.categorie, prix_standard=500
        )
        self.assertEqual(self.client.delete(f"/api/produits/{libre.pk}/").status_code, 204)

    def test_suppression_table_avec_commande_renvoie_409(self):
        table = TableResto.objects.get(numero=5)
        Commande.objects.create(table=table)
        self.assertEqual(self.client.delete(f"/api/tables/{table.pk}/").status_code, 409)

    def test_desactiver_un_produit_le_retire_de_la_vente(self):
        self.client.patch(f"/api/produits/{self.castel.pk}/", {"actif": False}, format="json")
        actifs = self.client.get("/api/produits/?actif=true&page_size=400").data["results"]
        self.assertNotIn("Castel", [p["nom"] for p in actifs])


class FamilleTest(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_catalogue")

    def setUp(self):
        self.client.force_authenticate(User.objects.create_user("gerant", password="x"))

    def test_le_seed_relie_les_categories_a_leur_famille(self):
        self.assertEqual(Categorie.objects.get(nom="Bière").famille.nom, "Alcools")
        self.assertEqual(Categorie.objects.get(nom="Cuisine").famille.nom, "Restauration")

    def test_famille_compte_ses_categories(self):
        alcools = self.client.get("/api/familles/").data["results"]
        ligne = next(f for f in alcools if f["nom"] == "Alcools")
        # Bière, Vin, Wisky
        self.assertEqual(ligne["nb_categories"], 3)

    def test_creer_une_famille_et_y_relier_une_categorie(self):
        famille = self.client.post(
            "/api/familles/", {"nom": "Boissons chaudes", "ordre": 5}, format="json"
        )
        self.assertEqual(famille.status_code, 201)

        sucrerie = Categorie.objects.get(nom="Sucrerie")
        reponse = self.client.patch(
            f"/api/categories/{sucrerie.pk}/", {"famille": famille.data["id"]}, format="json"
        )
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data["famille_nom"], "Boissons chaudes")

    def test_supprimer_une_famille_delie_ses_categories_sans_les_perdre(self):
        alcools = Famille.objects.get(nom="Alcools")
        categories = list(alcools.categories.values_list("pk", flat=True))
        self.assertTrue(categories)

        reponse = self.client.delete(f"/api/familles/{alcools.pk}/")
        self.assertEqual(reponse.status_code, 204)
        # SET_NULL : les catégories restent, simplement sans famille.
        for pk in categories:
            self.assertTrue(Categorie.objects.filter(pk=pk).exists())
            self.assertIsNone(Categorie.objects.get(pk=pk).famille)

    def test_filtrer_les_produits_par_famille(self):
        alcools = Famille.objects.get(nom="Alcools")
        reponse = self.client.get(
            f"/api/produits/?categorie__famille={alcools.pk}&page_size=400"
        )
        noms = {p["categorie_nom"] for p in reponse.data["results"]}
        self.assertTrue(noms <= {"Bière", "Vin", "Wisky"})
        self.assertIn("Bière", noms)
