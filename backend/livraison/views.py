from django.db.models import Count, F, Q, Sum
from django.utils import timezone
from utils.dates import date_range
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ventes.models import Commande, Paiement

from .models import Livreur


class LivreurSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)

    class Meta:
        model = Livreur
        fields = ["id", "nom", "telephone", "actif"]


class LivreurViewSet(viewsets.ModelViewSet):
    queryset = Livreur.objects.all()
    serializer_class = LivreurSerializer
    filterset_fields = ["actif"]

    @action(detail=False, methods=["get"])
    def comptes_du_jour(self, request):
        date_param = request.query_params.get("date")
        if date_param:
            try:
                from datetime import datetime
                jour = datetime.strptime(date_param, "%Y-%m-%d").date()
            except ValueError:
                jour = timezone.localdate()
        else:
            jour = timezone.localdate()

        comptes = {}

        def ligne(livreur_id, nom):
            key = livreur_id if livreur_id is not None else "__sans__"
            nom_final = nom if livreur_id is not None else "⚠ Non attribué"
            return comptes.setdefault(
                key,
                {
                    "livreur_id": key,
                    "livreur_nom": nom_final,
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
            )
            .filter(Q(cloturee_le__range=date_range(jour)) | Q(ouverte_le__range=date_range(jour)))
            .values("livreur_id", nom=F("livreur__nom"))
            .annotate(total=Count("id", distinct=True))
        )
        for entree in courses:
            ligne(entree["livreur_id"], entree["nom"])["courses_du_jour"] = entree["total"]

        en_attente = (
            Commande.objects.filter(
                type=Commande.TYPE_LIVRAISON,
                statut=Commande.STATUT_LIVREE,
            )
            .filter(Q(cloturee_le__range=date_range(jour)) | Q(ouverte_le__range=date_range(jour)))
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
            )
            .filter(Q(commande__cloturee_le__range=date_range(jour)) | Q(cree_le__range=date_range(jour)))
            .values(livreur_id=F("commande__livreur_id"), nom=F("commande__livreur__nom"))
            .annotate(courses=Count("commande", distinct=True), montant=Sum("montant"))
        )
        for entree in remis:
            compte = ligne(entree["livreur_id"], entree["nom"])
            compte["courses_remises"] = entree["courses"]
            compte["deja_remis"] = entree["montant"] or 0

        return Response(
            sorted(comptes.values(), key=lambda c: (c["livreur_id"] == "__sans__", -c["a_remettre"], -c["deja_remis"]))
        )

    @action(detail=True, methods=["get"])
    def detail_du_jour(self, request, pk=None):
        """Ce que ce livreur (ou les courses non attribuées) a transporté à la date sélectionnée."""
        date_param = request.query_params.get("date")
        if date_param:
            try:
                from datetime import datetime
                jour = datetime.strptime(date_param, "%Y-%m-%d").date()
            except ValueError:
                jour = timezone.localdate()
        else:
            jour = timezone.localdate()

        if str(pk) in ["__sans__", "sans_attribution", "0", "None"]:
            livreur_nom = "⚠ Non attribué"
            courses = (
                Commande.objects.filter(
                    livreur__isnull=True,
                    type=Commande.TYPE_LIVRAISON,
                    statut__in=[Commande.STATUT_LIVREE, Commande.STATUT_PAYEE],
                )
                .filter(Q(cloturee_le__range=date_range(jour)) | Q(ouverte_le__range=date_range(jour)))
                .prefetch_related("lignes__produit__categorie")
                .order_by("-cloturee_le", "-ouverte_le")
            )
        else:
            livreur = self.get_object()
            livreur_nom = livreur.nom
            courses = (
                Commande.objects.filter(
                    livreur=livreur,
                    type=Commande.TYPE_LIVRAISON,
                    statut__in=[Commande.STATUT_LIVREE, Commande.STATUT_PAYEE],
                )
                .filter(Q(cloturee_le__range=date_range(jour)) | Q(ouverte_le__range=date_range(jour)))
                .prefetch_related("lignes__produit__categorie")
                .order_by("-cloturee_le", "-ouverte_le")
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
                        "rayon": ligne.produit.categorie.rayon if ligne.produit and ligne.produit.categorie else "cuisine",
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
                "livreur": livreur_nom,
                "courses": detail,
                "recapitulatif": sorted(plats.values(), key=lambda p: -p["quantite"]),
                "total": sum(course["total"] for course in detail),
            }
        )
