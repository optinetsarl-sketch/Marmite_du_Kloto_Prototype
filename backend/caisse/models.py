from django.db import models
from django.db.models import Sum
from django.utils import timezone


class SessionCaisse(models.Model):
    ouverte_le = models.DateTimeField(auto_now_add=True)
    cloturee_le = models.DateTimeField(null=True, blank=True)
    fond_initial = models.PositiveIntegerField(default=0)
    montant_reel = models.PositiveIntegerField(null=True, blank=True)
    remarques = models.TextField(blank=True)

    class Meta:
        ordering = ["-ouverte_le"]
        verbose_name = "session de caisse"
        verbose_name_plural = "sessions de caisse"
        indexes = [models.Index(fields=["ouverte_le"])]

    def __str__(self):
        statut = "Clôturée" if self.cloturee_le else "En cours"
        return f"Session du {self.ouverte_le.strftime('%d/%m/%Y')} ({statut})"

    @classmethod
    def courante(cls):
        """Renvoie la session active non clôturée ou en crée une vide si aucune n'existe."""
        session = cls.objects.filter(cloturee_le__isnull=True).first()
        if not session:
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
                cree_le__range=(dt_start, dt_end),
                supprime_le__isnull=True,
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
    supprime_le = models.DateTimeField(
        null=True, blank=True,
        help_text="Renseigné lors d'une suppression (soft-delete). La dépense reste traçable dans l'historique."
    )
    supprime_par = models.CharField(max_length=100, blank=True, default='')

    class Meta:
        ordering = ["-cree_le"]
        verbose_name = "dépense"
        verbose_name_plural = "dépenses"
        indexes = [models.Index(fields=["cree_le"]), models.Index(fields=["supprime_le"])]

    def __str__(self):
        return f"{self.get_categorie_display()} · {self.montant} F"

    @property
    def est_supprimee(self):
        return self.supprime_le is not None
