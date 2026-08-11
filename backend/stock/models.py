from django.db import models, transaction
from django.db.models import Sum
from django.utils import timezone

from catalogue.models import Produit


class Fournisseur(models.Model):
    nom = models.CharField(max_length=80, unique=True)
    telephone = models.CharField(max_length=25, blank=True)

    class Meta:
        ordering = ["nom"]

    def __str__(self):
        return self.nom


class MouvementStock(models.Model):
    """Livre de stock : le stock restant n'est jamais stocké, il se recalcule.

    C'est ce qui rend l'inventaire auditable — on peut toujours répondre à
    « d'où vient ce chiffre ? » en listant les mouvements du produit.
    """

    MOTIF_RECEPTION = "reception"
    MOTIF_VENTE = "vente"
    MOTIF_CASSE = "casse"
    MOTIF_PERTE = "perte"
    MOTIF_OFFERT = "offert"
    MOTIF_INVENTAIRE = "inventaire"
    MOTIFS = [
        (MOTIF_RECEPTION, "Réception fournisseur"),
        (MOTIF_VENTE, "Vente"),
        (MOTIF_CASSE, "Casse"),
        (MOTIF_PERTE, "Perte"),
        (MOTIF_OFFERT, "Offert"),
        (MOTIF_INVENTAIRE, "Correction d'inventaire"),
    ]

    produit = models.ForeignKey(Produit, on_delete=models.PROTECT, related_name="mouvements")
    motif = models.CharField(max_length=12, choices=MOTIFS)
    quantite = models.IntegerField(help_text="Positif pour une entrée, négatif pour une sortie.")
    prix_unitaire = models.PositiveIntegerField(
        null=True, blank=True, help_text="Prix d'achat à la réception, en FCFA."
    )
    fournisseur = models.ForeignKey(
        Fournisseur, on_delete=models.PROTECT, null=True, blank=True, related_name="receptions"
    )
    commande = models.ForeignKey(
        "ventes.Commande",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="mouvements_stock",
        help_text="Renseigné pour les sorties déclenchées par une vente.",
    )
    commentaire = models.CharField(max_length=160, blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]
        verbose_name = "mouvement de stock"
        verbose_name_plural = "mouvements de stock"
        indexes = [models.Index(fields=["produit", "cree_le"])]

    def __str__(self):
        signe = "+" if self.quantite >= 0 else ""
        return f"{self.produit} {signe}{self.quantite} ({self.get_motif_display()})"

    @staticmethod
    def stock_de(produit):
        return (
            MouvementStock.objects.filter(produit=produit).aggregate(t=Sum("quantite"))["t"] or 0
        )

    @staticmethod
    def stocks_par_produit():
        """Un seul aller-retour SQL pour tout le catalogue, au lieu de N requêtes."""
        lignes = MouvementStock.objects.values("produit_id").annotate(total=Sum("quantite"))
        return {ligne["produit_id"]: ligne["total"] or 0 for ligne in lignes}


# ---------------------------------------------------------------------------
# Inventaire officiel — SessionInventaire + LigneInventaire
# ---------------------------------------------------------------------------

class SessionInventaire(models.Model):
    """Une session d'inventaire créée par un admin.

    Cycle de vie :
      brouillon  → l'opérateur est en train de compter, rien n'est enregistré
      valide     → l'admin a confirmé : tous les MouvementStock sont créés en une transaction
      annule     → session abandonnée, aucun effet sur le stock
    """

    STATUT_BROUILLON = "brouillon"
    STATUT_VALIDE    = "valide"
    STATUT_ANNULE    = "annule"
    STATUTS = [
        (STATUT_BROUILLON, "Brouillon"),
        (STATUT_VALIDE,    "Validé"),
        (STATUT_ANNULE,    "Annulé"),
    ]

    date      = models.DateField()
    motif     = models.CharField(max_length=160, help_text="Ex : Inventaire semaine du 10/08/2026")
    statut    = models.CharField(max_length=12, choices=STATUTS, default=STATUT_BROUILLON)
    cree_le   = models.DateTimeField(auto_now_add=True)
    valide_le = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-date", "-cree_le"]
        verbose_name = "session d'inventaire"
        verbose_name_plural = "sessions d'inventaire"

    def __str__(self):
        return f"{self.date} — {self.motif} [{self.statut}]"

    def valider(self):
        """Valider la session : crée les MouvementStock pour chaque ligne avec écart.

        Tout est dans une seule transaction atomique : soit tout passe, soit rien.
        Si le PC coupe pendant la validation, la transaction est annulée automatiquement.
        """
        if self.statut != self.STATUT_BROUILLON:
            raise ValueError("Seul un brouillon peut être validé.")

        with transaction.atomic():
            for ligne in self.lignes.select_related("produit").all():
                if ligne.stock_physique is None:
                    continue  # produit non compté → on ignore
                ecart = ligne.stock_physique - ligne.stock_theorique
                if ecart != 0:
                    MouvementStock.objects.create(
                        produit=ligne.produit,
                        motif=MouvementStock.MOTIF_INVENTAIRE,
                        quantite=ecart,
                        commentaire=self.motif,
                    )
            self.statut    = self.STATUT_VALIDE
            self.valide_le = timezone.now()
            self.save(update_fields=["statut", "valide_le"])


class LigneInventaire(models.Model):
    """Un produit dans une session d'inventaire.

    stock_theorique : figé à l'ouverture de la session (stock calculé à cet instant)
    stock_physique  : saisi par l'opérateur (null = non encore compté)
    ecart           : stock_physique - stock_theorique (calculé à la validation)
    """

    session         = models.ForeignKey(SessionInventaire, on_delete=models.CASCADE, related_name="lignes")
    produit         = models.ForeignKey(Produit, on_delete=models.PROTECT, related_name="lignes_inventaire")
    stock_theorique = models.IntegerField()
    stock_physique  = models.IntegerField(null=True, blank=True)

    class Meta:
        ordering = ["produit__categorie__ordre", "produit__nom"]
        unique_together = [("session", "produit")]

    def __str__(self):
        return f"{self.produit.nom} : théo={self.stock_theorique} / physique={self.stock_physique}"

    @property
    def ecart(self):
        if self.stock_physique is None:
            return None
        return self.stock_physique - self.stock_theorique
