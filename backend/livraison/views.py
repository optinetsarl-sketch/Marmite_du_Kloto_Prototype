from django.db.models import Count, F, Q, Sum
from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ventes.models import Commande, Paiement

from .models import Livreur


class LivreurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Livreur
        fields = ["id", "nom", "telephone", "actif"]


class LivreurViewSet(viewsets.ModelViewSet):
    queryset = Livreur.objects.all()
    serializer_class = LivreurSerializer
    filterset_fields = ["actif"]

    @action(detail=False, methods=["get"])
    def comptes_du_jour(self, request):
        """« Kofi doit remettre 45 000 FCFA pour 5 livraisons » (§7).

        Deux colonnes bien distinctes, et c'est tout l'intérêt du suivi :

        - « à remettre » : commandes livrées dont l'argent n'est pas encore
          rentré en caisse. C'est la somme que le livreur a dans la poche.
        - « déjà remis » : livraisons encaissées en espèces aujourd'hui.

        Le mobile money n'apparaît pas dans « déjà remis » : il arrive
        directement sur le compte, le livreur n'a rien à rapporter. Il compte
        en revanche dans les courses du jour, pour qu'un livreur payé
        uniquement en TMoney ne disparaisse pas du tableau de fin de journée.
        """
        jour = request.query_params.get("date") or timezone.localdate()

        comptes = {}

        def ligne(livreur_id, nom):
            return comptes.setdefault(
                livreur_id,
                {
                    "livreur_id": livreur_id,
                    "livreur_nom": nom,
                    "courses_du_jour": 0,
                    "courses_en_attente": 0,
                    "a_remettre": 0,
                    "courses_remises": 0,
                    "deja_remis": 0,
                },
            )

        courses = (
            Commande.objects.filter(
                type=Commande.TYPE_LIVRAISON,
                statut__in=[Commande.STATUT_LIVREE, Commande.STATUT_PAYEE],
                livreur__isnull=False,
            )
            .values("livreur_id", nom=F("livreur__nom"))
            .annotate(total=Count("id", distinct=True))
        )
        for entree in courses:
            ligne(entree["livreur_id"], entree["nom"])["courses_du_jour"] = entree["total"]

        en_attente = (
            Commande.objects.filter(
                type=Commande.TYPE_LIVRAISON,
                statut=Commande.STATUT_LIVREE,
                livreur__isnull=False,
            )
            .values("livreur_id", nom=F("livreur__nom"))
            .annotate(
                courses=Count("id", distinct=True),
                montant=Sum(F("lignes__prix_unitaire") * F("lignes__quantite")),
            )
        )
        for entree in en_attente:
            compte = ligne(entree["livreur_id"], entree["nom"])
            compte["courses_en_attente"] = entree["courses"]
            compte["a_remettre"] = entree["montant"] or 0

        remis = (
            Paiement.objects.filter(
                mode=Paiement.MODE_ESPECES,
                commande__type=Commande.TYPE_LIVRAISON,
                commande__statut=Commande.STATUT_PAYEE,
                commande__livreur__isnull=False,
                commande__cloturee_le__date=jour,
            )
            .values(livreur_id=F("commande__livreur_id"), nom=F("commande__livreur__nom"))
            .annotate(courses=Count("commande", distinct=True), montant=Sum("montant"))
        )
        for entree in remis:
            compte = ligne(entree["livreur_id"], entree["nom"])
            compte["courses_remises"] = entree["courses"]
            compte["deja_remis"] = entree["montant"] or 0

        return Response(
            sorted(comptes.values(), key=lambda c: (-c["a_remettre"], -c["deja_remis"]))
        )

    @action(detail=True, methods=["get"])
    def detail_du_jour(self, request, pk=None):
        """Ce que ce livreur a transporté aujourd'hui, course par course et plat
        par plat. Sert à vérifier une contestation : « je n'ai jamais eu ce poulet »."""
        livreur = self.get_object()
        jour = request.query_params.get("date") or timezone.localdate()

        courses = (
            Commande.objects.filter(
                livreur=livreur,
                type=Commande.TYPE_LIVRAISON,
                statut__in=[Commande.STATUT_LIVREE, Commande.STATUT_PAYEE],
            )
            .filter(Q(cloturee_le__date=jour) | Q(cloturee_le__isnull=True))
            .prefetch_related("lignes__produit__categorie")
            .order_by("ouverte_le")
        )

        detail = []
        plats = {}
        for course in courses:
            lignes = []
            for ligne in course.lignes.all():
                lignes.append(
                    {
                        "libelle": ligne.libelle,
                        "quantite": ligne.quantite,
                        "montant": ligne.montant,
                        "rayon": ligne.produit.categorie.rayon,
                    }
                )
                cumul = plats.setdefault(ligne.libelle, {"libelle": ligne.libelle, "quantite": 0, "montant": 0})
                cumul["quantite"] += ligne.quantite
                cumul["montant"] += ligne.montant

            detail.append(
                {
                    "id": course.pk,
                    "client_nom": course.client_nom,
                    "client_adresse": course.client_adresse,
                    "statut": course.statut,
                    "encaissee": course.statut == Commande.STATUT_PAYEE,
                    "total": course.total,
                    "heure": course.ouverte_le,
                    "lignes": lignes,
                }
            )

        return Response(
            {
                "livreur": livreur.nom,
                "courses": detail,
                "recapitulatif": sorted(plats.values(), key=lambda p: -p["quantite"]),
                "total": sum(course["total"] for course in detail),
            }
        )
