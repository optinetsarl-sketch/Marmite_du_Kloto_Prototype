from django.db import models
from django.db.models import Sum

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
