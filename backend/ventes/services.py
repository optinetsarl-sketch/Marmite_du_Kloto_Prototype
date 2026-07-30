"""Règles métier de la vente — tout ce qui doit rester vrai quelle que soit l'IHM."""

from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from catalogue.models import Categorie
from stock.models import MouvementStock

from .models import Commande, LigneCommande, Paiement


def prochain_numero_recu():
    dernier = Commande.objects.aggregate(n=Max("numero_recu"))["n"] or 0
    return dernier + 1


@transaction.atomic
def ajouter_ligne(commande, produit, quantite=1, prix_unitaire=None, note=""):
    if commande.statut in (Commande.STATUT_PAYEE, Commande.STATUT_ANNULEE):
        raise ValidationError("Cette commande est close, on ne peut plus y ajouter de produit.")

    if prix_unitaire is None:
        prix_unitaire = produit.prix_standard
    if prix_unitaire is None:
        raise ValidationError(f"« {produit.nom} » n'a pas de prix standard : saisissez le prix.")

    # Même produit au même prix sur une ardoise ouverte → on incrémente.
    ligne = commande.lignes.filter(produit=produit, prix_unitaire=prix_unitaire, note=note).first()
    if ligne:
        ligne.quantite += quantite
        ligne.save(update_fields=["quantite"])
    else:
        ligne = LigneCommande.objects.create(
            commande=commande,
            produit=produit,
            libelle=produit.nom,
            quantite=quantite,
            prix_unitaire=prix_unitaire,
            note=note,
        )

    envoyer_en_cuisine(commande, produit)
    return ligne


def envoyer_en_cuisine(commande, produit):
    """Un plat commandé part en cuisine sans que personne ait à y penser.

    Y compris quand la cuisine avait déjà marqué la commande « prête » : un plat
    ajouté en cours de repas est du travail neuf, la commande repasse en cours.
    Les boissons ne déclenchent rien, elles ne passent pas par la cuisine.
    """
    if produit.categorie.rayon != Categorie.RAYON_CUISINE:
        return

    if commande.statut in (Commande.STATUT_OUVERTE, Commande.STATUT_PRETE):
        commande.statut = Commande.STATUT_EN_CUISINE
        commande.save(update_fields=["statut"])


@transaction.atomic
def synchroniser_lignes(commande, lignes_voulues):
    """Aligne la commande sur un panier validé, en une transaction.

    `lignes_voulues` : liste de dicts {produit, quantite, prix_unitaire?, note?}.
    C'est le geste « Valider la commande » : le panier construit à l'écran devient
    la commande. On réconcilie plutôt que tout recréer, pour ne pas réinitialiser
    l'état cuisine des plats déjà envoyés — seul le neuf part en cuisine.
    """
    if commande.statut in (Commande.STATUT_PAYEE, Commande.STATUT_ANNULEE):
        raise ValidationError("Cette commande est close, on ne peut plus la modifier.")

    def cle(produit_id, prix, note):
        return (produit_id, prix, note or "")

    existantes = {cle(l.produit_id, l.prix_unitaire, l.note): l for l in commande.lignes.all()}
    voulues = {}
    for entree in lignes_voulues:
        produit = entree["produit"]
        prix = entree.get("prix_unitaire")
        if prix is None:
            prix = produit.prix_standard
        if prix is None:
            raise ValidationError(f"« {produit.nom} » n'a pas de prix : saisissez-le.")
        note = entree.get("note", "") or ""
        k = cle(produit.pk, prix, note)
        # Le même produit/prix/note peut apparaître deux fois : on cumule.
        if k in voulues:
            voulues[k]["quantite"] += entree.get("quantite", 1)
        else:
            voulues[k] = {"produit": produit, "prix": prix, "note": note, "quantite": entree.get("quantite", 1)}

    for k, ligne in existantes.items():
        if k not in voulues:
            ligne.delete()

    for k, v in voulues.items():
        if k in existantes:
            ligne = existantes[k]
            if ligne.quantite != v["quantite"]:
                ligne.quantite = v["quantite"]
                ligne.save(update_fields=["quantite"])
        else:
            LigneCommande.objects.create(
                commande=commande,
                produit=v["produit"],
                libelle=v["produit"].nom,
                quantite=v["quantite"],
                prix_unitaire=v["prix"],
                note=v["note"],
            )
            envoyer_en_cuisine(commande, v["produit"])

    # Déstocker automatiquement les boissons et produits avec suivi de stock
    deverser_stock(commande)
    return commande


@transaction.atomic
def annuler(commande):
    """Annule une commande non payée : la retire de la cuisine et libère la table."""
    if commande.statut == Commande.STATUT_PAYEE:
        raise ValidationError("Une commande déjà encaissée ne peut pas être annulée.")
    # Restituer le stock si la commande avait été déstockée
    commande.mouvements_stock.all().delete()
    commande.statut = Commande.STATUT_ANNULEE
    commande.cloturee_le = timezone.now()
    commande.save(update_fields=["statut", "cloturee_le"])
    return commande


@transaction.atomic
def encaisser(commande, paiements):
    """Clôture financière : encaisse, déstocke le bar, attribue le numéro de reçu.

    `paiements` : liste de dicts {mode, montant, montant_recu?}. Plusieurs entrées
    = paiement mixte (§5.2 du cahier des charges).
    """
    if commande.statut == Commande.STATUT_PAYEE:
        raise ValidationError("Cette commande est déjà encaissée.")
    if not commande.lignes.exists():
        raise ValidationError("Aucun produit sur cette commande.")

    total = commande.total
    encaisse = sum(paiement["montant"] for paiement in paiements)
    if encaisse < total:
        raise ValidationError(
            f"Paiement incomplet : {encaisse} F reçus pour un total de {total} F."
        )

    for paiement in paiements:
        Paiement.objects.create(
            commande=commande,
            mode=paiement.get("mode", Paiement.MODE_ESPECES),
            montant=paiement["montant"],
            montant_recu=paiement.get("montant_recu"),
        )

    deverser_stock(commande)

    commande.numero_recu = prochain_numero_recu()
    commande.statut = Commande.STATUT_PAYEE
    commande.cloturee_le = timezone.now()
    commande.save(update_fields=["numero_recu", "statut", "cloturee_le"])
    return commande


def deverser_stock(commande):
    """Sortie automatique du stock bar. La cuisine est préparée à la commande,
    elle n'a pas de stock de plats à décrémenter (§9)."""
    # Réinitialiser les mouvements de cette commande pour recalculer le panier exact
    commande.mouvements_stock.all().delete()

    for ligne in commande.lignes.select_related("produit"):
        if not ligne.produit.gere_stock:
            continue
        MouvementStock.objects.create(
            produit=ligne.produit,
            motif=MouvementStock.MOTIF_VENTE,
            quantite=-ligne.quantite,
            commande=commande,
        )


def monnaie_a_rendre(commande):
    especes = commande.paiements.filter(mode=Paiement.MODE_ESPECES)
    return sum(paiement.monnaie_rendue for paiement in especes)
