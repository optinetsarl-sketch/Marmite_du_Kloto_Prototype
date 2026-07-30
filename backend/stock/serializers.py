from rest_framework import serializers

from catalogue.models import Produit

from .models import Fournisseur, MouvementStock


class FournisseurSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)

    class Meta:
        model = Fournisseur
        fields = ["id", "nom", "telephone"]


class MouvementStockSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    produit_nom = serializers.CharField(source="produit.nom", read_only=True)
    fournisseur_nom = serializers.CharField(source="fournisseur.nom", read_only=True)
    motif_libelle = serializers.CharField(source="get_motif_display", read_only=True)

    class Meta:
        model = MouvementStock
        fields = [
            "id", "produit", "produit_nom", "motif", "motif_libelle", "quantite",
            "prix_unitaire", "fournisseur", "fournisseur_nom", "commande",
            "commentaire", "cree_le",
        ]
        read_only_fields = ["commande"]


class ReceptionSerializer(serializers.Serializer):
    """Entrée de stock au réapprovisionnement (§8.1)."""

    produit = serializers.PrimaryKeyRelatedField(queryset=Produit.objects.filter(gere_stock=True))
    quantite = serializers.IntegerField(min_value=1)
    prix_unitaire = serializers.IntegerField(min_value=0, required=False, allow_null=True, default=None)
    fournisseur = serializers.CharField(max_length=80, required=False, allow_blank=True, allow_null=True, default="")
    # Le prix d'achat saisi peut aussi devenir le nouveau prix de vente standard.
    maj_prix_vente = serializers.BooleanField(required=False, default=False)


class SortieSerializer(serializers.Serializer):
    """Sortie manuelle : casse, perte, boisson offerte."""

    produit = serializers.PrimaryKeyRelatedField(queryset=Produit.objects.filter(gere_stock=True))
    quantite = serializers.IntegerField(min_value=1)
    motif = serializers.ChoiceField(
        choices=[
            MouvementStock.MOTIF_CASSE,
            MouvementStock.MOTIF_PERTE,
            MouvementStock.MOTIF_OFFERT,
        ]
    )
    commentaire = serializers.CharField(max_length=160, required=False, allow_blank=True, default="")


class InventaireSerializer(serializers.Serializer):
    """Le magasinier compte les bouteilles et saisit ce qu'il voit.

    On n'écrase pas le stock — impossible, il est calculé : on écrit l'écart
    entre le compté et le théorique. L'historique reste donc lisible.
    """

    produit = serializers.PrimaryKeyRelatedField(queryset=Produit.objects.filter(gere_stock=True))
    stock_reel = serializers.IntegerField(min_value=0)
    commentaire = serializers.CharField(max_length=160, required=False, allow_blank=True, default="")
