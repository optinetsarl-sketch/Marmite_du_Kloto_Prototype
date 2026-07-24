from django.contrib import admin

from .models import Fournisseur, MouvementStock


@admin.register(Fournisseur)
class FournisseurAdmin(admin.ModelAdmin):
    list_display = ["nom", "telephone"]


@admin.register(MouvementStock)
class MouvementStockAdmin(admin.ModelAdmin):
    list_display = ["produit", "motif", "quantite", "fournisseur", "cree_le"]
    list_filter = ["motif", "produit"]
