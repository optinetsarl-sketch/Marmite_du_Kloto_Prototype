from django.contrib.auth.models import User
from django.core.management import call_command
from rest_framework.test import APITestCase

from catalogue.models import Produit
from ventes.models import Commande

from .models import Livreur


class LivraisonTest(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_catalogue")

    def setUp(self):
        self.client.force_authenticate(User.objects.create_superuser("admin", password="x"))
        self.kofi = Livreur.objects.get(nom="Kofi")
        self.kossi = Livreur.objects.get(nom="Kossi")
        self.castel = Produit.objects.get(nom="Castel")
        self.poulet = Produit.objects.get(nom="Poulet braisé")

    def _course(self, livreur, quantite_castel=0, quantite_poulet=0, client="Mme Adjo"):
        commande = Commande.objects.create(
            type=Commande.TYPE_LIVRAISON,
            origine=Commande.ORIGINE_WHATSAPP,
            livreur=livreur,
            client_nom=client,
            client_adresse="Agoè",
            note="Peu pimenté",
        )
        if quantite_castel:
            self.client.post(
                f"/api/commandes/{commande.pk}/lignes/",
                {"produit": self.castel.pk, "quantite": quantite_castel}, format="json",
            )
        if quantite_poulet:
            self.client.post(
                f"/api/commandes/{commande.pk}/lignes/",
                {"produit": self.poulet.pk, "quantite": quantite_poulet, "prix_unitaire": 5000},
                format="json",
            )
        return commande

    def _statut(self, commande, statut):
        return self.client.post(
            f"/api/commandes/{commande.pk}/changer_statut/", {"statut": statut}, format="json"
        )

    def _comptes(self):
        return {
            ligne["livreur_nom"]: ligne
            for ligne in self.client.get("/api/livreurs/comptes_du_jour/").data
        }

    def test_course_livree_apparait_en_a_remettre(self):
        course = self._course(self.kofi, quantite_poulet=3)  # 15 000 F
        self._statut(course, Commande.STATUT_LIVREE)

        compte = self._comptes()["Kofi"]
        self.assertEqual(compte["courses_en_attente"], 1)
        self.assertEqual(compte["a_remettre"], 15000)
        self.assertEqual(compte["deja_remis"], 0)

    def test_encaissement_bascule_de_a_remettre_vers_deja_remis(self):
        course = self._course(self.kofi, quantite_poulet=3)
        self._statut(course, Commande.STATUT_LIVREE)
        self.client.post(
            f"/api/commandes/{course.pk}/encaisser/",
            {"paiements": [{"mode": "especes", "montant": 15000}]}, format="json",
        )

        compte = self._comptes()["Kofi"]
        self.assertEqual(compte["a_remettre"], 0)
        self.assertEqual(compte["courses_en_attente"], 0)
        self.assertEqual(compte["deja_remis"], 15000)
        self.assertEqual(compte["courses_remises"], 1)

    def test_mobile_money_ne_compte_pas_comme_remis(self):
        course = self._course(self.kofi, quantite_poulet=2)  # 10 000 F
        self._statut(course, Commande.STATUT_LIVREE)
        self.client.post(
            f"/api/commandes/{course.pk}/encaisser/",
            {"paiements": [{"mode": "tmoney", "montant": 10000}]}, format="json",
        )
        # L'argent est arrivé sur le compte, pas dans les mains du livreur —
        # mais la course reste visible au tableau de fin de journée.
        compte = self._comptes()["Kofi"]
        self.assertEqual(compte["a_remettre"], 0)
        self.assertEqual(compte["deja_remis"], 0)
        self.assertEqual(compte["courses_du_jour"], 1)

    def test_course_en_route_nest_pas_encore_a_remettre(self):
        course = self._course(self.kofi, quantite_poulet=1)
        self._statut(course, Commande.STATUT_EN_ROUTE)
        self.assertEqual(self._comptes(), {})

    def test_comptes_separes_par_livreur(self):
        self._statut(self._course(self.kofi, quantite_poulet=2), Commande.STATUT_LIVREE)
        self._statut(self._course(self.kofi, quantite_castel=5), Commande.STATUT_LIVREE)
        self._statut(self._course(self.kossi, quantite_poulet=1), Commande.STATUT_LIVREE)

        comptes = self._comptes()
        self.assertEqual(comptes["Kofi"]["courses_en_attente"], 2)
        self.assertEqual(comptes["Kofi"]["a_remettre"], 10000 + 3500)
        self.assertEqual(comptes["Kossi"]["a_remettre"], 5000)

    def test_file_cuisine_ignore_les_commandes_sans_nourriture(self):
        boissons = self._course(self.kofi, quantite_castel=6)
        self._statut(boissons, Commande.STATUT_EN_CUISINE)
        repas = self._course(self.kossi, quantite_poulet=2, quantite_castel=2)
        self._statut(repas, Commande.STATUT_EN_CUISINE)

        file = self.client.get("/api/commandes/?pour_cuisine=1").data["results"]
        self.assertEqual([commande["id"] for commande in file], [str(repas.pk)])

    def test_file_cuisine_exclut_les_commandes_servies(self):
        repas = self._course(self.kofi, quantite_poulet=1)
        self._statut(repas, Commande.STATUT_EN_CUISINE)
        self.assertEqual(len(self.client.get("/api/commandes/?pour_cuisine=1").data["results"]), 1)

        self._statut(repas, Commande.STATUT_EN_ROUTE)
        self.assertEqual(len(self.client.get("/api/commandes/?pour_cuisine=1").data["results"]), 0)

    def test_ligne_porte_son_rayon(self):
        course = self._course(self.kofi, quantite_castel=1, quantite_poulet=1)
        lignes = self.client.get(f"/api/commandes/{course.pk}/").data["lignes"]
        self.assertEqual({ligne["libelle"]: ligne["rayon"] for ligne in lignes},
                         {"Castel": "bar", "Poulet braisé": "cuisine"})

    def test_detail_du_jour_donne_les_plats_course_par_course(self):
        self._statut(self._course(self.kofi, quantite_poulet=2, quantite_castel=3, client="Ama"),
                     Commande.STATUT_LIVREE)
        self._statut(self._course(self.kofi, quantite_poulet=1, client="Yao"),
                     Commande.STATUT_LIVREE)

        detail = self.client.get(f"/api/livreurs/{self.kofi.pk}/detail_du_jour/").data
        self.assertEqual(detail["livreur"], "Kofi")
        self.assertEqual(len(detail["courses"]), 2)
        self.assertEqual(detail["total"], 10000 + 2100 + 5000)

        # Le récapitulatif cumule les articles sur toutes les courses.
        recap = {ligne["libelle"]: ligne["quantite"] for ligne in detail["recapitulatif"]}
        self.assertEqual(recap, {"Poulet braisé": 3, "Castel": 3})

        # Chaque ligne dit si c'est un plat ou une boisson.
        rayons = {l["libelle"]: l["rayon"] for l in detail["courses"][0]["lignes"]}
        self.assertEqual(rayons, {"Poulet braisé": "cuisine", "Castel": "bar"})

    def test_detail_du_jour_distingue_encaisse_et_a_remettre(self):
        remise = self._course(self.kofi, quantite_poulet=1, client="Ama")
        self._statut(remise, Commande.STATUT_LIVREE)
        self.client.post(
            f"/api/commandes/{remise.pk}/encaisser/",
            {"paiements": [{"mode": "especes", "montant": 5000}]}, format="json",
        )
        self._statut(self._course(self.kofi, quantite_poulet=1, client="Yao"),
                     Commande.STATUT_LIVREE)

        detail = self.client.get(f"/api/livreurs/{self.kofi.pk}/detail_du_jour/").data
        self.assertEqual(
            {course["client_nom"]: course["encaissee"] for course in detail["courses"]},
            {"Ama": True, "Yao": False},
        )

    def test_detail_du_jour_ignore_les_courses_dun_autre_livreur(self):
        self._statut(self._course(self.kossi, quantite_poulet=1), Commande.STATUT_LIVREE)
        detail = self.client.get(f"/api/livreurs/{self.kofi.pk}/detail_du_jour/").data
        self.assertEqual(detail["courses"], [])
        self.assertEqual(detail["total"], 0)

    def test_commande_whatsapp_conserve_ses_coordonnees(self):
        course = self._course(self.kofi, quantite_poulet=1)
        donnees = self.client.get(f"/api/commandes/{course.pk}/").data
        self.assertEqual(donnees["origine"], "whatsapp")
        self.assertEqual(donnees["client_adresse"], "Agoè")
        self.assertEqual(donnees["note"], "Peu pimenté")
        self.assertEqual(donnees["livreur_nom"], "Kofi")
