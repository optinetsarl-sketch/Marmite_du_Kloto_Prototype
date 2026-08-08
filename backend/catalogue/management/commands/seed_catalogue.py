"""Charge le catalogue de départ : catégories, boissons, plats, tables, livreurs.

Source : annexe A / annexe B du cahier des charges, complétées par les vins et
whiskys ajoutés dans le prototype HTML.

Idempotent : relancer la commande met à jour, ne duplique pas.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from catalogue.models import Categorie, Famille, Produit
from livraison.models import Livreur
from ventes.models import TableResto

# (nom, icône, ordre)
FAMILLES = [
    ("Restauration", "tools-kitchen-2", 1),
    ("Alcools", "glass-full", 2),
    ("Sans alcool", "cup", 3),
    ("Divers", "tag", 4),
]

# (nom, rayon, icône, ordre, famille)
CATEGORIES = [
    ("Cuisine", Categorie.RAYON_CUISINE, "tools-kitchen-2", 1, "Restauration"),
    ("Bière", Categorie.RAYON_BAR, "bottle", 2, "Alcools"),
    ("Vin", Categorie.RAYON_BAR, "glass-full", 3, "Alcools"),
    ("Wisky", Categorie.RAYON_BAR, "glass", 4, "Alcools"),
    ("Sucrerie", Categorie.RAYON_BAR, "cup", 5, "Sans alcool"),
    ("Eau", Categorie.RAYON_BAR, "droplet", 6, "Sans alcool"),
    ("Énergisante", Categorie.RAYON_BAR, "bolt", 7, "Sans alcool"),
    ("Autre", Categorie.RAYON_BAR, "tag", 8, "Divers"),
]

# (nom, prix standard FCFA, catégorie)
BOISSONS = [
    # Bières
    ("Pils", 700, "Bière"), ("Lager", 700, "Bière"), ("Beaufort", 700, "Bière"),
    ("Awouyo", 800, "Bière"), ("Castel", 700, "Bière"), ("Eku", 700, "Bière"),
    ("Doppel", 700, "Bière"), ("Racines", 700, "Bière"), ("Guinness", 800, "Bière"),
    ("Djama pils", 700, "Bière"), ("Djama Lager", 700, "Bière"), ("Djama 228", 700, "Bière"),
    ("Djama noir", 800, "Bière"), ("Djama panaché", 600, "Bière"), ("Sikavi", 700, "Bière"),
    ("Vody", 800, "Bière"), ("Origin", 800, "Bière"), ("Ira", 600, "Bière"),
    ("Benin'or", 600, "Bière"), ("Desperado", 800, "Bière"), ("Heineken", 1200, "Bière"),
    ("Double 7", 800, "Bière"), ("Beaufort canette", 500, "Bière"),
    # Sucreries
    ("Cocktail", 500, "Sucrerie"), ("Coca", 500, "Sucrerie"), ("Malta", 500, "Sucrerie"),
    ("Youzou", 500, "Sucrerie"), ("Chill", 600, "Sucrerie"), ("Tonic", 500, "Sucrerie"),
    ("Bitter lemon", 500, "Sucrerie"), ("Chap Cocktail", 500, "Sucrerie"),
    ("Agrumes", 500, "Sucrerie"), ("Pom Pom", 500, "Sucrerie"),
    ("Malta Can", 500, "Sucrerie"), ("Cocktail Can", 500, "Sucrerie"),
    # Énergisantes
    ("Xxl", 700, "Énergisante"), ("Sport actif", 500, "Énergisante"), ("3x", 500, "Énergisante"),
    ("RoxEnergy", 1000, "Énergisante"), ("Red bull", 1200, "Énergisante"), ("Rush", 300, "Énergisante"),
    # Eaux
    ("Cristal", 600, "Eau"), ("Voltic", 600, "Eau"), ("Vitale", 600, "Eau"),
    ("Verna", 300, "Eau"), ("Possotome", 1500, "Eau"),
    # Autre
    ("Vita mulk", 800, "Autre"),
    # Wiskys & Liqueurs
    ("Jameson", 1800, "Wisky"), ("Johnnie Walker", 5000, "Wisky"), ("Old Monk", 1500, "Wisky"),
    ("Dennis", 2500, "Wisky"), ("White&Bue", 3500, "Wisky"), ("Wall street", 2500, "Wisky"),
    ("Blue Funeste", 3000, "Wisky"), ("Jack 10", 3000, "Wisky"), ("Vodka", 9000, "Wisky"),
    ("JB", 7000, "Wisky"), ("Lion diamond", 3500, "Wisky"), ("Bishop Oak's", 3500, "Wisky"),
    ("Royal circle", 3500, "Wisky"),
    # Vins
    ("Du vin et des jeux", 5000, "Vin"), ("Thérapie de groupe", 5000, "Vin"),
    ("Vallformosa", 8500, "Vin"), ("Aria", 5000, "Vin"), ("Hacienda", 3500, "Vin"),
    ("Grand versant", 5000, "Vin"), ("JP chenet", 5000, "Vin"), ("Muscador", 4000, "Vin"),
    ("Mouton Cadet", 9000, "Vin"), ("Asconi", 6000, "Vin"), ("Agor Lux", 6000, "Vin"),
    ("Old beaver", 5000, "Vin"), ("Haut Machel", 2500, "Vin"), ("Baron de Senac", 2500, "Vin"),
    ("Jardin des amoureux", 3000, "Vin"), ("Baron de Romero", 2500, "Vin"),
    ("Fiesta", 2000, "Vin"), ("Magic", 2000, "Vin"), ("Martini", 6000, "Vin"),
    ("Bella Tavola", 6000, "Vin"), ("Les Gardielles", 5000, "Vin"),
    ("Pied d'argent", 7000, "Vin"), ("Forges de Bordeaux", 6000, "Vin"),
    ("RLG", 5000, "Vin"), ("Cote de Rhone", 6000, "Vin"), ("Portal Braz", 6000, "Vin"),
    ("Terres légendaires", 6000, "Vin"), ("Bellerives", 6000, "Vin"),
    ("Jas d'Estanquet", 5000, "Vin"), ("Montmeyrac", 5000, "Vin"),
    ("Fifty 50", 5000, "Vin"), ("Lamorosso", 7000, "Vin"), ("Du bonnet", 7000, "Vin"),
    ("Petite Baie", 5000, "Vin"),
]

PLATS = [
    "Fufu", "Pâte", "Spaghetti", "Poisson braisé", "Poulet braisé", "Frite", "Alloco",
    "Attiéké", "Riz blanc", "Riz au gras", "Pomme sauté", "Khom", "Sifio",
    "Soupe", "Sauce seule",
]

LIVREURS = ["Kofi", "Kossi", "Yao"]

NB_TABLES = 30


class Command(BaseCommand):
    help = "Charge le catalogue de départ (catégories, boissons, plats, tables, livreurs)."

    @transaction.atomic
    def handle(self, *args, **options):
        familles = {}
        for nom, icone, ordre in FAMILLES:
            famille, _ = Famille.objects.update_or_create(
                nom=nom, defaults={"icone": icone, "ordre": ordre}
            )
            familles[nom] = famille

        categories = {}
        for nom, rayon, icone, ordre, famille in CATEGORIES:
            categorie, _ = Categorie.objects.update_or_create(
                nom=nom,
                defaults={
                    "rayon": rayon,
                    "icone": icone,
                    "ordre": ordre,
                    "famille": familles[famille],
                },
            )
            categories[nom] = categorie

        for nom, prix, categorie in BOISSONS:
            Produit.objects.update_or_create(
                nom=nom,
                defaults={
                    "categorie": categories[categorie],
                    "prix_standard": prix,
                    "prix_libre": False,
                    "gere_stock": True,
                },
            )

        for nom in PLATS:
            Produit.objects.update_or_create(
                nom=nom,
                defaults={
                    "categorie": categories["Cuisine"],
                    "prix_standard": None,
                    "prix_libre": True,
                    "gere_stock": False,
                },
            )

        for numero in range(1, NB_TABLES + 1):
            TableResto.objects.get_or_create(numero=numero)

        for nom in LIVREURS:
            Livreur.objects.get_or_create(nom=nom)

        self.stdout.write(
            self.style.SUCCESS(
                f"{len(familles)} familles · {len(categories)} catégories · "
                f"{len(BOISSONS)} boissons · {len(PLATS)} plats · "
                f"{NB_TABLES} tables · {len(LIVREURS)} livreurs."
            )
        )
