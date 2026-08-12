from rest_framework import serializers

from catalogue.models import Produit

from .models import Commande, LigneCommande, Paiement, TableResto


class LigneCommandeSerializer(serializers.ModelSerializer):
    id = serializers.SerializerMethodField()
    montant = serializers.IntegerField(read_only=True)
    # Le poste cuisine trie ses lignes là-dessus : un bon de cuisine ne porte
    # que la nourriture, jamais les boissons.
    rayon = serializers.CharField(source="produit.categorie.rayon", read_only=True)

    class Meta:
        model = LigneCommande
        fields = ["id", "produit", "libelle", "quantite", "prix_unitaire", "note", "montant", "rayon"]
        read_only_fields = ["libelle"]

    def get_id(self, obj):
        from utils.objectid import to_str
        return to_str(obj.pk)


class PaiementSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    monnaie_rendue = serializers.IntegerField(read_only=True)

    class Meta:
        model = Paiement
        fields = ["id", "mode", "montant", "montant_recu", "monnaie_rendue", "cree_le"]


class CommandeSerializer(serializers.ModelSerializer):
    id = serializers.SerializerMethodField()
    lignes = LigneCommandeSerializer(many=True, read_only=True)
    paiements = PaiementSerializer(many=True, read_only=True)
    total = serializers.IntegerField(read_only=True)
    total_paye = serializers.IntegerField(read_only=True)
    reste_a_payer = serializers.IntegerField(read_only=True)
    table_numero = serializers.IntegerField(source="table.numero", read_only=True)
    livreur_nom = serializers.CharField(source="livreur.nom", read_only=True)

    class Meta:
        model = Commande
        fields = [
            "id", "uuid", "numero_recu", "numero_jour", "type", "origine", "statut",
            "table", "table_numero", "couverts",
            "client_nom", "client_telephone", "client_adresse", "livreur", "livreur_nom",
            "note", "addition_demandee", "ouverte_le", "cloturee_le",
            "lignes", "paiements", "total", "total_paye", "reste_a_payer",
        ]
        read_only_fields = ["numero_recu", "numero_jour", "cloturee_le"]

    def get_id(self, obj):
        from utils.objectid import to_str
        return to_str(obj.pk)


class TableRestoSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    etat = serializers.CharField(read_only=True)
    commande_id = serializers.SerializerMethodField()
    total = serializers.SerializerMethodField()
    couverts = serializers.SerializerMethodField()

    class Meta:
        model = TableResto
        fields = ["id", "numero", "couverts_defaut", "active", "etat", "commande_id", "total", "couverts"]

    def get_commande_id(self, table):
        commande = table.commande_ouverte
        from utils.objectid import to_str
        return to_str(commande.pk) if commande else None

    def get_total(self, table):
        commande = table.commande_ouverte
        return commande.total if commande else 0

    def get_couverts(self, table):
        commande = table.commande_ouverte
        return commande.couverts if commande else 0

class AjoutLigneSerializer(serializers.Serializer):
    """Entrée de POST /commandes/{id}/lignes/."""

    produit = serializers.PrimaryKeyRelatedField(queryset=Produit.objects.filter(actif=True))
    libelle = serializers.CharField(max_length=80, required=False, allow_blank=True, default="")
    quantite = serializers.IntegerField(min_value=1, default=1)
    prix_unitaire = serializers.IntegerField(min_value=0, required=False, allow_null=True)
    note = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")


class SynchronisationSerializer(serializers.Serializer):
    """Entrée de POST /commandes/{id}/synchroniser/ : le panier validé au complet."""

    lignes = serializers.ListField(child=AjoutLigneSerializer(), allow_empty=True)


class EncaissementSerializer(serializers.Serializer):
    """Entrée de POST /commandes/{id}/encaisser/. Plusieurs lignes = paiement mixte."""

    paiements = serializers.ListField(child=PaiementSerializer(), allow_empty=False)

    def validate_paiements(self, valeur):
        if any(paiement["montant"] <= 0 for paiement in valeur):
            raise serializers.ValidationError("Chaque paiement doit porter un montant positif.")
        return valeur
