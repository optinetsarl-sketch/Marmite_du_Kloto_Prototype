from django.contrib.auth.models import User
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APITestCase

from catalogue.models import Produit
from livraison.models import Livreur
from ventes.models import Commande


class RapportsTest(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_catalogue")

    def setUp(self):
        self.client.force_authenticate(User.objects.create_user("gerant", password="x"))
        self.castel = Produit.objects.get(nom="Castel")
        self.poulet = Produit.objects.get(nom="Poulet braisé")

    def _vendre(self, type_commande, castel=0, poulet=0):
        commande = Commande.objects.create(
            type=type_commande,
            livreur=Livreur.objects.get(nom="Kofi") if type_commande == "livraison" else None,
        )
        if castel:
            self.client.post(
                f"/api/commandes/{commande.pk}/lignes/",
                {"produit": self.castel.pk, "quantite": castel}, format="json",
            )
        if poulet:
            self.client.post(
                f"/api/commandes/{commande.pk}/lignes/",
                {"produit": self.poulet.pk, "quantite": poulet, "prix_unitaire": 5000},
                format="json",
            )
        self.client.post(
            f"/api/commandes/{commande.pk}/encaisser/",
            {"paiements": [{"mode": "especes", "montant": commande.total}]}, format="json",
        )
        return commande

    def test_les_trois_sources_font_le_chiffre_daffaires(self):
        self._vendre("place", castel=10, poulet=2)  # 7 000 + 10 000
        self._vendre("livraison", castel=2, poulet=1)  # 1 400 + 5 000

        revenus = self.client.get("/api/rapports/revenus/").data["revenus"]
        self.assertEqual(revenus["bar"] + revenus["cuisine"] + revenus["livraison"], revenus["total"])
        self.assertEqual(revenus["total"], 23400)
        # Une livraison compte entièrement en « livraison », boissons comprises.
        self.assertEqual(revenus["bar"], 7000)
        self.assertEqual(revenus["cuisine"], 10000)
        self.assertEqual(revenus["livraison"], 6400)

    def test_rapport_produit_couvre_tous_les_canaux(self):
        """Le rapport bar compte par produit, pas par source : il inclut donc les
        boissons parties en livraison. L'écart avec revenus.bar est voulu — ce test
        le fige pour qu'il ne devienne pas une dérive silencieuse."""
        self._vendre("place", castel=10)  # 7 000 F au comptoir
        self._vendre("livraison", castel=2)  # 1 400 F en livraison

        bar = self.client.get("/api/rapports/bar/").data
        revenus = self.client.get("/api/rapports/revenus/").data["revenus"]

        self.assertEqual(bar["ca_total"], 8400)
        self.assertEqual(revenus["bar"], 7000)
        self.assertEqual(bar["ca_total"] - revenus["bar"], 1400)

    def test_rapport_bar_suit_le_stock(self):
        self.client.post(
            "/api/mouvements-stock/reception/",
            {"produit": self.castel.pk, "quantite": 48}, format="json",
        )
        self._vendre("place", castel=10)

        ligne = next(
            l for l in self.client.get("/api/rapports/bar/").data["lignes"] if l["produit"] == "Castel"
        )
        self.assertEqual((ligne["recu"], ligne["vendu"], ligne["restant"]), (48, 10, 38))

    def test_rapport_cuisine_ne_liste_que_la_nourriture(self):
        self._vendre("place", castel=5, poulet=3)
        cuisine = self.client.get("/api/rapports/cuisine/").data
        self.assertEqual([l["libelle"] for l in cuisine["lignes"]], ["Poulet braisé"])
        self.assertEqual(cuisine["ca_total"], 15000)

    def test_classement_des_produits(self):
        self._vendre("place", castel=10, poulet=2)
        classement = self.client.get("/api/rapports/produits/").data["lignes"]
        self.assertEqual(classement[0]["libelle"], "Castel")  # 10 unités devant 2
        self.assertEqual(classement[0]["vendu"], 10)

    def test_periodes_semaine_et_mois(self):
        self._vendre("place", castel=10)
        for periode in ("jour", "semaine", "mois"):
            donnees = self.client.get(f"/api/rapports/revenus/?periode={periode}").data
            self.assertEqual(donnees["revenus"]["total"], 7000, periode)
            self.assertNotIn("None", donnees["periode"])

    def test_historique_regroupe_les_operations_du_jour(self):
        self._vendre("place", castel=2)
        self.client.post(
            "/api/mouvements-stock/reception/",
            {"produit": self.castel.pk, "quantite": 20},
            format="json",
        )
        self.client.post(
            "/api/depenses/",
            {"categorie": "transport", "montant": 5000, "description": "Taxi marché", "mode": "especes"},
            format="json",
        )

        historique = self.client.get("/api/rapports/historique/").data
        self.assertEqual(historique["date"], timezone.localdate().isoformat())
        self.assertGreaterEqual(len(historique["commandes"]), 1)
        self.assertGreaterEqual(len(historique["depenses"]), 1)
        self.assertGreaterEqual(len(historique["mouvements_stock"]), 1)
        self.assertTrue(any(item["type"] == "commande" for item in historique["evenements"]))
        self.assertTrue(any(item["type"] == "depense" for item in historique["evenements"]))
        self.assertTrue(any(item["type"] == "mouvement_stock" for item in historique["evenements"]))

    def test_commande_non_encaissee_hors_rapports(self):
        commande = Commande.objects.create()
        self.client.post(
            f"/api/commandes/{commande.pk}/lignes/",
            {"produit": self.castel.pk, "quantite": 5}, format="json",
        )
        # Une ardoise ouverte n'est pas une recette tant qu'elle n'est pas payée.
        self.assertEqual(self.client.get("/api/rapports/revenus/").data["revenus"]["total"], 0)
