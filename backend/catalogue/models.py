from django.db import models


class Famille(models.Model):
    """Regroupement au-dessus des catégories : Alcools, Sans alcool, Restauration…

    C'est le « type de catalogue ». Une famille rassemble plusieurs catégories,
    chaque catégorie garde ses produits. C'est un axe de classement distinct du
    rayon (Bar/Cuisine), qui, lui, pilote le stock et la cuisine.
    """

    nom = models.CharField(max_length=60, unique=True)
    icone = models.CharField(
        max_length=40, blank=True, help_text="Nom d'icône Tabler, sans le préfixe « ti- »."
    )
    ordre = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["ordre", "nom"]
        verbose_name = "famille"
        verbose_name_plural = "familles"

    def __str__(self):
        return self.nom


class Categorie(models.Model):
    """Bière, Sucrerie, Eau, Vin, Wisky, Énergisante… et la catégorie Cuisine."""

    RAYON_BAR = "bar"
    RAYON_CUISINE = "cuisine"
    RAYONS = [(RAYON_BAR, "Bar"), (RAYON_CUISINE, "Cuisine")]

    nom = models.CharField(max_length=60, unique=True)
    rayon = models.CharField(max_length=10, choices=RAYONS, default=RAYON_BAR)
    famille = models.ForeignKey(
        Famille,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="categories",
        help_text="Regroupement d'affichage. Supprimer une famille délie ses catégories, sans les perdre.",
    )
    icone = models.CharField(
        max_length=40, blank=True, help_text="Nom d'icône Tabler, sans le préfixe « ti- »."
    )
    ordre = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["ordre", "nom"]
        verbose_name = "catégorie"
        verbose_name_plural = "catégories"

    def __str__(self):
        return self.nom


class Produit(models.Model):
    """Boisson du bar ou plat de la cuisine.

    Les deux vivent dans la même table : un plat est simplement un produit à
    prix libre et sans gestion de stock (cf. §9 du cahier des charges — le prix
    d'un plat est saisi à chaque commande).
    """

    nom = models.CharField(max_length=80, unique=True)
    categorie = models.ForeignKey(Categorie, on_delete=models.PROTECT, related_name="produits")
    prix_standard = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="En FCFA. Vide pour les plats, dont le prix est saisi à la vente.",
    )
    prix_libre = models.BooleanField(
        default=False, help_text="Le prix est demandé au caissier à chaque ligne de commande."
    )
    gere_stock = models.BooleanField(
        default=True, help_text="Faux pour la cuisine, préparée à la commande."
    )
    seuil_alerte = models.PositiveSmallIntegerField(
        default=12, help_text="En dessous de ce stock, le produit est signalé « Bas »."
    )
    photo = models.ImageField(upload_to="produits/", null=True, blank=True)
    actif = models.BooleanField(default=True)

    class Meta:
        ordering = ["categorie__ordre", "nom"]

    def __str__(self):
        return self.nom

    @property
    def stock(self):
        """Stock restant = somme algébrique des mouvements. Jamais stocké en dur."""
        if not self.gere_stock:
            return None
        from stock.models import MouvementStock

        return MouvementStock.stock_de(self)

    @property
    def etat_stock(self):
        niveau = self.stock
        if niveau is None:
            return None
        if niveau <= 0:
            return "rupture"
        if niveau <= self.seuil_alerte:
            return "bas"
        return "ok"


class Configuration(models.Model):
    """Stockage clé-valeur pour des configurations globales (ex: activation licence)."""

    cle = models.CharField(max_length=100, unique=True)
    valeur = models.TextField(blank=True)

    class Meta:
        verbose_name = "configuration"
        verbose_name_plural = "configurations"

    def __str__(self):
        return f"{self.cle} = {self.valeur}"
