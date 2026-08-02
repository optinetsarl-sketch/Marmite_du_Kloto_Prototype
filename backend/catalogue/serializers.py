from rest_framework import serializers

from .models import Categorie, Famille, Produit


class FamilleSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    nb_categories = serializers.IntegerField(source="categories.count", read_only=True)

    class Meta:
        model = Famille
        fields = ["id", "nom", "icone", "ordre", "nb_categories"]


class CategorieSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    famille_nom = serializers.CharField(source="famille.nom", read_only=True)

    class Meta:
        model = Categorie
        fields = ["id", "nom", "rayon", "famille", "famille_nom", "icone", "ordre"]


class ProduitSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    categorie_nom = serializers.CharField(source="categorie.nom", read_only=True)
    rayon = serializers.CharField(source="categorie.rayon", read_only=True)
    stock = serializers.SerializerMethodField()
    etat_stock = serializers.SerializerMethodField()
    # PositiveIntegerField rejette null par défaut même si le modèle le permet.
    prix_standard = serializers.IntegerField(allow_null=True, required=False, min_value=0)

    class Meta:
        model = Produit
        fields = [
            "id", "nom", "categorie", "categorie_nom", "rayon", "prix_standard",
            "prix_libre", "gere_stock", "seuil_alerte", "photo", "actif",
            "stock", "etat_stock",
        ]

    # Le ViewSet injecte `stocks` dans le contexte : une seule requête agrégée
    # pour tout le catalogue plutôt qu'une par produit.
    def _stock(self, produit):
        if not produit.gere_stock:
            return None
        stocks = self.context.get("stocks")
        if stocks is None:
            return produit.stock
        return stocks.get(produit.pk, 0)

    def get_stock(self, produit):
        return self._stock(produit)

    def get_etat_stock(self, produit):
        niveau = self._stock(produit)
        if niveau is None:
            return None
        if niveau <= 0:
            return "rupture"
        if niveau <= produit.seuil_alerte:
            return "bas"
        return "ok"
