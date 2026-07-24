import uuid

from django.db import models
from django.db.models import F, Sum

from catalogue.models import Produit
from livraison.models import Livreur


class TableResto(models.Model):
    numero = models.PositiveSmallIntegerField(unique=True)
    couverts_defaut = models.PositiveSmallIntegerField(default=2)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["numero"]
        verbose_name = "table"
        verbose_name_plural = "tables"

    def __str__(self):
        return f"Table {self.numero}"

    @property
    def commande_ouverte(self):
        return self.commandes.filter(statut__in=Commande.STATUTS_OUVERTS).first()

    @property
    def etat(self):
        """Reprend les trois états du plan de salle : libre / occupée / à encaisser.

        « À encaisser » veut dire que le client a demandé l'addition — pas que la
        cuisine a fini. Les deux ont longtemps partagé le statut « prête », ce qui
        faisait passer une table en attente de paiement dès qu'un plat sortait.
        """
        commande = self.commande_ouverte
        if commande is None:
            return "libre"
        return "pay" if commande.addition_demandee else "occ"


class Commande(models.Model):
    TYPE_PLACE = "place"
    TYPE_EMPORTER = "emporter"
    TYPE_LIVRAISON = "livraison"
    TYPES = [
        (TYPE_PLACE, "Sur place"),
        (TYPE_EMPORTER, "À emporter"),
        (TYPE_LIVRAISON, "Livraison"),
    ]

    STATUT_OUVERTE = "ouverte"
    STATUT_EN_CUISINE = "en_cuisine"
    STATUT_PRETE = "prete"
    STATUT_EN_ROUTE = "en_route"
    STATUT_LIVREE = "livree"
    STATUT_PAYEE = "payee"
    STATUT_ANNULEE = "annulee"
    STATUTS = [
        (STATUT_OUVERTE, "Ouverte"),
        (STATUT_EN_CUISINE, "En préparation"),
        (STATUT_PRETE, "Prête"),
        (STATUT_EN_ROUTE, "En route"),
        (STATUT_LIVREE, "Livrée"),
        (STATUT_PAYEE, "Payée"),
        (STATUT_ANNULEE, "Annulée"),
    ]
    STATUTS_OUVERTS = [STATUT_OUVERTE, STATUT_EN_CUISINE, STATUT_PRETE, STATUT_EN_ROUTE, STATUT_LIVREE]

    ORIGINE_COMPTOIR = "comptoir"
    ORIGINE_WHATSAPP = "whatsapp"
    ORIGINES = [(ORIGINE_COMPTOIR, "Comptoir"), (ORIGINE_WHATSAPP, "WhatsApp (saisie manuelle)")]

    # Identifiant généré côté client : rend le rejeu d'une vente idempotent
    # si le réseau a coupé avant la réponse du serveur.
    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    numero_recu = models.PositiveIntegerField(null=True, blank=True, unique=True)

    type = models.CharField(max_length=12, choices=TYPES, default=TYPE_PLACE)
    origine = models.CharField(max_length=12, choices=ORIGINES, default=ORIGINE_COMPTOIR)
    statut = models.CharField(max_length=12, choices=STATUTS, default=STATUT_OUVERTE)

    table = models.ForeignKey(
        TableResto, on_delete=models.PROTECT, null=True, blank=True, related_name="commandes"
    )
    couverts = models.PositiveSmallIntegerField(default=1)

    client_nom = models.CharField(max_length=80, blank=True)
    client_telephone = models.CharField(max_length=25, blank=True)
    client_adresse = models.CharField(max_length=160, blank=True)
    livreur = models.ForeignKey(
        Livreur, on_delete=models.PROTECT, null=True, blank=True, related_name="commandes"
    )

    note = models.TextField(blank=True, help_text="Ex. « peu pimenté ». Reporté sur le bon de cuisine.")
    addition_demandee = models.BooleanField(
        default=False,
        help_text="Le client a demandé l'addition. Indépendant de l'avancement en cuisine.",
    )
    ouverte_le = models.DateTimeField(auto_now_add=True)
    cloturee_le = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-ouverte_le"]
        indexes = [
            models.Index(fields=["statut", "ouverte_le"]),
            models.Index(fields=["cloturee_le"]),
        ]

    def __str__(self):
        cible = str(self.table) if self.table else (self.client_nom or self.get_type_display())
        return f"#{self.numero_recu or self.pk} · {cible}"

    @property
    def total(self):
        agrege = self.lignes.aggregate(t=Sum(F("prix_unitaire") * F("quantite")))
        return agrege["t"] or 0

    @property
    def total_paye(self):
        return self.paiements.aggregate(t=Sum("montant"))["t"] or 0

    @property
    def reste_a_payer(self):
        return self.total - self.total_paye


class LigneCommande(models.Model):
    commande = models.ForeignKey(Commande, on_delete=models.CASCADE, related_name="lignes")
    produit = models.ForeignKey(Produit, on_delete=models.PROTECT, related_name="lignes")
    # Le libellé et le prix sont figés à la vente : renommer ou reprix un produit
    # ne doit jamais réécrire l'historique des tickets déjà émis.
    libelle = models.CharField(max_length=80)
    quantite = models.PositiveSmallIntegerField(default=1)
    prix_unitaire = models.PositiveIntegerField()
    note = models.CharField(max_length=120, blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["cree_le", "pk"]
        verbose_name = "ligne de commande"
        verbose_name_plural = "lignes de commande"

    def __str__(self):
        return f"{self.quantite} × {self.libelle}"

    @property
    def montant(self):
        return self.prix_unitaire * self.quantite

    def save(self, *args, **kwargs):
        if not self.libelle:
            self.libelle = self.produit.nom
        super().save(*args, **kwargs)


class Paiement(models.Model):
    """Une commande peut porter plusieurs paiements : c'est le paiement mixte du §5.2."""

    MODE_ESPECES = "especes"
    MODE_TMONEY = "tmoney"
    MODE_FLOOZ = "flooz"
    MODE_CARTE = "carte"
    MODES = [
        (MODE_ESPECES, "Espèces"),
        (MODE_TMONEY, "TMoney"),
        (MODE_FLOOZ, "Flooz"),
        (MODE_CARTE, "Carte bancaire"),
    ]

    commande = models.ForeignKey(Commande, on_delete=models.CASCADE, related_name="paiements")
    mode = models.CharField(max_length=10, choices=MODES, default=MODE_ESPECES)
    montant = models.PositiveIntegerField(help_text="Montant imputé à la commande, en FCFA.")
    montant_recu = models.PositiveIntegerField(
        null=True, blank=True, help_text="Espèces remises par le client, pour calculer la monnaie."
    )
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["cree_le"]

    def __str__(self):
        return f"{self.get_mode_display()} · {self.montant} F"

    @property
    def monnaie_rendue(self):
        if self.mode != self.MODE_ESPECES or self.montant_recu is None:
            return 0
        return max(0, self.montant_recu - self.montant)
