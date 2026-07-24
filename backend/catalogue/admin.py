from django.contrib import admin

from .models import Categorie, Famille, Produit


@admin.register(Famille)
class FamilleAdmin(admin.ModelAdmin):
    list_display = ["nom", "ordre"]


@admin.register(Categorie)
class CategorieAdmin(admin.ModelAdmin):
    list_display = ["nom", "rayon", "famille", "ordre"]
    list_filter = ["rayon", "famille"]


@admin.register(Produit)
class ProduitAdmin(admin.ModelAdmin):
    list_display = ["nom", "categorie", "prix_standard", "prix_libre", "gere_stock", "stock", "actif"]
    list_filter = ["categorie", "actif", "prix_libre", "gere_stock"]
    search_fields = ["nom"]
