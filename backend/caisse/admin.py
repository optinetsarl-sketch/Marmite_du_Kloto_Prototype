from django.contrib import admin

from .models import Depense, SessionCaisse


@admin.register(SessionCaisse)
class SessionCaisseAdmin(admin.ModelAdmin):
    list_display = ["__str__", "fond_initial", "montant_theorique", "montant_reel", "ecart"]


@admin.register(Depense)
class DepenseAdmin(admin.ModelAdmin):
    list_display = ["categorie", "description", "montant", "mode", "cree_le"]
    list_filter = ["categorie", "mode"]
