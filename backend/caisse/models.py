from django.db import models
from django.db.models import Sum


class SessionCaisse(models.Model):
    """Une journée de caisse : ouverture avec fond, clôture avec écart."""

    ouverte_le = models.DateTimeField(auto_now_add=True)
    fond_initial = models.PositiveIntegerField(default=0)

    fermee_le = models.DateTimeField(null=True, blank=True)
    montant_reel = models.PositiveIntegerField(
        null=True, blank=True, help_text="Espèces réellement comptées à la fermeture."
    )
    commentaire_cloture = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["-ouverte_le"]
        verbose_name = "session de caisse"
        verbose_name_plural = "sessions de caisse"

    def __str__(self):
        etat = "clôturée" if self.fermee_le else "ouverte"
        return f"Caisse du {self.ouverte_le:%d/%m/%Y} ({etat})"

    @classmethod
    def courante(cls):
        return cls.objects.filter(fermee_le__isnull=True).first()

    @property
    def recettes_especes(self):
        from ventes.models import Paiement

        return (
            Paiement.objects.filter(
                mode=Paiement.MODE_ESPECES,
                cree_le__gte=self.ouverte_le,
                **({"cree_le__lte": self.fermee_le} if self.fermee_le else {}),
            ).aggregate(t=Sum("montant"))["t"]
            or 0
        )

    @property
    def depenses_especes(self):
        return (
            self.depenses.filter(mode=Depense.MODE_ESPECES).aggregate(t=Sum("montant"))["t"] or 0
        )

    @property
    def montant_theorique(self):
        return self.fond_initial + self.recettes_especes - self.depenses_especes

    @property
    def ecart(self):
        if self.montant_reel is None:
            return None
        return self.montant_reel - self.montant_theorique


class Depense(models.Model):
    CATEGORIES = [
        ("achats_bar", "Achats bar"),
        ("achats_cuisine", "Achats cuisine"),
        ("transport", "Transport"),
        ("salaires", "Salaires"),
        ("energie", "Électricité / Eau"),
        ("entretien", "Entretien"),
        ("autres", "Autres"),
    ]

    MODE_ESPECES = "especes"
    MODES = [
        (MODE_ESPECES, "Espèces"),
        ("tmoney", "TMoney"),
        ("flooz", "Flooz"),
        ("banque", "Banque / Carte"),
    ]

    session = models.ForeignKey(
        SessionCaisse, on_delete=models.PROTECT, related_name="depenses", null=True, blank=True
    )
    categorie = models.CharField(max_length=20, choices=CATEGORIES, default="autres")
    description = models.CharField(max_length=160, blank=True)
    montant = models.PositiveIntegerField()
    mode = models.CharField(max_length=10, choices=MODES, default=MODE_ESPECES)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]
        verbose_name = "dépense"
        verbose_name_plural = "dépenses"
        indexes = [models.Index(fields=["cree_le"])]

    def __str__(self):
        return f"{self.get_categorie_display()} · {self.montant} F"
