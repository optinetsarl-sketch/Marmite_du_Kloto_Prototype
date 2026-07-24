from django.contrib import admin

from .models import Commande, LigneCommande, Paiement, TableResto


class LigneInline(admin.TabularInline):
    model = LigneCommande
    extra = 0


class PaiementInline(admin.TabularInline):
    model = Paiement
    extra = 0


@admin.register(TableResto)
class TableRestoAdmin(admin.ModelAdmin):
    list_display = ["numero", "etat", "active"]


@admin.register(Commande)
class CommandeAdmin(admin.ModelAdmin):
    list_display = ["__str__", "type", "statut", "total", "ouverte_le", "cloturee_le"]
    list_filter = ["statut", "type", "origine"]
    inlines = [LigneInline, PaiementInline]
