from config.permissions import IsAdminUserRole
from rest_framework import viewsets

from stock.models import MouvementStock

from .models import Categorie, Famille, Produit
from .serializers import CategorieSerializer, FamilleSerializer, ProduitSerializer


class AdminWritePermissionMixin:
    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAdminUserRole()]
        return super().get_permissions()


class FamilleViewSet(AdminWritePermissionMixin, viewsets.ModelViewSet):
    queryset = Famille.objects.all()
    serializer_class = FamilleSerializer
    search_fields = ["nom"]


class CategorieViewSet(AdminWritePermissionMixin, viewsets.ModelViewSet):
    queryset = Categorie.objects.select_related("famille")
    serializer_class = CategorieSerializer
    filterset_fields = ["rayon", "famille"]

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        if isinstance(response.data, list):
            vus = set()
            uniques = []
            for item in response.data:
                nom = (item.get("nom") or "").strip().lower()
                if nom and nom not in vus:
                    vus.add(nom)
                    uniques.append(item)
            response.data = uniques
        return response


class ProduitViewSet(AdminWritePermissionMixin, viewsets.ModelViewSet):
    queryset = Produit.objects.select_related("categorie", "categorie__famille")
    serializer_class = ProduitSerializer
    filterset_fields = ["categorie", "actif", "categorie__rayon", "categorie__famille"]
    search_fields = ["nom"]

    def get_serializer_context(self):
        contexte = super().get_serializer_context()
        contexte["stocks"] = MouvementStock.stocks_par_produit()
        return contexte

