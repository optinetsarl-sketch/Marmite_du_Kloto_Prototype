from rest_framework import serializers

from catalogue.models import Produit

from .models import Fournisseur, LigneInventaire, MouvementStock, SessionInventaire


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


# ---------------------------------------------------------------------------
# Inventaire officiel — SessionInventaire + LigneInventaire
# ---------------------------------------------------------------------------

class LigneInventaireSerializer(serializers.ModelSerializer):
    id              = serializers.CharField(read_only=True)
    produit_nom     = serializers.CharField(source="produit.nom", read_only=True)
    produit_categorie_nom = serializers.CharField(source="produit.categorie.nom", read_only=True)
    produit_prix    = serializers.IntegerField(source="produit.prix_standard", read_only=True)
    ecart           = serializers.IntegerField(read_only=True)

    class Meta:
        model  = LigneInventaire
        fields = [
            "id", "produit", "produit_nom", "produit_categorie_nom", "produit_prix",
            "stock_theorique", "stock_physique", "ecart",
        ]
        read_only_fields = ["stock_theorique"]


class SessionInventaireSerializer(serializers.ModelSerializer):
    id     = serializers.CharField(read_only=True)
    lignes = LigneInventaireSerializer(many=True, read_only=True)

    # Statistiques calculées à la volée
    nb_lignes       = serializers.SerializerMethodField()
    nb_comptes      = serializers.SerializerMethodField()
    nb_ecarts       = serializers.SerializerMethodField()
    total_manquants = serializers.SerializerMethodField()
    total_surplus   = serializers.SerializerMethodField()

    class Meta:
        model  = SessionInventaire
        fields = [
            "id", "date", "motif", "statut", "cree_le", "valide_le",
            "lignes",
            "nb_lignes", "nb_comptes", "nb_ecarts", "total_manquants", "total_surplus",
        ]
        read_only_fields = ["statut", "cree_le", "valide_le"]

    def get_nb_lignes(self, obj):
        return obj.lignes.count()

    def get_nb_comptes(self, obj):
        return obj.lignes.filter(stock_physique__isnull=False).count()

    def get_nb_ecarts(self, obj):
        return sum(
            1 for l in obj.lignes.all()
            if l.stock_physique is not None and l.stock_physique != l.stock_theorique
        )

    def get_total_manquants(self, obj):
        return sum(
            (l.stock_theorique - l.stock_physique)
            for l in obj.lignes.all()
            if l.stock_physique is not None and l.stock_physique < l.stock_theorique
        )

    def get_total_surplus(self, obj):
        return sum(
            (l.stock_physique - l.stock_theorique)
            for l in obj.lignes.all()
            if l.stock_physique is not None and l.stock_physique > l.stock_theorique
        )


class SessionInventaireListSerializer(serializers.ModelSerializer):
    """Version allégée pour la liste (sans détails des lignes)."""
    id              = serializers.CharField(read_only=True)
    nb_lignes       = serializers.SerializerMethodField()
    nb_comptes      = serializers.SerializerMethodField()
    nb_ecarts       = serializers.SerializerMethodField()
    total_manquants = serializers.SerializerMethodField()
    total_surplus   = serializers.SerializerMethodField()

    class Meta:
        model  = SessionInventaire
        fields = [
            "id", "date", "motif", "statut", "cree_le", "valide_le",
            "nb_lignes", "nb_comptes", "nb_ecarts", "total_manquants", "total_surplus",
        ]

    def get_nb_lignes(self, obj):
        return obj.lignes.count()

    def get_nb_comptes(self, obj):
        return obj.lignes.filter(stock_physique__isnull=False).count()

    def get_nb_ecarts(self, obj):
        return sum(
            1 for l in obj.lignes.all()
            if l.stock_physique is not None and l.stock_physique != l.stock_theorique
        )

    def get_total_manquants(self, obj):
        return sum(
            (l.stock_theorique - l.stock_physique)
            for l in obj.lignes.all()
            if l.stock_physique is not None and l.stock_physique < l.stock_theorique
        )

    def get_total_surplus(self, obj):
        return sum(
            (l.stock_physique - l.stock_theorique)
            for l in obj.lignes.all()
            if l.stock_physique is not None and l.stock_physique > l.stock_theorique
        )
