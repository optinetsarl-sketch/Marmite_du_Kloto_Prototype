from django.db import transaction
from catalogue.models import Produit
from config.permissions import IsAdminUserRole
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response

from .models import Fournisseur, MouvementStock
from .serializers import (
    FournisseurSerializer,
    InventaireSerializer,
    MouvementStockSerializer,
    ReceptionSerializer,
    SortieSerializer,
)


class FournisseurViewSet(viewsets.ModelViewSet):
    queryset = Fournisseur.objects.all()
    serializer_class = FournisseurSerializer
    search_fields = ["nom"]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAdminUserRole()]
        return super().get_permissions()


class MouvementStockViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MouvementStock.objects.select_related("produit", "fournisseur").order_by("-cree_le", "-id")
    serializer_class = MouvementStockSerializer
    filterset_fields = ["produit", "motif"]

    @action(detail=False, methods=["post"], permission_classes=[IsAdminUserRole])
    @transaction.atomic
    def reception(self, request):
        entree = ReceptionSerializer(data=request.data)
        entree.is_valid(raise_exception=True)
        donnees = entree.validated_data

        fournisseur_nom = donnees.get("fournisseur")
        fournisseur = None
        if fournisseur_nom and isinstance(fournisseur_nom, str) and fournisseur_nom.strip():
            fournisseur, _ = Fournisseur.objects.get_or_create(nom=fournisseur_nom.strip())

        produit = donnees["produit"]
        prix = donnees.get("prix_unitaire")
        if donnees.get("maj_prix_vente") and prix:
            produit.prix_standard = prix
            produit.save(update_fields=["prix_standard"])

        mouvement = MouvementStock.objects.create(
            produit=produit,
            motif=MouvementStock.MOTIF_RECEPTION,
            quantite=donnees["quantite"],
            prix_unitaire=prix,
            fournisseur=fournisseur,
        )
        return Response(
            MouvementStockSerializer(mouvement).data, status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=["post"], permission_classes=[IsAdminUserRole])
    def inventaire(self, request):
        entree = InventaireSerializer(data=request.data)
        entree.is_valid(raise_exception=True)
        produit = entree.validated_data["produit"]
        ecart = entree.validated_data["stock_reel"] - MouvementStock.stock_de(produit)
        if ecart == 0:
            return Response(
                {"detail": "Le stock compté correspond déjà au stock théorique.", "ecart": 0}
            )
        mouvement = MouvementStock.objects.create(
            produit=produit,
            motif=MouvementStock.MOTIF_INVENTAIRE,
            quantite=ecart,
            commentaire=entree.validated_data["commentaire"],
        )
        return Response(
            MouvementStockSerializer(mouvement).data, status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=["post"], permission_classes=[IsAdminUserRole])
    def sortie(self, request):
        entree = SortieSerializer(data=request.data)
        entree.is_valid(raise_exception=True)
        donnees = entree.validated_data
        mouvement = MouvementStock.objects.create(
            produit=donnees["produit"],
            motif=donnees["motif"],
            quantite=-donnees["quantite"],
            commentaire=donnees["commentaire"],
        )
        return Response(
            MouvementStockSerializer(mouvement).data, status=status.HTTP_201_CREATED
        )


@api_view(["GET"])
def alertes_stock(request):
    """Renvoie les alertes de stock (bas/rupture), accessible aux administrateurs et gérants."""
    stocks = MouvementStock.stocks_par_produit()
    alertes = []
    for produit in Produit.objects.filter(gere_stock=True, actif=True):
        niveau = stocks.get(produit.pk, 0)
        if niveau <= produit.seuil_alerte:
            alertes.append(
                {
                    "produit": produit.nom,
                    "stock": niveau,
                    "etat": "rupture" if niveau <= 0 else "bas",
                }
            )
    alertes.sort(key=lambda ligne: ligne["stock"])
    return Response({"alertes_stock": alertes[:15]})

