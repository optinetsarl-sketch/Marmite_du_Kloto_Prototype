from django.contrib.auth.models import User
from django.core.management import call_command
from rest_framework.test import APITestCase

from catalogue.models import Produit
from ventes.models import Commande

from .models import Depense, SessionCaisse
from .serializers import fcfa


class CaisseTest(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_catalogue")

    def setUp(self):
        self.client.force_authenticate(User.objects.create_superuser("admin", password="x"))
        self.castel = Produit.objects.get(nom="Castel")

    def _vendre(self, quantite, mode="especes"):
        commande = Commande.objects.create()
        self.client.post(
            f"/api/commandes/{commande.pk}/lignes/",
            {"produit": self.castel.pk, "quantite": quantite}, format="json",
        )
        self.client.post(
            f"/api/commandes/{commande.pk}/encaisser/",
            {"paiements": [{"mode": mode, "montant": quantite * 700}]}, format="json",
        )
        return commande

    def _depenser(self, montant, mode="especes"):
        return self.client.post(
            "/api/depenses/",
            {"categorie": "transport", "montant": montant, "mode": mode, "description": "Test"},
            format="json",
        )

    def test_depense_especes_refusee_si_caisse_insuffisante(self):
        SessionCaisse.objects.create(fond_initial=10000)
        refus = self._depenser(20000)
        self.assertEqual(refus.status_code, 400)
        # Le message doit nommer les deux montants, formatés pour être lus au comptoir.
        # On lit le message lui-même : str() sur le dict DRF échapperait l'unicode.
        self.assertIn(
            f"{fcfa(20000)} dépasse les espèces en caisse ({fcfa(10000)} disponibles)",
            refus.data["non_field_errors"][0],
        )

    def test_montants_formates_a_la_francaise(self):
        # Espace fine insécable comme séparateur de milliers, jamais de virgule.
        self.assertEqual(fcfa(1234567), "1 234 567 F")
        self.assertEqual(fcfa(700), "700 F")

    def test_depense_especes_vide_la_caisse_puis_bloque(self):
        SessionCaisse.objects.create(fond_initial=10000)
        self.assertEqual(self._depenser(10000).status_code, 201)
        self.assertEqual(self._depenser(1).status_code, 400)

    def test_recette_especes_reconstitue_le_disponible(self):
        SessionCaisse.objects.create(fond_initial=5000)
        self.assertEqual(self._depenser(6000).status_code, 400)
        self._vendre(10)  # +7 000 F en espèces
        self.assertEqual(self._depenser(6000).status_code, 201)

    def test_depense_non_especes_ignore_le_solde_du_tiroir(self):
        SessionCaisse.objects.create(fond_initial=0)
        self.assertEqual(self._depenser(500000, mode="banque").status_code, 201)

    def test_depense_libre_sans_session_ouverte(self):
        self.assertIsNone(SessionCaisse.courante())
        self.assertEqual(self._depenser(99000).status_code, 201)

    def test_cloture_calcule_ecart_et_verrouille(self):
        session = SessionCaisse.objects.create(fond_initial=50000)
        self._vendre(10)  # +7 000 F espèces
        self._depenser(2000)
        self.assertEqual(session.montant_theorique, 55000)

        reponse = self.client.post(
            f"/api/sessions-caisse/{session.pk}/cloturer/",
            {"montant_reel": 54500, "commentaire": "Manque un billet"}, format="json",
        )
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data["ecart"], -500)

        seconde = self.client.post(
            f"/api/sessions-caisse/{session.pk}/cloturer/", {"montant_reel": 54500}, format="json",
        )
        self.assertEqual(seconde.status_code, 400)

    def test_une_seule_session_ouverte_a_la_fois(self):
        self.assertEqual(self.client.post("/api/sessions-caisse/", {"fond_initial": 50000}).status_code, 201)
        self.assertEqual(self.client.post("/api/sessions-caisse/", {"fond_initial": 10000}).status_code, 400)

    def test_feuille_de_cloture(self):
        SessionCaisse.objects.create(fond_initial=50000)
        self._vendre(10)  # 7 000 F espèces
        self._vendre(5, mode="tmoney")  # 3 500 F TMoney
        self._depenser(2000)

        feuille = self.client.get("/api/rapports/cloture/").data
        self.assertEqual(feuille["revenus"]["bar"], 10500)
        self.assertEqual(feuille["total_depenses"], 2000)
        self.assertEqual(feuille["resultat_net"], 8500)
        self.assertEqual(feuille["nb_commandes"], 2)
        self.assertEqual(
            {ligne["mode"]: ligne["montant"] for ligne in feuille["recettes_par_mode"]},
            {"especes": 7000, "tmoney": 3500},
        )
        # Le tiroir ne connaît que les espèces : le TMoney n'y entre pas.
        self.assertEqual(feuille["caisse"]["montant_theorique"], 50000 + 7000 - 2000)

    def test_depense_rattachee_a_la_session_ouverte(self):
        session = SessionCaisse.objects.create(fond_initial=50000)
        self._depenser(1000)
        self.assertEqual(Depense.objects.get().session, session)
