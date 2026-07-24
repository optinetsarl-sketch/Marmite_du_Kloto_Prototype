"""Agrégations de gestion. Tout ce qui était codé en dur dans le prototype HTML
(CA du jour, top ventes, revenus par source) se calcule ici depuis la base.
"""

import datetime

from django.db.models import Count, F, Sum
from django.utils import timezone
from django.utils.formats import date_format
from rest_framework.decorators import api_view
from rest_framework.response import Response

from caisse.models import Depense, SessionCaisse
from catalogue.models import Categorie, Produit
from stock.models import MouvementStock
from ventes.models import Commande, LigneCommande, Paiement


def _periode(request):
    """Renvoie (debut, fin, libelle) d'après ?periode=jour|semaine|mois&date=YYYY-MM-DD."""
    brut = request.query_params.get("date")
    jour = datetime.date.fromisoformat(brut) if brut else timezone.localdate()
    periode = request.query_params.get("periode", "jour")

    # date_format respecte LANGUAGE_CODE, contrairement à strftime('%B') qui
    # suit la locale système et renvoie « July » au lieu de « juillet ».
    if periode == "semaine":
        debut = jour - datetime.timedelta(days=jour.weekday())
        fin = debut + datetime.timedelta(days=6)
        libelle = f"Semaine du {debut:%d} au {date_format(fin, 'j F Y')}"
    elif periode == "mois":
        debut = jour.replace(day=1)
        mois_suivant = (debut + datetime.timedelta(days=32)).replace(day=1)
        fin = mois_suivant - datetime.timedelta(days=1)
        libelle = f"Mois de {date_format(debut, 'F Y')}"
    else:
        debut = fin = jour
        libelle = f"Journée du {date_format(jour, 'j F Y')}"

    return debut, fin, libelle


def _commandes_payees(debut, fin):
    return Commande.objects.filter(
        statut=Commande.STATUT_PAYEE, cloturee_le__date__range=(debut, fin)
    )


def _montant(queryset):
    return queryset.aggregate(t=Sum(F("prix_unitaire") * F("quantite")))["t"] or 0


def _revenus_par_source(debut, fin):
    """Bar / cuisine / livraison. Une commande livrée compte en livraison quel
    que soit son contenu ; le reste se ventile par rayon de produit."""
    lignes = LigneCommande.objects.filter(commande__in=_commandes_payees(debut, fin))

    livraison = _montant(lignes.filter(commande__type=Commande.TYPE_LIVRAISON))
    sur_site = lignes.exclude(commande__type=Commande.TYPE_LIVRAISON)
    bar = _montant(sur_site.filter(produit__categorie__rayon=Categorie.RAYON_BAR))
    cuisine = _montant(sur_site.filter(produit__categorie__rayon=Categorie.RAYON_CUISINE))

    return {
        "bar": bar,
        "cuisine": cuisine,
        "livraison": livraison,
        "total": bar + cuisine + livraison,
    }


def top_ventes(debut, fin, limite=5):
    return list(
        LigneCommande.objects.filter(commande__in=_commandes_payees(debut, fin))
        .values("libelle")
        # L'alias ne doit pas s'appeler « quantite » : il masquerait le champ
        # du même nom dans l'agrégat suivant.
        .annotate(vendu=Sum("quantite"), ca=Sum(F("prix_unitaire") * F("quantite")))
        .order_by("-vendu")[:limite]
    )


@api_view(["GET"])
def tableau_de_bord(request):
    debut, fin, libelle = _periode(request)
    revenus = _revenus_par_source(debut, fin)
    depenses_total = (
        Depense.objects.filter(cree_le__date__range=(debut, fin)).aggregate(t=Sum("montant"))["t"]
        or 0
    )

    stocks = MouvementStock.stocks_par_produit()
    alertes = []
    for produit in Produit.objects.filter(gere_stock=True, actif=True):
        niveau = stocks.get(produit.pk, 0)
        if niveau <= produit.seuil_alerte:
            alertes.append(
                {
                    "produit": produit.nom,
                    "stock": niveau,
                    "etat": "rupture" if niveau <= 0 else "bas",
                }
            )
    alertes.sort(key=lambda ligne: ligne["stock"])

    session = SessionCaisse.courante()

    return Response(
        {
            "periode": libelle,
            "revenus": revenus,
            "depenses": depenses_total,
            "resultat_net": revenus["total"] - depenses_total,
            "nb_commandes": _commandes_payees(debut, fin).count(),
            "top_ventes": top_ventes(debut, fin),
            "alertes_stock": alertes[:12],
            "caisse_ouverte": session is not None,
            "montant_theorique_caisse": session.montant_theorique if session else None,
        }
    )


@api_view(["GET"])
def rapport_bar(request):
    """Par boisson : reçu, vendu, restant, CA."""
    debut, fin, libelle = _periode(request)

    ventes = {
        ligne["produit_id"]: ligne
        for ligne in LigneCommande.objects.filter(
            commande__in=_commandes_payees(debut, fin),
            produit__categorie__rayon=Categorie.RAYON_BAR,
        )
        .values("produit_id")
        .annotate(vendu=Sum("quantite"), ca=Sum(F("prix_unitaire") * F("quantite")))
    }
    receptions = {
        ligne["produit_id"]: ligne["recu"]
        for ligne in MouvementStock.objects.filter(
            motif=MouvementStock.MOTIF_RECEPTION, cree_le__date__range=(debut, fin)
        )
        .values("produit_id")
        .annotate(recu=Sum("quantite"))
    }
    stocks = MouvementStock.stocks_par_produit()

    lignes = []
    for produit in Produit.objects.filter(gere_stock=True).select_related("categorie"):
        vente = ventes.get(produit.pk)
        recu = receptions.get(produit.pk, 0)
        if not vente and not recu:
            continue
        lignes.append(
            {
                "produit": produit.nom,
                "categorie": produit.categorie.nom,
                "recu": recu,
                "vendu": vente["vendu"] if vente else 0,
                "restant": stocks.get(produit.pk, 0),
                "ca": vente["ca"] if vente else 0,
            }
        )
    lignes.sort(key=lambda item: item["ca"], reverse=True)
    return Response(
        {"periode": libelle, "lignes": lignes, "ca_total": sum(l["ca"] for l in lignes)}
    )


@api_view(["GET"])
def rapport_cuisine(request):
    debut, fin, libelle = _periode(request)
    lignes = list(
        LigneCommande.objects.filter(
            commande__in=_commandes_payees(debut, fin),
            produit__categorie__rayon=Categorie.RAYON_CUISINE,
        )
        .values("libelle")
        .annotate(vendu=Sum("quantite"), ca=Sum(F("prix_unitaire") * F("quantite")))
        .order_by("-ca")
    )
    return Response(
        {"periode": libelle, "lignes": lignes, "ca_total": sum(l["ca"] for l in lignes)}
    )


@api_view(["GET"])
def rapport_livraisons(request):
    debut, fin, libelle = _periode(request)
    lignes = list(
        _commandes_payees(debut, fin)
        .filter(type=Commande.TYPE_LIVRAISON)
        .values(livreur_nom=F("livreur__nom"))
        .annotate(
            livraisons=Count("id", distinct=True),
            ca=Sum(F("lignes__prix_unitaire") * F("lignes__quantite")),
        )
        .order_by("-ca")
    )
    return Response({"periode": libelle, "lignes": lignes})


@api_view(["GET"])
def rapport_depenses(request):
    debut, fin, libelle = _periode(request)
    depenses = Depense.objects.filter(cree_le__date__range=(debut, fin))
    par_categorie = list(
        depenses.values("categorie").annotate(montant=Sum("montant")).order_by("-montant")
    )
    libelles = dict(Depense.CATEGORIES)
    for ligne in par_categorie:
        ligne["libelle"] = libelles.get(ligne["categorie"], ligne["categorie"])
    return Response(
        {
            "periode": libelle,
            "par_categorie": par_categorie,
            "detail": list(depenses.values("categorie", "description", "montant", "mode", "cree_le")),
            "total": depenses.aggregate(t=Sum("montant"))["t"] or 0,
        }
    )


@api_view(["GET"])
def rapport_revenus(request):
    debut, fin, libelle = _periode(request)
    detail_bar = list(
        LigneCommande.objects.filter(
            commande__in=_commandes_payees(debut, fin),
            produit__categorie__rayon=Categorie.RAYON_BAR,
        )
        .values(categorie=F("produit__categorie__nom"))
        .annotate(ca=Sum(F("prix_unitaire") * F("quantite")))
        .order_by("-ca")
    )
    return Response(
        {"periode": libelle, "revenus": _revenus_par_source(debut, fin), "detail_bar": detail_bar}
    )


@api_view(["GET"])
def rapport_cloture(request):
    """Tout ce qu'il faut pour l'arrêté de fin de journée, en un seul appel :
    recettes, dépenses, résultat et état du tiroir-caisse."""
    debut, fin, libelle = _periode(request)
    revenus = _revenus_par_source(debut, fin)

    depenses = Depense.objects.filter(cree_le__date__range=(debut, fin))
    libelles_depense = dict(Depense.CATEGORIES)
    par_categorie = [
        {"categorie": ligne["categorie"], "libelle": libelles_depense.get(ligne["categorie"], ""), "montant": ligne["montant"]}
        for ligne in depenses.values("categorie").annotate(montant=Sum("montant")).order_by("-montant")
    ]
    total_depenses = depenses.aggregate(t=Sum("montant"))["t"] or 0

    libelles_mode = dict(Paiement.MODES)
    recettes_par_mode = [
        {"mode": ligne["mode"], "libelle": libelles_mode.get(ligne["mode"], ""), "montant": ligne["montant"]}
        for ligne in Paiement.objects.filter(commande__in=_commandes_payees(debut, fin))
        .values("mode")
        .annotate(montant=Sum("montant"))
        .order_by("-montant")
    ]

    session = SessionCaisse.courante()
    caisse = None
    if session:
        caisse = {
            "id": session.pk,
            "ouverte_le": session.ouverte_le,
            "fond_initial": session.fond_initial,
            "recettes_especes": session.recettes_especes,
            "depenses_especes": session.depenses_especes,
            "montant_theorique": session.montant_theorique,
        }

    return Response(
        {
            "periode": libelle,
            "revenus": revenus,
            "depenses_par_categorie": par_categorie,
            "total_depenses": total_depenses,
            "resultat_net": revenus["total"] - total_depenses,
            "recettes_par_mode": recettes_par_mode,
            "nb_commandes": _commandes_payees(debut, fin).count(),
            "caisse": caisse,
        }
    )


@api_view(["GET"])
def rapport_produits(request):
    debut, fin, libelle = _periode(request)
    return Response({"periode": libelle, "lignes": top_ventes(debut, fin, limite=20)})
