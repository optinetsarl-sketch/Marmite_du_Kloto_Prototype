from django.contrib.auth.models import User
from django.core.management import call_command
from rest_framework.test import APITestCase

from catalogue.models import Produit
from ventes.models import Commande

from .models import MouvementStock


class StockTest(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_catalogue")

    def setUp(self):
        self.client.force_authenticate(User.objects.create_user("gerant", password="x"))
        self.castel = Produit.objects.get(nom="Castel")

    def _reception(self, quantite):
        return self.client.post(
            "/api/mouvements-stock/reception/",
            {"produit": self.castel.pk, "quantite": quantite}, format="json",
        )

    def test_inventaire_ecrit_lecart_et_ne_remplace_rien(self):
        self._reception(48)
        # Le magasinier n'en compte que 45 : trois manquent à l'appel.
        reponse = self.client.post(
            "/api/mouvements-stock/inventaire/",
            {"produit": self.castel.pk, "stock_reel": 45, "commentaire": "Comptage du soir"},
            format="json",
        )
        self.assertEqual(reponse.status_code, 201)
        self.assertEqual(reponse.data["quantite"], -3)
        self.assertEqual(self.castel.stock, 45)
        # L'historique reste lisible : la réception de 48 n'a pas été effacée.
        self.assertEqual(
            list(MouvementStock.objects.order_by("id").values_list("quantite", flat=True)),
            [48, -3],
        )

    def test_inventaire_conforme_ne_cree_pas_de_mouvement(self):
        self._reception(20)
        reponse = self.client.post(
            "/api/mouvements-stock/inventaire/",
            {"produit": self.castel.pk, "stock_reel": 20}, format="json",
        )
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data["ecart"], 0)
        self.assertEqual(MouvementStock.objects.count(), 1)

    def test_inventaire_a_la_hausse(self):
        self._reception(10)
        self.client.post(
            "/api/mouvements-stock/inventaire/",
            {"produit": self.castel.pk, "stock_reel": 14}, format="json",
        )
        self.assertEqual(self.castel.stock, 14)

    def test_casse_diminue_le_stock(self):
        self._reception(24)
        reponse = self.client.post(
            "/api/mouvements-stock/sortie/",
            {"produit": self.castel.pk, "quantite": 4, "motif": "casse",
             "commentaire": "Casier renversé"}, format="json",
        )
        self.assertEqual(reponse.status_code, 201)
        self.assertEqual(self.castel.stock, 20)

    def test_reception_peut_mettre_a_jour_le_prix_de_vente(self):
        self.client.post(
            "/api/mouvements-stock/reception/",
            {"produit": self.castel.pk, "quantite": 24, "prix_unitaire": 900,
             "maj_prix_vente": True}, format="json",
        )
        self.castel.refresh_from_db()
        self.assertEqual(self.castel.prix_standard, 900)

    def test_reception_sans_maj_laisse_le_prix_intact(self):
        prix = self.castel.prix_standard
        self.client.post(
            "/api/mouvements-stock/reception/",
            {"produit": self.castel.pk, "quantite": 24, "prix_unitaire": 900}, format="json",
        )
        self.castel.refresh_from_db()
        self.assertEqual(self.castel.prix_standard, prix)

    def test_stock_apres_reception_vente_casse_et_inventaire(self):
        """Le stock n'est jamais stocké : il doit rester la somme des mouvements
        quel que soit l'ordre des opérations."""
        self._reception(48)
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
            "/api/mouvements-stock/sortie/",
            {"produit": self.castel.pk, "quantite": 3, "motif": "perte"}, format="json",
        )
        self.assertEqual(self.castel.stock, 48 - 10 - 3)

        self.client.post(
            "/api/mouvements-stock/inventaire/",
            {"produit": self.castel.pk, "stock_reel": 30}, format="json",
        )
        self.assertEqual(self.castel.stock, 30)
