"""Agrégations de gestion. Tout ce qui était codé en dur dans le prototype HTML
(CA du jour, top ventes, revenus par source) se calcule ici depuis la base.
"""

import datetime

from django.db.models import Count, F, Q, Sum
from django.utils import timezone
from django.utils.formats import date_format
from utils.objectid import to_str
from utils.dates import date_range
from rest_framework.decorators import api_view
from rest_framework.response import Response

from stock.models import MouvementStock
from ventes.models import Commande, LigneCommande, Paiement
from caisse.models import Depense, SessionCaisse
from catalogue.models import Categorie, Produit


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
    dt_start, dt_end = date_range(debut, fin)
    return Commande.objects.exclude(statut=Commande.STATUT_ANNULEE).filter(
        Q(cloturee_le__range=(dt_start, dt_end)) | Q(ouverte_le__range=(dt_start, dt_end))
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
        Depense.objects.filter(cree_le__range=date_range(debut, fin), supprime_le__isnull=True).aggregate(t=Sum("montant"))["t"]
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
            motif=MouvementStock.MOTIF_RECEPTION, cree_le__range=date_range(debut, fin)
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
    depenses = Depense.objects.filter(cree_le__range=date_range(debut, fin), supprime_le__isnull=True)
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

    depenses = Depense.objects.filter(cree_le__range=date_range(debut, fin), supprime_le__isnull=True)
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
    if not recettes_par_mode and revenus["total"] > 0:
        recettes_par_mode = [
            {"mode": "especes", "libelle": "Espèces", "montant": revenus["total"]}
        ]

    session = SessionCaisse.courante()
    caisse = None
    if session:
        caisse = {
            "id": to_str(session.pk),
            "ouverte_le": session.ouverte_le,
            "fond_initial": session.fond_initial,
            "recettes_especes": session.recettes_especes,
            "depenses_especes": session.depenses_especes,
            "montant_theorique": session.montant_theorique,
        }

    from ventes.models import Commande
    nb_livraison_ouvertes = Commande.objects.filter(
        type=Commande.TYPE_LIVRAISON
    ).exclude(statut__in=[Commande.STATUT_PAYEE, Commande.STATUT_ANNULEE]).count()

    nb_emporter_ouvertes = Commande.objects.filter(
        type=Commande.TYPE_EMPORTER
    ).exclude(statut__in=[Commande.STATUT_PAYEE, Commande.STATUT_ANNULEE]).count()

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
            "commandes_non_encaissees_livraison": nb_livraison_ouvertes,
            "commandes_non_encaissees_emporter": nb_emporter_ouvertes,
        }
    )


@api_view(["GET"])
def rapport_produits(request):
    debut, fin, libelle = _periode(request)
    return Response({"periode": libelle, "lignes": top_ventes(debut, fin, limite=20)})


@api_view(["GET"])
def historique(request):
    """Regroupe les opérations récentes de caisse, stock et commandes."""
    date_param = request.query_params.get("date")
    if date_param:
        try:
            date = datetime.date.fromisoformat(date_param)
        except ValueError:
            date = timezone.localdate()
    else:
        date = timezone.localdate()

    dt_start, dt_end = date_range(date)
    commandes = Commande.objects.filter(
        Q(ouverte_le__range=date_range(date)) | Q(cloturee_le__range=date_range(date))
    ).select_related("table", "livreur").order_by("-ouverte_le")[:100]

    # On inclut toutes les dépenses du jour : créées ou supprimées ce jour-là
    depenses = Depense.objects.filter(
        Q(cree_le__range=(dt_start, dt_end)) | Q(supprime_le__range=(dt_start, dt_end))
    ).order_by("-cree_le")[:100]

    mouvements = MouvementStock.objects.filter(cree_le__range=date_range(date)).select_related(
        "produit", "fournisseur"
    ).order_by("-cree_le")[:100]

    def commande_data(commande):
        return {
            "id": to_str(commande.pk),
            "type": "commande",
            "timestamp": commande.cloturee_le or commande.ouverte_le,
            "type_libelle": commande.get_type_display(),
            "statut": commande.statut,
            "statut_libelle": dict(Commande.STATUTS).get(commande.statut, commande.statut),
            "table_numero": commande.table.numero if commande.table else None,
            "client_nom": commande.client_nom,
            "livreur_nom": commande.livreur.nom if commande.livreur else None,
            "total": commande.total,
            "origine": commande.origine,
            "note": commande.note,
        }

    def depense_data(depense):
        return {
            "id": to_str(depense.pk),
            "type": "depense",
            "timestamp": depense.cree_le,
            "categorie": depense.categorie,
            "categorie_libelle": depense.get_categorie_display(),
            "mode": depense.mode,
            "montant": depense.montant,
            "description": depense.description,
            "supprimee": depense.supprime_le is not None,
            "supprime_le": depense.supprime_le,
            "supprime_par": depense.supprime_par or '',
        }

    def depense_suppression_data(depense):
        """Génère un événement distinct pour la suppression d'une dépense."""
        return {
            "id": f"{to_str(depense.pk)}_sup",
            "type": "depense_supprimee",
            "timestamp": depense.supprime_le,
            "categorie": depense.categorie,
            "categorie_libelle": depense.get_categorie_display(),
            "mode": depense.mode,
            "montant": depense.montant,
            "description": depense.description,
            "supprime_par": depense.supprime_par or '',
        }

    def mouvement_data(mouvement):
        return {
            "id": to_str(mouvement.pk),
            "type": "mouvement_stock",
            "timestamp": mouvement.cree_le,
            "produit": mouvement.produit.nom,
            "motif": mouvement.motif,
            "motif_libelle": mouvement.get_motif_display(),
            "quantite": mouvement.quantite,
            "fournisseur_nom": mouvement.fournisseur.nom if mouvement.fournisseur else None,
            "commentaire": mouvement.commentaire,
        }

    # Ajout d'un event "suppression" séparé pour les dépenses supprimées ce jour
    suppressions = [
        depense_suppression_data(d)
        for d in depenses
        if d.supprime_le is not None and dt_start <= d.supprime_le <= dt_end
    ]

    evenements = [
        *map(commande_data, commandes),
        *map(depense_data, depenses),
        *suppressions,
        *map(mouvement_data, mouvements),
    ]
    evenements.sort(key=lambda item: item["timestamp"], reverse=True)

    return Response(
        {
            "periode": date_format(date, "j F Y"),
            "date": date.isoformat(),
            "commandes": [commande_data(c) for c in commandes],
            "depenses": [depense_data(d) for d in depenses],
            "mouvements_stock": [mouvement_data(m) for m in mouvements],
            "evenements": evenements,
        }
    )
