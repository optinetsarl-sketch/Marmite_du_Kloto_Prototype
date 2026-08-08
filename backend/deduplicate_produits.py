"""
Script de dédoublonnage des produits du catalogue.
Garde le premier exemplaire de chaque produit (par nom + catégorie) et supprime les doublons.
"""
import os
import django

os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'
django.setup()

from django.db.models import Count
from catalogue.models import Produit, Categorie, Famille

print("=" * 56)
print("  Dédoublonnage du catalogue - La Marmite du Kloto")
print("=" * 56)

# ── 1. Doublons de Produit (nom + catégorie identiques) ──────
print("\n[1] Recherche des produits dupliqués...")
total_avant = Produit.objects.count()
supprimes = 0

# Grouper par nom (les catégories ont le même nom donc même objet)
noms_vus = {}
for produit in Produit.objects.order_by("nom", "pk"):
    cle = (produit.nom.strip().lower(), str(produit.categorie_id) if produit.categorie_id else "")
    if cle in noms_vus:
        # C'est un doublon — supprimer
        print(f"  [SUPPRIME] '{produit.nom}' (id={produit.pk})")
        produit.delete()
        supprimes += 1
    else:
        noms_vus[cle] = produit.pk

total_apres = Produit.objects.count()
print(f"\n  Avant : {total_avant} produits | Après : {total_apres} produits | Supprimés : {supprimes}")

# ── 2. Doublons de Catégorie (nom identique) ─────────────────
print("\n[2] Recherche des catégories dupliquées...")
cats_vues = {}
for cat in Categorie.objects.order_by("nom", "pk"):
    cle = cat.nom.strip().lower()
    if cle in cats_vues:
        # Réassigner les produits vers la première catégorie conservée
        premiere_cat = cats_vues[cle]
        nb = Produit.objects.filter(categorie=cat).count()
        if nb > 0:
            Produit.objects.filter(categorie=cat).update(categorie=premiere_cat)
            print(f"  [REAFFECTE] {nb} produit(s) de la catégorie doublée '{cat.nom}' vers {premiere_cat.pk}")
        cat.delete()
        print(f"  [SUPPRIME] Catégorie doublée '{cat.nom}'")
    else:
        cats_vues[cle] = cat

# ── 3. Doublons de Famille (nom identique) ───────────────────
print("\n[3] Recherche des familles dupliquées...")
fams_vues = {}
for fam in Famille.objects.order_by("nom", "pk"):
    cle = fam.nom.strip().lower()
    if cle in fams_vues:
        premiere_fam = fams_vues[cle]
        nb = Categorie.objects.filter(famille=fam).count()
        if nb > 0:
            Categorie.objects.filter(famille=fam).update(famille=premiere_fam)
            print(f"  [REAFFECTE] {nb} catégorie(s) de la famille doublée '{fam.nom}' vers {premiere_fam.pk}")
        fam.delete()
        print(f"  [SUPPRIME] Famille doublée '{fam.nom}'")
    else:
        fams_vues[cle] = fam

# ── 4. Résumé final ──────────────────────────────────────────
print("\n" + "=" * 56)
print(f"  Familles    : {Famille.objects.count()}")
print(f"  Catégories  : {Categorie.objects.count()}")
print(f"  Produits    : {Produit.objects.count()}")
print("  [OK] Dédoublonnage terminé avec succès !")
print("=" * 56)
