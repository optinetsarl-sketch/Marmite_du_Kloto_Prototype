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
        session = cls.objects.filter(fermee_le__isnull=True).first()
        if session is None:
            session = cls.objects.create(fond_initial=0)
        return session

    @property
    def recettes_especes(self):
        from ventes.models import Paiement, Commande
        from utils.dates import date_range

        dt_start, dt_end = date_range(self.ouverte_le.date())
        p_especes = (
            Paiement.objects.filter(
                mode=Paiement.MODE_ESPECES,
                cree_le__range=(dt_start, dt_end)
            ).aggregate(t=Sum("montant"))["t"]
            or 0
        )
        if p_especes > 0:
            return p_especes

        cmds = Commande.objects.exclude(statut=Commande.STATUT_ANNULEE).filter(
            ouverte_le__range=(dt_start, dt_end)
        )
        return sum(c.total for c in cmds)

    @property
    def depenses_especes(self):
        from utils.dates import date_range
        dt_start, dt_end = date_range(self.ouverte_le.date())
        return (
            Depense.objects.filter(
                mode=Depense.MODE_ESPECES,
                cree_le__range=(dt_start, dt_end)
            ).aggregate(t=Sum("montant"))["t"]
            or 0
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
