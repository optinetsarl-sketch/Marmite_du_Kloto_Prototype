from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
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


class MouvementStockViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MouvementStock.objects.select_related("produit", "fournisseur")
    serializer_class = MouvementStockSerializer
    filterset_fields = ["produit", "motif"]

    @action(detail=False, methods=["post"])
    @transaction.atomic
    def reception(self, request):
        entree = ReceptionSerializer(data=request.data)
        entree.is_valid(raise_exception=True)
        donnees = entree.validated_data

        fournisseur = None
        if donnees["fournisseur"]:
            fournisseur, _ = Fournisseur.objects.get_or_create(nom=donnees["fournisseur"].strip())

        produit = donnees["produit"]
        prix = donnees.get("prix_unitaire")
        if donnees["maj_prix_vente"] and prix:
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

    @action(detail=False, methods=["post"])
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

    @action(detail=False, methods=["post"])
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
