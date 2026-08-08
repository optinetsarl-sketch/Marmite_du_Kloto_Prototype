"""Commande Django : supprime les doublons de produits/catégories/familles."""
from django.core.management.base import BaseCommand
from catalogue.models import Produit, Categorie, Famille


class Command(BaseCommand):
    help = "Supprime les doublons de produits, catégories et familles dans la base de données."

    def handle(self, *args, **options):
        self.stdout.write("\n[+] Dédoublonnage du catalogue en cours...")

        # ── Familles dupliquées ───────────────────────────────
        fams_vues = {}
        for fam in Famille.objects.order_by("nom", "pk"):
            cle = fam.nom.strip().lower()
            if cle in fams_vues:
                premiere = fams_vues[cle]
                nb = Categorie.objects.filter(famille=fam).count()
                if nb:
                    Categorie.objects.filter(famille=fam).update(famille=premiere)
                fam.delete()
            else:
                fams_vues[cle] = fam

        # ── Catégories dupliquées ─────────────────────────────
        cats_vues = {}
        for cat in Categorie.objects.order_by("nom", "pk"):
            cle = cat.nom.strip().lower()
            if cle in cats_vues:
                premiere = cats_vues[cle]
                nb = Produit.objects.filter(categorie=cat).count()
                if nb:
                    Produit.objects.filter(categorie=cat).update(categorie=premiere)
                cat.delete()
            else:
                cats_vues[cle] = cat

        # ── Produits dupliqués ────────────────────────────────
        total_avant = Produit.objects.count()
        noms_vus = {}
        supprimes = 0
        for produit in Produit.objects.order_by("nom", "pk"):
            cle = (
                produit.nom.strip().lower(),
                str(produit.categorie_id) if produit.categorie_id else "",
            )
            if cle in noms_vus:
                produit.delete()
                supprimes += 1
            else:
                noms_vus[cle] = produit.pk

        total_apres = Produit.objects.count()

        self.stdout.write(
            self.style.SUCCESS(
                f"[OK] {supprimes} doublons supprimés. "
                f"Produits : {total_avant} → {total_apres} | "
                f"Familles : {Famille.objects.count()} | "
                f"Catégories : {Categorie.objects.count()}"
            )
        )
