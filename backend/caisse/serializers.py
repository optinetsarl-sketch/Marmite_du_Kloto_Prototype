from rest_framework import serializers

from .models import Depense, SessionCaisse


def fcfa(montant):
    """« 70 400 F » plutôt que « 70400 F » dans les messages destinés au caissier."""
    return f"{montant:,} F".replace(",", " ")


class DepenseSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    categorie_libelle = serializers.CharField(source="get_categorie_display", read_only=True)

    class Meta:
        model = Depense
        fields = [
            "id", "session", "categorie", "categorie_libelle", "description",
            "montant", "mode", "cree_le",
        ]
        read_only_fields = ["session"]

    def validate(self, donnees):
        """On ne sort pas de la caisse plus d'espèces qu'elle n'en contient.

        La règle ne vaut que pour les espèces : un virement ou un paiement
        mobile ne touche pas le tiroir-caisse. Et seulement si une session est
        ouverte — sans fond de caisse déclaré, il n'y a pas de solde à opposer.
        """
        mode = donnees.get("mode") or (self.instance.mode if self.instance else Depense.MODE_ESPECES)
        if mode != Depense.MODE_ESPECES:
            return donnees

        session = SessionCaisse.courante()
        if session is None:
            return donnees

        montant = donnees.get("montant") or (self.instance.montant if self.instance else 0)
        disponible = session.montant_theorique
        if self.instance:  # une modification libère d'abord l'ancien montant
            disponible += self.instance.montant
        if montant > disponible:
            raise serializers.ValidationError(
                f"Dépense refusée : {fcfa(montant)} dépasse les espèces en caisse "
                f"({fcfa(disponible)} disponibles)."
            )
        return donnees

    def create(self, donnees):
        donnees["session"] = SessionCaisse.courante()
        return super().create(donnees)


class SessionCaisseSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    recettes_especes = serializers.IntegerField(read_only=True)
    depenses_especes = serializers.IntegerField(read_only=True)
    montant_theorique = serializers.IntegerField(read_only=True)
    ecart = serializers.IntegerField(read_only=True)

    class Meta:
        model = SessionCaisse
        fields = [
            "id", "ouverte_le", "fond_initial", "fermee_le", "montant_reel",
            "commentaire_cloture", "recettes_especes", "depenses_especes",
            "montant_theorique", "ecart",
        ]
        read_only_fields = ["fermee_le", "montant_reel"]


class ClotureSerializer(serializers.Serializer):
    montant_reel = serializers.IntegerField(min_value=0)
    commentaire = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
