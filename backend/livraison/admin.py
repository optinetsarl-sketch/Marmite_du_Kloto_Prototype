from django.contrib import admin

from .models import Livreur


@admin.register(Livreur)
class LivreurAdmin(admin.ModelAdmin):
    list_display = ["nom", "telephone", "actif"]
